import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import * as moment from 'moment-timezone';
import { ConfirmationConfig } from './entities/confirmation-config.entity';
import { PendingConfirmation, ConfirmationStatus } from './entities/pending-confirmation.entity';
import { CreateConfirmationConfigDto } from './dto/create-confirmation-config.dto';
import { UpdateConfirmationConfigDto } from './dto/update-confirmation-config.dto';
import { ClientsService } from '../clients/clients.service';
import { ConfirmationAdapterFactory } from './adapters/confirmation-adapter.factory';
import { NormalizedAppointmentData } from './adapters/confirmation-adapter.interface';

@Injectable()
export class AppointmentConfirmationsService {
  private readonly logger = new Logger(AppointmentConfirmationsService.name);

  constructor(
    @InjectRepository(ConfirmationConfig)
    private configRepository: Repository<ConfirmationConfig>,
    @InjectRepository(PendingConfirmation)
    private pendingRepository: Repository<PendingConfirmation>,
    private clientsService: ClientsService,
    private adapterFactory: ConfirmationAdapterFactory,
  ) {}

  /**
   * Helper para agregar delay entre peticiones (rate limiting)
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper para hacer llamadas HTTP con retry automático en caso de error 429
   */
  private async makeGHLRequest<T>(requestFn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;

        if (error.response) {
          this.logger.error(`🔴 Error de GHL (Status ${statusCode}):`);
          this.logger.error(`   URL: ${error.config?.url}`);
          this.logger.error(`   Method: ${error.config?.method?.toUpperCase()}`);
          this.logger.error(`   Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
          this.logger.error(
            `   Response Headers: ${JSON.stringify(error.response.headers, null, 2)}`,
          );
        }

        if (statusCode === 429 && attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000;
          this.logger.warn(
            `⚠️ Rate limit (429) - Reintentando en ${waitTime}ms (intento ${attempt + 1}/${maxRetries})`,
          );
          await this.sleep(waitTime);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  async createConfig(
    clientId: string,
    dto: CreateConfirmationConfigDto,
  ): Promise<ConfirmationConfig> {
    await this.clientsService.findOne(clientId);

    const existingCount = await this.configRepository.count({
      where: { clientId },
    });

    if (existingCount >= 3) {
      throw new BadRequestException('Solo se permiten hasta 3 configuraciones de confirmación');
    }

    const existingOrder = await this.configRepository.findOne({
      where: { clientId, order: dto.order },
    });

    if (existingOrder) {
      throw new ConflictException(`Ya existe una configuración con orden ${dto.order}`);
    }

    const config = this.configRepository.create({
      clientId,
      name: dto.name,
      daysBeforeAppointment: dto.daysBeforeAppointment,
      timeToSend: dto.timeToSend,
      ghlCalendarId: dto.ghlCalendarId,
      appointmentStates: dto.appointmentStates ? dto.appointmentStates.join(',') : '7',
      isEnabled: dto.isEnabled ?? true,
      order: dto.order,
    });

    return await this.configRepository.save(config);
  }

  async getConfigs(clientId: string): Promise<ConfirmationConfig[]> {
    return await this.configRepository.find({
      where: { clientId },
      order: { order: 'ASC' },
    });
  }

  async getConfig(clientId: string, configId: string): Promise<ConfirmationConfig> {
    const config = await this.configRepository.findOne({
      where: { id: configId, clientId },
    });

    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }

    return config;
  }

  async updateConfig(
    clientId: string,
    configId: string,
    dto: UpdateConfirmationConfigDto,
  ): Promise<ConfirmationConfig> {
    const config = await this.getConfig(clientId, configId);

    if (dto.order && dto.order !== config.order) {
      const existingOrder = await this.configRepository.findOne({
        where: { clientId, order: dto.order },
      });

      if (existingOrder && existingOrder.id !== configId) {
        throw new ConflictException(`Ya existe una configuración con orden ${dto.order}`);
      }
    }

    if (dto.name !== undefined) config.name = dto.name;
    if (dto.daysBeforeAppointment !== undefined)
      config.daysBeforeAppointment = dto.daysBeforeAppointment;
    if (dto.timeToSend !== undefined) config.timeToSend = dto.timeToSend;
    if (dto.ghlCalendarId !== undefined) config.ghlCalendarId = dto.ghlCalendarId;
    if (dto.appointmentStates !== undefined)
      config.appointmentStates = dto.appointmentStates.join(',');
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    if (dto.order !== undefined) config.order = dto.order;

    return await this.configRepository.save(config);
  }

  async deleteConfig(clientId: string, configId: string): Promise<void> {
    const config = await this.getConfig(clientId, configId);
    await this.configRepository.remove(config);
  }

  // ============================================
  // PROCESAMIENTO DE CONFIRMACIONES
  // ============================================

  /**
   * Cron job que se ejecuta cada hora para verificar si hay confirmaciones por procesar
   * (Backup/Fallback para confirmaciones que no se procesaron automáticamente)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkPendingConfirmations() {
    this.logger.log('🔄 Verificando confirmaciones pendientes...');

    const now = new Date();
    const pending = await this.pendingRepository.find({
      where: {
        status: ConfirmationStatus.PENDING,
        scheduledFor: LessThan(now),
      },
      relations: ['confirmationConfig', 'client'],
      take: 10,
    });

    this.logger.log(`📋 Encontradas ${pending.length} confirmaciones pendientes para procesar`);

    for (const confirmation of pending) {
      await this.processConfirmation(confirmation);

      if (pending.indexOf(confirmation) < pending.length - 1) {
        this.logger.log('⏱️ Esperando 600ms antes de procesar siguiente (rate limit GHL)...');
        await this.sleep(600);
      }
    }
  }

  /**
   * Cron job que se ejecuta cada 30 minutos para obtener y confirmar citas automáticamente
   * Este es el flujo principal de confirmación automática.
   * Funciona con cualquier plataforma (Dentalink, Reservo, etc.) gracias al adapter pattern.
   */
  @Cron('*/30 * * * *')
  async autoFetchAndConfirmAppointments() {
    this.logger.log('🤖 Iniciando proceso automático de confirmación de citas...');

    try {
      const activeConfigs = await this.getAllActiveConfigs();

      if (activeConfigs.length === 0) {
        this.logger.log('ℹ️ No hay configuraciones activas para procesar');
        return;
      }

      this.logger.log(`📋 Encontradas ${activeConfigs.length} configuraciones activas`);

      for (const config of activeConfigs) {
        try {
          const client = config.client;
          const timezone = client.timezone || 'America/Santiago';
          const now = moment.tz(timezone);

          const [configHour, configMinute] = config.timeToSend.split(':').map(Number);
          const currentHour = now.hour();
          const currentMinute = now.minute();

          const isTimeToExecute =
            currentHour === configHour &&
            currentMinute >= configMinute &&
            currentMinute < configMinute + 30;

          if (isTimeToExecute) {
            const adapter = this.adapterFactory.getAdapterForClient(client);
            this.logger.log(
              `⏰ Es hora de procesar "${config.name}" para cliente ${client.name} (${client.id}) [${adapter.platform}]`,
            );
            this.logger.log(
              `   🕐 Hora configurada: ${config.timeToSend}, Hora actual: ${now.format('HH:mm')}`,
            );

            // Obtener y almacenar citas (el adapter correcto se resuelve automáticamente)
            const result = await this.fetchAndStoreAppointments(
              client.id,
              config.id,
              undefined,
              true,
            );

            this.logger.log(`   ✅ ${result.stored} citas almacenadas para confirmación inmediata`);

            if (result.stored > 0) {
              this.logger.log(`   🚀 Procesando todas las confirmaciones...`);
              const processResult = await this.processAllPendingConfirmationsNow(client.id);
              this.logger.log(
                `   ✅ Confirmaciones completadas: ${processResult.completed}/${processResult.processed}`,
              );

              if (processResult.failed > 0) {
                this.logger.warn(`   ⚠️ Confirmaciones fallidas: ${processResult.failed}`);
              }
            }
          } else {
            this.logger.debug(
              `⏭️ Saltando config "${config.name}" (${client.name}) - ` +
                `Hora actual: ${now.format('HH:mm')}, Hora configurada: ${config.timeToSend}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `❌ Error procesando config "${config.name}" (${config.id}): ${error.message}`,
          );
        }
      }

      this.logger.log('🤖 Proceso automático completado');
    } catch (error) {
      this.logger.error(`❌ Error en proceso automático: ${error.message}`);
    }
  }

  /**
   * Obtiene todas las configuraciones activas con sus clientes
   */
  private async getAllActiveConfigs(): Promise<ConfirmationConfig[]> {
    return await this.configRepository.find({
      where: { isEnabled: true },
      relations: ['client'],
    });
  }

  /**
   * Procesa TODAS las confirmaciones pendientes de un cliente (sin límite de 10)
   * Procesa en batches de 10 respetando rate limits hasta completar todas
   */
  async processAllPendingConfirmationsNow(
    clientId: string,
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(`🔄 Procesando TODAS las confirmaciones pendientes para cliente ${clientId}`);

    let totalProcessed = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let hasMore = true;

    while (hasMore) {
      const pending = await this.pendingRepository.find({
        where: {
          clientId,
          status: ConfirmationStatus.PENDING,
        },
        relations: ['confirmationConfig', 'client'],
        take: 10,
      });

      if (pending.length === 0) {
        hasMore = false;
        break;
      }

      this.logger.log(`📦 Procesando batch de ${pending.length} confirmaciones...`);

      for (const confirmation of pending) {
        try {
          await this.processConfirmation(confirmation);
          totalProcessed++;

          const updated = await this.pendingRepository.findOne({
            where: { id: confirmation.id },
          });

          if (updated.status === ConfirmationStatus.COMPLETED) {
            totalCompleted++;
          } else if (updated.status === ConfirmationStatus.FAILED) {
            totalFailed++;
          }
        } catch (error) {
          totalFailed++;
          this.logger.error(
            `❌ Error procesando confirmación ${confirmation.id}: ${error.message}`,
          );
        }

        if (pending.indexOf(confirmation) < pending.length - 1) {
          await this.sleep(600);
        }
      }

      if (pending.length < 10) {
        hasMore = false;
      } else {
        this.logger.log('⏱️ Esperando 1 segundo antes del siguiente batch...');
        await this.sleep(1000);
      }
    }

    this.logger.log(
      `✅ Procesamiento completo: ${totalProcessed} procesadas, ` +
        `${totalCompleted} completadas, ${totalFailed} fallidas`,
    );

    return {
      processed: totalProcessed,
      completed: totalCompleted,
      failed: totalFailed,
    };
  }

  /**
   * Obtiene citas de la plataforma correspondiente y crea registros pendientes.
   * Funciona con cualquier plataforma gracias al adapter pattern.
   */
  async fetchAndStoreAppointments(
    clientId: string,
    configId?: string,
    targetDate?: string,
    immediateConfirmation: boolean = false,
  ): Promise<{ stored: number; appointments: any[] }> {
    const client = await this.clientsService.findOne(clientId);
    const adapter = this.adapterFactory.getAdapterForClient(client);

    this.logger.log(`📥 Obteniendo citas de ${adapter.platform} para cliente ${client.name}`);

    // Obtener configuraciones a procesar
    let configs: ConfirmationConfig[];
    if (configId) {
      const config = await this.getConfig(clientId, configId);
      configs = [config];
    } else {
      configs = await this.getConfigs(clientId);
      configs = configs.filter((c) => c.isEnabled);
    }

    if (configs.length === 0) {
      throw new BadRequestException('No hay configuraciones habilitadas');
    }

    let totalStored = 0;
    const allAppointments = [];
    const timezone = client.timezone || 'America/Santiago';

    for (const config of configs) {
      const today = targetDate
        ? moment.tz(targetDate, timezone).startOf('day')
        : moment.tz(timezone).startOf('day');

      const appointmentDate = today
        .clone()
        .add(config.daysBeforeAppointment, 'days')
        .format('YYYY-MM-DD');

      this.logger.log(
        `🔍 [${config.name}] Hoy es ${today.format('YYYY-MM-DD')} → Buscando citas del ${appointmentDate} (${config.daysBeforeAppointment} días después)`,
      );

      try {
        // Delegar al adapter la obtención y normalización de citas
        const fetchedAppointments = await adapter.fetchAppointments(
          client,
          config,
          appointmentDate,
          timezone,
        );

        this.logger.log(
          `✅ [${adapter.platform}] ${fetchedAppointments.length} citas obtenidas para ${appointmentDate}`,
        );

        for (const fetched of fetchedAppointments) {
          try {
            const scheduledFor = immediateConfirmation
              ? new Date()
              : this.calculateScheduledTime(
                  appointmentDate,
                  config.timeToSend,
                  config.daysBeforeAppointment,
                  timezone,
                );

            // Deduplicación platform-agnostic
            const existing = await this.pendingRepository.findOne({
              where: {
                clientId,
                confirmationConfigId: config.id,
                platform: adapter.platform,
                platformAppointmentId: fetched.platformAppointmentId,
              },
            });

            if (!existing) {
              const pending = this.pendingRepository.create({
                clientId,
                confirmationConfigId: config.id,
                platform: adapter.platform,
                platformAppointmentId: fetched.platformAppointmentId,
                appointmentData: fetched.appointmentData,
                scheduledFor,
                status: ConfirmationStatus.PENDING,
              });

              await this.pendingRepository.save(pending);
              totalStored++;
              this.logger.log(
                `✅ Cita ${fetched.platformAppointmentId} almacenada para confirmación`,
              );
            } else {
              this.logger.log(
                `⚠️ Cita ${fetched.platformAppointmentId} ya existe en pendientes`,
              );
            }

            allAppointments.push(fetched);
          } catch (error) {
            this.logger.error(
              `❌ Error almacenando cita ${fetched.platformAppointmentId}: ${error.message}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `❌ Error obteniendo citas de ${adapter.platform}: ${error.message}`,
        );
      }
    }

    return { stored: totalStored, appointments: allAppointments };
  }

  /**
   * Procesa una confirmación individual (busca/crea contacto y cita en GHL)
   * Este método es completamente genérico - funciona con cualquier plataforma.
   */
  private async processConfirmation(confirmation: PendingConfirmation): Promise<void> {
    this.logger.log(
      `📤 Procesando confirmación ${confirmation.id} [${confirmation.platform}]`,
    );

    // Marcar como procesando
    confirmation.status = ConfirmationStatus.PROCESSING;
    confirmation.attempts++;
    await this.pendingRepository.save(confirmation);

    // Delay aleatorio entre 20 y 30 segundos antes de procesar
    const delaySeconds = Math.floor(Math.random() * 11) + 20;
    const delayMs = delaySeconds * 1000;
    this.logger.log(
      `⏱️ Esperando ${delaySeconds} segundos antes de procesar confirmación ${confirmation.id}...`,
    );
    await this.sleep(delayMs);

    try {
      const client = confirmation.client;
      const appointmentData = confirmation.appointmentData;

      // Verificar que el cliente tiene GHL configurado
      if (!client.ghlEnabled || !client.ghlAccessToken || !client.ghlLocationId) {
        throw new Error('Cliente no tiene GoHighLevel configurado');
      }

      const ghlHeaders = {
        Authorization: `Bearer ${client.ghlAccessToken}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      };

      // 1. Buscar o crear contacto en GHL
      const contactId = await this.findOrCreateContact(
        client.ghlLocationId,
        appointmentData,
        ghlHeaders,
        confirmation.platform,
      );

      confirmation.ghlContactId = contactId;
      await this.pendingRepository.save(confirmation);

      // 2. Actualizar custom fields del contacto (incluye for_confirmation: true)
      await this.updateContactCustomFields(
        contactId,
        confirmation.platformAppointmentId,
        appointmentData,
        ghlHeaders,
      );

      // 3. Actualizar el estado de la cita en la plataforma origen
      if (client.contactedStateId) {
        try {
          const adapter = this.adapterFactory.getAdapterForClient(client);
          this.logger.log(
            `📞 [${adapter.platform}] Actualizando cita ${confirmation.platformAppointmentId} al estado "Contactado"`,
          );
          await adapter.confirmAppointmentOnPlatform(
            client,
            confirmation.platformAppointmentId,
            client.contactedStateId,
          );
          this.logger.log(`✅ Estado de la cita actualizado a "Contactado"`);
        } catch (error) {
          this.logger.warn(`⚠️ No se pudo actualizar el estado de la cita: ${error.message}`);
        }
      }

      // Marcar como completado
      confirmation.status = ConfirmationStatus.COMPLETED;
      confirmation.processedAt = new Date();
      this.logger.log(`✅ Confirmación ${confirmation.id} procesada exitosamente`);
    } catch (error) {
      const errorMessage = error.message || String(error);
      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      this.logger.error(
        `❌ Error procesando confirmación ${confirmation.id}: ${errorMessage} (Status: ${statusCode})`,
      );

      if (errorData) {
        this.logger.error(`   Detalles del error de GHL: ${JSON.stringify(errorData, null, 2)}`);
      }

      if (statusCode === 429) {
        this.logger.warn(`⚠️ Rate limit excedido (429) - Se reintentará automáticamente`);
        confirmation.status = ConfirmationStatus.PENDING;
        confirmation.errorMessage = 'Rate limit excedido - reintentando';
        confirmation.attempts = Math.max(0, confirmation.attempts - 1);
      } else {
        confirmation.status = ConfirmationStatus.FAILED;
        confirmation.errorMessage = errorMessage;

        if (confirmation.attempts >= 3) {
          this.logger.error(`❌ Confirmación ${confirmation.id} falló después de 3 intentos`);
        } else {
          confirmation.status = ConfirmationStatus.PENDING;
        }
      }
    }

    await this.pendingRepository.save(confirmation);
  }

  /**
   * Normaliza un número de teléfono removiendo espacios y caracteres extra
   */
  private normalizePhone(phone: string): string {
    if (!phone) return phone;
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Busca un contacto en GHL por email o teléfono, o lo crea si no existe
   */
  private async findOrCreateContact(
    locationId: string,
    appointmentData: NormalizedAppointmentData,
    headers: any,
    platform: string,
  ): Promise<string> {
    const searchUrl = 'https://services.leadconnectorhq.com/contacts/search';

    // 1. Buscar por email
    if (appointmentData.email_paciente) {
      try {
        this.logger.log(`🔍 Buscando contacto por email: ${appointmentData.email_paciente}`);

        const searchPayload = {
          locationId,
          pageLimit: 20,
          filters: [
            {
              field: 'email',
              operator: 'eq',
              value: appointmentData.email_paciente,
            },
          ],
        };

        const searchResp = await this.makeGHLRequest(() =>
          axios.post(searchUrl, searchPayload, { headers }),
        );

        if (searchResp.status === 200) {
          const contacts = searchResp.data?.contacts || [];
          if (contacts.length > 0) {
            this.logger.log(`✅ Contacto encontrado por email: ${contacts[0].id}`);
            return contacts[0].id;
          }
        }
      } catch (error) {
        this.logger.warn(`⚠️ Error buscando por email: ${error.message}`);
      }
    }

    // 2. Buscar por teléfono
    if (appointmentData.telefono_paciente) {
      try {
        const normalizedPhone = this.normalizePhone(appointmentData.telefono_paciente);
        this.logger.log(
          `🔍 Buscando contacto por teléfono: ${appointmentData.telefono_paciente} (normalizado: ${normalizedPhone})`,
        );

        const searchPayload = {
          locationId,
          pageLimit: 20,
          filters: [
            {
              field: 'phone',
              operator: 'eq',
              value: normalizedPhone,
            },
          ],
        };

        const searchResp = await this.makeGHLRequest(() =>
          axios.post(searchUrl, searchPayload, { headers }),
        );

        if (searchResp.status === 200) {
          const contacts = searchResp.data?.contacts || [];
          if (contacts.length > 0) {
            this.logger.log(`✅ Contacto encontrado por teléfono: ${contacts[0].id}`);
            return contacts[0].id;
          }
        }
      } catch (error) {
        this.logger.warn(`⚠️ Error buscando por teléfono: ${error.message}`);
      }
    }

    // 3. Crear nuevo contacto
    this.logger.log('👤 Creando nuevo contacto en GHL...');

    const nameParts = appointmentData.nombre_paciente.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const createPayload: any = {
      locationId,
      firstName,
      lastName,
      name: appointmentData.nombre_paciente,
      source: `${platform} Confirmation`,
    };

    if (appointmentData.email_paciente) {
      createPayload.email = appointmentData.email_paciente;
    }

    if (appointmentData.telefono_paciente) {
      createPayload.phone = this.normalizePhone(appointmentData.telefono_paciente);
    }

    try {
      const createResp = await this.makeGHLRequest(() =>
        axios.post('https://services.leadconnectorhq.com/contacts/', createPayload, { headers }),
      );

      if (createResp.status === 201 || createResp.status === 200) {
        const contactId = createResp.data?.contact?.id;
        this.logger.log(`✅ Contacto creado: ${contactId}`);
        return contactId;
      }
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.meta?.contactId) {
        const existingContactId = error.response.data.meta.contactId;
        const matchingField = error.response.data.meta.matchingField;
        this.logger.log(
          `✅ Contacto ya existe (matching: ${matchingField}), usando contactId: ${existingContactId}`,
        );
        return existingContactId;
      }
      throw error;
    }

    throw new Error('No se pudo crear el contacto en GHL');
  }

  /**
   * Actualiza los custom fields del contacto con datos de la cita
   */
  private async updateContactCustomFields(
    contactId: string,
    platformAppointmentId: string,
    appointmentData: NormalizedAppointmentData,
    headers: any,
  ): Promise<void> {
    this.logger.log(`📝 Actualizando custom fields del contacto ${contactId}`);
    this.logger.log(
      `📋 Datos de Cita: id_cita=${platformAppointmentId}, id_paciente=${appointmentData.id_paciente}, rut=${appointmentData.rut_paciente}`,
    );

    const updatePayload = {
      customFields: [
        { key: 'id_cita', field_value: platformAppointmentId },
        { key: 'hora_inicio', field_value: appointmentData.hora_inicio },
        { key: 'fecha', field_value: appointmentData.fecha },
        { key: 'nombre_dentista', field_value: appointmentData.nombre_dentista },
        { key: 'nombre_paciente', field_value: appointmentData.nombre_paciente },
        { key: 'id_paciente', field_value: appointmentData.id_paciente },
        { key: 'id_sucursal', field_value: appointmentData.id_sucursal },
        { key: 'nombre_sucursal', field_value: appointmentData.nombre_sucursal },
        { key: 'rut', field_value: appointmentData.rut_paciente || '' },
        { key: 'for_confirmation', field_value: 'true' },
      ],
    };

    const updateUrl = `https://services.leadconnectorhq.com/contacts/${contactId}`;

    this.logger.log(`📤 Enviando a GHL:`);
    this.logger.log(`   URL: ${updateUrl}`);
    this.logger.log(`   Payload: ${JSON.stringify(updatePayload, null, 2)}`);

    try {
      const updateResp = await this.makeGHLRequest(() =>
        axios.put(updateUrl, updatePayload, { headers }),
      );

      if (updateResp.status === 200) {
        this.logger.log(`✅ Custom fields actualizados (incluyendo for_confirmation: true)`);
      }
    } catch (error) {
      this.logger.error(`❌ Error actualizando custom fields: ${error.message}`);
      this.logger.error(`   Contact ID: ${contactId}`);
      this.logger.error(`   Payload enviado: ${JSON.stringify(updatePayload, null, 2)}`);
      throw error;
    }
  }

  /**
   * Calcula el momento en que debe enviarse la confirmación
   */
  private calculateScheduledTime(
    appointmentDate: string,
    timeToSend: string,
    daysBeforeAppointment: number,
    timezone: string,
  ): Date {
    const [hours, minutes] = timeToSend.split(':').map(Number);

    const scheduledMoment = moment
      .tz(appointmentDate, timezone)
      .subtract(daysBeforeAppointment, 'days')
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    return scheduledMoment.toDate();
  }

  // ============================================
  // CONSULTAS
  // ============================================

  async getPendingConfirmations(clientId: string): Promise<PendingConfirmation[]> {
    return await this.pendingRepository.find({
      where: { clientId },
      order: { scheduledFor: 'ASC' },
      relations: ['confirmationConfig'],
    });
  }

  async getPendingConfirmationsByStatus(
    clientId: string,
    status: ConfirmationStatus,
  ): Promise<PendingConfirmation[]> {
    return await this.pendingRepository.find({
      where: { clientId, status },
      order: { scheduledFor: 'ASC' },
      relations: ['confirmationConfig'],
    });
  }

  /**
   * Procesa confirmaciones seleccionadas específicamente
   */
  async processSelectedConfirmations(
    clientId: string,
    confirmationIds: string[],
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(
      `🔄 Procesando ${confirmationIds.length} confirmaciones seleccionadas para cliente ${clientId}`,
    );

    const pending = await this.pendingRepository.find({
      where: {
        id: In(confirmationIds),
        clientId,
        status: ConfirmationStatus.PENDING,
      },
      relations: ['confirmationConfig', 'client', 'client.integrations'],
    });

    this.logger.log(`📋 Encontradas ${pending.length} confirmaciones válidas para procesar`);

    let completed = 0;
    let failed = 0;

    for (const confirmation of pending) {
      try {
        await this.processConfirmation(confirmation);

        if (pending.indexOf(confirmation) < pending.length - 1) {
          this.logger.log('⏱️ Esperando 600ms antes de procesar siguiente (rate limit GHL)...');
          await this.sleep(600);
        }

        const updated = await this.pendingRepository.findOne({
          where: { id: confirmation.id },
        });

        if (updated?.status === ConfirmationStatus.COMPLETED) {
          completed++;
        } else if (updated?.status === ConfirmationStatus.FAILED) {
          failed++;
        }
      } catch (error) {
        this.logger.error(`❌ Error procesando confirmación ${confirmation.id}: ${error.message}`);
        failed++;
      }
    }

    this.logger.log(
      `✅ Procesamiento seleccionado completado: ${completed} exitosas, ${failed} fallidas`,
    );

    return {
      processed: pending.length,
      completed,
      failed,
    };
  }

  async processPendingConfirmationsNow(
    clientId: string,
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(`🔄 Procesando manualmente confirmaciones pendientes para cliente ${clientId}`);

    const pending = await this.pendingRepository.find({
      where: {
        clientId,
        status: ConfirmationStatus.PENDING,
      },
      relations: ['confirmationConfig', 'client'],
      take: 10,
    });

    this.logger.log(`📋 Encontradas ${pending.length} confirmaciones pendientes para procesar`);

    let completed = 0;
    let failed = 0;

    for (const confirmation of pending) {
      try {
        await this.processConfirmation(confirmation);

        if (pending.indexOf(confirmation) < pending.length - 1) {
          this.logger.log('⏱️ Esperando 600ms antes de procesar siguiente (rate limit GHL)...');
          await this.sleep(600);
        }

        const updated = await this.pendingRepository.findOne({
          where: { id: confirmation.id },
        });

        if (updated?.status === ConfirmationStatus.COMPLETED) {
          completed++;
        } else if (updated?.status === ConfirmationStatus.FAILED) {
          failed++;
        }
      } catch (error) {
        this.logger.error(`❌ Error procesando confirmación ${confirmation.id}: ${error.message}`);
        failed++;
      }
    }

    this.logger.log(
      `✅ Procesamiento completo: ${completed} exitosas, ${failed} fallidas de ${pending.length} totales`,
    );

    return {
      processed: pending.length,
      completed,
      failed,
    };
  }
}

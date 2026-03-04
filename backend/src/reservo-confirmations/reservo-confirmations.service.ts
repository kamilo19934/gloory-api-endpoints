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
import { ReservoConfirmationConfig } from './entities/reservo-confirmation-config.entity';
import {
  ReservoPendingConfirmation,
  ReservoConfirmationStatus,
  ReservoNormalizedAppointment,
} from './entities/reservo-pending-confirmation.entity';
import { CreateReservoConfigDto } from './dto/create-reservo-config.dto';
import { UpdateReservoConfigDto } from './dto/update-reservo-config.dto';
import { ClientsService } from '../clients/clients.service';
import { ReservoService } from '../integrations/reservo/reservo.service';
import { ReservoConfig } from '../integrations/reservo/reservo.types';

@Injectable()
export class ReservoConfirmationsService {
  private readonly logger = new Logger(ReservoConfirmationsService.name);

  constructor(
    @InjectRepository(ReservoConfirmationConfig)
    private configRepository: Repository<ReservoConfirmationConfig>,
    @InjectRepository(ReservoPendingConfirmation)
    private pendingRepository: Repository<ReservoPendingConfirmation>,
    private clientsService: ClientsService,
    private reservoService: ReservoService,
  ) {}

  // ============================================
  // HELPERS
  // ============================================

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async makeGHLRequest<T>(requestFn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;

        if (error.response) {
          this.logger.error(`Error de GHL (Status ${statusCode}):`);
          this.logger.error(`   URL: ${error.config?.url}`);
          this.logger.error(`   Method: ${error.config?.method?.toUpperCase()}`);
          this.logger.error(`   Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }

        if (statusCode === 429 && attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000;
          this.logger.warn(
            `Rate limit (429) - Reintentando en ${waitTime}ms (intento ${attempt + 1}/${maxRetries})`,
          );
          await this.sleep(waitTime);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private normalizePhone(phone: string): string {
    if (!phone) return phone;
    return phone.replace(/[\s\-\(\)]/g, '');
  }

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

  /**
   * Obtiene la configuración de Reservo del cliente
   */
  private getReservoConfig(client: any): ReservoConfig {
    const integration = client.getIntegration('reservo');
    if (!integration) {
      throw new BadRequestException('Cliente no tiene integración Reservo configurada');
    }
    return integration.config as ReservoConfig;
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  async createConfig(
    clientId: string,
    dto: CreateReservoConfigDto,
  ): Promise<ReservoConfirmationConfig> {
    const client = await this.clientsService.findOne(clientId);

    // Verificar que el cliente tiene Reservo
    this.getReservoConfig(client);

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
      isEnabled: dto.isEnabled ?? true,
      order: dto.order,
    });

    return await this.configRepository.save(config);
  }

  async getConfigs(clientId: string): Promise<ReservoConfirmationConfig[]> {
    return await this.configRepository.find({
      where: { clientId },
      order: { order: 'ASC' },
    });
  }

  async getConfig(clientId: string, configId: string): Promise<ReservoConfirmationConfig> {
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
    dto: UpdateReservoConfigDto,
  ): Promise<ReservoConfirmationConfig> {
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
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    if (dto.order !== undefined) config.order = dto.order;

    return await this.configRepository.save(config);
  }

  async deleteConfig(clientId: string, configId: string): Promise<void> {
    const config = await this.getConfig(clientId, configId);
    await this.configRepository.remove(config);
  }

  // ============================================
  // CRON JOBS
  // ============================================

  /**
   * Cron job backup: verifica cada hora si hay confirmaciones pendientes por procesar
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkPendingConfirmations() {
    this.logger.log('[Reservo] Verificando confirmaciones pendientes...');

    const now = new Date();
    const pending = await this.pendingRepository.find({
      where: {
        status: ReservoConfirmationStatus.PENDING,
        scheduledFor: LessThan(now),
      },
      relations: ['config', 'client'],
      take: 10,
    });

    this.logger.log(`[Reservo] ${pending.length} confirmaciones pendientes para procesar`);

    for (const confirmation of pending) {
      await this.processConfirmation(confirmation);

      if (pending.indexOf(confirmation) < pending.length - 1) {
        await this.sleep(600);
      }
    }
  }

  /**
   * Cron job principal: cada 30 min obtiene y confirma citas automáticamente
   */
  @Cron('*/30 * * * *')
  async autoFetchAndConfirmAppointments() {
    this.logger.log('[Reservo] Iniciando proceso automático de confirmación...');

    try {
      const activeConfigs = await this.getAllActiveConfigs();

      if (activeConfigs.length === 0) {
        this.logger.log('[Reservo] No hay configuraciones activas');
        return;
      }

      this.logger.log(`[Reservo] ${activeConfigs.length} configuraciones activas`);

      for (const config of activeConfigs) {
        try {
          const client = config.client;
          const reservoConfig = this.getReservoConfig(client);
          const timezone = reservoConfig.timezone || client.timezone || 'America/Santiago';
          const now = moment.tz(timezone);

          const [configHour, configMinute] = config.timeToSend.split(':').map(Number);
          const currentHour = now.hour();
          const currentMinute = now.minute();

          const isTimeToExecute =
            currentHour === configHour &&
            currentMinute >= configMinute &&
            currentMinute < configMinute + 30;

          if (isTimeToExecute) {
            this.logger.log(
              `[Reservo] Procesando "${config.name}" para cliente ${client.name} (${client.id})`,
            );

            const result = await this.fetchAndStoreAppointments(
              client.id,
              config.id,
              undefined,
              true,
            );

            this.logger.log(`[Reservo] ${result.stored} citas almacenadas para confirmación inmediata`);

            if (result.stored > 0) {
              const processResult = await this.processAllPendingConfirmationsNow(client.id);
              this.logger.log(
                `[Reservo] Confirmaciones completadas: ${processResult.completed}/${processResult.processed}`,
              );

              if (processResult.failed > 0) {
                this.logger.warn(`[Reservo] Confirmaciones fallidas: ${processResult.failed}`);
              }
            }
          } else {
            this.logger.debug(
              `[Reservo] Saltando config "${config.name}" (${client.name}) - ` +
                `Hora actual: ${now.format('HH:mm')}, Hora configurada: ${config.timeToSend}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `[Reservo] Error procesando config "${config.name}" (${config.id}): ${error.message}`,
          );
        }
      }

      this.logger.log('[Reservo] Proceso automático completado');
    } catch (error) {
      this.logger.error(`[Reservo] Error en proceso automático: ${error.message}`);
    }
  }

  private async getAllActiveConfigs(): Promise<ReservoConfirmationConfig[]> {
    return await this.configRepository.find({
      where: { isEnabled: true },
      relations: ['client'],
    });
  }

  // ============================================
  // OBTENCIÓN Y ALMACENAMIENTO DE CITAS
  // ============================================

  async fetchAndStoreAppointments(
    clientId: string,
    configId?: string,
    targetDate?: string,
    immediateConfirmation: boolean = false,
  ): Promise<{ stored: number; appointments: any[] }> {
    const client = await this.clientsService.findOne(clientId);
    const reservoConfig = this.getReservoConfig(client);
    const timezone = reservoConfig.timezone || client.timezone || 'America/Santiago';

    this.logger.log(`[Reservo] Obteniendo citas para cliente ${client.name}`);

    // Obtener configuraciones a procesar
    let configs: ReservoConfirmationConfig[];
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

    for (const config of configs) {
      const today = targetDate
        ? moment.tz(targetDate, timezone).startOf('day')
        : moment.tz(timezone).startOf('day');

      const appointmentDate = today
        .clone()
        .add(config.daysBeforeAppointment, 'days')
        .format('YYYY-MM-DD');

      this.logger.log(
        `[Reservo] [${config.name}] Hoy es ${today.format('YYYY-MM-DD')} -> Buscando citas del ${appointmentDate} (${config.daysBeforeAppointment} días después)`,
      );

      try {
        // Obtener citas de Reservo
        const citasResult = await this.reservoService.getAppointmentsByDateRange(
          appointmentDate,
          appointmentDate,
          reservoConfig,
        );

        if (!citasResult.success || !citasResult.data) {
          this.logger.warn(`[Reservo] No se pudieron obtener citas: ${citasResult.error}`);
          continue;
        }

        // Filtrar solo citas No Confirmadas (NC)
        const ncAppointments = citasResult.data.filter(
          (apt) => apt.estado?.codigo === 'NC',
        );

        this.logger.log(
          `[Reservo] ${ncAppointments.length} citas NC de ${citasResult.data.length} totales para ${appointmentDate}`,
        );

        for (const apt of ncAppointments) {
          try {
            // Normalizar datos de la cita
            const normalized = this.normalizeAppointment(apt, timezone);

            const scheduledFor = immediateConfirmation
              ? new Date()
              : this.calculateScheduledTime(
                  appointmentDate,
                  config.timeToSend,
                  config.daysBeforeAppointment,
                  timezone,
                );

            // Deduplicación
            const existing = await this.pendingRepository.findOne({
              where: {
                clientId,
                configId: config.id,
                reservoAppointmentUuid: apt.uuid,
              },
            });

            if (!existing) {
              const pending = this.pendingRepository.create({
                clientId,
                configId: config.id,
                reservoAppointmentUuid: apt.uuid,
                appointmentData: normalized,
                scheduledFor,
                status: ReservoConfirmationStatus.PENDING,
              });

              await this.pendingRepository.save(pending);
              totalStored++;
              this.logger.log(`[Reservo] Cita ${apt.uuid} almacenada para confirmación`);
            } else {
              this.logger.log(`[Reservo] Cita ${apt.uuid} ya existe en pendientes`);
            }

            allAppointments.push({ uuid: apt.uuid, data: normalized });
          } catch (error) {
            this.logger.error(
              `[Reservo] Error almacenando cita ${apt.uuid}: ${error.message}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`[Reservo] Error obteniendo citas: ${error.message}`);
      }
    }

    return { stored: totalStored, appointments: allAppointments };
  }

  /**
   * Normaliza una cita de Reservo a formato interno
   */
  private normalizeAppointment(
    apt: any,
    timezone: string,
  ): ReservoNormalizedAppointment {
    const cliente = apt.cliente;
    const profesional = apt.profesional;
    const sucursal = apt.sucursal;
    const tratamientos = apt.tratamientos || [];

    const tz = apt.zona_horaria || timezone;
    const inicioLocal = moment.utc(apt.inicio).tz(tz);
    const finLocal = moment.utc(apt.fin).tz(tz);

    return {
      id_paciente: cliente?.uuid || '',
      nombre_paciente: cliente
        ? `${cliente.nombre} ${cliente.apellido_paterno}`.trim()
        : 'Sin paciente',
      rut_paciente: cliente?.identificador || '',
      email_paciente: cliente?.mail || '',
      telefono_paciente: cliente?.telefono_1 || cliente?.telefono_2 || '',
      fecha: inicioLocal.format('YYYY-MM-DD'),
      hora_inicio: inicioLocal.format('HH:mm:ss'),
      hora_fin: finLocal.format('HH:mm:ss'),
      duracion: finLocal.diff(inicioLocal, 'minutes'),
      id_profesional: profesional?.uuid || '',
      nombre_profesional: profesional?.nombre || 'Sin profesional',
      id_tratamiento: tratamientos[0]?.uuid || '',
      nombre_tratamiento:
        tratamientos.map((t: any) => t.nombre).join(', ') || 'Sin tratamiento',
      id_sucursal: sucursal?.uuid || '',
      nombre_sucursal: sucursal?.nombre || 'Sin sucursal',
      estado_codigo: apt.estado?.codigo || 'NC',
      estado_descripcion: apt.estado?.descripcion || 'No Confirmado',
      comentarios: apt.comentario || '',
    };
  }

  // ============================================
  // PROCESAMIENTO DE CONFIRMACIONES
  // ============================================

  /**
   * Procesa una confirmación individual: busca/crea contacto en GHL y actualiza custom fields
   */
  private async processConfirmation(confirmation: ReservoPendingConfirmation): Promise<void> {
    this.logger.log(`[Reservo] Procesando confirmación ${confirmation.id}`);

    // Marcar como procesando (usar update() en vez de save() para evitar FK constraint en SQLite)
    confirmation.attempts++;
    await this.pendingRepository.update(confirmation.id, {
      status: ReservoConfirmationStatus.PROCESSING,
      attempts: confirmation.attempts,
    });
    confirmation.status = ReservoConfirmationStatus.PROCESSING;

    // Delay aleatorio entre 20 y 30 segundos (rate limit GHL)
    const delaySeconds = Math.floor(Math.random() * 11) + 20;
    const delayMs = delaySeconds * 1000;
    this.logger.log(`[Reservo] Esperando ${delaySeconds}s antes de procesar ${confirmation.id}...`);
    await this.sleep(delayMs);

    try {
      const client = confirmation.client
        || await this.clientsService.findOne(confirmation.clientId);
      const reservoConfig = this.getReservoConfig(client);
      const appointmentData = confirmation.appointmentData;

      // Verificar que GHL está configurado en la integración Reservo
      if (!reservoConfig.ghlEnabled || !reservoConfig.ghlAccessToken || !reservoConfig.ghlLocationId) {
        throw new Error('La integración Reservo no tiene GoHighLevel configurado');
      }

      const ghlHeaders = {
        Authorization: `Bearer ${reservoConfig.ghlAccessToken}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      };

      // 1. Buscar o crear contacto en GHL
      const contactId = await this.findOrCreateContact(
        reservoConfig.ghlLocationId,
        appointmentData,
        ghlHeaders,
      );

      confirmation.ghlContactId = contactId;
      await this.pendingRepository.update(confirmation.id, {
        ghlContactId: contactId,
      });

      // 2. Actualizar custom fields del contacto
      await this.updateContactCustomFields(
        contactId,
        confirmation.reservoAppointmentUuid,
        appointmentData,
        ghlHeaders,
      );

      // Nota: NO se cambia el estado de la cita en Reservo — queda tal cual ("NC")
      // Solo se sincroniza la información del contacto en GoHighLevel

      // Marcar como completado
      confirmation.status = ReservoConfirmationStatus.COMPLETED;
      confirmation.processedAt = new Date();
      this.logger.log(`[Reservo] Confirmación ${confirmation.id} procesada exitosamente`);
    } catch (error) {
      const errorMessage = error.message || String(error);
      const statusCode = error.response?.status;

      this.logger.error(
        `[Reservo] Error procesando confirmación ${confirmation.id}: ${errorMessage} (Status: ${statusCode})`,
      );

      if (statusCode === 429) {
        this.logger.warn(`[Reservo] Rate limit excedido (429) - Se reintentará automáticamente`);
        confirmation.status = ReservoConfirmationStatus.PENDING;
        confirmation.errorMessage = 'Rate limit excedido - reintentando';
        confirmation.attempts = Math.max(0, confirmation.attempts - 1);
      } else {
        confirmation.status = ReservoConfirmationStatus.FAILED;
        confirmation.errorMessage = errorMessage;

        if (confirmation.attempts >= 3) {
          this.logger.error(`[Reservo] Confirmación ${confirmation.id} falló después de 3 intentos`);
        } else {
          confirmation.status = ReservoConfirmationStatus.PENDING;
        }
      }
    }

    // Guardar estado final con update() para evitar FK constraint en SQLite
    await this.pendingRepository.update(confirmation.id, {
      status: confirmation.status,
      ghlContactId: confirmation.ghlContactId,
      errorMessage: confirmation.errorMessage,
      attempts: confirmation.attempts,
      processedAt: confirmation.processedAt,
    });
  }

  /**
   * Busca un contacto en GHL por email o teléfono, o lo crea si no existe
   */
  private async findOrCreateContact(
    locationId: string,
    appointmentData: ReservoNormalizedAppointment,
    headers: any,
  ): Promise<string> {
    const searchUrl = 'https://services.leadconnectorhq.com/contacts/search';

    // 1. Buscar por email
    if (appointmentData.email_paciente) {
      try {
        this.logger.log(`[Reservo] Buscando contacto por email: ${appointmentData.email_paciente}`);

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
            this.logger.log(`[Reservo] Contacto encontrado por email: ${contacts[0].id}`);
            return contacts[0].id;
          }
        }
      } catch (error) {
        this.logger.warn(`[Reservo] Error buscando por email: ${error.message}`);
      }
    }

    // 2. Buscar por teléfono
    if (appointmentData.telefono_paciente) {
      try {
        const normalizedPhone = this.normalizePhone(appointmentData.telefono_paciente);
        this.logger.log(`[Reservo] Buscando contacto por teléfono: ${normalizedPhone}`);

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
            this.logger.log(`[Reservo] Contacto encontrado por teléfono: ${contacts[0].id}`);
            return contacts[0].id;
          }
        }
      } catch (error) {
        this.logger.warn(`[Reservo] Error buscando por teléfono: ${error.message}`);
      }
    }

    // 3. Crear nuevo contacto
    this.logger.log('[Reservo] Creando nuevo contacto en GHL...');

    const nameParts = appointmentData.nombre_paciente.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const createPayload: any = {
      locationId,
      firstName,
      lastName,
      name: appointmentData.nombre_paciente,
      source: 'Reservo Confirmation',
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
        this.logger.log(`[Reservo] Contacto creado: ${contactId}`);
        return contactId;
      }
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.meta?.contactId) {
        const existingContactId = error.response.data.meta.contactId;
        const matchingField = error.response.data.meta.matchingField;
        this.logger.log(
          `[Reservo] Contacto ya existe (matching: ${matchingField}), usando contactId: ${existingContactId}`,
        );
        return existingContactId;
      }
      throw error;
    }

    throw new Error('No se pudo crear el contacto en GHL');
  }

  /**
   * Actualiza los custom fields del contacto con datos de la cita de Reservo
   */
  private async updateContactCustomFields(
    contactId: string,
    reservoAppointmentUuid: string,
    appointmentData: ReservoNormalizedAppointment,
    headers: any,
  ): Promise<void> {
    this.logger.log(`[Reservo] Actualizando custom fields del contacto ${contactId}`);

    const updatePayload = {
      customFields: [
        { key: 'id_cita', field_value: reservoAppointmentUuid },
        { key: 'hora_inicio', field_value: appointmentData.hora_inicio },
        { key: 'fecha', field_value: appointmentData.fecha },
        { key: 'nombre_dentista', field_value: appointmentData.nombre_profesional },
        { key: 'nombre_paciente', field_value: appointmentData.nombre_paciente },
        { key: 'id_paciente', field_value: appointmentData.id_paciente },
        { key: 'id_sucursal', field_value: appointmentData.id_sucursal },
        { key: 'nombre_sucursal', field_value: appointmentData.nombre_sucursal },
        { key: 'rut', field_value: appointmentData.rut_paciente || '' },
        { key: 'for_confirmation', field_value: 'true' },
      ],
    };

    const updateUrl = `https://services.leadconnectorhq.com/contacts/${contactId}`;

    try {
      const updateResp = await this.makeGHLRequest(() =>
        axios.put(updateUrl, updatePayload, { headers }),
      );

      if (updateResp.status === 200) {
        this.logger.log(`[Reservo] Custom fields actualizados (for_confirmation: true)`);
      }
    } catch (error) {
      this.logger.error(`[Reservo] Error actualizando custom fields: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // PROCESAMIENTO MASIVO
  // ============================================

  /**
   * Procesa TODAS las confirmaciones pendientes sin límite (batches de 10)
   */
  async processAllPendingConfirmationsNow(
    clientId: string,
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(`[Reservo] Procesando TODAS las confirmaciones pendientes para cliente ${clientId}`);

    let totalProcessed = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let hasMore = true;

    while (hasMore) {
      const pending = await this.pendingRepository.find({
        where: {
          clientId,
          status: ReservoConfirmationStatus.PENDING,
        },
        relations: ['config', 'client'],
        take: 10,
      });

      if (pending.length === 0) {
        hasMore = false;
        break;
      }

      this.logger.log(`[Reservo] Procesando batch de ${pending.length} confirmaciones...`);

      for (const confirmation of pending) {
        try {
          await this.processConfirmation(confirmation);
          totalProcessed++;

          const updated = await this.pendingRepository.findOne({
            where: { id: confirmation.id },
          });

          if (updated.status === ReservoConfirmationStatus.COMPLETED) {
            totalCompleted++;
          } else if (updated.status === ReservoConfirmationStatus.FAILED) {
            totalFailed++;
          }
        } catch (error) {
          totalFailed++;
          this.logger.error(
            `[Reservo] Error procesando confirmación ${confirmation.id}: ${error.message}`,
          );
        }

        if (pending.indexOf(confirmation) < pending.length - 1) {
          await this.sleep(600);
        }
      }

      if (pending.length < 10) {
        hasMore = false;
      } else {
        this.logger.log('[Reservo] Esperando 1s antes del siguiente batch...');
        await this.sleep(1000);
      }
    }

    this.logger.log(
      `[Reservo] Procesamiento completo: ${totalProcessed} procesadas, ` +
        `${totalCompleted} completadas, ${totalFailed} fallidas`,
    );

    return {
      processed: totalProcessed,
      completed: totalCompleted,
      failed: totalFailed,
    };
  }

  /**
   * Procesa hasta 10 confirmaciones pendientes (invocación manual)
   */
  async processPendingConfirmationsNow(
    clientId: string,
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(`[Reservo] Procesando manualmente confirmaciones para cliente ${clientId}`);

    const pending = await this.pendingRepository.find({
      where: {
        clientId,
        status: ReservoConfirmationStatus.PENDING,
      },
      relations: ['config', 'client'],
      take: 10,
    });

    this.logger.log(`[Reservo] ${pending.length} confirmaciones pendientes para procesar`);

    let completed = 0;
    let failed = 0;

    for (const confirmation of pending) {
      try {
        await this.processConfirmation(confirmation);

        if (pending.indexOf(confirmation) < pending.length - 1) {
          await this.sleep(600);
        }

        const updated = await this.pendingRepository.findOne({
          where: { id: confirmation.id },
        });

        if (updated?.status === ReservoConfirmationStatus.COMPLETED) {
          completed++;
        } else if (updated?.status === ReservoConfirmationStatus.FAILED) {
          failed++;
        }
      } catch (error) {
        this.logger.error(`[Reservo] Error procesando confirmación ${confirmation.id}: ${error.message}`);
        failed++;
      }
    }

    return {
      processed: pending.length,
      completed,
      failed,
    };
  }

  /**
   * Procesa confirmaciones específicas por IDs
   */
  async processSelectedConfirmations(
    clientId: string,
    confirmationIds: string[],
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(
      `[Reservo] Procesando ${confirmationIds.length} confirmaciones seleccionadas`,
    );

    const pending = await this.pendingRepository.find({
      where: {
        id: In(confirmationIds),
        clientId,
        status: ReservoConfirmationStatus.PENDING,
      },
      relations: ['config', 'client'],
    });

    this.logger.log(`[Reservo] ${pending.length} confirmaciones válidas para procesar`);

    let completed = 0;
    let failed = 0;

    for (const confirmation of pending) {
      try {
        await this.processConfirmation(confirmation);

        if (pending.indexOf(confirmation) < pending.length - 1) {
          await this.sleep(600);
        }

        const updated = await this.pendingRepository.findOne({
          where: { id: confirmation.id },
        });

        if (updated?.status === ReservoConfirmationStatus.COMPLETED) {
          completed++;
        } else if (updated?.status === ReservoConfirmationStatus.FAILED) {
          failed++;
        }
      } catch (error) {
        this.logger.error(`[Reservo] Error procesando confirmación ${confirmation.id}: ${error.message}`);
        failed++;
      }
    }

    return {
      processed: pending.length,
      completed,
      failed,
    };
  }

  // ============================================
  // CONSULTAS
  // ============================================

  async getPendingConfirmations(clientId: string): Promise<ReservoPendingConfirmation[]> {
    return await this.pendingRepository.find({
      where: { clientId },
      order: { scheduledFor: 'ASC' },
      relations: ['config'],
    });
  }

  async getPendingConfirmationsByStatus(
    clientId: string,
    status: ReservoConfirmationStatus,
  ): Promise<ReservoPendingConfirmation[]> {
    return await this.pendingRepository.find({
      where: { clientId, status },
      order: { scheduledFor: 'ASC' },
      relations: ['config'],
    });
  }
}

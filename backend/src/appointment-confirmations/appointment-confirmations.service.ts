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

@Injectable()
export class AppointmentConfirmationsService {
  private readonly logger = new Logger(AppointmentConfirmationsService.name);

  constructor(
    @InjectRepository(ConfirmationConfig)
    private configRepository: Repository<ConfirmationConfig>,
    @InjectRepository(PendingConfirmation)
    private pendingRepository: Repository<PendingConfirmation>,
    private clientsService: ClientsService,
  ) {}

  /**
   * Helper para agregar delay entre peticiones (rate limiting)
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper para hacer llamadas HTTP con retry automático en caso de error 429
   */
  private async makeGHLRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        
        // Solo reintentar en caso de 429 (Rate Limit)
        if (statusCode === 429 && attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
          this.logger.warn(`⚠️ Rate limit (429) - Reintentando en ${waitTime}ms (intento ${attempt + 1}/${maxRetries})`);
          await this.sleep(waitTime);
          continue;
        }
        
        // Para otros errores, no reintentar
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
    // Verificar que el cliente existe
    await this.clientsService.findOne(clientId);

    // Verificar que no exceda el límite de 3 configuraciones
    const existingCount = await this.configRepository.count({
      where: { clientId },
    });

    if (existingCount >= 3) {
      throw new BadRequestException('Solo se permiten hasta 3 configuraciones de confirmación');
    }

    // Verificar que no exista otra configuración con el mismo orden
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

    // Si se cambia el orden, verificar que no exista
    if (dto.order && dto.order !== config.order) {
      const existingOrder = await this.configRepository.findOne({
        where: { clientId, order: dto.order },
      });

      if (existingOrder && existingOrder.id !== configId) {
        throw new ConflictException(`Ya existe una configuración con orden ${dto.order}`);
      }
    }

    if (dto.name !== undefined) config.name = dto.name;
    if (dto.daysBeforeAppointment !== undefined) config.daysBeforeAppointment = dto.daysBeforeAppointment;
    if (dto.timeToSend !== undefined) config.timeToSend = dto.timeToSend;
    if (dto.ghlCalendarId !== undefined) config.ghlCalendarId = dto.ghlCalendarId;
    if (dto.appointmentStates !== undefined) config.appointmentStates = dto.appointmentStates.join(',');
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
      take: 10, // Procesar 10 a la vez para respetar rate limit de GHL (100 req/10s)
    });

    this.logger.log(`📋 Encontradas ${pending.length} confirmaciones pendientes para procesar`);

    for (const confirmation of pending) {
      await this.processConfirmation(confirmation);
      
      // Delay de 600ms entre cada procesamiento para respetar rate limit
      // Cada confirmación hace ~3-4 requests a GHL (promedio 3.5)
      // 10 confirmaciones = ~35 requests en 6 segundos = ~5.8 req/s (58% del límite de 10 req/s)
      if (pending.indexOf(confirmation) < pending.length - 1) {
        this.logger.log('⏱️ Esperando 600ms antes de procesar siguiente (rate limit GHL)...');
        await this.sleep(600);
      }
    }
  }

  /**
   * Obtiene las citas de Dentalink y crea registros pendientes
   */
  async fetchAndStoreAppointments(
    clientId: string,
    configId?: string,
    targetDate?: string,
  ): Promise<{ stored: number; appointments: any[] }> {
    const client = await this.clientsService.findOne(clientId);

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

    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';
    const headers = {
      Authorization: `Token ${client.apiKey}`,
      'Content-Type': 'application/json',
    };

    let totalStored = 0;
    const allAppointments = [];

    for (const config of configs) {
      // Calcular la fecha objetivo
      const timezone = client.timezone || 'America/Santiago';
      
      // IMPORTANTE: Siempre empezar desde medianoche para cálculos correctos
      const today = targetDate
        ? moment.tz(targetDate, timezone).startOf('day')
        : moment.tz(timezone).startOf('day');

      // Calcular la fecha de la cita que debemos obtener
      // Si configuramos "1 día antes", hoy obtenemos las citas de MAÑANA
      // Si configuramos "2 días antes", hoy obtenemos las citas de PASADO MAÑANA
      // Si configuramos "3 días antes", hoy obtenemos las citas de PASADO PASADO MAÑANA
      const appointmentDate = today
        .clone()
        .add(config.daysBeforeAppointment, 'days')
        .format('YYYY-MM-DD');

      this.logger.log(
        `🔍 [${config.name}] Hoy es ${today.format('YYYY-MM-DD')} → Buscando citas del ${appointmentDate} (${config.daysBeforeAppointment} días después)`,
      );

      // Obtener citas de Dentalink
      try {
        // Parsear los estados configurados
        const stateIds = config.appointmentStates.split(',').map(id => parseInt(id.trim(), 10));
        
        // Crear filtro para múltiples estados
        const filtro = JSON.stringify({
          fecha: { eq: appointmentDate },
          id_estado: stateIds.length === 1 ? { eq: stateIds[0] } : { in: stateIds },
        });

        this.logger.log(`📋 Filtrando por estados: [${stateIds.join(', ')}]`);
        this.logger.log(`🔎 Filtro enviado a Dentalink: ${filtro}`);
        this.logger.log(`🌐 URL completa: ${baseURL}citas?q=${encodeURIComponent(filtro)}`);

        const response = await axios.get(`${baseURL}citas`, {
          headers,
          params: { q: filtro },
        });

        if (response.status === 200) {
          const appointments = response.data?.data || [];
          this.logger.log(`✅ Obtenidas ${appointments.length} citas de Dentalink`);
          
          // Log de las fechas reales de las citas obtenidas
          if (appointments.length > 0) {
            const fechas = appointments.map((apt: any) => apt.fecha).filter((f: any, i: number, arr: any[]) => arr.indexOf(f) === i);
            this.logger.log(`📅 Fechas de citas obtenidas: ${fechas.join(', ')}`);
          }

          // Obtener información de pacientes
          for (const apt of appointments) {
            try {
              // Obtener datos del paciente
              const patientResp = await axios.get(`${baseURL}pacientes/${apt.id_paciente}`, {
                headers,
              });

              if (patientResp.status === 200) {
                const patient = patientResp.data?.data || {};
                apt.email_paciente = patient.email;
                apt.telefono_paciente = patient.celular || patient.telefono;
              }

              // Calcular cuándo enviar la confirmación
              const scheduledFor = this.calculateScheduledTime(
                appointmentDate,
                config.timeToSend,
                config.daysBeforeAppointment,
                timezone,
              );

              // Verificar si ya existe esta cita pendiente
              const existing = await this.pendingRepository.findOne({
                where: {
                  clientId,
                  confirmationConfigId: config.id,
                  dentalinkAppointmentId: apt.id,
                },
              });

              if (!existing) {
                // Crear registro pendiente
                const pending = this.pendingRepository.create({
                  clientId,
                  confirmationConfigId: config.id,
                  dentalinkAppointmentId: apt.id,
                  appointmentData: {
                    id_paciente: apt.id_paciente,
                    nombre_paciente: apt.nombre_paciente,
                    nombre_social_paciente: apt.nombre_social_paciente,
                    email_paciente: apt.email_paciente,
                    telefono_paciente: apt.telefono_paciente,
                    id_tratamiento: apt.id_tratamiento,
                    nombre_tratamiento: apt.nombre_tratamiento,
                    fecha: apt.fecha,
                    hora_inicio: apt.hora_inicio,
                    hora_fin: apt.hora_fin,
                    duracion: apt.duracion,
                    id_dentista: apt.id_dentista,
                    nombre_dentista: apt.nombre_dentista,
                    id_sucursal: apt.id_sucursal,
                    nombre_sucursal: apt.nombre_sucursal,
                    id_estado: apt.id_estado,
                    estado_cita: apt.estado_cita,
                    motivo_atencion: apt.motivo_atencion,
                    comentarios: apt.comentarios,
                  },
                  scheduledFor,
                  status: ConfirmationStatus.PENDING,
                });

                await this.pendingRepository.save(pending);
                totalStored++;
                this.logger.log(`✅ Cita ${apt.id} almacenada para confirmación`);
              } else {
                this.logger.log(`⚠️ Cita ${apt.id} ya existe en pendientes`);
              }

              allAppointments.push(apt);
            } catch (error) {
              this.logger.error(`❌ Error procesando cita ${apt.id}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`❌ Error obteniendo citas de Dentalink: ${error.message}`);
      }
    }

    return { stored: totalStored, appointments: allAppointments };
  }

  /**
   * Procesa una confirmación individual (busca/crea contacto y cita en GHL)
   */
  private async processConfirmation(confirmation: PendingConfirmation): Promise<void> {
    this.logger.log(`📤 Procesando confirmación ${confirmation.id}`);

    // Marcar como procesando
    confirmation.status = ConfirmationStatus.PROCESSING;
    confirmation.attempts++;
    await this.pendingRepository.save(confirmation);

    try {
      const client = confirmation.client;
      const config = confirmation.confirmationConfig;
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
      let contactId = await this.findOrCreateContact(
        client.ghlAccessToken,
        client.ghlLocationId,
        appointmentData,
        ghlHeaders,
      );

      confirmation.ghlContactId = contactId;
      await this.pendingRepository.save(confirmation);

      // 2. Actualizar custom fields del contacto (incluye for_confirmation: true)
      await this.updateContactCustomFields(
        contactId,
        appointmentData,
        ghlHeaders,
      );

      // Marcar como completado
      confirmation.status = ConfirmationStatus.COMPLETED;
      confirmation.processedAt = new Date();
      this.logger.log(`✅ Confirmación ${confirmation.id} procesada exitosamente`);
    } catch (error) {
      const errorMessage = error.message || String(error);
      const statusCode = error.response?.status;
      
      this.logger.error(`❌ Error procesando confirmación ${confirmation.id}: ${errorMessage} (Status: ${statusCode})`);
      
      // Manejo especial para error 429 (Rate Limit)
      if (statusCode === 429) {
        this.logger.warn(`⚠️ Rate limit excedido (429) - Se reintentará automáticamente`);
        confirmation.status = ConfirmationStatus.PENDING;
        confirmation.errorMessage = 'Rate limit excedido - reintentando';
        // No aumentar attempts para rate limit
        confirmation.attempts = Math.max(0, confirmation.attempts - 1);
      } else {
        confirmation.status = ConfirmationStatus.FAILED;
        confirmation.errorMessage = errorMessage;

        // Si ha fallado 3 veces, no reintentar
        if (confirmation.attempts >= 3) {
          this.logger.error(`❌ Confirmación ${confirmation.id} falló después de 3 intentos`);
        } else {
          // Resetear a pending para reintentar
          confirmation.status = ConfirmationStatus.PENDING;
        }
      }
    }

    await this.pendingRepository.save(confirmation);
  }

  /**
   * Busca un contacto en GHL por email o teléfono, o lo crea si no existe
   */
  private async findOrCreateContact(
    accessToken: string,
    locationId: string,
    appointmentData: any,
    headers: any,
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
          axios.post(searchUrl, searchPayload, { headers })
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
        this.logger.log(`🔍 Buscando contacto por teléfono: ${appointmentData.telefono_paciente}`);
        
        const searchPayload = {
          locationId,
          pageLimit: 20,
          filters: [
            {
              field: 'phone',
              operator: 'eq',
              value: appointmentData.telefono_paciente,
            },
          ],
        };

        const searchResp = await this.makeGHLRequest(() =>
          axios.post(searchUrl, searchPayload, { headers })
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
      source: 'Dentalink Confirmation',
    };

    if (appointmentData.email_paciente) {
      createPayload.email = appointmentData.email_paciente;
    }

    if (appointmentData.telefono_paciente) {
      createPayload.phone = appointmentData.telefono_paciente;
    }

    const createResp = await this.makeGHLRequest(() =>
      axios.post(
        'https://services.leadconnectorhq.com/contacts/',
        createPayload,
        { headers },
      )
    );

    if (createResp.status === 201 || createResp.status === 200) {
      const contactId = createResp.data?.contact?.id;
      this.logger.log(`✅ Contacto creado: ${contactId}`);
      return contactId;
    }

    throw new Error('No se pudo crear el contacto en GHL');
  }

  /**
   * Actualiza los custom fields del contacto con datos de la cita
   */
  private async updateContactCustomFields(
    contactId: string,
    appointmentData: any,
    headers: any,
  ): Promise<void> {
    this.logger.log(`📝 Actualizando custom fields del contacto ${contactId}`);

    const updatePayload = {
      customFields: [
        { key: 'id_cita', field_value: String(appointmentData.id_paciente) },
        { key: 'hora_inicio', field_value: appointmentData.hora_inicio },
        { key: 'fecha', field_value: appointmentData.fecha },
        { key: 'nombre_dentista', field_value: appointmentData.nombre_dentista },
        { key: 'id_sucursal', field_value: String(appointmentData.id_sucursal) },
        { key: 'nombre_sucursal', field_value: appointmentData.nombre_sucursal },
        { key: 'for_confirmation', field_value: 'true' },
      ],
    };

    const updateUrl = `https://services.leadconnectorhq.com/contacts/${contactId}`;
    
    try {
      const updateResp = await this.makeGHLRequest(() =>
        axios.put(updateUrl, updatePayload, { headers })
      );
      
      if (updateResp.status === 200) {
        this.logger.log(`✅ Custom fields actualizados (incluyendo for_confirmation: true)`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Error actualizando custom fields: ${error.message}`);
      // No fallar el proceso completo si esto falla
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
   * Obtiene los estados de cita disponibles en Dentalink
   */
  async getAppointmentStates(clientId: string): Promise<any[]> {
    const client = await this.clientsService.findOne(clientId);
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';
    
    const headers = {
      Authorization: `Token ${client.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      this.logger.log('🔍 Obteniendo estados de cita de Dentalink');
      
      const response = await axios.get(`${baseURL}citas/estados`, { headers });
      
      if (response.status === 200) {
        const states = response.data?.data || [];
        this.logger.log(`✅ Obtenidos ${states.length} estados de cita`);
        
        // Filtrar solo estados habilitados y no de uso interno
        return states.filter((state: any) => state.habilitado === 1 && state.uso_interno === 0);
      }
      
      return [];
    } catch (error) {
      this.logger.error(`❌ Error obteniendo estados de cita: ${error.message}`);
      throw error;
    }
  }

  /**
   * Procesa manualmente las confirmaciones pendientes de un cliente (para testing)
   * Ignora el scheduledFor y procesa todas las pendientes inmediatamente
   */
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
      take: 10, // Procesar máximo 10 a la vez para respetar rate limit de GHL
    });

    this.logger.log(`📋 Encontradas ${pending.length} confirmaciones pendientes para procesar`);

    let completed = 0;
    let failed = 0;

    for (const confirmation of pending) {
      try {
        await this.processConfirmation(confirmation);
        
        // Delay entre procesamiento para rate limit
        if (pending.indexOf(confirmation) < pending.length - 1) {
          this.logger.log('⏱️ Esperando 600ms antes de procesar siguiente (rate limit GHL)...');
          await this.sleep(600);
        }
        
        // Recargar para ver el estado actualizado
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

    this.logger.log(`✅ Procesamiento completo: ${completed} exitosas, ${failed} fallidas de ${pending.length} totales`);

    return {
      processed: pending.length,
      completed,
      failed,
    };
  }
}

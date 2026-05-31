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
import * as moment from 'moment-timezone';
import { SacmedConfirmationConfig } from './entities/sacmed-confirmation-config.entity';
import {
  SacmedPendingConfirmation,
  SacmedConfirmationStatus,
  SacmedNormalizedAppointment,
} from './entities/sacmed-pending-confirmation.entity';
import { CreateSacmedConfigDto } from './dto/create-sacmed-config.dto';
import { UpdateSacmedConfigDto } from './dto/update-sacmed-config.dto';
import { ClientsService } from '../clients/clients.service';
import { SacmedService } from '../integrations/sacmed/sacmed.service';
import {
  SacmedConfig,
  SacmedEvent,
  SACMED_EVENT_STATUS,
} from '../integrations/sacmed/sacmed.types';
import { GHLOAuthService } from '../gohighlevel/oauth/ghl-oauth.service';
import { GHLApiClient } from '../gohighlevel/oauth/ghl-api-client.service';
import { GHLAuthParams } from '../appointment-confirmations/ghl-setup.service';
import { GoHighLevelConfig } from '../integrations/gohighlevel/gohighlevel.types';
import {
  ExecutionStepEntry,
  ExecutionStepName,
  ExecutionStepStatus,
} from '../appointment-confirmations/types/execution-log.type';

@Injectable()
export class SacmedConfirmationsService {
  private readonly logger = new Logger(SacmedConfirmationsService.name);

  constructor(
    @InjectRepository(SacmedConfirmationConfig)
    private configRepository: Repository<SacmedConfirmationConfig>,
    @InjectRepository(SacmedPendingConfirmation)
    private pendingRepository: Repository<SacmedPendingConfirmation>,
    private clientsService: ClientsService,
    private sacmedService: SacmedService,
    private ghlOAuthService: GHLOAuthService,
    private ghlApiClient: GHLApiClient,
  ) {}

  /**
   * Resuelve parámetros de auth para llamar a GHL via wrapper.
   * Para OAuth no incluye `pitToken` — el wrapper lo resuelve dinámicamente.
   */
  private resolveGHLAuthParams(client: any, sacmedConfig: SacmedConfig): GHLAuthParams | null {
    const ghlIntegration = client.getIntegration('gohighlevel');
    if (ghlIntegration) {
      const ghlConfig = ghlIntegration.config as GoHighLevelConfig;
      if (ghlConfig.ghlOAuthMode && ghlConfig.ghlLocationId) {
        return { locationId: ghlConfig.ghlLocationId };
      }
      if (ghlConfig.ghlAccessToken && ghlConfig.ghlLocationId) {
        return { locationId: ghlConfig.ghlLocationId, pitToken: ghlConfig.ghlAccessToken };
      }
    }

    // GHL embebido en el config de la integration Sacmed
    if (sacmedConfig.ghlEnabled && sacmedConfig.ghlLocationId) {
      if (sacmedConfig.ghlOAuthMode) {
        return { locationId: sacmedConfig.ghlLocationId };
      }
      if (sacmedConfig.ghlAccessToken) {
        return {
          locationId: sacmedConfig.ghlLocationId,
          pitToken: sacmedConfig.ghlAccessToken,
        };
      }
    }

    return null;
  }

  /**
   * Ejecuta una request a GHL respetando el modo del cliente.
   */
  private async callGHL<T = any>(
    auth: GHLAuthParams,
    config: Parameters<GHLApiClient['request']>[1],
  ): Promise<T> {
    if (auth.pitToken) {
      return this.ghlApiClient.requestWithToken<T>(auth.pitToken, config);
    }
    return this.ghlApiClient.request<T>(auth.locationId, config);
  }

  // ============================================
  // HELPERS
  // ============================================

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runStep<T>(
    log: ExecutionStepEntry[],
    attempt: number,
    step: ExecutionStepName,
    fn: () => Promise<T>,
    metadataExtractor?: (result: T) => Record<string, any> | undefined,
  ): Promise<T> {
    const startedAt = new Date();
    try {
      const result = await fn();
      log.push({
        attempt,
        step,
        status: ExecutionStepStatus.SUCCESS,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        metadata: metadataExtractor ? metadataExtractor(result) : undefined,
      });
      return result;
    } catch (error) {
      const httpStatus = error?.response?.status;
      const ghlError = error?.response?.data;
      log.push({
        attempt,
        step,
        status: ExecutionStepStatus.ERROR,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        errorMessage: error?.message || String(error),
        httpStatus,
        metadata: ghlError ? { ghlError } : undefined,
      });
      throw error;
    }
  }

  private normalizePhone(phone: string): string {
    if (!phone) return phone;
    return phone.replace(/[\s\-()]/g, '');
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

  private getSacmedConfig(client: any): SacmedConfig {
    const integration = client.getIntegration('sacmed');
    if (!integration) {
      throw new BadRequestException('Cliente no tiene integración Sacmed configurada');
    }
    return integration.config as SacmedConfig;
  }

  private resolveTz(sacmedConfig: SacmedConfig, client: any): string {
    const tz = sacmedConfig.timezone || client.timezone || 'America/Santiago';
    return moment.tz.zone(tz) ? tz : 'America/Santiago';
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  async createConfig(
    clientId: string,
    dto: CreateSacmedConfigDto,
  ): Promise<SacmedConfirmationConfig> {
    const client = await this.clientsService.findOne(clientId);
    this.getSacmedConfig(client);

    const existingCount = await this.configRepository.count({ where: { clientId } });
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

  async getConfigs(clientId: string): Promise<SacmedConfirmationConfig[]> {
    return await this.configRepository.find({
      where: { clientId },
      order: { order: 'ASC' },
    });
  }

  async getConfig(clientId: string, configId: string): Promise<SacmedConfirmationConfig> {
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
    dto: UpdateSacmedConfigDto,
  ): Promise<SacmedConfirmationConfig> {
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
    this.logger.log('[Sacmed] Verificando confirmaciones pendientes...');

    const now = new Date();
    const pending = await this.pendingRepository.find({
      where: {
        status: SacmedConfirmationStatus.PENDING,
        scheduledFor: LessThan(now),
      },
      relations: ['config', 'client'],
      take: 10,
    });

    this.logger.log(`[Sacmed] ${pending.length} confirmaciones pendientes para procesar`);

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
    this.logger.log('[Sacmed] Iniciando proceso automático de confirmación...');

    try {
      const activeConfigs = await this.getAllActiveConfigs();

      if (activeConfigs.length === 0) {
        this.logger.log('[Sacmed] No hay configuraciones activas');
        return;
      }

      this.logger.log(`[Sacmed] ${activeConfigs.length} configuraciones activas`);

      for (const config of activeConfigs) {
        try {
          const client = config.client;
          const sacmedConfig = this.getSacmedConfig(client);
          const timezone = this.resolveTz(sacmedConfig, client);
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
              `[Sacmed] Procesando "${config.name}" para cliente ${client.name} (${client.id})`,
            );

            const result = await this.fetchAndStoreAppointments(
              client.id,
              config.id,
              undefined,
              true,
            );

            this.logger.log(
              `[Sacmed] ${result.stored} citas almacenadas para confirmación inmediata`,
            );

            if (result.stored > 0) {
              const processResult = await this.processAllPendingConfirmationsNow(client.id);
              this.logger.log(
                `[Sacmed] Confirmaciones completadas: ${processResult.completed}/${processResult.processed}`,
              );

              if (processResult.failed > 0) {
                this.logger.warn(`[Sacmed] Confirmaciones fallidas: ${processResult.failed}`);
              }
            }
          } else {
            this.logger.debug(
              `[Sacmed] Saltando config "${config.name}" (${client.name}) - ` +
                `Hora actual: ${now.format('HH:mm')}, Hora configurada: ${config.timeToSend}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `[Sacmed] Error procesando config "${config.name}" (${config.id}): ${error.message}`,
          );
        }
      }

      this.logger.log('[Sacmed] Proceso automático completado');
    } catch (error) {
      this.logger.error(`[Sacmed] Error en proceso automático: ${error.message}`);
    }
  }

  private async getAllActiveConfigs(): Promise<SacmedConfirmationConfig[]> {
    return await this.configRepository.find({
      where: { isEnabled: true },
      relations: ['client'],
    });
  }

  // ============================================
  // OBTENCIÓN Y ALMACENAMIENTO DE CITAS
  // ============================================

  /**
   * Obtiene las citas de Sacmed para la fecha objetivo y las encola.
   *
   * A diferencia de Reservo, Sacmed NO expone un endpoint de "todas las citas
   * por rango". Solo hay `events/by-practitioner/.../fechas/{from}/{to}`, así que
   * hacemos fan-out: listamos los profesionales y por cada uno (por su RUT /
   * identification) pedimos sus eventos del día. Deduplicamos por eventId.
   */
  async fetchAndStoreAppointments(
    clientId: string,
    configId?: string,
    targetDate?: string,
    immediateConfirmation: boolean = false,
  ): Promise<{ stored: number; appointments: any[] }> {
    const client = await this.clientsService.findOne(clientId);
    const sacmedConfig = this.getSacmedConfig(client);
    const timezone = this.resolveTz(sacmedConfig, client);

    this.logger.log(`[Sacmed] Obteniendo citas para cliente ${client.name}`);

    let configs: SacmedConfirmationConfig[];
    if (configId) {
      configs = [await this.getConfig(clientId, configId)];
    } else {
      configs = (await this.getConfigs(clientId)).filter((c) => c.isEnabled);
    }

    if (configs.length === 0) {
      throw new BadRequestException('No hay configuraciones habilitadas');
    }

    // Listar profesionales una sola vez (compartido entre configs)
    const practitionersResult = await this.sacmedService.getPractitioners(sacmedConfig);
    if (!practitionersResult.success) {
      this.logger.warn(
        `[Sacmed] No se pudieron obtener profesionales: ${practitionersResult.error}`,
      );
      return { stored: 0, appointments: [] };
    }
    const practitioners = practitionersResult.data?.practitioners || [];
    this.logger.log(`[Sacmed] ${practitioners.length} profesionales para revisar`);

    let totalStored = 0;
    const allAppointments: any[] = [];

    for (const config of configs) {
      const today = targetDate
        ? moment.tz(targetDate, timezone).startOf('day')
        : moment.tz(timezone).startOf('day');

      const appointmentDate = today
        .clone()
        .add(config.daysBeforeAppointment, 'days')
        .format('YYYY-MM-DD');

      this.logger.log(
        `[Sacmed] [${config.name}] Hoy es ${today.format('YYYY-MM-DD')} -> Buscando citas del ${appointmentDate}`,
      );

      // Rango inclusivo: from = día objetivo, to = día siguiente (filtramos por fecha local)
      const from = appointmentDate;
      const to = today
        .clone()
        .add(config.daysBeforeAppointment + 1, 'days')
        .format('YYYY-MM-DD');

      for (const practitioner of practitioners) {
        const identification = practitioner.identification;
        if (!identification) continue;

        try {
          const eventsResult = await this.sacmedService.getEventsByPractitioner(
            identification,
            from,
            to,
            sacmedConfig,
          );

          if (!eventsResult.success || !eventsResult.data) {
            continue;
          }

          // Filtrar citas del día objetivo que no estén canceladas
          const events = eventsResult.data.filter((e) => {
            if (e.statusEventId === SACMED_EVENT_STATUS.CANCELLED) return false;
            const startLocal = this.parseToZone(e.start, timezone);
            return startLocal && startLocal.format('YYYY-MM-DD') === appointmentDate;
          });

          for (const event of events) {
            try {
              const normalized = this.normalizeAppointment(event, practitioner, timezone);
              const eventIdStr = String(event.eventId);

              const scheduledFor = immediateConfirmation
                ? new Date()
                : this.calculateScheduledTime(
                    appointmentDate,
                    config.timeToSend,
                    config.daysBeforeAppointment,
                    timezone,
                  );

              const existing = await this.pendingRepository.findOne({
                where: { clientId, configId: config.id, sacmedEventId: eventIdStr },
              });

              if (!existing) {
                const pending = this.pendingRepository.create({
                  clientId,
                  configId: config.id,
                  sacmedEventId: eventIdStr,
                  appointmentData: normalized,
                  scheduledFor,
                  status: SacmedConfirmationStatus.PENDING,
                });
                await this.pendingRepository.save(pending);
                totalStored++;
                this.logger.log(`[Sacmed] Cita ${eventIdStr} almacenada para confirmación`);
              }

              allAppointments.push({ eventId: eventIdStr, data: normalized });
            } catch (error) {
              this.logger.error(
                `[Sacmed] Error almacenando cita ${event.eventId}: ${error.message}`,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `[Sacmed] Error obteniendo citas del profesional ${identification}: ${error.message}`,
          );
        }
      }
    }

    return { stored: totalStored, appointments: allAppointments };
  }

  /**
   * Parsea una fecha del backend a la zona de la clínica.
   * - Si trae 'Z'/offset, se respeta y se convierte a la zona.
   * - Si es naive, se asume hora local de la clínica.
   */
  private parseToZone(value: string | undefined, tz: string): moment.Moment | null {
    if (!value) return null;
    const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
    const m = hasTz ? moment.parseZone(value).tz(tz) : moment.tz(value, tz);
    return m.isValid() ? m : null;
  }

  /**
   * Normaliza un evento de Sacmed a formato interno
   */
  private normalizeAppointment(
    event: SacmedEvent,
    practitioner: { identification?: string; name?: string },
    timezone: string,
  ): SacmedNormalizedAppointment {
    const patient = event.patient;
    const inicioLocal = this.parseToZone(event.start, timezone);
    const finLocal = this.parseToZone(event.end, timezone);

    const nombrePaciente = patient
      ? `${patient.firstName || ''} ${patient.paternalLastName || ''}`.trim() || 'Sin paciente'
      : 'Sin paciente';

    const nombreProfesional =
      event.practitioner?.firstName || event.practitioner?.lastName
        ? `${event.practitioner?.firstName || ''} ${event.practitioner?.lastName || ''}`.trim()
        : practitioner.name || 'Sin profesional';

    return {
      id_paciente: patient?.identification || '',
      nombre_paciente: nombrePaciente,
      rut_paciente: patient?.identification || '',
      email_paciente: patient?.email || '',
      telefono_paciente: patient?.mobilePhone || '',
      fecha: inicioLocal ? inicioLocal.format('YYYY-MM-DD') : '',
      hora_inicio: inicioLocal ? inicioLocal.format('HH:mm:ss') : '',
      hora_fin: finLocal ? finLocal.format('HH:mm:ss') : '',
      duracion: inicioLocal && finLocal ? finLocal.diff(inicioLocal, 'minutes') : 0,
      id_profesional: event.userId || '',
      nombre_profesional: nombreProfesional,
      estado_codigo: event.statusEventId != null ? String(event.statusEventId) : '',
      estado_descripcion: event.statusEvent || '',
      modalidad: event.tipoServicio || '',
    };
  }

  // ============================================
  // PROCESAMIENTO DE CONFIRMACIONES
  // ============================================

  private async processConfirmation(confirmation: SacmedPendingConfirmation): Promise<void> {
    this.logger.log(`[Sacmed] Procesando confirmación ${confirmation.id}`);

    confirmation.attempts++;
    await this.pendingRepository.update(confirmation.id, {
      status: SacmedConfirmationStatus.PROCESSING,
      attempts: confirmation.attempts,
    });
    confirmation.status = SacmedConfirmationStatus.PROCESSING;

    // Delay aleatorio entre 20 y 30 segundos (rate limit GHL)
    const delaySeconds = Math.floor(Math.random() * 11) + 20;
    this.logger.log(`[Sacmed] Esperando ${delaySeconds}s antes de procesar ${confirmation.id}...`);
    await this.sleep(delaySeconds * 1000);

    const log: ExecutionStepEntry[] = confirmation.executionLog ?? [];
    const attempt = confirmation.attempts;

    try {
      const client =
        confirmation.client || (await this.clientsService.findOne(confirmation.clientId));
      const sacmedConfig = this.getSacmedConfig(client);
      const appointmentData = confirmation.appointmentData;

      const ghlAuth = await this.runStep(
        log,
        attempt,
        ExecutionStepName.RESOLVE_GHL_CREDENTIALS,
        async () => {
          const params = this.resolveGHLAuthParams(client, sacmedConfig);
          if (!params) {
            throw new Error('La integración Sacmed no tiene GoHighLevel configurado');
          }
          return params;
        },
        (params) => ({ ghlLocationId: params.locationId }),
      );

      const contactId = await this.runStep(
        log,
        attempt,
        ExecutionStepName.FIND_OR_CREATE_CONTACT,
        () => this.findOrCreateContact(ghlAuth, appointmentData),
        (id) => ({ contactId: id }),
      );

      confirmation.ghlContactId = contactId;
      await this.pendingRepository.update(confirmation.id, { ghlContactId: contactId });

      await this.runStep(log, attempt, ExecutionStepName.UPDATE_CONTACT_CUSTOM_FIELDS, () =>
        this.updateContactCustomFields(
          contactId,
          confirmation.sacmedEventId,
          appointmentData,
          ghlAuth,
        ),
      );

      confirmation.status = SacmedConfirmationStatus.COMPLETED;
      confirmation.processedAt = new Date();
      this.logger.log(`[Sacmed] Confirmación ${confirmation.id} procesada exitosamente`);
    } catch (error) {
      const errorMessage = error.message || String(error);
      const statusCode = error.response?.status;

      this.logger.error(
        `[Sacmed] Error procesando confirmación ${confirmation.id}: ${errorMessage} (Status: ${statusCode})`,
      );

      if (statusCode === 429) {
        this.logger.warn(`[Sacmed] Rate limit excedido (429) - Se reintentará automáticamente`);
        confirmation.status = SacmedConfirmationStatus.PENDING;
        confirmation.errorMessage = 'Rate limit excedido - reintentando';
        confirmation.attempts = Math.max(0, confirmation.attempts - 1);
      } else {
        confirmation.status = SacmedConfirmationStatus.FAILED;
        confirmation.errorMessage = errorMessage;

        if (confirmation.attempts >= 3) {
          this.logger.error(`[Sacmed] Confirmación ${confirmation.id} falló después de 3 intentos`);
        } else {
          confirmation.status = SacmedConfirmationStatus.PENDING;
        }
      }
    }

    confirmation.executionLog = log;

    await this.pendingRepository.update(confirmation.id, {
      status: confirmation.status,
      ghlContactId: confirmation.ghlContactId,
      errorMessage: confirmation.errorMessage,
      attempts: confirmation.attempts,
      processedAt: confirmation.processedAt,
      executionLog: log,
    });
  }

  /**
   * Busca un contacto en GHL por email o teléfono, o lo crea si no existe
   */
  private async findOrCreateContact(
    auth: GHLAuthParams,
    appointmentData: SacmedNormalizedAppointment,
  ): Promise<string> {
    if (appointmentData.email_paciente) {
      try {
        const data = await this.callGHL<{ contacts?: any[] }>(auth, {
          method: 'POST',
          url: '/contacts/search',
          data: {
            locationId: auth.locationId,
            pageLimit: 20,
            filters: [{ field: 'email', operator: 'eq', value: appointmentData.email_paciente }],
          },
        });
        const contacts = data?.contacts || [];
        if (contacts.length > 0) {
          return contacts[0].id;
        }
      } catch (error) {
        this.logger.warn(`[Sacmed] Error buscando por email: ${error.message}`);
      }
    }

    if (appointmentData.telefono_paciente) {
      try {
        const normalizedPhone = this.normalizePhone(appointmentData.telefono_paciente);
        const data = await this.callGHL<{ contacts?: any[] }>(auth, {
          method: 'POST',
          url: '/contacts/search',
          data: {
            locationId: auth.locationId,
            pageLimit: 20,
            filters: [{ field: 'phone', operator: 'eq', value: normalizedPhone }],
          },
        });
        const contacts = data?.contacts || [];
        if (contacts.length > 0) {
          return contacts[0].id;
        }
      } catch (error) {
        this.logger.warn(`[Sacmed] Error buscando por teléfono: ${error.message}`);
      }
    }

    this.logger.log('[Sacmed] Creando nuevo contacto en GHL...');

    const nameParts = appointmentData.nombre_paciente.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const createPayload: any = {
      locationId: auth.locationId,
      firstName,
      lastName,
      name: appointmentData.nombre_paciente,
      source: 'Sacmed Confirmation',
    };

    if (appointmentData.email_paciente) {
      createPayload.email = appointmentData.email_paciente;
    }
    if (appointmentData.telefono_paciente) {
      createPayload.phone = this.normalizePhone(appointmentData.telefono_paciente);
    }

    try {
      const data = await this.callGHL<{ contact?: { id: string } }>(auth, {
        method: 'POST',
        url: '/contacts/',
        data: createPayload,
      });

      const contactId = data?.contact?.id;
      if (contactId) {
        this.logger.log(`[Sacmed] Contacto creado: ${contactId}`);
        return contactId;
      }
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.meta?.contactId) {
        const existingContactId = error.response.data.meta.contactId;
        this.logger.log(`[Sacmed] Contacto ya existe, usando contactId: ${existingContactId}`);
        return existingContactId;
      }
      throw error;
    }

    throw new Error('No se pudo crear el contacto en GHL');
  }

  /**
   * Actualiza los custom fields del contacto con datos de la cita de Sacmed
   */
  private async updateContactCustomFields(
    contactId: string,
    sacmedEventId: string,
    appointmentData: SacmedNormalizedAppointment,
    auth: GHLAuthParams,
  ): Promise<void> {
    this.logger.log(`[Sacmed] Actualizando custom fields del contacto ${contactId}`);

    const updatePayload = {
      customFields: [
        { key: 'id_cita', field_value: sacmedEventId },
        { key: 'hora_inicio', field_value: appointmentData.hora_inicio },
        { key: 'fecha', field_value: appointmentData.fecha },
        { key: 'nombre_profesional', field_value: appointmentData.nombre_profesional },
        { key: 'nombre_paciente', field_value: appointmentData.nombre_paciente },
        { key: 'id_paciente', field_value: appointmentData.id_paciente },
        { key: 'rut', field_value: appointmentData.rut_paciente || '' },
        { key: 'for_confirmation', field_value: 'true' },
      ],
    };

    try {
      await this.callGHL(auth, {
        method: 'PUT',
        url: `/contacts/${contactId}`,
        data: updatePayload,
      });
      this.logger.log(`[Sacmed] Custom fields actualizados (for_confirmation: true)`);
    } catch (error) {
      this.logger.error(`[Sacmed] Error actualizando custom fields: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // PROCESAMIENTO MASIVO
  // ============================================

  async processAllPendingConfirmationsNow(
    clientId: string,
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(`[Sacmed] Procesando TODAS las confirmaciones pendientes para ${clientId}`);

    let totalProcessed = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let hasMore = true;

    while (hasMore) {
      const pending = await this.pendingRepository.find({
        where: { clientId, status: SacmedConfirmationStatus.PENDING },
        relations: ['config', 'client'],
        take: 10,
      });

      if (pending.length === 0) {
        hasMore = false;
        break;
      }

      this.logger.log(`[Sacmed] Procesando batch de ${pending.length} confirmaciones...`);

      for (const confirmation of pending) {
        try {
          await this.processConfirmation(confirmation);
          totalProcessed++;

          const updated = await this.pendingRepository.findOne({ where: { id: confirmation.id } });
          if (updated.status === SacmedConfirmationStatus.COMPLETED) {
            totalCompleted++;
          } else if (updated.status === SacmedConfirmationStatus.FAILED) {
            totalFailed++;
          }
        } catch (error) {
          totalFailed++;
          this.logger.error(
            `[Sacmed] Error procesando confirmación ${confirmation.id}: ${error.message}`,
          );
        }

        if (pending.indexOf(confirmation) < pending.length - 1) {
          await this.sleep(600);
        }
      }

      if (pending.length < 10) {
        hasMore = false;
      } else {
        await this.sleep(1000);
      }
    }

    this.logger.log(
      `[Sacmed] Procesamiento completo: ${totalProcessed} procesadas, ` +
        `${totalCompleted} completadas, ${totalFailed} fallidas`,
    );

    return { processed: totalProcessed, completed: totalCompleted, failed: totalFailed };
  }

  async processPendingConfirmationsNow(
    clientId: string,
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(`[Sacmed] Procesando manualmente confirmaciones para cliente ${clientId}`);

    const pending = await this.pendingRepository.find({
      where: { clientId, status: SacmedConfirmationStatus.PENDING },
      relations: ['config', 'client'],
      take: 10,
    });

    let completed = 0;
    let failed = 0;

    for (const confirmation of pending) {
      try {
        await this.processConfirmation(confirmation);
        if (pending.indexOf(confirmation) < pending.length - 1) {
          await this.sleep(600);
        }
        const updated = await this.pendingRepository.findOne({ where: { id: confirmation.id } });
        if (updated?.status === SacmedConfirmationStatus.COMPLETED) {
          completed++;
        } else if (updated?.status === SacmedConfirmationStatus.FAILED) {
          failed++;
        }
      } catch (error) {
        this.logger.error(
          `[Sacmed] Error procesando confirmación ${confirmation.id}: ${error.message}`,
        );
        failed++;
      }
    }

    return { processed: pending.length, completed, failed };
  }

  async processSelectedConfirmations(
    clientId: string,
    confirmationIds: string[],
  ): Promise<{ processed: number; completed: number; failed: number }> {
    this.logger.log(`[Sacmed] Procesando ${confirmationIds.length} confirmaciones seleccionadas`);

    const pending = await this.pendingRepository.find({
      where: {
        id: In(confirmationIds),
        clientId,
        status: SacmedConfirmationStatus.PENDING,
      },
      relations: ['config', 'client'],
    });

    let completed = 0;
    let failed = 0;

    for (const confirmation of pending) {
      try {
        await this.processConfirmation(confirmation);
        if (pending.indexOf(confirmation) < pending.length - 1) {
          await this.sleep(600);
        }
        const updated = await this.pendingRepository.findOne({ where: { id: confirmation.id } });
        if (updated?.status === SacmedConfirmationStatus.COMPLETED) {
          completed++;
        } else if (updated?.status === SacmedConfirmationStatus.FAILED) {
          failed++;
        }
      } catch (error) {
        this.logger.error(
          `[Sacmed] Error procesando confirmación ${confirmation.id}: ${error.message}`,
        );
        failed++;
      }
    }

    return { processed: pending.length, completed, failed };
  }

  // ============================================
  // CONSULTAS
  // ============================================

  async getPendingConfirmations(clientId: string): Promise<SacmedPendingConfirmation[]> {
    return await this.pendingRepository.find({
      where: { clientId },
      order: { scheduledFor: 'ASC' },
      relations: ['config'],
    });
  }

  async getPendingConfirmationsByStatus(
    clientId: string,
    status: SacmedConfirmationStatus,
  ): Promise<SacmedPendingConfirmation[]> {
    return await this.pendingRepository.find({
      where: { clientId, status },
      order: { scheduledFor: 'ASC' },
      relations: ['config'],
    });
  }
}

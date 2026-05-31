import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { ClientsService } from '../clients/clients.service';
import { SacmedService } from '../integrations/sacmed/sacmed.service';
import {
  SacmedConfig,
  SacmedAvailabilityItem,
  SacmedCreateEventPayload,
  SacmedCreatePatientPayload,
  SacmedEvent,
  SACMED_EVENT_STATUS,
} from '../integrations/sacmed/sacmed.types';
import { GHLService } from '../dentalink/ghl.service';
import { GoHighLevelConfig } from '../integrations/gohighlevel/gohighlevel.types';
import { formatearRut, validarRut } from '../utils/rut.util';
import { SacmedCreatePatientDto } from './dto/create-patient.dto';
import { SacmedSearchAvailabilityDto } from './dto/search-availability.dto';
import { SacmedCreateAppointmentDto } from './dto/create-appointment.dto';
import { SacmedAppointmentActionDto } from './dto/appointment-action.dto';

const MODALIDAD_MAP: Record<number, string> = {
  1: 'Presencial',
  2: 'Telemedicina',
  3: 'Domiciliaria',
};

@Injectable()
export class SacmedProxyService {
  private readonly logger = new Logger(SacmedProxyService.name);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly sacmedService: SacmedService,
    private readonly ghlService: GHLService,
  ) {}

  private async getSacmedConfig(clientId: string): Promise<SacmedConfig> {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('sacmed');

    if (!integration) {
      throw new HttpException(
        'Este cliente no tiene integración con Sacmed configurada',
        HttpStatus.BAD_REQUEST,
      );
    }

    return integration.config as SacmedConfig;
  }

  /**
   * Resuelve la config GHL del cliente probando, en orden:
   *  1. Integration "gohighlevel" estándar.
   *  2. Campos GHL embebidos en la integration "sacmed".
   * Devuelve undefined si no hay calendar configurado (sin calendar no podemos espejar).
   */
  private resolveGhlConfig(client: any): GoHighLevelConfig | undefined {
    const ghl = client.integrations?.find((i: any) => i.integrationType === 'gohighlevel');
    if (ghl?.config?.ghlLocationId) {
      return ghl.config as GoHighLevelConfig;
    }

    const sacmed = client.integrations?.find((i: any) => i.integrationType === 'sacmed');
    const cfg = sacmed?.config;
    if (cfg?.ghlLocationId && (cfg.ghlAccessToken || cfg.ghlOAuthMode)) {
      return {
        ghlAccessToken: cfg.ghlAccessToken || '',
        ghlLocationId: cfg.ghlLocationId,
        ghlCalendarId: cfg.ghlCalendarId,
        ghlOAuthMode: cfg.ghlOAuthMode === true,
        timezone: cfg.timezone || client.timezone,
      };
    }

    return undefined;
  }

  private resolveTz(config: SacmedConfig): string {
    const tz = config.timezone || 'America/Santiago';
    return moment.tz.zone(tz) ? tz : 'America/Santiago';
  }

  // ============================
  // SERVICIOS / ESPECIALIDADES
  // ============================

  async getServices(clientId: string, modalidad?: string) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.getServices(config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error obteniendo servicios', HttpStatus.BAD_REQUEST);
    }

    const servicios = (result.data || []).map((s) => ({
      id_servicio: s.serviceId,
      nombre_servicio: s.name,
      modalidad: MODALIDAD_MAP[s.serviceTypeId] || 'Desconocido',
    }));

    if (modalidad) {
      const norm = modalidad.trim().toLowerCase();
      const target = norm.charAt(0).toUpperCase() + norm.slice(1);
      return servicios.filter((s) => s.modalidad === target);
    }

    return servicios;
  }

  async getSpecialtiesByService(clientId: string, serviceId: number) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.getSpecialtiesByService(serviceId, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo especialidades',
        HttpStatus.BAD_REQUEST,
      );
    }

    return (result.data || []).map((s) => ({
      id_especialidad: s.specialtyId,
      nombre_especialidad: s.name,
    }));
  }

  // ============================
  // PROFESIONALES
  // ============================

  /**
   * Lista profesionales con sus especialidades.
   * Si se pasa `serviceId`, filtra los profesionales que atienden ese servicio.
   */
  async getPractitioners(clientId: string, serviceId?: number) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.getPractitioners(config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo profesionales',
        HttpStatus.BAD_REQUEST,
      );
    }

    const practitioners = result.data?.practitioners || [];
    const out: any[] = [];

    for (const p of practitioners) {
      const services =
        serviceId != null
          ? (p.services || []).filter((s) => s.service_Id === serviceId)
          : p.services || [];

      if (serviceId != null && services.length === 0) {
        continue;
      }

      const especialidades: any[] = [];
      for (const s of services) {
        for (const esp of s.specialties || []) {
          especialidades.push({
            id_especialidad: esp.specialty_Id,
            nombre_especialidad: esp.name,
          });
        }
      }

      out.push({
        id_profesional: p.userId,
        nombre_profesional: p.name,
        especialidades,
      });
    }

    return out;
  }

  async getPractitionersBySpecialty(clientId: string, specialtyId: number) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.getPractitionersBySpecialty(specialtyId, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo especialistas',
        HttpStatus.BAD_REQUEST,
      );
    }

    return (result.data || []).map((p) => ({
      id_profesional: p.userId,
      nombre_profesional: p.fullName,
      id_especialidad: p.specialtyId,
    }));
  }

  // ============================
  // COMUNAS
  // ============================

  async getDistricts(clientId: string) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.getDistricts(config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error obteniendo comunas', HttpStatus.BAD_REQUEST);
    }

    return (result.data || []).map((d) => ({
      id_distrito: d.districtId,
      nombre_distrito: d.name,
    }));
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  /**
   * Busca disponibilidad por especialista. Intenta la semana solicitada y hasta
   * 3 semanas posteriores (4 intentos). Si se pasa `duracion_minutos`, se envía
   * como `customDuration` a Sacmed (slots de esa duración); si no, usa el default
   * de la especialidad.
   *
   * Respuesta compacta para ahorrar tokens del LLM: metadatos deduplicados en una
   * jerarquía profesional → días → slots["HH:MM"], con `duracion_minutos` y
   * `total_slots` una sola vez en la raíz.
   */
  async searchAvailability(clientId: string, dto: SacmedSearchAvailabilityDto) {
    const config = await this.getSacmedConfig(clientId);

    const baseDate = moment(dto.fecha, moment.ISO_8601, true).isValid()
      ? moment(dto.fecha)
      : moment(dto.fecha, 'YYYY-MM-DD');

    if (!baseDate.isValid()) {
      throw new HttpException(
        'El formato del campo fecha es inválido, debe ser ISO8601',
        HttpStatus.BAD_REQUEST,
      );
    }

    const MAX_WEEKS = 4;
    let current = baseDate.clone();

    for (let week = 0; week < MAX_WEEKS; week++) {
      const from = current.clone();
      const to = current.clone().add(7, 'days');

      const result = await this.sacmedService.getAvailabilityByPractitioner(
        {
          from: from.format('YYYY-MM-DDTHH:mm:ss'),
          to: to.format('YYYY-MM-DDTHH:mm:ss'),
          specialtyId: dto.id_especialidad,
          userIds: dto.id_profesionales,
          ...(dto.id_servicio != null ? { serviceId: dto.id_servicio } : {}),
          ...(dto.duracion_minutos != null ? { customDuration: dto.duracion_minutos } : {}),
        },
        config,
      );

      if (result.success) {
        const items = result.data || [];
        const hasAvailability = items.some((it) => Array.isArray(it.slots) && it.slots.length > 0);

        if (hasAvailability) {
          const profesionales = this.transformAvailability(items);
          const totalSlots = profesionales.reduce(
            (acc, p) => acc + p.dias.reduce((a, d) => a + d.slots.length, 0),
            0,
          );
          return {
            semana_desde: from.format('YYYY-MM-DD'),
            semana_hasta: to.format('YYYY-MM-DD'),
            // Eco de los IDs de la búsqueda para que crear_cita se arme solo desde
            // esta respuesta (el agente no tiene que recordarlos de pasos previos).
            id_especialidad: dto.id_especialidad,
            ...(dto.id_servicio != null ? { id_servicio: dto.id_servicio } : {}),
            duracion_minutos: dto.duracion_minutos ?? this.firstSlotDuration(items),
            total_slots: totalSlots,
            ...(week > 0 ? { nota: `Disponibilidad encontrada en la semana ${week + 1}` } : {}),
            profesionales,
          };
        }
      }

      current = current.add(7, 'days');
    }

    return {
      message: `No se encontraron horarios disponibles en las próximas ${MAX_WEEKS} semanas`,
    };
  }

  /** Duración (min) efectiva: la del primer slot encontrado entre los profesionales. */
  private firstSlotDuration(items: SacmedAvailabilityItem[]): number | undefined {
    for (const item of items) {
      const slot = (item.slots || []).find((s) => s.duration != null);
      if (slot) return slot.duration;
    }
    return undefined;
  }

  /**
   * Compacta la disponibilidad cruda a: profesional → días → slots["HH:MM"].
   * Deduplica fecha y metadatos del profesional (no se repiten por slot) y
   * descarta `termino`/`duration` (la duración va en la raíz; el `termino` lo
   * reconstruye `crear_cita` con `duracion_minutos`).
   */
  private transformAvailability(items: SacmedAvailabilityItem[]) {
    return items.map((item) => {
      const slots = item.slots || [];
      const direccion = slots[0]?.address;

      const byDay = new Map<string, string[]>();
      for (const s of slots) {
        const m = s.start?.match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
        if (!m) continue;
        const [, fecha, hhmm] = m;
        if (!byDay.has(fecha)) byDay.set(fecha, []);
        byDay.get(fecha)!.push(hhmm);
      }

      return {
        id_profesional: item.userId,
        nombre_profesional: item.fullName,
        ...(direccion ? { direccion } : {}),
        dias: Array.from(byDay.entries()).map(([fecha, horas]) => ({ fecha, slots: horas })),
      };
    });
  }

  // ============================
  // PACIENTES
  // ============================

  async searchPatient(clientId: string, identification: string) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.searchPatient(identification, config);

    if (!result.success) {
      throw new HttpException(result.error || 'No se encontró al paciente', HttpStatus.BAD_REQUEST);
    }

    if (!result.data || result.data.length === 0) {
      return { message: `No se encontró un paciente con el rut "${identification}"` };
    }

    const p = result.data[0];
    return {
      rut: p.identification,
      nombre: p.firstName,
      apellido_paterno: p.paternalLastName,
      apellido_materno: p.maternalLastName,
      nacionalidad: p.nationality ?? p.nationalityId,
      telefono: p.phone || p.mobilePhone,
      email: p.email,
      fecha_nacimiento: p.birthDay,
    };
  }

  async createPatient(clientId: string, dto: SacmedCreatePatientDto) {
    const config = await this.getSacmedConfig(clientId);

    const rutFormateado = formatearRut(dto.rut);
    // Solo validamos dígito verificador para pacientes chilenos (nacionalidad === 1)
    if (dto.nacionalidad === 1 && !validarRut(rutFormateado)) {
      throw new HttpException('El RUT no es válido', HttpStatus.BAD_REQUEST);
    }

    const birthDay = moment(dto.fecha_nacimiento).format('YYYY-MM-DD');

    const payload: SacmedCreatePatientPayload = {
      firstName: dto.nombre,
      paternalLastName: dto.apellido_paterno,
      maternalLastName: dto.apellido_materno,
      identification: dto.nacionalidad === 1 ? rutFormateado : dto.rut,
      nationalityId: dto.nacionalidad,
      phone: dto.telefono,
      mobilePhone: dto.telefono,
      email: dto.email,
      birthDay,
      addressDTO: {
        street: dto.direccion,
        districtId: dto.comuna,
      },
    };

    const result = await this.sacmedService.createPatient(payload, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'No fue posible crear el paciente',
        HttpStatus.BAD_REQUEST,
      );
    }

    return { message: 'El paciente fue creado exitosamente' };
  }

  // ============================
  // CITAS DEL PACIENTE
  // ============================

  async getPatientAppointments(clientId: string, identification: string) {
    const config = await this.getSacmedConfig(clientId);
    const tz = this.resolveTz(config);
    const result = await this.sacmedService.getEventsByPatient(identification, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'No se encontraron citas asociadas al paciente',
        HttpStatus.BAD_REQUEST,
      );
    }

    const futures = this.filterFutureSorted(result.data || [], tz);

    if (futures.length === 0) {
      return { message: 'No hay citas activas del paciente' };
    }

    return futures.map((appt) => this.formatPatientAppointment(appt, tz));
  }

  private filterFutureSorted(events: SacmedEvent[], tz: string): SacmedEvent[] {
    const now = moment.tz(tz);
    return events
      .map((e) => ({ e, start: this.parseToZone(e.start, tz) }))
      .filter(({ start }) => start && start.isSameOrAfter(now))
      .sort((a, b) => a.start!.valueOf() - b.start!.valueOf())
      .map(({ e }) => e);
  }

  /**
   * Parsea una fecha del backend a la zona de la clínica.
   * - Si trae 'Z' u offset, se respeta y se convierte a la zona.
   * - Si es naive, se ASUME que ya es hora local de la clínica.
   */
  private parseToZone(value: string | undefined, tz: string): moment.Moment | null {
    if (!value) return null;
    const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
    const m = hasTz ? moment.parseZone(value).tz(tz) : moment.tz(value, tz);
    return m.isValid() ? m : null;
  }

  private formatPatientAppointment(appt: SacmedEvent, tz: string) {
    const start = this.parseToZone(appt.start, tz);
    const end = this.parseToZone(appt.end, tz);

    const result: any = {
      id_cita: appt.eventId,
      fecha_inicio: start ? start.format('YYYY-MM-DDTHH:mm:ss') : null,
      fecha_termino: end ? end.format('YYYY-MM-DDTHH:mm:ss') : null,
      estado_cita: appt.statusEvent,
      estado_pago: appt.statusPaid,
      modalidad: appt.tipoServicio,
    };

    if (appt.practitioner) {
      result.profesional = {
        rut: appt.practitioner.identification,
        nombre_profesional: appt.practitioner.firstName,
        apellidos_profesional: appt.practitioner.lastName,
        email: appt.practitioner.email,
      };
    }

    if (appt.joinLink && appt.joinLink.link != null) {
      result.joinLink = appt.joinLink;
    }

    return result;
  }

  // ============================
  // CREAR CITA (+ espejado GHL)
  // ============================

  async createAppointment(clientId: string, dto: SacmedCreateAppointmentDto) {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('sacmed');
    if (!integration) {
      throw new HttpException(
        'Este cliente no tiene integración con Sacmed configurada',
        HttpStatus.BAD_REQUEST,
      );
    }
    const config = integration.config as SacmedConfig;

    // El agente entrega fecha + hora_inicio + duracion_minutos; el proxy arma el
    // rango ISO (hora local naive, como espera Sacmed). `end = inicio + duración`.
    const { start, end } = this.buildEventRange(dto.fecha, dto.hora_inicio, dto.duracion_minutos);

    const payload: SacmedCreateEventPayload = {
      userId: dto.id_profesional,
      start,
      end,
      patientIdentification: dto.rut_paciente,
      phone: dto.telefono,
      email: dto.email,
      serviceId: dto.id_servicio,
      specialtyId: dto.id_especialidad,
    };

    const result = await this.sacmedService.createEvent(payload, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error creando cita', HttpStatus.BAD_REQUEST);
    }

    if (dto.user_id) {
      setImmediate(() => {
        this.mirrorCitaToGHL(client, dto, config).catch((error) =>
          this.logger.error(`Error espejando cita Sacmed en GHL: ${error.message}`),
        );
      });
    }

    return {
      message: 'La cita fue creada exitosamente',
      id_cita: result.data?.eventId,
    };
  }

  /**
   * Construye el rango ISO (hora local naive) de una cita a partir de
   * fecha (YYYY-MM-DD) + hora_inicio (HH:MM o HH:MM:SS) + duración en minutos.
   */
  private buildEventRange(
    fecha: string,
    horaInicio: string,
    duracionMinutos: number,
  ): { start: string; end: string; horaInicioNorm: string } {
    const horaInicioNorm = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio;
    const start = `${fecha}T${horaInicioNorm}`;
    const end = moment(start, 'YYYY-MM-DDTHH:mm:ss')
      .add(duracionMinutos, 'minutes')
      .format('YYYY-MM-DDTHH:mm:ss');
    return { start, end, horaInicioNorm };
  }

  /**
   * Espeja en GHL una cita recién creada en Sacmed.
   * No-op si el cliente no tiene `ghlCalendarId` configurado.
   */
  private async mirrorCitaToGHL(
    client: any,
    dto: SacmedCreateAppointmentDto,
    sacmedConfig: SacmedConfig,
  ): Promise<void> {
    const ghlCfg = this.resolveGhlConfig(client);
    if (!ghlCfg?.ghlCalendarId) {
      this.logger.warn(
        `⚠️ Mirror GHL omitido (Sacmed): cliente sin ghlCalendarId configurado (location=${ghlCfg?.ghlLocationId ?? 'n/a'})`,
      );
      return;
    }
    if (!ghlCfg.timezone) {
      ghlCfg.timezone = sacmedConfig.timezone || client.timezone;
    }

    const { horaInicioNorm } = this.buildEventRange(
      dto.fecha,
      dto.hora_inicio,
      dto.duracion_minutos,
    );

    const customFields = dto.comentario
      ? [{ key: 'comentario', field_value: dto.comentario }]
      : undefined;

    await this.ghlService.integrarCita(ghlCfg, {
      userId: dto.user_id!,
      fecha: dto.fecha,
      hora_inicio: horaInicioNorm,
      duracion: dto.duracion_minutos,
      customFields,
    });
  }

  // ============================
  // CONFIRMAR / CANCELAR
  // ============================

  async confirmAppointment(clientId: string, dto: SacmedAppointmentActionDto) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.updateEventStatus(
      dto.id_cita,
      SACMED_EVENT_STATUS.CONFIRMED,
      config,
    );

    if (!result.success) {
      throw new HttpException(result.error || 'Error confirmando cita', HttpStatus.BAD_REQUEST);
    }

    return { message: 'La cita fue confirmada exitosamente' };
  }

  async cancelAppointment(clientId: string, dto: SacmedAppointmentActionDto) {
    const config = await this.getSacmedConfig(clientId);
    const result = await this.sacmedService.updateEventStatus(
      dto.id_cita,
      SACMED_EVENT_STATUS.CANCELLED,
      config,
    );

    if (!result.success) {
      throw new HttpException(result.error || 'Error cancelando cita', HttpStatus.BAD_REQUEST);
    }

    return { message: 'La cita fue cancelada exitosamente' };
  }

  // ============================
  // TEST DE CONEXIÓN
  // ============================

  async testConnection(clientId: string) {
    const config = await this.getSacmedConfig(clientId);
    return await this.sacmedService.testConnection(config);
  }
}

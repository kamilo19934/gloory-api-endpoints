import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ClientsService } from '../clients/clients.service';
import { GoHighLevelService } from '../integrations/gohighlevel/gohighlevel.service';
import { GoHighLevelConfig, GHLFreeSlots } from '../integrations/gohighlevel/gohighlevel.types';
import { GHLCalendar } from './entities/ghl-calendar.entity';
import { GHLBranch } from './entities/ghl-branch.entity';

// Diccionarios para formato español
const DIAS_SEMANA: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miercoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sabado',
};

const MESES: Record<number, string> = {
  0: 'Enero',
  1: 'Febrero',
  2: 'Marzo',
  3: 'Abril',
  4: 'Mayo',
  5: 'Junio',
  6: 'Julio',
  7: 'Agosto',
  8: 'Septiembre',
  9: 'Octubre',
  10: 'Noviembre',
  11: 'Diciembre',
};

@Injectable()
export class GoHighLevelProxyService {
  private readonly logger = new Logger(GoHighLevelProxyService.name);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly goHighLevelService: GoHighLevelService,
    @InjectRepository(GHLCalendar)
    private readonly calendarRepository: Repository<GHLCalendar>,
    @InjectRepository(GHLBranch)
    private readonly branchRepository: Repository<GHLBranch>,
  ) {}

  private async getGHLConfig(clientId: string): Promise<GoHighLevelConfig> {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('gohighlevel');

    if (!integration) {
      throw new HttpException(
        'Este cliente no tiene integracion con GoHighLevel configurada',
        HttpStatus.BAD_REQUEST,
      );
    }

    return integration.config as GoHighLevelConfig;
  }

  /**
   * Resuelve un índice de calendario (1, 2, 3...) al GHLCalendar correspondiente
   */
  private async resolveCalendar(
    clientId: string,
    calendarIndex: number,
  ): Promise<GHLCalendar> {
    // Buscar todos los calendarios activos ordenados por nombre
    const calendars = await this.calendarRepository.find({
      where: { clientId, activo: true },
      order: { nombre: 'ASC' },
    });

    if (calendarIndex > 0 && calendarIndex <= calendars.length) {
      return calendars[calendarIndex - 1];
    }

    const availableIds = calendars.map((c, i) => `${i + 1} (${c.nombre})`).join(', ');
    throw new HttpException(
      `Calendario con ID ${calendarIndex} no encontrado. Calendarios disponibles: ${availableIds}`,
      HttpStatus.BAD_REQUEST,
    );
  }

  private formatDateSpanish(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${DIAS_SEMANA[date.getDay()]} ${day} ${MESES[date.getMonth()]} ${year}`;
  }

  private calculateSlotDurationFromSlots(slotsData: GHLFreeSlots): number {
    for (const [dateKey, dateData] of Object.entries(slotsData)) {
      if (dateKey === 'traceId') continue;
      const slots = (dateData as any)?.slots || [];
      if (slots.length >= 2) {
        try {
          const first = new Date(slots[0]).getTime();
          const second = new Date(slots[1]).getTime();
          const durationMin = (second - first) / 60000;
          if (durationMin > 0 && durationMin <= 120) {
            return Math.round(durationMin);
          }
        } catch {
          // ignore
        }
      }
    }
    return 30;
  }

  private findConsecutiveSlots(
    slots: string[],
    requiredSlots: number,
    slotDurationMin: number,
  ): string[] {
    if (requiredSlots <= 1) return slots;

    const consecutiveStarts: string[] = [];

    for (let i = 0; i <= slots.length - requiredSlots; i++) {
      let isConsecutive = true;

      for (let j = 1; j < requiredSlots; j++) {
        const prev = new Date(slots[i + j - 1]).getTime();
        const curr = new Date(slots[i + j]).getTime();
        const diffMin = (curr - prev) / 60000;

        if (Math.abs(diffMin - slotDurationMin) > 1) {
          isConsecutive = false;
          break;
        }
      }

      if (isConsecutive) {
        consecutiveStarts.push(slots[i]);
      }
    }

    return consecutiveStarts;
  }

  private extractFormattedSlots(
    slotsData: GHLFreeSlots,
    timezone: string,
    tiempoCitaMin?: number,
    slotDurationMin: number = 30,
  ): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    const requiredSlots = tiempoCitaMin
      ? Math.max(1, Math.ceil(tiempoCitaMin / slotDurationMin))
      : 1;

    for (const [dateStr, dateData] of Object.entries(slotsData)) {
      if (dateStr === 'traceId') continue;

      const slots = (dateData as any)?.slots || [];
      if (slots.length === 0) continue;

      const validSlots =
        requiredSlots > 1
          ? this.findConsecutiveSlots(slots, requiredSlots, slotDurationMin)
          : slots;

      const times: string[] = [];
      for (const slot of validSlots) {
        try {
          const dt = new Date(slot);
          const hours = dt.getHours().toString().padStart(2, '0');
          const minutes = dt.getMinutes().toString().padStart(2, '0');
          times.push(`${hours}:${minutes}`);
        } catch {
          continue;
        }
      }

      if (times.length > 0) {
        const fechaFormateada = this.formatDateSpanish(dateStr);
        formatted[fechaFormateada] = times;
      }
    }

    return formatted;
  }

  // ============================
  // SINCRONIZACION DE CALENDARIOS
  // ============================

  async syncCalendars(clientId: string, force: boolean = false) {
    this.logger.log(
      `Iniciando sincronizacion GHL para cliente ${clientId}${force ? ' (FORZADA)' : ''}`,
    );

    if (force) {
      await this.calendarRepository.delete({ clientId });
      this.logger.log('Calendarios eliminados (modo forzado)');
    }

    const config = await this.getGHLConfig(clientId);

    const calendarsResult = await this.goHighLevelService.getCalendars(config);
    if (!calendarsResult.success || !calendarsResult.data) {
      throw new HttpException(
        `Error obteniendo calendarios de GHL: ${calendarsResult.error}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const calendars = calendarsResult.data;
    const totalCalendariosAPI = calendars.length;
    this.logger.log(`Calendarios encontrados en GHL: ${totalCalendariosAPI}`);

    const existingCalendars = await this.calendarRepository.find({
      where: { clientId },
      select: ['calendarId', 'id'],
    });
    const existingCalendarIds = new Set(existingCalendars.map((c) => c.calendarId));

    let calendariosNuevos = 0;
    let calendariosActualizados = 0;

    for (const calendar of calendars) {
      const calendarResult = await this.goHighLevelService.getCalendar(config, calendar.id);
      const calendarInfo = calendarResult.success ? calendarResult.data : calendar;

      let slotDurationMinutes = 30;
      if (calendarInfo?.slotDuration) {
        slotDurationMinutes =
          calendarInfo.slotDurationUnit === 'hours'
            ? calendarInfo.slotDuration * 60
            : calendarInfo.slotDuration;
      }

      let profesionalNombre = calendar.name || 'Profesional';
      const teamMembers = calendarInfo?.teamMembers || [];
      if (teamMembers.length > 0) {
        const userResult = await this.goHighLevelService.getUser(
          config,
          teamMembers[0].userId,
        );
        if (userResult.success && userResult.data?.name) {
          profesionalNombre = userResult.data.name;
        }
      }

      if (existingCalendarIds.has(calendar.id)) {
        await this.calendarRepository.update(
          { clientId, calendarId: calendar.id },
          {
            nombre: profesionalNombre,
            slotDuration: slotDurationMinutes,
          },
        );
        calendariosActualizados++;
        this.logger.log(`Actualizado: ${profesionalNombre} (${calendar.id})`);
      } else {
        const ghlCalendar = this.calendarRepository.create({
          clientId,
          calendarId: calendar.id,
          nombre: profesionalNombre,
          slotDuration: slotDurationMinutes,
          especialidad: '',
          activo: true,
          branches: [],
        });
        await this.calendarRepository.save(ghlCalendar);
        existingCalendarIds.add(calendar.id);
        calendariosNuevos++;
        this.logger.log(`Nuevo: ${profesionalNombre} (${calendar.id})`);
      }
    }

    const partes: string[] = [];
    if (calendariosNuevos > 0) partes.push(`${calendariosNuevos} calendarios nuevos`);
    if (calendariosActualizados > 0) partes.push(`${calendariosActualizados} calendarios actualizados`);

    const mensaje =
      partes.length === 0
        ? `No se encontraron cambios (${totalCalendariosAPI} calendarios en GHL)`
        : `Sincronizacion GHL completada: ${partes.join(', ')} (de ${totalCalendariosAPI} calendarios en API)`;

    this.logger.log(mensaje);

    return { calendariosNuevos, calendariosActualizados, totalCalendariosAPI, mensaje };
  }

  // ============================
  // SEDES (CRUD)
  // ============================

  async getActiveBranches(clientId: string): Promise<Partial<GHLBranch>[]> {
    return this.branchRepository.find({
      select: ['id', 'nombre', 'direccion', 'telefono', 'ciudad', 'comuna', 'activa'],
      where: { clientId, activa: true },
      order: { nombre: 'ASC' },
    });
  }

  async getAllBranches(clientId: string): Promise<Partial<GHLBranch>[]> {
    return this.branchRepository.find({
      select: ['id', 'nombre', 'direccion', 'telefono', 'ciudad', 'comuna', 'activa'],
      where: { clientId },
      order: { nombre: 'ASC' },
    });
  }

  async createBranch(
    clientId: string,
    data: { nombre: string; direccion?: string; telefono?: string; ciudad?: string; comuna?: string },
  ): Promise<GHLBranch> {
    this.logger.log(`Creando sede GHL para cliente ${clientId}: ${data.nombre}`);

    const branch = this.branchRepository.create({
      clientId,
      nombre: data.nombre,
      direccion: data.direccion || null,
      telefono: data.telefono || null,
      ciudad: data.ciudad || null,
      comuna: data.comuna || null,
      activa: true,
    });

    return this.branchRepository.save(branch);
  }

  async updateBranch(
    clientId: string,
    branchId: number,
    data: { nombre?: string; direccion?: string; telefono?: string; ciudad?: string; comuna?: string },
  ): Promise<GHLBranch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, clientId },
    });

    if (!branch) {
      throw new HttpException('Sede no encontrada', HttpStatus.NOT_FOUND);
    }

    if (data.nombre !== undefined) branch.nombre = data.nombre;
    if (data.direccion !== undefined) branch.direccion = data.direccion;
    if (data.telefono !== undefined) branch.telefono = data.telefono;
    if (data.ciudad !== undefined) branch.ciudad = data.ciudad;
    if (data.comuna !== undefined) branch.comuna = data.comuna;

    return this.branchRepository.save(branch);
  }

  async deleteBranch(clientId: string, branchId: number): Promise<void> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, clientId },
    });

    if (!branch) {
      throw new HttpException('Sede no encontrada', HttpStatus.NOT_FOUND);
    }

    // Remove branch from all calendars
    const calendars = await this.calendarRepository.find({ where: { clientId } });
    for (const calendar of calendars) {
      if (calendar.branches && calendar.branches.includes(branchId)) {
        calendar.branches = calendar.branches.filter((id) => id !== branchId);
        await this.calendarRepository.save(calendar);
      }
    }

    await this.branchRepository.remove(branch);
  }

  async toggleBranch(clientId: string, branchId: number, activa: boolean): Promise<GHLBranch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, clientId },
    });

    if (!branch) {
      throw new HttpException('Sede no encontrada', HttpStatus.NOT_FOUND);
    }

    branch.activa = activa;
    return this.branchRepository.save(branch);
  }

  // ============================
  // CALENDARIOS (CRUD / Admin)
  // ============================

  async getActiveCalendars(clientId: string): Promise<Partial<GHLCalendar>[]> {
    return this.calendarRepository.find({
      select: ['id', 'nombre', 'slotDuration', 'especialidad', 'activo', 'branches'],
      where: { clientId, activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async getAllCalendars(clientId: string): Promise<Partial<GHLCalendar>[]> {
    return this.calendarRepository.find({
      select: ['id', 'nombre', 'slotDuration', 'especialidad', 'activo', 'branches'],
      where: { clientId },
      order: { nombre: 'ASC' },
    });
  }

  async toggleCalendar(clientId: string, calendarId: number, activo: boolean): Promise<GHLCalendar> {
    const calendar = await this.calendarRepository.findOne({
      where: { id: calendarId, clientId },
    });

    if (!calendar) {
      throw new HttpException('Calendario no encontrado', HttpStatus.NOT_FOUND);
    }

    calendar.activo = activo;
    return this.calendarRepository.save(calendar);
  }

  async updateCalendarSpecialty(clientId: string, calendarId: number, especialidad: string): Promise<GHLCalendar> {
    const calendar = await this.calendarRepository.findOne({
      where: { id: calendarId, clientId },
    });

    if (!calendar) {
      throw new HttpException('Calendario no encontrado', HttpStatus.NOT_FOUND);
    }

    calendar.especialidad = especialidad;
    return this.calendarRepository.save(calendar);
  }

  async assignCalendarToBranches(clientId: string, calendarId: number, branchIds: number[]): Promise<GHLCalendar> {
    const calendar = await this.calendarRepository.findOne({
      where: { id: calendarId, clientId },
    });

    if (!calendar) {
      throw new HttpException('Calendario no encontrado', HttpStatus.NOT_FOUND);
    }

    calendar.branches = branchIds;
    return this.calendarRepository.save(calendar);
  }

  async getCalendarsByBranch(clientId: string, branchId: number): Promise<Partial<GHLCalendar>[]> {
    const calendars = await this.calendarRepository.find({
      select: ['id', 'nombre', 'slotDuration', 'especialidad', 'activo', 'branches'],
      where: { clientId, activo: true },
      order: { nombre: 'ASC' },
    });

    return calendars.filter((c) => c.branches && c.branches.includes(branchId));
  }

  async getSpecialties(clientId: string): Promise<string[]> {
    const calendars = await this.calendarRepository.find({
      where: { clientId, activo: true },
    });

    const specialties = new Set<string>();
    for (const c of calendars) {
      if (c.especialidad && c.especialidad.trim() !== '') {
        specialties.add(c.especialidad.trim());
      }
    }

    return Array.from(specialties).sort();
  }

  async getCalendarsBySpecialty(
    clientId: string,
    especialidad: string,
    branchId?: number,
  ): Promise<Partial<GHLCalendar>[]> {
    const calendars = await this.calendarRepository.find({
      select: ['id', 'nombre', 'slotDuration', 'especialidad', 'activo', 'branches'],
      where: { clientId, activo: true, especialidad: Like(`%${especialidad}%`) },
      order: { nombre: 'ASC' },
    });

    if (branchId) {
      return calendars.filter((c) => c.branches && c.branches.includes(branchId));
    }

    return calendars;
  }

  async getStats(clientId: string) {
    const [totalCalendarios, calendariosActivos, totalSedes, sedesActivas] = await Promise.all([
      this.calendarRepository.count({ where: { clientId } }),
      this.calendarRepository.count({ where: { clientId, activo: true } }),
      this.branchRepository.count({ where: { clientId } }),
      this.branchRepository.count({ where: { clientId, activa: true } }),
    ]);

    return { totalCalendarios, calendariosActivos, totalSedes, sedesActivas };
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  async searchAvailability(
    clientId: string,
    params: {
      profesionales: number[];
      fecha_inicio?: string;
      tiempo_cita?: number;
    },
  ) {
    const config = await this.getGHLConfig(clientId);
    const timezone = config.timezone || 'America/Santiago';

    const resultados = [];

    for (const profId of params.profesionales) {
      const calendar = await this.resolveCalendar(clientId, profId);

      const calendarId = calendar.calendarId;

      let horariosDisponibles: Record<string, string[]> = {};
      let slotDurationMinutos = calendar.slotDuration || 30;
      const maxWeeks = 4;

      const startDateStr = params.fecha_inicio || new Date().toISOString().split('T')[0];
      let currentStart = new Date(startDateStr + 'T00:00:00');

      for (let week = 0; week < maxWeeks; week++) {
        const startMs = currentStart.getTime();
        const endDate = new Date(currentStart);
        endDate.setDate(endDate.getDate() + 7);
        const endMs = endDate.getTime();

        const slotsResult = await this.goHighLevelService.getFreeSlots(
          config,
          calendarId,
          startMs,
          endMs,
        );

        if (!slotsResult.success || !slotsResult.data) {
          this.logger.warn(`Error obteniendo slots de GHL para semana ${week + 1}: ${slotsResult.error}`);
          break;
        }

        if (week === 0 && slotDurationMinutos === 30) {
          const calculated = this.calculateSlotDurationFromSlots(slotsResult.data);
          if (calculated !== 30) {
            slotDurationMinutos = calculated;
            this.logger.log(`Slot duration calculado desde slots: ${slotDurationMinutos} min`);
          }
        }

        const formatted = this.extractFormattedSlots(
          slotsResult.data,
          timezone,
          params.tiempo_cita,
          slotDurationMinutos,
        );

        for (const [fecha, horas] of Object.entries(formatted)) {
          if (!horariosDisponibles[fecha]) {
            horariosDisponibles[fecha] = [];
          }
          horariosDisponibles[fecha].push(...horas);
        }

        if (Object.keys(horariosDisponibles).length > 0) {
          break;
        }

        currentStart = endDate;
      }

      resultados.push({
        horarios_disponibles: horariosDisponibles,
        profesional: profId,
        profesional_nombre: calendar.nombre,
      });
    }

    if (params.profesionales.length === 1) {
      return resultados[0];
    }

    return { resultados_profesionales: resultados };
  }

  // ============================
  // CITAS
  // ============================

  async createAppointment(
    clientId: string,
    params: {
      user_id: string;
      profesional: number;
      fecha: string;
      hora_inicio: string;
      tiempo_cita?: number;
      nombre?: string;
      comentario?: string;
      telefono?: string;
      email?: string;
    },
  ) {
    const config = await this.getGHLConfig(clientId);
    const calendar = await this.resolveCalendar(clientId, params.profesional);

    const calendarId = calendar.calendarId;

    const startTimeStr = `${params.fecha}T${params.hora_inicio}:00`;
    const startTime = new Date(startTimeStr);

    if (params.nombre || params.comentario || params.telefono || params.email) {
      const contactPayload: any = {};
      if (params.nombre) contactPayload.name = params.nombre.trim();
      if (params.telefono) contactPayload.phone = params.telefono.trim();
      if (params.email) contactPayload.email = params.email.trim();
      if (params.comentario) {
        contactPayload.customFields = [
          { key: 'comentario', field_value: params.comentario.trim() },
        ];
      }
      try {
        await this.goHighLevelService.updateContact(config, params.user_id, contactPayload);
      } catch (err) {
        this.logger.warn(`Error actualizando contacto GHL: ${err.message}`);
      }
    }

    const payload: any = {
      calendarId,
      locationId: config.ghlLocationId,
      contactId: params.user_id,
      startTime: startTime.toISOString(),
    };

    if (params.tiempo_cita) {
      const endTime = new Date(startTime.getTime() + params.tiempo_cita * 60000);
      payload.endTime = endTime.toISOString();
    }

    payload.title = params.nombre
      ? `${params.nombre.trim()} - ${calendar.nombre}`
      : `Cita - ${calendar.nombre}`;

    const result = await this.goHighLevelService.createAppointment(config, payload);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error creando la cita en GoHighLevel',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      appointmentStatus: result.data?.appointmentStatus || result.data?.status || 'created',
      id: result.data?.id,
      profesional: params.profesional,
      profesional_nombre: calendar.nombre,
    };
  }

  async cancelAppointment(
    clientId: string,
    params: { event_id: string },
  ) {
    const config = await this.getGHLConfig(clientId);
    const result = await this.goHighLevelService.deleteAppointment(config, params.event_id);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error eliminando la cita',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      mensaje: 'Cita eliminada exitosamente',
      succeeded: true,
      event_id: params.event_id,
    };
  }

  async updateAppointment(
    clientId: string,
    params: {
      event_id: string;
      user_id?: string;
      comentario?: string;
      telefono?: string;
    },
  ) {
    const config = await this.getGHLConfig(clientId);

    const appointmentResult = await this.goHighLevelService.getAppointment(config, params.event_id);
    if (!appointmentResult.success) {
      throw new HttpException(
        'No se pudo obtener la cita',
        HttpStatus.BAD_REQUEST,
      );
    }

    const startTimeActual = appointmentResult.data?.startTime;

    if (params.user_id && (params.comentario || params.telefono)) {
      const contactPayload: any = {};
      if (params.telefono) contactPayload.phone = params.telefono.trim();
      if (params.comentario) {
        contactPayload.customFields = [
          { key: 'comentario', field_value: params.comentario },
        ];
      }

      try {
        await this.goHighLevelService.updateContact(config, params.user_id, contactPayload);
      } catch (err) {
        this.logger.warn(`Error actualizando contacto: ${err.message}`);
      }
    }

    if (startTimeActual) {
      await this.goHighLevelService.updateAppointment(config, params.event_id, {
        startTime: startTimeActual,
      } as any);
    }

    return {
      updated: true,
      event_id: params.event_id,
      start_time_usado: startTimeActual,
      custom_fields_actualizados: true,
    };
  }

  async getContactAppointments(
    clientId: string,
    params: { user_id: string },
  ) {
    const config = await this.getGHLConfig(clientId);
    const result = await this.goHighLevelService.getContactAppointments(config, params.user_id);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo citas del contacto',
        HttpStatus.BAD_REQUEST,
      );
    }

    const citas = (result.data || []).map((evento: any) => {
      const startStr = evento.startTime;
      if (!startStr) return null;

      try {
        const dt = new Date(startStr.includes('T') ? startStr : startStr.replace(' ', 'T'));
        return {
          id: evento.id,
          fecha: dt.toISOString().split('T')[0],
          hora: `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return { citas };
  }

  // ============================
  // CALENDARIOS (API de GHL remoto)
  // ============================

  async getRemoteCalendars(clientId: string) {
    const config = await this.getGHLConfig(clientId);
    const result = await this.goHighLevelService.getCalendars(config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo calendarios',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  // ============================
  // TEST DE CONEXION
  // ============================

  async testConnection(clientId: string) {
    const config = await this.getGHLConfig(clientId);
    return await this.goHighLevelService.testConnection(config);
  }
}

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { ClientsService } from '../clients/clients.service';
import { DentalsoftService } from '../integrations/dentalsoft/dentalsoft.service';
import {
  DentalsoftConfig,
  DentalsoftCreateAppointmentPayload,
  DentalsoftCreatePatientPayload,
} from '../integrations/dentalsoft/dentalsoft.types';
import { GHLService } from '../dentalink/ghl.service';
import { GoHighLevelConfig } from '../integrations/gohighlevel/gohighlevel.types';
import { DentalsoftSearchPatientDto } from './dto/search-patient.dto';
import { DentalsoftCreatePatientDto } from './dto/create-patient.dto';
import { DentalsoftMonthlyAvailabilityDto } from './dto/monthly-availability.dto';
import { DentalsoftDailyAvailabilityDto } from './dto/daily-availability.dto';
import { DentalsoftCreateAppointmentDto } from './dto/create-appointment.dto';
import { DentalsoftConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { DentalsoftCancelAppointmentDto } from './dto/cancel-appointment.dto';
import { DentalsoftDayBranchAppointmentsDto } from './dto/day-branch-appointments.dto';
import { DentalsoftPatientAppointmentsDto } from './dto/patient-appointments.dto';
import { DentalsoftProfessionalsBySpecialtyDto } from './dto/professionals-by-specialty.dto';
import { DentalsoftSearchAvailabilityDto } from './dto/search-availability.dto';

@Injectable()
export class DentalsoftProxyService {
  private readonly logger = new Logger(DentalsoftProxyService.name);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly dentalsoftService: DentalsoftService,
    private readonly ghlService: GHLService,
  ) {}

  /**
   * Resuelve cuántos bloques corresponden a una duración pedida en minutos,
   * reportando si hubo ajuste por no ser múltiplo del bloque.
   *
   * Si `duracionMinutos` viene `undefined` (el agente no la pasó), usa la
   * duración mínima de la clínica = 1 bloque. El response indica esto con
   * `default_aplicado: true` y `duracion_solicitada_minutos: null`.
   *
   * Si vino una duración pero no es múltiplo del bloque (ej: 40 min con bloque
   * de 15), redondea hacia arriba (3 bloques = 45 min) y marca
   * `ajuste_aplicado: true` para que el agente lo informe al paciente.
   */
  private async resolverDuracion(
    duracionMinutos: number | undefined,
    config: DentalsoftConfig,
  ): Promise<{
    duracion_bloque_minutos: number;
    duracion_solicitada_minutos: number | null;
    duracion_buscada_minutos: number;
    bloques: number;
    ajuste_aplicado: boolean;
    mensaje_ajuste?: string;
    default_aplicado: boolean;
    mensaje_default?: string;
  }> {
    const blockLength = await this.dentalsoftService.getBlockLength(config);
    const defaultAplicado = duracionMinutos === undefined;
    const duracionEfectiva = duracionMinutos ?? blockLength;
    const bloques = Math.ceil(duracionEfectiva / blockLength);
    const buscada = bloques * blockLength;
    const ajuste = !defaultAplicado && buscada !== duracionEfectiva;

    return {
      duracion_bloque_minutos: blockLength,
      duracion_solicitada_minutos: defaultAplicado ? null : duracionEfectiva,
      duracion_buscada_minutos: buscada,
      bloques,
      ajuste_aplicado: ajuste,
      mensaje_ajuste: ajuste
        ? `La duración solicitada (${duracionEfectiva} min) no es múltiplo de la duración del bloque de agenda (${blockLength} min). Se usaron ${bloques} bloques = ${buscada} min.`
        : undefined,
      default_aplicado: defaultAplicado,
      mensaje_default: defaultAplicado
        ? `No se entregó duración explícita. Se usó la duración mínima de la clínica: 1 bloque = ${blockLength} min.`
        : undefined,
    };
  }

  private async getDentalsoftConfig(clientId: string): Promise<DentalsoftConfig> {
    const { config } = await this.getClientAndConfig(clientId);
    return config;
  }

  private async getClientAndConfig(
    clientId: string,
  ): Promise<{ client: any; config: DentalsoftConfig }> {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('dentalsoft');
    if (!integration) {
      throw new HttpException(
        'Este cliente no tiene integración con Dentalsoft configurada',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { client, config: integration.config as DentalsoftConfig };
  }

  /**
   * Resuelve el timezone de la clínica priorizando la config de Dentalsoft, luego el
   * del cliente. Cae a `America/Santiago` solo como último recurso (clientes chilenos)
   * para garantizar un tz válido para moment.
   */
  private resolveTz(config: DentalsoftConfig, client?: any): string {
    const tz = config.timezone || client?.timezone || 'America/Santiago';
    return moment.tz.zone(tz) ? tz : 'America/Santiago';
  }

  private readonly DIAS_SEMANA = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  private readonly MESES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  /**
   * Formatea una fecha `YYYY-MM-DD` a un texto legible en español, ej:
   * `2026-06-09` → "Martes 9 de Junio 2026". Si la fecha no es válida, devuelve
   * el valor original.
   */
  private formatFechaLegible(fecha: string): string {
    const m = moment(fecha, 'YYYY-MM-DD', true);
    if (!m.isValid()) return fecha;
    return `${this.DIAS_SEMANA[m.day()]} ${m.date()} de ${this.MESES[m.month()]} ${m.year()}`;
  }

  /**
   * Resuelve la config GHL: 1) integration `gohighlevel`, 2) campos `ghl*` embebidos en la
   * config de Dentalsoft. Patrón espejado de [reservo-proxy.service.ts:54].
   */
  private resolveGhlConfig(client: any): GoHighLevelConfig | undefined {
    const ghl = client.integrations?.find((i: any) => i.integrationType === 'gohighlevel');
    if (ghl?.config?.ghlLocationId) {
      return ghl.config as GoHighLevelConfig;
    }

    const dentalsoft = client.integrations?.find((i: any) => i.integrationType === 'dentalsoft');
    const cfg = dentalsoft?.config;
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

  // ============================
  // TEST DE CONEXION
  // ============================

  async testConnection(clientId: string) {
    const config = await this.getDentalsoftConfig(clientId);
    return await this.dentalsoftService.testConnection(config);
  }

  // ============================
  // PACIENTES
  // ============================

  async searchPatient(clientId: string, dto: DentalsoftSearchPatientDto) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.searchPatient(
      { cedula: dto.cedula, tipo_cedula_texto: dto.tipo_cedula_texto ?? 'rut' },
      config,
    );

    if (!result.success) {
      throw new HttpException(result.error || 'Error buscando paciente', HttpStatus.BAD_REQUEST);
    }

    return result.data;
  }

  async createPatient(clientId: string, dto: DentalsoftCreatePatientDto) {
    const config = await this.getDentalsoftConfig(clientId);

    const payload: DentalsoftCreatePatientPayload = {
      cedula: dto.cedula,
      tipo_cedula_texto: dto.tipo_cedula_texto,
      nombre: dto.nombre,
      apellido_paterno: dto.apellido_paterno,
      apellido_materno: dto.apellido_materno,
      email: dto.email,
      celular: dto.celular,
      id_referencia: dto.id_referencia,
    };

    const result = await this.dentalsoftService.createPatient(payload, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error creando paciente', HttpStatus.BAD_REQUEST);
    }

    return result.data;
  }

  // ============================
  // PROFESIONALES / ESPECIALIDADES
  // ============================

  async getProfesionales(clientId: string) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.getProfesionales(config);
    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo profesionales',
        HttpStatus.BAD_REQUEST,
      );
    }
    return result.data;
  }

  /**
   * Lista profesionales filtrados por especialidad (match parcial case-insensitive).
   *
   * Resuelve la relación profesional↔especialidad vía `/usuario/listado` (más
   * confiable que `/profesional/listado/especialidad`, que no está disponible
   * en todos los tenants). Filtra a usuarios con agenda activa que tengan al
   * menos una especialidad cuyo nombre contenga el filtro pedido.
   *
   * Cada profesional viene con TODAS sus especialidades activas, no solo la
   * filtrada — útil para que el agente entienda el perfil completo.
   *
   * El `id_profesional` se deriva del cuerpo del RUT (sin DV), matcheando el
   * formato que usan los demás endpoints (`/professionals`, `/availability/...`,
   * `/appointments`).
   */
  async getProfesionalesPorEspecialidad(
    clientId: string,
    dto: DentalsoftProfessionalsBySpecialtyDto,
  ) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.getUsuarios(config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo usuarios desde Dentalsoft',
        HttpStatus.BAD_REQUEST,
      );
    }

    const needle = dto.especialidad.toLowerCase();
    const conAgenda = (result.data || []).filter(
      (u) => u.tipo_profesional === 'Usuario con agenda' && u.activo,
    );

    const matched = conAgenda
      .filter((u) =>
        (u.especialidades || []).some((e) => (e.nombre || '').toLowerCase().includes(needle)),
      )
      .map((u) => {
        const rutBody = u.rut?.split('-')[0]?.replace(/\D/g, '') || '';
        return {
          id_profesional: parseInt(rutBody, 10) || 0,
          nombre: u.nombre,
          apellido_paterno: u.apellido_paterno,
          apellido_materno: u.apellido_materno ?? null,
          especialidades: u.especialidades || [],
          sucursales: u.sucursales || [],
        };
      });

    // Sin match: un [] pelado no le da al agente ninguna pista para cambiar de
    // estrategia (se observaron loops de reintentos idénticos con "TTM", que en
    // la clínica está registrada con otro nombre). Devolver las especialidades
    // que sí tienen profesionales le permite autocorregir el filtro en una
    // sola llamada.
    if (matched.length === 0) {
      const disponibles = Array.from(
        new Set(
          conAgenda.flatMap((u) =>
            (u.especialidades || []).map((e) => e.nombre).filter(Boolean),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es'));
      return {
        profesionales: [],
        mensaje:
          `Ninguna especialidad registrada coincide con "${dto.especialidad}". ` +
          `Especialidades con profesionales disponibles: ${disponibles.join(', ')}. ` +
          'Vuelve a filtrar usando uno de esos nombres exactos, o pide el listado completo de profesionales. ' +
          'No repitas esta búsqueda con el mismo término.',
      };
    }

    return matched;
  }

  /**
   * Retorna solo las especialidades que cumplen dos condiciones:
   *  - `activo === true` en el catálogo de la clínica, y
   *  - existe al menos un profesional activo con agenda que las tiene asignadas.
   *
   * Esto evita que el agente ofrezca especialidades "fantasma" — que están en el
   * catálogo pero que ningún profesional realmente atiende, lo que llevaría a un
   * `/professionals/by-specialty` vacío. Hace dos llamadas en paralelo a
   * `/especialidad/listado` y `/usuario/listado`.
   */
  async getEspecialidades(clientId: string) {
    const config = await this.getDentalsoftConfig(clientId);

    const [especsResult, usuariosResult] = await Promise.all([
      this.dentalsoftService.getEspecialidades(config),
      this.dentalsoftService.getUsuarios(config),
    ]);

    if (!especsResult.success) {
      throw new HttpException(
        especsResult.error || 'Error obteniendo especialidades',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!usuariosResult.success) {
      throw new HttpException(
        usuariosResult.error || 'Error resolviendo profesionales por especialidad',
        HttpStatus.BAD_REQUEST,
      );
    }

    // IDs de especialidades que tienen al menos un profesional activo con agenda.
    const conProfesional = new Set<number>();
    for (const usuario of usuariosResult.data || []) {
      if (usuario.tipo_profesional !== 'Usuario con agenda' || !usuario.activo) continue;
      for (const esp of usuario.especialidades || []) {
        if (typeof esp.id === 'number') conProfesional.add(esp.id);
      }
    }

    return (especsResult.data || []).filter(
      (esp) => esp.activo && conProfesional.has(esp.id),
    );
  }

  // ============================
  // SUCURSALES
  // ============================

  async getSucursales(clientId: string) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.getSucursales(config);
    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo sucursales',
        HttpStatus.BAD_REQUEST,
      );
    }
    return result.data;
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  /**
   * Trae el listado real de profesionales como `Map<id_profesional, nombre_completo>`.
   * Best-effort: si la llamada falla devuelve un mapa vacío (no bloquea el flujo).
   */
  private async buildProfMap(config: DentalsoftConfig): Promise<Map<number, string>> {
    const profMap = new Map<number, string>();
    const result = await this.dentalsoftService.getProfesionales(config);
    for (const p of result.data || []) {
      profMap.set(p.id_profesional, p.nombre_completo);
    }
    return profMap;
  }

  /**
   * Valida que los `id_profesional` pedidos existan realmente en Dentalsoft.
   *
   * Dentalsoft NO devuelve 404 ante un id inexistente: simplemente entrega
   * disponibilidad vacía, indistinguible de una agenda llena. Eso hacía que el
   * agente reportara "sin horas en 4 semanas" cuando en realidad el id estaba
   * inventado (los id reales se derivan del cuerpo del RUT, 7-8 dígitos). Acá
   * lo cortamos con un error accionable que nombra la tool correcta, en vez de
   * un silencioso 0 slots.
   *
   * Best-effort: si no se pudo traer el listado (mapa vacío) no bloquea.
   */
  private assertProfesionalesValidos(profMap: Map<number, string>, ids: number[]): void {
    if (profMap.size === 0) return; // no se pudo validar; no empeorar el flujo
    const invalidos = ids.filter((id) => !profMap.has(id));
    if (invalidos.length === 0) return;

    const disponibles = Array.from(profMap.entries())
      .map(([id, nombre]) => `${id} (${nombre})`)
      .join(', ');
    throw new HttpException(
      `Error: el/los id_profesional [${invalidos.join(', ')}] no existe(n) en Dentalsoft. ` +
        'Usa la tool "listar_profesionales" para obtener los IDs correctos — nunca los inventes. ' +
        `Profesionales disponibles: ${disponibles}.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  async getMonthlyAvailability(clientId: string, dto: DentalsoftMonthlyAvailabilityDto) {
    const { client, config } = await this.getClientAndConfig(clientId);
    const [dur, profMap] = await Promise.all([
      this.resolverDuracion(dto.duracion_minutos, config),
      this.buildProfMap(config),
    ]);
    this.assertProfesionalesValidos(profMap, [dto.id_profesional]);
    const result = await this.dentalsoftService.getMonthlyAvailability(
      {
        id_profesional: dto.id_profesional,
        year: dto.year,
        month: dto.month,
        id_sucursal: dto.id_sucursal,
        bloques: dur.bloques,
      },
      config,
    );
    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo disponibilidad mensual',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Descartar días que ya pasaron (anteriores a hoy en la zona de la clínica) y
    // agregar la fecha legible. Dentalsoft no filtra el presente.
    const tz = this.resolveTz(config, client);
    const hoy = moment.tz(tz).format('YYYY-MM-DD');
    const dias = (result.data || [])
      .filter((dia) => dia.fecha >= hoy)
      .map((dia) => ({ ...dia, fecha: this.formatFechaLegible(dia.fecha) }));

    return {
      duracion_bloque_minutos: dur.duracion_bloque_minutos,
      duracion_solicitada_minutos: dur.duracion_solicitada_minutos,
      duracion_buscada_minutos: dur.duracion_buscada_minutos,
      ajuste_aplicado: dur.ajuste_aplicado,
      mensaje_ajuste: dur.mensaje_ajuste,
      default_aplicado: dur.default_aplicado,
      mensaje_default: dur.mensaje_default,
      dias,
    };
  }

  /**
   * Búsqueda de disponibilidad de alto nivel — el agente solo pasa una fecha de
   * inicio, duración en minutos, y uno o varios profesionales. El proxy:
   *   1. Convierte la duración a bloques usando el largo de bloque cacheado.
   *   2. Itera por semanas (7 días desde `fecha_inicio`) hasta encontrar disponibilidad
   *      o agotar 4 semanas. Si la primera semana está vacía, salta a la siguiente.
   *   3. En cada semana, consulta disponibilidad de TODOS los profesionales × TODOS los
   *      días en paralelo (7 × N profesionales requests).
   *   4. Aplica cap de 50 slots SIN cortar disponibilidad de un día: agrega días enteros
   *      hasta alcanzar el cap, luego corta.
   *
   * Devuelve un array agrupado por fecha. Cada slot incluye `id_profesional` para
   * que el agente pueda agendar directamente con `crear_cita`.
   */
  async searchAvailability(clientId: string, dto: DentalsoftSearchAvailabilityDto) {
    const { client, config } = await this.getClientAndConfig(clientId);
    // Resolver duración (bloques + ajuste) y listado de profesionales en paralelo.
    // El listado se usa para mapear id_profesional → nombre_completo en la respuesta.
    const [dur, profesionalesResult] = await Promise.all([
      this.resolverDuracion(dto.duracion_minutos, config),
      this.dentalsoftService.getProfesionales(config),
    ]);
    const bloques = dur.bloques;

    // "Ahora" en la zona de la clínica — para descartar horarios que ya pasaron.
    // La API de Dentalsoft no filtra el presente, así que lo hacemos acá.
    const tz = this.resolveTz(config, client);
    const now = moment.tz(tz);
    const profMap = new Map<number, string>();
    for (const p of profesionalesResult.data || []) {
      profMap.set(p.id_profesional, p.nombre_completo);
    }
    // Validar los IDs pedidos contra el listado real: un id inexistente da 0
    // slots silenciosos (Dentalsoft no 404ea), indistinguible de agenda llena.
    this.assertProfesionalesValidos(profMap, dto.id_profesional);

    const MAX_WEEKS = 4;
    const MAX_SLOTS = 50;
    const startDate = new Date(`${dto.fecha_inicio}T00:00:00Z`);

    const toYmd = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`;

    for (let week = 0; week < MAX_WEEKS; week++) {
      // 7 días consecutivos desde fecha_inicio + week*7
      const days: string[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(startDate);
        day.setUTCDate(startDate.getUTCDate() + week * 7 + d);
        days.push(toYmd(day));
      }

      // Todas las llamadas (días × profesionales) en paralelo
      type Call = { fecha: string; id_profesional: number };
      const calls: Call[] = days.flatMap((fecha) =>
        dto.id_profesional.map((id_profesional) => ({ fecha, id_profesional })),
      );

      const results = await Promise.all(
        calls.map((c) =>
          this.dentalsoftService.getDailyAvailability(
            {
              id_profesional: c.id_profesional,
              fecha: c.fecha,
              id_sucursal: dto.id_sucursal,
              duracion: bloques,
            },
            config,
          ),
        ),
      );

      // Agrupar slots por fecha → profesional → sala. La estructura final por día es:
      //   { fecha, total_slots, profesionales: [
      //       { id_profesional, nombre_profesional, salas: [
      //           { id_sala, nombre_sala, slots: ["HH:MM", ...] }
      //         ] }
      //     ] }
      // Por día / por profesional / por sala se ordenan las horas ascendente.
      const byDate = new Map<string, Map<number, Map<number, { nombre_sala: string; slots: Set<string> }>>>();

      for (let i = 0; i < calls.length; i++) {
        const { fecha, id_profesional } = calls[i];
        const slots = results[i].data || [];
        if (slots.length === 0) continue;
        for (const slot of slots) {
          // Descartar horarios que ya pasaron (presente y pasado).
          const slotInicio = moment.tz(`${fecha}T${slot.inicio}`, tz);
          if (slotInicio.isValid() && slotInicio.isBefore(now)) continue;

          if (!byDate.has(fecha)) byDate.set(fecha, new Map());
          const profMap2 = byDate.get(fecha)!;
          if (!profMap2.has(id_profesional)) profMap2.set(id_profesional, new Map());
          const salaMap = profMap2.get(id_profesional)!;
          if (!salaMap.has(slot.id_sala)) {
            salaMap.set(slot.id_sala, { nombre_sala: slot.nombre_sala, slots: new Set() });
          }
          // Hora sin segundos
          salaMap.get(slot.id_sala)!.slots.add(slot.inicio.slice(0, 5));
        }
      }

      const weekDays = days
        .map((fecha) => {
          const profMapDia = byDate.get(fecha);
          if (!profMapDia) return null;
          let totalDia = 0;
          const profesionales = Array.from(profMapDia.entries()).map(
            ([id_profesional, salaMap]) => {
              const salas = Array.from(salaMap.entries()).map(([id_sala, info]) => {
                const slotsOrdenados = Array.from(info.slots).sort();
                totalDia += slotsOrdenados.length;
                return {
                  id_sala,
                  nombre_sala: info.nombre_sala,
                  slots: slotsOrdenados,
                };
              });
              return {
                id_profesional,
                nombre_profesional: profMap.get(id_profesional) || `Profesional ${id_profesional}`,
                salas,
              };
            },
          );
          // `fecha` se mantiene en ISO (YYYY-MM-DD) para la lógica interna; se
          // convierte a texto legible recién en la respuesta.
          return { fecha, total_slots: totalDia, profesionales };
        })
        .filter(
          (d): d is { fecha: string; total_slots: number; profesionales: any[] } => d !== null,
        );

      if (weekDays.length === 0) continue; // sin disponibilidad, siguiente semana

      // Cap de 50 sin cortar días: agregar días enteros hasta llegar al cap
      const capped: typeof weekDays = [];
      let total = 0;
      for (const day of weekDays) {
        capped.push(day);
        total += day.total_slots;
        if (total >= MAX_SLOTS) break;
      }
      const capAlcanzado = capped.length < weekDays.length;

      return {
        duracion_bloque_minutos: dur.duracion_bloque_minutos,
        duracion_solicitada_minutos: dur.duracion_solicitada_minutos,
        duracion_buscada_minutos: dur.duracion_buscada_minutos,
        ajuste_aplicado: dur.ajuste_aplicado,
        mensaje_ajuste: dur.mensaje_ajuste,
        default_aplicado: dur.default_aplicado,
        mensaje_default: dur.mensaje_default,
        semana_buscada: {
          // `desde` = primer día de la semana buscada.
          // `hasta` = último día efectivamente entregado (puede ser < día 7 si se aplicó el cap).
          desde: this.formatFechaLegible(days[0]),
          hasta: this.formatFechaLegible(capped[capped.length - 1].fecha),
          numero: week + 1, // 1-indexed para la UI/agente
        },
        cap_alcanzado: capAlcanzado,
        total_slots: total,
        dias: capped.map((d) => ({ ...d, fecha: this.formatFechaLegible(d.fecha) })),
      };
    }

    return {
      duracion_bloque_minutos: dur.duracion_bloque_minutos,
      duracion_solicitada_minutos: dur.duracion_solicitada_minutos,
      duracion_buscada_minutos: dur.duracion_buscada_minutos,
      ajuste_aplicado: dur.ajuste_aplicado,
      mensaje_ajuste: dur.mensaje_ajuste,
      default_aplicado: dur.default_aplicado,
      mensaje_default: dur.mensaje_default,
      mensaje: `Sin disponibilidad en las próximas ${MAX_WEEKS} semanas desde ${dto.fecha_inicio}`,
      semana_buscada: null,
      cap_alcanzado: false,
      total_slots: 0,
      dias: [],
    };
  }

  async getDailyAvailability(clientId: string, dto: DentalsoftDailyAvailabilityDto) {
    const { client, config } = await this.getClientAndConfig(clientId);
    const [dur, profMap] = await Promise.all([
      this.resolverDuracion(dto.duracion_minutos, config),
      this.buildProfMap(config),
    ]);
    this.assertProfesionalesValidos(profMap, [dto.id_profesional]);
    const result = await this.dentalsoftService.getDailyAvailability(
      {
        id_profesional: dto.id_profesional,
        fecha: dto.fecha,
        id_sucursal: dto.id_sucursal,
        duracion: dur.bloques,
      },
      config,
    );
    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo disponibilidad diaria',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Descartar horarios que ya pasaron (Dentalsoft no filtra el presente).
    const tz = this.resolveTz(config, client);
    const now = moment.tz(tz);
    const slots = (result.data || []).filter((slot) => {
      const slotInicio = moment.tz(`${dto.fecha}T${slot.inicio}`, tz);
      return !slotInicio.isValid() || !slotInicio.isBefore(now);
    });

    return {
      duracion_bloque_minutos: dur.duracion_bloque_minutos,
      duracion_solicitada_minutos: dur.duracion_solicitada_minutos,
      duracion_buscada_minutos: dur.duracion_buscada_minutos,
      ajuste_aplicado: dur.ajuste_aplicado,
      mensaje_ajuste: dur.mensaje_ajuste,
      default_aplicado: dur.default_aplicado,
      mensaje_default: dur.mensaje_default,
      fecha: this.formatFechaLegible(dto.fecha),
      slots,
    };
  }

  // ============================
  // CITAS
  // ============================

  async getAppointment(clientId: string, citaId: number) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.getAppointment(citaId, config);
    if (!result.success) {
      throw new HttpException(result.error || 'Error obteniendo cita', HttpStatus.BAD_REQUEST);
    }
    return result.data;
  }

  async getAppointmentsByBranchAndDate(clientId: string, dto: DentalsoftDayBranchAppointmentsDto) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.getAppointmentsByBranchAndDate(
      { fecha: dto.fecha, id_sucursal: dto.id_sucursal },
      config,
    );
    if (!result.success) {
      throw new HttpException(result.error || 'Error obteniendo citas', HttpStatus.BAD_REQUEST);
    }
    return result.data;
  }

  async createAppointment(clientId: string, dto: DentalsoftCreateAppointmentDto) {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('dentalsoft');
    if (!integration) {
      throw new HttpException(
        'Este cliente no tiene integración con Dentalsoft configurada',
        HttpStatus.BAD_REQUEST,
      );
    }
    const config = integration.config as DentalsoftConfig;
    const [dur, profMap] = await Promise.all([
      this.resolverDuracion(dto.duracion_minutos, config),
      this.buildProfMap(config),
    ]);
    this.assertProfesionalesValidos(profMap, [dto.id_profesional]);

    const payload: DentalsoftCreateAppointmentPayload = {
      sucursal: dto.id_sucursal,
      profesional: dto.id_profesional,
      sala: dto.id_sala,
      paciente: dto.id_paciente,
      fecha: dto.fecha,
      inicio: dto.inicio,
      bloques: dur.bloques,
      // Dentalsoft espera `observacion`; nosotros lo recibimos como `comentario`
      // para mantener consistencia con Dentalink y con el custom field de GHL.
      observacion: dto.comentario || '',
    };

    const result = await this.dentalsoftService.createAppointment(payload, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error creando cita', HttpStatus.BAD_REQUEST);
    }

    if (dto.user_id) {
      setImmediate(() => {
        this.mirrorCitaToGHL(client, dto, dur.duracion_buscada_minutos, config).catch((error) =>
          this.logger.error(`Error espejando cita Dentalsoft en GHL: ${error.message}`),
        );
      });
    }

    return {
      ...result.data,
      duracion_bloque_minutos: dur.duracion_bloque_minutos,
      duracion_solicitada_minutos: dur.duracion_solicitada_minutos,
      duracion_agendada_minutos: dur.duracion_buscada_minutos,
      ajuste_aplicado: dur.ajuste_aplicado,
      mensaje_ajuste: dur.mensaje_ajuste,
      default_aplicado: dur.default_aplicado,
      mensaje_default: dur.mensaje_default,
    };
  }

  /**
   * Espeja en GHL una cita recién creada en Dentalsoft. No-op si no hay `ghlCalendarId`.
   * `duracionMinutos` es la duración REAL agendada (ya ajustada al múltiplo de bloque),
   * no la que pidió el agente — así GHL queda con el `endTime` correcto.
   */
  private async mirrorCitaToGHL(
    client: any,
    dto: DentalsoftCreateAppointmentDto,
    duracionMinutos: number,
    dentalsoftConfig: DentalsoftConfig,
  ): Promise<void> {
    const ghlCfg = this.resolveGhlConfig(client);
    if (!ghlCfg?.ghlCalendarId) {
      this.logger.warn(
        `⚠️ Mirror GHL omitido (Dentalsoft): cliente sin ghlCalendarId (location=${ghlCfg?.ghlLocationId ?? 'n/a'})`,
      );
      return;
    }
    if (!ghlCfg.timezone) {
      ghlCfg.timezone = dentalsoftConfig.timezone || client.timezone;
    }

    const customFields = dto.comentario
      ? [{ key: 'comentario', field_value: dto.comentario }]
      : undefined;

    await this.ghlService.integrarCita(ghlCfg, {
      userId: dto.user_id!,
      fecha: dto.fecha,
      hora_inicio: dto.inicio.length === 5 ? `${dto.inicio}:00` : dto.inicio,
      duracion: duracionMinutos,
      customFields,
    });
  }

  /**
   * Citas del paciente, separadas en `futuras` (sorted ASC) y `pasadas` (top 5,
   * sorted DESC por fecha). Las canceladas (`estado_cita="Cancelada"`) se excluyen
   * de ambas listas — el agente no necesita verlas para el contexto inicial.
   *
   * Internamente consulta `/agenda/informes/horas/efectivas` con rango fijo
   * [hoy-180d, hoy+180d]; el agente solo pasa `id_paciente`, sin riesgo de loops
   * por rangos ad-hoc.
   */
  async getPatientAppointments(clientId: string, dto: DentalsoftPatientAppointmentsDto) {
    const config = await this.getDentalsoftConfig(clientId);

    const WINDOW_DAYS = 180;
    const today = new Date();
    const desde = new Date(today);
    desde.setUTCDate(today.getUTCDate() - WINDOW_DAYS);
    const hasta = new Date(today);
    hasta.setUTCDate(today.getUTCDate() + WINDOW_DAYS);
    const toYmd = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const result = await this.dentalsoftService.getPatientAppointmentsInRange(
      {
        id_paciente: dto.id_paciente,
        fecha_desde: toYmd(desde),
        fecha_hasta: toYmd(hasta),
        onlyFuture: false, // queremos pasadas también; partimos abajo
      },
      config,
    );
    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo citas del paciente',
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = Date.now();
    const activas = (result.data || []).filter(
      (c) => (c.estado_cita || '').toLowerCase() !== 'cancelada',
    );
    const withTs = activas.map((c) => ({
      cita: c,
      ts: new Date(`${c.fecha_cita}T${c.hora_cita}:00`).getTime(),
    }));

    const futuras = withTs
      .filter((x) => x.ts >= now)
      .sort((a, b) => a.ts - b.ts)
      .map((x) => x.cita);

    const pasadas = withTs
      .filter((x) => x.ts < now)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
      .map((x) => x.cita);

    return { futuras, pasadas };
  }

  async confirmAppointment(clientId: string, dto: DentalsoftConfirmAppointmentDto) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.changeAppointmentState(dto.id, 'confirmar', config);
    if (!result.success) {
      throw new HttpException(result.error || 'Error confirmando cita', HttpStatus.BAD_REQUEST);
    }
    return result.data;
  }

  async cancelAppointment(clientId: string, dto: DentalsoftCancelAppointmentDto) {
    const config = await this.getDentalsoftConfig(clientId);
    const result = await this.dentalsoftService.changeAppointmentState(dto.id, 'cancelar', config);
    if (!result.success) {
      throw new HttpException(result.error || 'Error cancelando cita', HttpStatus.BAD_REQUEST);
    }
    return result.data;
  }
}

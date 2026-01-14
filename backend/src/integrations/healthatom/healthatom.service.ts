import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as moment from 'moment-timezone';
import {
  HealthAtomApi,
  HealthAtomConfig,
  DENTALINK_ENDPOINTS,
  MEDILINK_ENDPOINTS,
  NormalizedProfessional,
  NormalizedBranch,
  NormalizedPatient,
  NormalizedAvailability,
  DualApiOperationResult,
  ApiEndpoints,
} from './healthatom.types';

/**
 * Servicio unificado para APIs de HealthAtom (Dentalink y MediLink)
 * Implementa la estrategia de "intentar con ambas APIs"
 */
@Injectable()
export class HealthAtomService {
  private readonly logger = new Logger(HealthAtomService.name);

  /**
   * Crea cliente HTTP para una API específica
   */
  private createClient(apiKey: string, api: HealthAtomApi): AxiosInstance {
    const endpoints = api === HealthAtomApi.DENTALINK ? DENTALINK_ENDPOINTS : MEDILINK_ENDPOINTS;
    return axios.create({
      baseURL: endpoints.baseUrl,
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Obtiene el orden de APIs a intentar
   * Siempre intenta primero Dentalink, luego MediLink como fallback
   */
  private getApisToTry(): HealthAtomApi[] {
    return [HealthAtomApi.DENTALINK, HealthAtomApi.MEDILINK];
  }

  /**
   * Obtiene los endpoints para una API
   */
  private getEndpoints(api: HealthAtomApi): ApiEndpoints {
    return api === HealthAtomApi.DENTALINK ? DENTALINK_ENDPOINTS : MEDILINK_ENDPOINTS;
  }

  // ============================
  // PROFESIONALES
  // ============================

  /**
   * Obtiene profesionales de ambas APIs
   */
  async getProfessionals(config: HealthAtomConfig): Promise<DualApiOperationResult<NormalizedProfessional[]>> {
    const errors: string[] = [];
    const allProfessionals: NormalizedProfessional[] = [];
    const seenIds = new Set<number>();

    for (const api of [HealthAtomApi.DENTALINK, HealthAtomApi.MEDILINK]) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔍 Obteniendo profesionales de ${api}`);

        if (api === HealthAtomApi.DENTALINK) {
          const response = await client.get(endpoints.professionals);
          const dentistas = response.data?.data || [];

          for (const dentista of dentistas) {
            if (!seenIds.has(dentista.id)) {
              seenIds.add(dentista.id);
              allProfessionals.push(this.normalizeProfessional(dentista, api));
            }
          }
          this.logger.log(`✅ ${dentistas.length} profesionales de Dentalink`);
        } else {
          // MediLink requiere obtener IDs primero o usar paginación
          // Por ahora obtenemos los primeros 100
          const response = await client.get(`${endpoints.professionals}?limit=100`);
          const profesionales = response.data?.data || [];

          for (const prof of profesionales) {
            if (!seenIds.has(prof.id)) {
              seenIds.add(prof.id);
              allProfessionals.push(this.normalizeProfessional(prof, api));
            }
          }
          this.logger.log(`✅ ${profesionales.length} profesionales de MediLink`);
        }
      } catch (error: any) {
        const msg = `${api}: ${error.response?.status || error.message}`;
        this.logger.warn(`⚠️ Error en ${api}: ${msg}`);
        errors.push(msg);
      }
    }

    if (allProfessionals.length === 0) {
      return { success: false, error: 'No se pudieron obtener profesionales', details: errors };
    }

    return { success: true, data: allProfessionals };
  }

  /**
   * Obtiene un profesional por ID intentando en ambas APIs
   */
  async getProfessionalById(
    professionalId: number,
    config: HealthAtomConfig,
    branchId?: number,
  ): Promise<DualApiOperationResult<NormalizedProfessional>> {
    const errors: string[] = [];
    const apisToTry = this.getApisToTry();

    for (const api of apisToTry) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔍 Buscando profesional ${professionalId} en ${api}`);

        if (api === HealthAtomApi.DENTALINK) {
          const response = await client.get(endpoints.professionals);
          const dentistas = response.data?.data || [];
          const dentista = dentistas.find((d: any) => d.id === professionalId);

          if (dentista) {
            this.logger.log(`✅ Profesional encontrado en Dentalink`);
            return {
              success: true,
              data: this.normalizeProfessional(dentista, api),
              apiUsed: api,
            };
          }
        } else {
          const response = await client.get(`${endpoints.professionals}/${professionalId}`);
          if (response.data?.data) {
            this.logger.log(`✅ Profesional encontrado en MediLink`);
            return {
              success: true,
              data: this.normalizeProfessional(response.data.data, api),
              apiUsed: api,
            };
          }
        }
      } catch (error: any) {
        if (error.response?.status !== 404) {
          errors.push(`${api}: ${error.response?.status || error.message}`);
        }
      }
    }

    return { success: false, error: `Profesional ${professionalId} no encontrado`, details: errors };
  }

  private normalizeProfessional(data: any, source: HealthAtomApi): NormalizedProfessional {
    return {
      id: data.id,
      rut: data.rut,
      nombre: data.nombre,
      apellidos: data.apellidos || data.apellido,
      especialidad: data.especialidad,
      intervalo: data.intervalo,
      habilitado: data.habilitado ?? true,
      agendaOnline: data.agenda_online ?? true,
      sucursales: [
        ...(data.contratos_sucursal || []),
        ...(data.horarios_sucursal || []),
      ].filter((v, i, a) => a.indexOf(v) === i), // unique
      source,
    };
  }

  // ============================
  // SUCURSALES
  // ============================

  /**
   * Obtiene sucursales de ambas APIs
   */
  async getBranches(config: HealthAtomConfig): Promise<DualApiOperationResult<NormalizedBranch[]>> {
    const errors: string[] = [];
    const allBranches: NormalizedBranch[] = [];
    const seenIds = new Set<number>();

    for (const api of [HealthAtomApi.DENTALINK, HealthAtomApi.MEDILINK]) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔍 Obteniendo sucursales de ${api}`);

        const response = await client.get(endpoints.branches);
        const sucursales = response.data?.data || [];

        for (const suc of sucursales) {
          if (!seenIds.has(suc.id)) {
            seenIds.add(suc.id);
            allBranches.push(this.normalizeBranch(suc, api));
          }
        }
        this.logger.log(`✅ ${sucursales.length} sucursales de ${api}`);
      } catch (error: any) {
        const msg = `${api}: ${error.response?.status || error.message}`;
        this.logger.warn(`⚠️ Error en ${api}: ${msg}`);
        errors.push(msg);
      }
    }

    if (allBranches.length === 0) {
      return { success: false, error: 'No se pudieron obtener sucursales', details: errors };
    }

    return { success: true, data: allBranches };
  }

  private normalizeBranch(data: any, source: HealthAtomApi): NormalizedBranch {
    return {
      id: data.id,
      nombre: data.nombre,
      telefono: data.telefono,
      ciudad: data.ciudad,
      comuna: data.comuna,
      direccion: data.direccion,
      habilitada: data.habilitada ?? true,
      source,
    };
  }

  // ============================
  // PACIENTES
  // ============================

  /**
   * Busca paciente por RUT en ambas APIs
   */
  async searchPatientByRut(
    rut: string,
    config: HealthAtomConfig,
    branchId?: number,
  ): Promise<DualApiOperationResult<NormalizedPatient>> {
    const errors: string[] = [];
    const apisToTry = this.getApisToTry();
    const rutFormateado = this.formatRut(rut);

    for (const api of apisToTry) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔍 Buscando paciente ${rutFormateado} en ${api}`);

        const filtro = JSON.stringify({ rut: { eq: rutFormateado } });
        const response = await client.get(endpoints.patients, { params: { q: filtro } });
        const pacientes = response.data?.data || [];

        if (pacientes.length > 0) {
          this.logger.log(`✅ Paciente encontrado en ${api}`);
          return {
            success: true,
            data: this.normalizePatient(pacientes[0], api),
            apiUsed: api,
          };
        }
      } catch (error: any) {
        errors.push(`${api}: ${error.response?.status || error.message}`);
      }
    }

    return { success: false, error: `Paciente ${rutFormateado} no encontrado`, details: errors };
  }

  /**
   * Crea paciente intentando en ambas APIs
   */
  async createPatient(
    data: {
      nombre: string;
      apellidos: string;
      rut: string;
      telefono?: string;
      email?: string;
      fechaNacimiento?: string;
    },
    config: HealthAtomConfig,
    branchId?: number,
  ): Promise<DualApiOperationResult<NormalizedPatient>> {
    const errors: string[] = [];
    const apisToTry = this.getApisToTry();
    const rutFormateado = this.formatRut(data.rut);

    // Verificar si ya existe
    const existente = await this.searchPatientByRut(rutFormateado, config, branchId);
    if (existente.success && existente.data) {
      return {
        success: true,
        data: existente.data,
        apiUsed: existente.apiUsed,
      };
    }

    const payload = {
      nombre: data.nombre,
      apellidos: data.apellidos,
      rut: rutFormateado,
      celular: data.telefono,
      email: data.email,
      fecha_nacimiento: data.fechaNacimiento,
    };

    for (const api of apisToTry) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔄 Creando paciente en ${api}`);

        const response = await client.post(`${endpoints.patients}/`, payload);

        if (response.status === 201) {
          this.logger.log(`✅ Paciente creado en ${api}`);
          return {
            success: true,
            data: this.normalizePatient(response.data.data, api),
            apiUsed: api,
          };
        }
      } catch (error: any) {
        const msg = `${api}: ${error.response?.status || error.message}`;
        errors.push(msg);
        
        // Si es duplicado, buscar de nuevo
        if (error.response?.status === 400 && error.response?.data?.toString().toLowerCase().includes('existe')) {
          const existente = await this.searchPatientByRut(rutFormateado, config, branchId);
          if (existente.success && existente.data) {
            return existente;
          }
        }
      }
    }

    return { success: false, error: 'No se pudo crear el paciente', details: errors };
  }

  private normalizePatient(data: any, source: HealthAtomApi): NormalizedPatient {
    return {
      id: data.id,
      rut: data.rut,
      nombre: data.nombre,
      apellidos: data.apellidos,
      celular: data.celular,
      email: data.email,
      source,
    };
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  /**
   * Busca disponibilidad intentando en ambas APIs
   */
  async searchAvailability(
    params: {
      professionalIds: number[];
      branchId: number;
      startDate?: string;
      appointmentDuration?: number;
    },
    config: HealthAtomConfig,
  ): Promise<DualApiOperationResult<NormalizedAvailability[]>> {
    const errors: string[] = [];
    const apisToTry = this.getApisToTry();
    const timezone = config.timezone || 'America/Santiago';

    const fechaInicio = params.startDate || moment().tz(timezone).format('YYYY-MM-DD');
    const fechaFin = moment(fechaInicio).add(6, 'days').format('YYYY-MM-DD');

    // Obtener nombres de profesionales
    const professionalsInfo: Record<number, string> = {};
    for (const profId of params.professionalIds) {
      const result = await this.getProfessionalById(profId, config, params.branchId);
      if (result.success && result.data) {
        professionalsInfo[profId] = `${result.data.nombre} ${result.data.apellidos || ''}`.trim();
      } else {
        professionalsInfo[profId] = `Profesional ${profId}`;
      }
    }

    for (const api of apisToTry) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔍 Buscando disponibilidad en ${api}`);

        let response;
        if (api === HealthAtomApi.DENTALINK) {
          response = await client.get(endpoints.availability, {
            data: {
              ids_dentista: params.professionalIds,
              id_sucursal: params.branchId,
              fecha_inicio: fechaInicio,
              fecha_fin: fechaFin,
            },
          });
        } else {
          const queryParams = new URLSearchParams();
          params.professionalIds.forEach(id => queryParams.append('ids_profesional[]', id.toString()));
          queryParams.append('id_sucursal', params.branchId.toString());
          queryParams.append('fecha_inicio', fechaInicio);
          queryParams.append('fecha_fin', fechaFin);

          response = await client.get(`${endpoints.availability}?${queryParams.toString()}`);
        }

        const horariosData = response.data?.data || {};

        if (Object.keys(horariosData).length > 0) {
          const availability = this.normalizeAvailability(
            horariosData,
            professionalsInfo,
            params.appointmentDuration,
            timezone,
          );

          if (availability.length > 0) {
            this.logger.log(`✅ Disponibilidad encontrada en ${api}`);
            return { success: true, data: availability, apiUsed: api };
          }
        }
      } catch (error: any) {
        const msg = `${api}: ${error.response?.status || error.message}`;
        errors.push(msg);
        this.logger.warn(`⚠️ Error en ${api}: ${msg}`);
      }
    }

    return { success: false, error: 'No se encontró disponibilidad', details: errors };
  }

  private normalizeAvailability(
    data: Record<string, any>,
    professionalsInfo: Record<number, string>,
    appointmentDuration?: number,
    timezone = 'America/Santiago',
  ): NormalizedAvailability[] {
    const result: NormalizedAvailability[] = [];
    const horaActual = moment().tz(timezone);

    for (const [profIdStr, fechasHorarios] of Object.entries(data)) {
      const profId = parseInt(profIdStr);
      const nombreProfesional = professionalsInfo[profId] || `Profesional ${profId}`;
      const fechas: Record<string, string[]> = {};

      if (typeof fechasHorarios === 'object' && fechasHorarios !== null) {
        for (const [fecha, horarios] of Object.entries(fechasHorarios)) {
          if (Array.isArray(horarios)) {
            // Filtrar horarios futuros
            const horariosFiltrados = horarios.filter((h: any) => {
              try {
                const horaCita = moment.tz(`${fecha} ${h.hora_inicio}`, 'YYYY-MM-DD HH:mm:ss', timezone);
                return horaCita.isAfter(horaActual);
              } catch {
                return false;
              }
            });

            // Filtrar por duración si se especifica
            const horariosFinales = appointmentDuration
              ? this.filterByDuration(horariosFiltrados, appointmentDuration)
              : horariosFiltrados.map((h: any) => moment(h.hora_inicio, 'HH:mm:ss').format('HH:mm'));

            if (horariosFinales.length > 0) {
              fechas[fecha] = horariosFinales;
            }
          }
        }
      }

      if (Object.keys(fechas).length > 0) {
        result.push({ nombreProfesional, idProfesional: profId, fechas });
      }
    }

    return result;
  }

  private filterByDuration(horarios: any[], duracionRequerida: number): string[] {
    const horariosOrdenados = horarios.sort((a, b) => 
      a.hora_inicio.localeCompare(b.hora_inicio)
    );
    const horariosValidos: string[] = [];

    for (let i = 0; i < horariosOrdenados.length; i++) {
      const horario = horariosOrdenados[i];
      const intervalo = horario.intervalo;
      if (!intervalo) continue;

      let tiempoDisponible = intervalo;
      let horaEsperada = moment(horario.hora_inicio, 'HH:mm:ss').add(intervalo, 'minutes');

      for (let j = i + 1; j < horariosOrdenados.length && tiempoDisponible < duracionRequerida; j++) {
        const siguiente = horariosOrdenados[j];
        const horaSiguiente = moment(siguiente.hora_inicio, 'HH:mm:ss');

        if (horaSiguiente.isSame(horaEsperada)) {
          tiempoDisponible += siguiente.intervalo || intervalo;
          horaEsperada = horaSiguiente.add(siguiente.intervalo || intervalo, 'minutes');
        } else {
          break;
        }
      }

      if (tiempoDisponible >= duracionRequerida) {
        horariosValidos.push(moment(horario.hora_inicio, 'HH:mm:ss').format('HH:mm'));
      }
    }

    return horariosValidos;
  }

  // ============================
  // CITAS
  // ============================

  /**
   * Agenda cita intentando en ambas APIs
   */
  async scheduleAppointment(
    params: {
      patientId: number;
      professionalId: number;
      branchId: number;
      date: string;
      startTime: string;
      duration?: number;
      comment?: string;
    },
    config: HealthAtomConfig,
  ): Promise<DualApiOperationResult<{ id: number; mensaje: string }>> {
    const errors: string[] = [];
    const apisToTry = this.getApisToTry();

    // Obtener duración si no se especifica
    let duracion = params.duration;
    if (!duracion) {
      const profResult = await this.getProfessionalById(params.professionalId, config, params.branchId);
      if (profResult.success && profResult.data?.intervalo) {
        duracion = profResult.data.intervalo;
      } else {
        return { success: false, error: 'No se pudo determinar la duración de la cita' };
      }
    }

    for (const api of apisToTry) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔄 Agendando cita en ${api}`);

        const payload = api === HealthAtomApi.DENTALINK
          ? {
              id_dentista: params.professionalId,
              id_sucursal: params.branchId,
              id_estado: 7, // Confirmado
              id_sillon: 1,
              id_paciente: params.patientId,
              fecha: params.date,
              hora_inicio: params.startTime,
              duracion: duracion,
              comentario: params.comment || 'Cita agendada por Sistema',
            }
          : {
              id_profesional: params.professionalId,
              id_sucursal: params.branchId,
              id_estado: 7,
              id_sillon: 1,
              id_paciente: params.patientId,
              fecha: params.date,
              hora_inicio: params.startTime,
              duracion: duracion,
              comentario: params.comment || 'Cita agendada por Sistema',
              videoconsulta: 0,
            };

        const response = await client.post(`${endpoints.appointments}/`, payload);

        if (response.status === 201) {
          const idCita = response.data?.data?.id;
          this.logger.log(`✅ Cita creada en ${api} con ID ${idCita}`);
          return {
            success: true,
            data: { id: idCita, mensaje: `Cita agendada en ${api}` },
            apiUsed: api,
          };
        }
      } catch (error: any) {
        const msg = `${api}: ${error.response?.status || error.message}`;
        errors.push(msg);
      }
    }

    return { success: false, error: 'No se pudo agendar la cita', details: errors };
  }

  /**
   * Cancela cita por ID intentando en ambas APIs
   */
  async cancelAppointment(
    appointmentId: number,
    config: HealthAtomConfig,
  ): Promise<DualApiOperationResult<{ mensaje: string }>> {
    const errors: string[] = [];

    // Intentar en ambas APIs ya que no sabemos dónde está
    for (const api of [HealthAtomApi.DENTALINK, HealthAtomApi.MEDILINK]) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔍 Buscando cita ${appointmentId} en ${api}`);

        // Verificar si la cita existe
        const getResponse = await client.get(`${endpoints.appointments}/${appointmentId}`);
        if (getResponse.status !== 200) continue;

        // Cancelar
        const payload = api === HealthAtomApi.DENTALINK
          ? { id_estado: 1, comentarios: 'Cita cancelada por sistema', flag_notificar_anulacion: 1 }
          : { id_estado: 1, comentario: 'Cita cancelada por sistema' };

        const cancelResponse = await client.put(`${endpoints.appointments}/${appointmentId}`, payload);

        if (cancelResponse.status === 200) {
          this.logger.log(`✅ Cita cancelada en ${api}`);
          return {
            success: true,
            data: { mensaje: `Cita ${appointmentId} cancelada` },
            apiUsed: api,
          };
        }
      } catch (error: any) {
        if (error.response?.status !== 404 && error.response?.status !== 400) {
          errors.push(`${api}: ${error.response?.status || error.message}`);
        }
      }
    }

    return { success: false, error: `No se pudo cancelar la cita ${appointmentId}`, details: errors };
  }

  // ============================
  // UTILIDADES
  // ============================

  private formatRut(rut: string): string {
    try {
      const cleaned = rut.replace(/\./g, '').trim();
      if (cleaned.includes('-')) {
        const [body, dv] = cleaned.split('-');
        return `${parseInt(body)}-${dv.toUpperCase()}`;
      }
      return `${parseInt(cleaned.slice(0, -1))}-${cleaned.slice(-1).toUpperCase()}`;
    } catch {
      return rut;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as moment from 'moment-timezone';
import {
  HealthAtomApi,
  HealthAtomConfig,
  DENTALINK_ENDPOINTS,
  MEDILINK_ENDPOINTS,
  MEDILINK_PROFESSIONALS_V6_URL,
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
          // MediLink: usar endpoint v6 para profesionales
          // El endpoint de profesionales de Medilink requiere v6, no v5
          const response = await axios.get(`${MEDILINK_PROFESSIONALS_V6_URL}?limit=100`, {
            headers: {
              Authorization: `Token ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
          });
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
      return { success: false, error: 'No se pudieron obtener profesionales' };
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
            };
          }
        } else {
          // MediLink: usar endpoint v6 para profesionales
          const response = await axios.get(`${MEDILINK_PROFESSIONALS_V6_URL}/${professionalId}`, {
            headers: {
              Authorization: `Token ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.data?.data) {
            this.logger.log(`✅ Profesional encontrado en MediLink`);
            return {
              success: true,
              data: this.normalizeProfessional(response.data.data, api),
            };
          }
        }
      } catch (error: any) {
        if (error.response?.status !== 404) {
          errors.push(`${api}: ${error.response?.status || error.message}`);
        }
      }
    }

    return { success: false, error: `Profesional ${professionalId} no encontrado` };
  }

  private normalizeProfessional(data: any, _source: HealthAtomApi): NormalizedProfessional {
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
      return { success: false, error: 'No se pudieron obtener sucursales' };
    }

    return { success: true, data: allBranches };
  }

  private normalizeBranch(data: any, _source: HealthAtomApi): NormalizedBranch {
    return {
      id: data.id,
      nombre: data.nombre,
      telefono: data.telefono,
      ciudad: data.ciudad,
      comuna: data.comuna,
      direccion: data.direccion,
      habilitada: data.habilitada ?? true,
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
          };
        }
      } catch (error: any) {
        errors.push(`${api}: ${error.response?.status || error.message}`);
      }
    }

    return { success: false, error: `Paciente ${rutFormateado} no encontrado` };
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
    const apisToTry = this.getApisToTry();
    const rutFormateado = this.formatRut(data.rut);
    let lastError: string | null = null;

    // Verificar si ya existe
    const existente = await this.searchPatientByRut(rutFormateado, config, branchId);
    if (existente.success && existente.data) {
      return {
        success: true,
        data: existente.data,
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
          };
        }
      } catch (error: any) {
        const apiErrorMessage = this.extractApiErrorMessage(error);
        this.logger.warn(`⚠️ Error en ${api}: ${apiErrorMessage}`);
        
        // Si es duplicado, buscar de nuevo
        if (error.response?.status === 400) {
          const errorStr = JSON.stringify(error.response?.data || '').toLowerCase();
          if (errorStr.includes('existe') || errorStr.includes('duplicate')) {
            const existente = await this.searchPatientByRut(rutFormateado, config, branchId);
            if (existente.success && existente.data) {
              return existente;
            }
          }
          lastError = apiErrorMessage;
          break;
        }
        
        lastError = apiErrorMessage;
      }
    }

    return { success: false, error: lastError || 'No se pudo crear el paciente' };
  }

  private normalizePatient(data: any, _source: HealthAtomApi): NormalizedPatient {
    return {
      id: data.id,
      rut: data.rut,
      nombre: data.nombre,
      apellidos: data.apellidos,
      celular: data.celular,
      email: data.email,
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
          // MediLink: GET con body data (misma mecánica que Dentalink)
          response = await client.get(endpoints.availability, {
            data: {
              ids_profesional: params.professionalIds,
              id_sucursal: params.branchId,
              fecha_inicio: fechaInicio,
              fecha_fin: fechaFin,
            },
          });
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
            return { success: true, data: availability };
          }
        }
      } catch (error: any) {
        const msg = `${api}: ${error.response?.status || error.message}`;
        errors.push(msg);
        this.logger.warn(`⚠️ Error en ${api}: ${msg}`);
      }
    }

    return { success: false, error: 'No se encontró disponibilidad' };
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
    const apisToTry = this.getApisToTry();
    let lastError: string | null = null;

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
              comentario: params.comment || 'Agendado por IA',
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
              comentario: params.comment || 'Agendado por IA',
              videoconsulta: 0,
            };

        const response = await client.post(`${endpoints.appointments}/`, payload);

        if (response.status === 201) {
          const idCita = response.data?.data?.id;
          this.logger.log(`✅ Cita creada en ${api} con ID ${idCita}`);
          return {
            success: true,
            data: { id: idCita, mensaje: 'Cita agendada exitosamente' },
          };
        }
      } catch (error: any) {
        // Extraer el mensaje de error real de la API
        const apiErrorMessage = this.extractApiErrorMessage(error);
        this.logger.warn(`⚠️ Error en ${api}: ${apiErrorMessage}`);
        
        // Si es un error de negocio (400), guardar el mensaje y no continuar
        // ya que el error es específico de la operación, no de la API
        if (error.response?.status === 400) {
          lastError = apiErrorMessage;
          // En modo dual, si hay error de negocio, no tiene sentido intentar con la otra API
          // ya que probablemente dará el mismo error
          break;
        }
        
        lastError = apiErrorMessage;
      }
    }

    return { success: false, error: lastError || 'No se pudo agendar la cita' };
  }

  /**
   * Extrae el mensaje de error real de la respuesta de la API
   */
  private extractApiErrorMessage(error: any): string {
    // Intentar obtener el mensaje de error de diferentes formatos de respuesta
    const responseData = error.response?.data;
    
    if (responseData) {
      // Formato: { error: { message: "..." } }
      if (responseData.error?.message) {
        return responseData.error.message;
      }
      // Formato: { message: "..." }
      if (responseData.message) {
        return responseData.message;
      }
      // Formato: { error: "..." }
      if (typeof responseData.error === 'string') {
        return responseData.error;
      }
      // Si es un string directo
      if (typeof responseData === 'string') {
        return responseData;
      }
    }
    
    // Fallback al mensaje de error genérico
    return error.message || 'Error desconocido';
  }

  /**
   * Confirma cita por ID intentando en ambas APIs
   */
  async confirmAppointment(
    appointmentId: number,
    confirmationStateId: number,
    config: HealthAtomConfig,
  ): Promise<DualApiOperationResult<{ mensaje: string; cita: any }>> {
    let lastError: string | null = null;

    // Intentar en ambas APIs ya que no sabemos dónde está
    for (const api of [HealthAtomApi.DENTALINK, HealthAtomApi.MEDILINK]) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        this.logger.log(`🔍 Buscando cita ${appointmentId} en ${api}`);

        // Verificar si la cita existe
        const getResponse = await client.get(`${endpoints.appointments}/${appointmentId}`);
        if (getResponse.status !== 200) continue;

        const citaData = getResponse.data?.data;
        this.logger.log(`✅ Cita encontrada en ${api}`);

        // Confirmar - solo cambiar el estado, sin comentarios
        const payload = { 
          id_estado: confirmationStateId
        };

        const confirmResponse = await client.put(`${endpoints.appointments}/${appointmentId}`, payload);

        if (confirmResponse.status === 200) {
          this.logger.log(`✅ Cita confirmada en ${api}`);
          return {
            success: true,
            data: { 
              mensaje: `Cita ${appointmentId} confirmada exitosamente`,
              cita: citaData 
            },
          };
        }
      } catch (error: any) {
        // Si es 404, la cita no existe en esta API, intentar con la siguiente
        if (error.response?.status === 404) {
          continue;
        }
        
        // Extraer el mensaje de error real
        const apiErrorMessage = this.extractApiErrorMessage(error);
        this.logger.warn(`⚠️ Error en ${api}: ${apiErrorMessage}`);
        
        // Si es error de negocio (400), guardar y salir
        if (error.response?.status === 400) {
          lastError = apiErrorMessage;
          break;
        }
        
        lastError = apiErrorMessage;
      }
    }

    return { success: false, error: lastError || `No se pudo confirmar la cita ${appointmentId}` };
  }

  /**
   * Cancela cita por ID intentando en ambas APIs
   */
  async cancelAppointment(
    appointmentId: number,
    config: HealthAtomConfig,
  ): Promise<DualApiOperationResult<{ mensaje: string }>> {
    let lastError: string | null = null;

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
          };
        }
      } catch (error: any) {
        // Si es 404, la cita no existe en esta API, intentar con la siguiente
        if (error.response?.status === 404) {
          continue;
        }
        
        // Extraer el mensaje de error real
        const apiErrorMessage = this.extractApiErrorMessage(error);
        this.logger.warn(`⚠️ Error en ${api}: ${apiErrorMessage}`);
        
        // Si es error de negocio (400), guardar y salir
        if (error.response?.status === 400) {
          lastError = apiErrorMessage;
          break;
        }
        
        lastError = apiErrorMessage;
      }
    }

    return { success: false, error: lastError || `No se pudo cancelar la cita ${appointmentId}` };
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

  /**
   * Obtiene todas las citas futuras y activas de un paciente por RUT
   */
  async getFutureAppointments(
    rut: string,
    config: HealthAtomConfig,
  ): Promise<DualApiOperationResult<{ mensaje: string; total_citas: number; citas: any[] }>> {
    const formattedRut = this.formatRut(rut);
    const timezone = config.timezone || 'America/Santiago';
    const errors: string[] = [];

    this.logger.log(`🔎 Buscando citas FUTURAS y ACTIVAS para RUT: ${formattedRut}`);

    // Intentar en ambas APIs
    for (const api of this.getApisToTry()) {
      try {
        const client = this.createClient(config.apiKey, api);
        const endpoints = this.getEndpoints(api);

        // 1. Buscar paciente por RUT
        const filter = JSON.stringify({ rut: { eq: formattedRut } });
        const patientResponse = await client.get(`${endpoints.patients}?q=${filter}`);

        if (patientResponse.status !== 200) {
          this.logger.warn(`⚠️ No se pudo buscar paciente en ${api}`);
          continue;
        }

        const patients = patientResponse.data?.data || [];
        if (patients.length === 0) {
          this.logger.warn(`⚠️ Paciente con RUT ${formattedRut} no encontrado en ${api}`);
          continue;
        }

        const patient = patients[0];
        this.logger.log(`✅ Paciente encontrado en ${api}: ${patient.nombre} ${patient.apellidos} (ID: ${patient.id})`);

        // 2. Obtener link de citas
        const citasLink = patient.links?.find((l: any) => l.rel === 'citas')?.href;
        if (!citasLink) {
          this.logger.warn(`⚠️ No se encontró link de citas para el paciente en ${api}`);
          continue;
        }

        // 3. Obtener todas las citas del paciente
        const appointmentsResponse = await axios.get(citasLink, {
          headers: {
            Authorization: `Token ${config.apiKey}`,
          },
        });

        if (appointmentsResponse.status !== 200) {
          this.logger.warn(`⚠️ No se pudieron obtener citas en ${api}`);
          continue;
        }

        const allAppointments = appointmentsResponse.data?.data || [];
        
        if (allAppointments.length === 0) {
          return {
            success: true,
            data: {
              mensaje: 'El paciente no tiene citas registradas',
              total_citas: 0,
              citas: [],
            },
          };
        }

        // 4. Filtrar citas futuras y activas
        const now = moment.tz(timezone);
        const currentDate = now.format('YYYY-MM-DD');
        const currentTime = now.format('HH:mm:ss');

        const futureAppointments = allAppointments.filter((cita: any) => {
          // Filtrar citas anuladas
          if (cita.estado_anulacion !== 0) {
            return false;
          }

          const appointmentDate = cita.fecha;
          const appointmentTime = cita.hora_inicio;

          // Cita es futura si:
          // - La fecha es posterior a hoy, O
          // - La fecha es hoy Y la hora es posterior a la actual
          return (
            appointmentDate > currentDate ||
            (appointmentDate === currentDate && appointmentTime > currentTime)
          );
        });

        // 5. Ordenar por fecha y hora (más próxima primero)
        futureAppointments.sort((a: any, b: any) => {
          const dateCompare = a.fecha.localeCompare(b.fecha);
          if (dateCompare !== 0) return dateCompare;
          return a.hora_inicio.localeCompare(b.hora_inicio);
        });

        // 6. Extraer datos del paciente (son los mismos para todas las citas)
        const pacienteData = futureAppointments.length > 0
          ? {
              id_paciente: futureAppointments[0].id_paciente,
              nombre_paciente: futureAppointments[0].nombre_paciente,
            }
          : null;

        // 7. Mapear citas para devolver solo los campos necesarios (sin datos del paciente)
        const mappedAppointments = futureAppointments.map((cita: any) => ({
          id: cita.id,
          id_estado: cita.id_estado,
          estado_cita: cita.estado_cita,
          nombre_tratamiento: cita.nombre_tratamiento,
          id_dentista: cita.id_dentista,
          nombre_dentista: cita.nombre_dentista,
          id_sucursal: cita.id_sucursal,
          fecha: cita.fecha,
          hora_inicio: cita.hora_inicio,
          hora_fin: cita.hora_fin,
          duracion: cita.duracion,
          comentarios: cita.comentarios,
        }));

        const mensaje = futureAppointments.length > 0
          ? 'Citas futuras activas encontradas'
          : 'No hay citas futuras activas';

        this.logger.log(`✅ ${futureAppointments.length} citas futuras encontradas en ${api}`);

        const responseData: any = {
          mensaje,
          total_citas: futureAppointments.length,
          citas: mappedAppointments,
        };

        // Solo agregar paciente si hay citas
        if (pacienteData) {
          responseData.paciente = pacienteData;
        }

        return {
          success: true,
          data: responseData,
        };
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message;
        this.logger.error(`❌ Error en ${api}: ${errorMsg}`);
        errors.push(`${api}: ${errorMsg}`);
      }
    }

    return {
      success: false,
      error: `No se pudieron obtener las citas para el RUT ${formattedRut}`,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  ReservoConfig,
  ReservoOperationResult,
  ReservoPatient,
  ReservoAppointment,
  ReservoProfessional,
  ReservoTreatment,
  ReservoSucursal,
  ReservoAvailabilitySlot,
  ReservoCreateAppointmentPayload,
  ReservoCreatePatientPayload,
  ReservoPaginatedResponse,
  RESERVO_API,
} from './reservo.types';

@Injectable()
export class ReservoService {
  private readonly logger = new Logger(ReservoService.name);

  private createHeaders(config: ReservoConfig) {
    const token = config.apiToken.startsWith('Token ')
      ? config.apiToken
      : `Token ${config.apiToken}`;
    return {
      accept: 'application/json',
      Authorization: token,
    };
  }

  // ============================
  // PACIENTES
  // ============================

  /**
   * Busca pacientes por identificador (RUT), email o uuid
   * GET /cliente/
   */
  async searchPatient(
    params: { identificador?: string; mail?: string; uuid?: string },
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<ReservoPatient[]>> {
    try {
      this.logger.log(`Buscando paciente con params: ${JSON.stringify(params)}`);

      const response = await axios.get(`${RESERVO_API.baseUrl}/cliente/`, {
        params,
        headers: this.createHeaders(config),
        timeout: 15000,
      });

      const paginated = response.data as ReservoPaginatedResponse<ReservoPatient>;
      return { success: true, data: paginated.resultados || [] };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error buscando paciente: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Obtiene detalle de un paciente por UUID
   * GET /cliente/{uuid}/
   */
  async getPatientByUuid(
    uuid: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<ReservoPatient>> {
    try {
      this.logger.log(`Obteniendo detalle del paciente: ${uuid}`);

      const response = await axios.get(`${RESERVO_API.baseUrl}/cliente/${uuid}/`, {
        headers: this.createHeaders(config),
        timeout: 15000,
      });

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error obteniendo paciente: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Crea un paciente en Reservo
   * POST /cliente/
   */
  async createPatient(
    payload: ReservoCreatePatientPayload,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<ReservoPatient>> {
    try {
      this.logger.log(`Creando paciente: ${payload.nombre}`);

      const response = await axios.post(
        `${RESERVO_API.baseUrl}/cliente/`,
        [payload], // La API espera un array
        {
          headers: {
            ...this.createHeaders(config),
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error creando paciente: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // CITAS
  // ============================

  /**
   * Obtiene citas por uuid_cliente
   * GET /citas/?uuid_cliente={uuid}
   */
  async getAppointmentsByPatient(
    patientUuid: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<ReservoAppointment[]>> {
    try {
      this.logger.log(`Obteniendo citas del paciente: ${patientUuid}`);

      const response = await axios.get(`${RESERVO_API.baseUrl}/citas/`, {
        params: { uuid_cliente: patientUuid },
        headers: this.createHeaders(config),
        timeout: 15000,
      });

      const paginated = response.data as ReservoPaginatedResponse<ReservoAppointment>;
      return { success: true, data: paginated.resultados || [] };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error obteniendo citas: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Obtiene citas por rango de fechas (máx 31 días)
   * GET /citas/?fecha_inicial={fecha}&fecha_final={fecha}
   */
  async getAppointmentsByDateRange(
    fechaInicial: string,
    fechaFinal: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<ReservoAppointment[]>> {
    try {
      this.logger.log(`Obteniendo citas del ${fechaInicial} al ${fechaFinal}`);

      const allAppointments: ReservoAppointment[] = [];
      let pagina = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await axios.get(`${RESERVO_API.baseUrl}/citas/`, {
          params: {
            fecha_inicial: fechaInicial,
            fecha_final: fechaFinal,
            pagina,
          },
          headers: this.createHeaders(config),
          timeout: 15000,
        });

        const paginated = response.data as ReservoPaginatedResponse<ReservoAppointment>;
        const resultados = paginated.resultados || [];
        allAppointments.push(...resultados);

        hasMore = paginated.pagina_siguiente !== null;
        pagina++;

        // Safety limit
        if (pagina > 50) {
          this.logger.warn('Alcanzado límite de 50 páginas de citas');
          break;
        }
      }

      this.logger.log(`Total de citas obtenidas: ${allAppointments.length}`);
      return { success: true, data: allAppointments };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error obteniendo citas por fecha: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Obtiene las citas futuras (NC) de un paciente desde hoy en adelante
   */
  async getFutureAppointments(
    patientUuid: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<ReservoAppointment[]>> {
    try {
      const result = await this.getAppointmentsByPatient(patientUuid, config);
      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'No se pudieron obtener citas' };
      }

      const now = new Date();
      const futureCitas = result.data
        .filter((c) => c.estado?.codigo === 'NC' && new Date(c.inicio) >= now)
        .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

      if (futureCitas.length === 0) {
        return { success: false, error: 'No hay citas futuras' };
      }

      return { success: true, data: futureCitas };
    } catch (error) {
      const message = error.message;
      this.logger.error(`Error obteniendo citas futuras: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Confirma una cita (estado_codigo: "C")
   * PUT /citas/
   *
   * Condiciones:
   * - Citas eliminadas NO se pueden modificar
   * - Citas suspendidas NO se pueden confirmar
   * - Citas en lista de espera NO se pueden confirmar
   */
  async confirmAppointment(
    appointmentUuid: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<{ mensaje: string }>> {
    return this.updateAppointmentState(appointmentUuid, 'C', config);
  }

  /**
   * Cancela/suspende una cita (estado_codigo: "S")
   * PUT /citas/
   *
   * Condiciones:
   * - Citas eliminadas NO se pueden modificar
   * - Citas en lista de espera NO se pueden suspender
   */
  async cancelAppointment(
    appointmentUuid: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<{ mensaje: string }>> {
    return this.updateAppointmentState(appointmentUuid, 'S', config);
  }

  private async updateAppointmentState(
    appointmentUuid: string,
    estadoCodigo: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<{ mensaje: string }>> {
    try {
      const action = estadoCodigo === 'C' ? 'confirmar' : 'cancelar';
      this.logger.log(`Intentando ${action} cita: ${appointmentUuid}`);

      const response = await axios.put(
        `${RESERVO_API.baseUrl}/citas/`,
        {
          uuid: appointmentUuid,
          estado_codigo: estadoCodigo,
        },
        {
          headers: {
            ...this.createHeaders(config),
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      if (response.status !== 200) {
        return {
          success: false,
          error: `Error al ${action} la cita (${response.status})`,
        };
      }

      const actionPast = estadoCodigo === 'C' ? 'confirmada' : 'cancelada';
      return {
        success: true,
        data: { mensaje: `Cita ${actionPast} con exito` },
      };
    } catch (error) {
      // Manejar errores específicos de Reservo
      const errores = error.response?.data?.errores;
      if (errores) {
        const errorMsg = typeof errores === 'string'
          ? errores
          : Object.entries(errores).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ');
        this.logger.error(`Error de Reservo al actualizar cita: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      const message = error.message;
      this.logger.error(`Error actualizando estado de cita: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Crea una cita en Reservo
   * POST /makereserva/confirmApptAPI/
   */
  async createAppointment(
    payload: ReservoCreateAppointmentPayload,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<any>> {
    try {
      this.logger.log(`Creando cita en Reservo - Payload: ${JSON.stringify(payload)}`);

      const response = await axios.post(RESERVO_API.createAppointmentUrl, payload, {
        headers: {
          ...this.createHeaders(config),
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      if (response.status !== 200) {
        return {
          success: false,
          error: `Error al crear cita (${response.status})`,
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      const responseData = error.response?.data;
      this.logger.error(`Error creando cita - Status: ${error.response?.status} - Response: ${JSON.stringify(responseData)}`);
      const message = responseData?.errores || responseData?.message || responseData || error.message;
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  /**
   * Obtiene horarios disponibles
   * GET /agenda_online/{uuid_agenda}/horarios_disponibles/
   *
   * Búsqueda semanal (Lunes a Domingo).
   * No retorna bloques anteriores al momento de la consulta.
   */
  async getAvailability(
    agendaUuid: string,
    fecha: string,
    treatmentUuid: string,
    config: ReservoConfig,
    filters?: { uuid_profesional?: string; uuid_sucursal?: string },
  ): Promise<ReservoOperationResult<ReservoAvailabilitySlot[]>> {
    try {
      this.logger.log(`Obteniendo disponibilidad para agenda ${agendaUuid}, fecha ${fecha}`);

      const params: Record<string, string> = {
        fecha,
        uuid_tratamiento: treatmentUuid,
      };

      if (filters?.uuid_profesional) {
        params.uuid_profesional = filters.uuid_profesional;
      }
      if (filters?.uuid_sucursal) {
        params.uuid_sucursal = filters.uuid_sucursal;
      }

      const response = await axios.get(
        `${RESERVO_API.baseUrl}/agenda_online/${agendaUuid}/horarios_disponibles/`,
        {
          params,
          headers: this.createHeaders(config),
          timeout: 15000,
        },
      );

      if (response.status !== 200) {
        return {
          success: false,
          error: `Error al obtener disponibilidad (${response.status})`,
        };
      }

      const data = response.data || [];
      return { success: true, data: Array.isArray(data) ? data : [data] };
    } catch (error) {
      const errores = error.response?.data?.errores;
      const message = errores || error.message;
      this.logger.error(`Error obteniendo disponibilidad: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // PROFESIONALES
  // ============================

  /**
   * Obtiene profesionales de una agenda
   * GET /agenda_online/{uuid_agenda}/profesionales/
   *
   * Nota: El campo 'agenda' será deprecado, usar 'uuid'
   * Soporta filtros opcionales: uuid_profesional, uuid_sucursal, uuid_tratamiento, search_text
   */
  async getProfessionals(
    agendaUuid: string,
    config: ReservoConfig,
    filters?: { uuid_profesional?: string; uuid_sucursal?: string; uuid_tratamiento?: string; search_text?: string },
  ): Promise<ReservoOperationResult<ReservoProfessional[]>> {
    try {
      this.logger.log(`Obteniendo profesionales para agenda ${agendaUuid}`);

      const params: Record<string, string> = {};
      if (filters?.uuid_profesional) params.uuid_profesional = filters.uuid_profesional;
      if (filters?.uuid_sucursal) params.uuid_sucursal = filters.uuid_sucursal;
      if (filters?.uuid_tratamiento) params.uuid_tratamiento = filters.uuid_tratamiento;
      if (filters?.search_text) params.search_text = filters.search_text;

      const response = await axios.get(
        `${RESERVO_API.baseUrl}/agenda_online/${agendaUuid}/profesionales/`,
        {
          params: Object.keys(params).length > 0 ? params : undefined,
          headers: this.createHeaders(config),
          timeout: 15000,
        },
      );

      if (response.status !== 200) {
        return {
          success: false,
          error: `Error al obtener profesionales (${response.status})`,
        };
      }

      const paginated = response.data as ReservoPaginatedResponse<ReservoProfessional>;
      return { success: true, data: paginated.resultados || [] };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error obteniendo profesionales: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // TRATAMIENTOS
  // ============================

  /**
   * Obtiene tratamientos de una agenda
   * GET /agenda_online/{uuid_agenda}/tratamientos/
   *
   * Soporta filtros opcionales: uuid_profesional, uuid_sucursal, uuid_tratamiento, search_text
   */
  async getTreatments(
    agendaUuid: string,
    config: ReservoConfig,
    filters?: { uuid_profesional?: string; uuid_sucursal?: string; uuid_tratamiento?: string; search_text?: string },
  ): Promise<ReservoOperationResult<ReservoTreatment[]>> {
    try {
      this.logger.log(`Obteniendo tratamientos para agenda ${agendaUuid}`);

      const params: Record<string, string> = {};
      if (filters?.uuid_profesional) params.uuid_profesional = filters.uuid_profesional;
      if (filters?.uuid_sucursal) params.uuid_sucursal = filters.uuid_sucursal;
      if (filters?.uuid_tratamiento) params.uuid_tratamiento = filters.uuid_tratamiento;
      if (filters?.search_text) params.search_text = filters.search_text;

      const response = await axios.get(
        `${RESERVO_API.baseUrl}/agenda_online/${agendaUuid}/tratamientos/`,
        {
          params: Object.keys(params).length > 0 ? params : undefined,
          headers: this.createHeaders(config),
          timeout: 15000,
        },
      );

      if (response.status !== 200) {
        return {
          success: false,
          error: `Error al obtener tratamientos (${response.status})`,
        };
      }

      const paginated = response.data as ReservoPaginatedResponse<ReservoTreatment>;
      return { success: true, data: paginated.resultados || [] };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error obteniendo tratamientos: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // SUCURSALES
  // ============================

  /**
   * Obtiene sucursales de una agenda
   * GET /agenda_online/{uuid_agenda}/sucursales/
   */
  async getSucursales(
    agendaUuid: string,
    config: ReservoConfig,
    filters?: { uuid_profesional?: string; uuid_sucursal?: string; uuid_tratamiento?: string; search_text?: string },
  ): Promise<ReservoOperationResult<ReservoSucursal[]>> {
    try {
      this.logger.log(`Obteniendo sucursales para agenda ${agendaUuid}`);

      const params: Record<string, string> = {};
      if (filters?.uuid_profesional) params.uuid_profesional = filters.uuid_profesional;
      if (filters?.uuid_sucursal) params.uuid_sucursal = filters.uuid_sucursal;
      if (filters?.uuid_tratamiento) params.uuid_tratamiento = filters.uuid_tratamiento;
      if (filters?.search_text) params.search_text = filters.search_text;

      const response = await axios.get(
        `${RESERVO_API.baseUrl}/agenda_online/${agendaUuid}/sucursales/`,
        {
          params: Object.keys(params).length > 0 ? params : undefined,
          headers: this.createHeaders(config),
          timeout: 15000,
        },
      );

      if (response.status !== 200) {
        return {
          success: false,
          error: `Error al obtener sucursales (${response.status})`,
        };
      }

      const paginated = response.data as ReservoPaginatedResponse<ReservoSucursal>;
      return { success: true, data: paginated.resultados || [] };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error obteniendo sucursales: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // PREVISIONALES
  // ============================

  /**
   * Obtiene opciones previsionales del formulario de una agenda
   * GET /agenda_online/{uuid_agenda}/form/
   */
  async getPrevisionOptions(
    agendaUuid: string,
    config: ReservoConfig,
  ): Promise<ReservoOperationResult<any[]>> {
    try {
      this.logger.log(`Obteniendo opciones previsionales para agenda ${agendaUuid}`);

      const response = await axios.get(`${RESERVO_API.baseUrl}/agenda_online/${agendaUuid}/form/`, {
        headers: this.createHeaders(config),
        timeout: 10000,
      });

      const fields = response.data || [];
      const previsionField = fields.find((f: any) => f.nombre === 'prevision');

      if (!previsionField?.options) {
        return {
          success: false,
          error: 'No se encontraron opciones de prevision en el formulario',
        };
      }

      return { success: true, data: previsionField.options };
    } catch (error) {
      const message = error.response?.data?.errores || error.message;
      this.logger.error(`Error obteniendo previsionales: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // TEST DE CONEXION
  // ============================

  async testConnection(config: ReservoConfig): Promise<{ connected: boolean; message: string }> {
    try {
      // Test auth with a simple patient search (no agenda needed)
      await axios.get(`${RESERVO_API.baseUrl}/cliente/`, {
        params: { identificador: 'test' },
        headers: this.createHeaders(config),
        timeout: 10000,
      });

      // If we get here (200), the token is valid
      return {
        connected: true,
        message: 'Conexión exitosa con Reservo',
      };
    } catch (error) {
      // 404 or empty results still means auth worked
      if (error.response?.status === 404) {
        return {
          connected: true,
          message: 'Conexión exitosa con Reservo',
        };
      }

      const errData = error.response?.data?.errores || error.response?.data || error.message;
      return {
        connected: false,
        message: typeof errData === 'string' ? errData : JSON.stringify(errData),
      };
    }
  }
}

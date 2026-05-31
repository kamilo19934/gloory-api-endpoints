import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  DentalsoftConfig,
  DentalsoftOperationResult,
  DentalsoftTokenResponse,
  DentalsoftPaciente,
  DentalsoftCita,
  DentalsoftSucursal,
  DentalsoftProfesional,
  DentalsoftEspecialidad,
  DentalsoftDisponibilidadDiaria,
  DentalsoftDisponibilidadMensual,
  DentalsoftCreateAppointmentPayload,
  DentalsoftCitaEstado,
  DentalsoftCreatePatientPayload,
  DentalsoftHoraEfectiva,
  DentalsoftHorasEfectivasResponse,
  DentalsoftUsuario,
  DENTALSOFT_API,
} from './dentalsoft.types';

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

@Injectable()
export class DentalsoftService {
  private readonly logger = new Logger(DentalsoftService.name);

  // Cache de access tokens por (clientId|scope) — evita pedir un token por request.
  // Stateless-friendly: si el proceso reinicia se rellena on-demand.
  private readonly tokenCache = new Map<string, CachedToken>();

  // Cache del largo de bloque (5 o 15 min) por (clientId|scope). No cambia en runtime.
  private readonly blockLengthCache = new Map<string, number>();

  // Margen de seguridad para renovar el token antes de que expire realmente
  private readonly TOKEN_REFRESH_MARGIN_MS = 60_000;

  private baseUrl(config: DentalsoftConfig): string {
    return (config.baseUrl || DENTALSOFT_API.defaultBaseUrl).replace(/\/$/, '');
  }

  private cacheKey(config: DentalsoftConfig): string {
    return `${config.clientId}:${config.scope}`;
  }

  /**
   * Obtiene un access_token válido. Pide uno nuevo si no hay cache o el actual está por expirar.
   * El endpoint de token cuelga del host base (sin el path /external).
   */
  private async getAccessToken(config: DentalsoftConfig): Promise<string> {
    const key = this.cacheKey(config);
    const cached = this.tokenCache.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt - this.TOKEN_REFRESH_MARGIN_MS > now) {
      return cached.token;
    }

    // El base URL apunta a .../external. /access_token cuelga del host base.
    const base = this.baseUrl(config);
    const tokenUrl = `${base.replace(/\/external$/, '')}/external/access_token`;

    const form = new URLSearchParams();
    form.append('grant_type', 'client_credentials');
    form.append('client_id', config.clientId);
    form.append('client_secret', config.clientSecret);
    form.append('scope', String(config.scope));

    this.logger.log(`🔑 Solicitando access_token a Dentalsoft (scope=${config.scope})`);
    const response = await axios.post<DentalsoftTokenResponse>(tokenUrl, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const expiresInSec = Number(response.data.expires_in) || 3600;
    this.tokenCache.set(key, {
      token: response.data.access_token,
      expiresAt: now + expiresInSec * 1000,
    });

    return response.data.access_token;
  }

  private async authHeaders(config: DentalsoftConfig): Promise<Record<string, string>> {
    const token = await this.getAccessToken(config);
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
  }

  private formatError(error: any): string {
    const data = error.response?.data;
    if (typeof data === 'string') return data;
    if (data?.message) return data.message;
    if (data?.error_description) return data.error_description;
    if (data?.error) return data.error;
    return error.message || 'Error desconocido';
  }

  /**
   * Invalida el token cacheado de un cliente (útil tras un 401 inesperado).
   */
  invalidateToken(config: DentalsoftConfig): void {
    this.tokenCache.delete(this.cacheKey(config));
  }

  // ============================
  // TEST DE CONEXION
  // ============================

  async testConnection(
    config: DentalsoftConfig,
  ): Promise<{ connected: boolean; message: string; branches?: number; professionals?: number }> {
    try {
      // El propio access_token valida client_id/secret/scope.
      await this.getAccessToken(config);

      let branches = 0;
      let professionals = 0;

      try {
        const sucursales = await this.getSucursales(config);
        if (sucursales.success) branches = sucursales.data?.length || 0;
      } catch {
        /* preview opcional */
      }

      try {
        const profesionales = await this.getProfesionales(config);
        if (profesionales.success) professionals = profesionales.data?.length || 0;
      } catch {
        /* preview opcional */
      }

      return {
        connected: true,
        message: 'Conexión exitosa con Dentalsoft',
        branches,
        professionals,
      };
    } catch (error) {
      return {
        connected: false,
        message: this.formatError(error),
      };
    }
  }

  // ============================
  // PACIENTES
  // ============================

  /**
   * GET /paciente/datos?cedula=...&tipo_cedula_texto=rut|dni
   */
  async searchPatient(
    params: { cedula: string; tipo_cedula_texto: 'rut' | 'dni' },
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftPaciente>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/paciente/datos`, {
        params,
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error buscando paciente Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * POST /paciente/nuevo
   */
  async createPatient(
    payload: DentalsoftCreatePatientPayload,
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<{ mensaje: string; paciente: number }>> {
    try {
      const response = await axios.post(`${this.baseUrl(config)}/paciente/nuevo`, payload, {
        headers: {
          ...(await this.authHeaders(config)),
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error creando paciente Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // PROFESIONALES / ESPECIALIDADES
  // ============================

  /**
   * GET /profesional/listado
   */
  async getProfesionales(
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftProfesional[]>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/profesional/listado`, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      return { success: true, data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo profesionales Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /usuario/listado
   *
   * Usado para resolver la relación profesional↔especialidad. Reemplaza a
   * `/profesional/listado/especialidad`, que no está disponible en todos los
   * tenants. Filtrar por `tipo_profesional === 'Usuario con agenda'` para
   * quedarse solo con los profesionales que pueden recibir citas.
   */
  async getUsuarios(
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftUsuario[]>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/usuario/listado`, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      return { success: true, data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo usuarios Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /especialidad/listado
   */
  async getEspecialidades(
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftEspecialidad[]>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/especialidad/listado`, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      return { success: true, data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo especialidades Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // SUCURSALES
  // ============================

  /**
   * GET /sucursal/listado
   */
  async getSucursales(
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftSucursal[]>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/sucursal/listado`, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      return { success: true, data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo sucursales Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  /**
   * GET /agenda/disponibilidad/mensual/{id_profesional}/{año}/{mes}/{id_sucursal}/{bloques}
   */
  async getMonthlyAvailability(
    params: {
      id_profesional: number;
      year: number;
      month: number;
      id_sucursal: number;
      bloques: number;
    },
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftDisponibilidadMensual[]>> {
    try {
      const url = `${this.baseUrl(config)}/agenda/disponibilidad/mensual/${params.id_profesional}/${params.year}/${params.month}/${params.id_sucursal}/${params.bloques}`;
      const response = await axios.get(url, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      return { success: true, data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo disponibilidad mensual: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /agenda/disponibilidad/diaria/{id_profesional}/{fecha}/{idSucursal}/{duracion}
   */
  async getDailyAvailability(
    params: { id_profesional: number; fecha: string; id_sucursal: number; duracion: number },
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftDisponibilidadDiaria[]>> {
    try {
      const url = `${this.baseUrl(config)}/agenda/disponibilidad/diaria/${params.id_profesional}/${params.fecha}/${params.id_sucursal}/${params.duracion}`;
      const response = await axios.get(url, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      const raw = Array.isArray(response.data) ? response.data : [];
      // La API responde con cod_sala/nom_sala (no id_sala/nombre_sala como dice el
      // OpenAPI), y id_profesional/cod_sala vienen como strings. Normalizamos a
      // integers + nombres consistentes con el resto del contrato.
      const data: DentalsoftDisponibilidadDiaria[] = raw.map((slot: any) => ({
        inicio: slot.inicio,
        fin: slot.fin,
        id_profesional: Number(slot.id_profesional),
        id_sala: Number(slot.id_sala ?? slot.cod_sala),
        nombre_sala: slot.nombre_sala ?? slot.nom_sala ?? '',
      }));
      return { success: true, data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo disponibilidad diaria: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /agenda/bloque/largo — largo de cada bloque de agenda (5 o 15 min).
   * Cacheado en memoria; raramente cambia. Si falla, propaga el error en vez de
   * adivinar un default — calcular duración con un largo asumido produce citas
   * con duración incorrecta y rompe el mirror a GHL en silencio.
   */
  async getBlockLength(config: DentalsoftConfig): Promise<number> {
    const key = this.cacheKey(config);
    const cached = this.blockLengthCache.get(key);
    if (cached) return cached;

    const response = await axios.get(`${this.baseUrl(config)}/agenda/bloque/largo`, {
      headers: await this.authHeaders(config),
      timeout: 10000,
    });
    const largo = Number(response.data?.largo);
    if (!largo || largo <= 0) {
      throw new Error(
        `Respuesta inválida de /agenda/bloque/largo: ${JSON.stringify(response.data)}`,
      );
    }
    this.blockLengthCache.set(key, largo);
    return largo;
  }

  // ============================
  // CITAS
  // ============================

  /**
   * GET /agenda/cita/{id}
   */
  async getAppointment(
    citaId: number,
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftCita>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/agenda/cita/${citaId}`, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo cita Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /agenda/dia_sucursal/{fecha}/{idSucursal}
   */
  async getAppointmentsByBranchAndDate(
    params: { fecha: string; id_sucursal: number },
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftCita[]>> {
    try {
      const url = `${this.baseUrl(config)}/agenda/dia_sucursal/${params.fecha}/${params.id_sucursal}`;
      const response = await axios.get(url, {
        headers: await this.authHeaders(config),
        timeout: 15000,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      return { success: true, data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo citas día/sucursal Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * POST /agenda/cita
   */
  async createAppointment(
    payload: DentalsoftCreateAppointmentPayload,
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<{ mensaje: string; id_cita: number }>> {
    try {
      const response = await axios.post(`${this.baseUrl(config)}/agenda/cita`, payload, {
        headers: {
          ...(await this.authHeaders(config)),
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error creando cita Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /agenda/informes/horas/efectivas/{from}/{to}?id_paciente=...
   *
   * Devuelve todas las citas del paciente en el rango, paginadas (cursor `c`).
   * Itera siguiendo `pagination.siguiente` hasta que no haya más (safety limit 50).
   * Filtramos `eliminada=false` y opcionalmente solo las futuras desde `now`.
   */
  async getPatientAppointmentsInRange(
    params: { id_paciente: number; fecha_desde: string; fecha_hasta: string; onlyFuture?: boolean },
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<DentalsoftHoraEfectiva[]>> {
    try {
      const all: DentalsoftHoraEfectiva[] = [];
      const headers = await this.authHeaders(config);
      let nextUrl: string | null =
        `${this.baseUrl(config)}/agenda/informes/horas/efectivas/${params.fecha_desde}/${params.fecha_hasta}?id_paciente=${params.id_paciente}`;

      for (let page = 0; page < 50 && nextUrl; page++) {
        const response = await axios.get<DentalsoftHorasEfectivasResponse>(nextUrl, {
          headers,
          timeout: 20000,
        });
        const items = response.data?.data || [];
        all.push(...items);
        const siguiente = response.data?.pagination?.siguiente;
        nextUrl = siguiente && siguiente.length > 0 ? siguiente : null;
      }

      let filtered = all.filter((c) => c.eliminada !== true);
      if (params.onlyFuture) {
        const now = new Date();
        filtered = filtered.filter((c) => {
          const dt = new Date(`${c.fecha_cita}T${c.hora_cita}:00`);
          return dt.getTime() >= now.getTime();
        });
      }
      return { success: true, data: filtered };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error obteniendo citas del paciente: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * PUT /agenda/cita/cambia_estado
   */
  async changeAppointmentState(
    citaId: number,
    estado: DentalsoftCitaEstado,
    config: DentalsoftConfig,
  ): Promise<DentalsoftOperationResult<{ mensaje: string; id: number }>> {
    try {
      const response = await axios.put(
        `${this.baseUrl(config)}/agenda/cita/cambia_estado`,
        { id: citaId, estado },
        {
          headers: {
            ...(await this.authHeaders(config)),
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
      return { success: true, data: response.data };
    } catch (error) {
      const message = this.formatError(error);
      this.logger.error(`Error cambiando estado cita Dentalsoft: ${message}`);
      return { success: false, error: message };
    }
  }
}

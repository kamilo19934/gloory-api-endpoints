import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  SacmedConfig,
  SacmedOperationResult,
  SacmedService as SacmedServiceType,
  SacmedSpecialty,
  SacmedPractitionersResponse,
  SacmedSpecialist,
  SacmedDistrict,
  SacmedPatient,
  SacmedCreatePatientPayload,
  SacmedAvailabilityRequest,
  SacmedAvailabilityItem,
  SacmedEvent,
  SacmedCreateEventPayload,
  SacmedUpdateEventStatusPayload,
  SACMED_API,
} from './sacmed.types';

/**
 * Cliente HTTP puro hacia la API de Sacmed (availability-ms).
 * No depende de ClientsService/DB — recibe `config` en cada método.
 * Autenticación vía header X-ApiKey.
 */
@Injectable()
export class SacmedService {
  private readonly logger = new Logger(SacmedService.name);

  private createHeaders(config: SacmedConfig) {
    return {
      accept: 'application/json',
      'X-ApiKey': config.apiKey,
    };
  }

  /**
   * Resuelve la base URL de la API de Sacmed de forma defensiva.
   * Acepta que el cliente pegue por error la URL de Swagger (`.../swagger/index.html`)
   * o el dominio pelado: en esos casos deriva `${origin}/api/v1`. Si ya viene una
   * base válida `.../api/vN`, la usa tal cual (sin trailing slash).
   */
  private baseUrl(config: SacmedConfig): string {
    const raw = (config.baseUrl || '').trim();
    if (!raw) return SACMED_API.prodBaseUrl;

    // Ya apunta a /api/vN → usar tal cual (recortando lo que venga después)
    const apiMatch = raw.match(/^(https?:\/\/[^/]+\/api\/v\d+)/i);
    if (apiMatch) return apiMatch[1];

    // Cualquier otra ruta (swagger, dominio pelado, etc.) → origin + /api/v1
    try {
      return `${new URL(raw).origin}/api/v1`;
    } catch {
      return SACMED_API.prodBaseUrl;
    }
  }

  private extractError(error: any): string {
    const data = error.response?.data;
    const message = data?.detail || data?.title || data?.errors || data || error.message;
    return typeof message === 'string' ? message : JSON.stringify(message);
  }

  // ============================
  // SERVICIOS / ESPECIALIDADES
  // ============================

  /** GET /service/by-company */
  async getServices(config: SacmedConfig): Promise<SacmedOperationResult<SacmedServiceType[]>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/service/by-company`, {
        headers: this.createHeaders(config),
        timeout: 15000,
      });
      return { success: true, data: response.data || [] };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo servicios: ${message}`);
      return { success: false, error: message };
    }
  }

  /** GET /specialty/by-service/{serviceId} */
  async getSpecialtiesByService(
    serviceId: number,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<SacmedSpecialty[]>> {
    try {
      const response = await axios.get(
        `${this.baseUrl(config)}/specialty/by-service/${serviceId}`,
        { headers: this.createHeaders(config), timeout: 15000 },
      );
      return { success: true, data: response.data || [] };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo especialidades: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // PROFESIONALES
  // ============================

  /** GET /practitioners */
  async getPractitioners(
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<SacmedPractitionersResponse>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/practitioners`, {
        headers: this.createHeaders(config),
        timeout: 15000,
      });
      return { success: true, data: response.data || { practitioners: [] } };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo profesionales: ${message}`);
      return { success: false, error: message };
    }
  }

  /** GET /practitioner/by-specialty/{specialtyId} */
  async getPractitionersBySpecialty(
    specialtyId: number,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<SacmedSpecialist[]>> {
    try {
      const response = await axios.get(
        `${this.baseUrl(config)}/practitioner/by-specialty/${specialtyId}`,
        { headers: this.createHeaders(config), timeout: 15000 },
      );
      return { success: true, data: response.data || [] };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo especialistas: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // COMUNAS (DISTRICTS)
  // ============================

  /** GET /district */
  async getDistricts(config: SacmedConfig): Promise<SacmedOperationResult<SacmedDistrict[]>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/district`, {
        headers: this.createHeaders(config),
        timeout: 15000,
      });
      return { success: true, data: response.data || [] };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo comunas: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // PACIENTES
  // ============================

  /** GET /patient?identification={rut} */
  async searchPatient(
    identification: string,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<SacmedPatient[]>> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/patient`, {
        params: { identification },
        headers: this.createHeaders(config),
        timeout: 15000,
      });
      const data = response.data;
      return { success: true, data: Array.isArray(data) ? data : data ? [data] : [] };
    } catch (error) {
      // Sacmed devuelve 404 cuando el RUT no existe → resultado vacío, no es error
      if (error.response?.status === 404) {
        return { success: true, data: [] };
      }
      const message = this.extractError(error);
      this.logger.error(`Error buscando paciente: ${message}`);
      return { success: false, error: message };
    }
  }

  /** POST /patient */
  async createPatient(
    payload: SacmedCreatePatientPayload,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<any>> {
    try {
      const response = await axios.post(`${this.baseUrl(config)}/patient`, payload, {
        headers: { ...this.createHeaders(config), 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error creando paciente: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  /** POST /availability/by-practitioner */
  async getAvailabilityByPractitioner(
    body: SacmedAvailabilityRequest,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<SacmedAvailabilityItem[]>> {
    try {
      const response = await axios.post(
        `${this.baseUrl(config)}/availability/by-practitioner`,
        body,
        {
          headers: { ...this.createHeaders(config), 'Content-Type': 'application/json' },
          timeout: 60000,
        },
      );
      const data = response.data;
      // La API puede devolver una lista directa o { message: [...] }
      const items = Array.isArray(data) ? data : data?.message || [];
      return { success: true, data: Array.isArray(items) ? items : [] };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo disponibilidad: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // EVENTOS (CITAS)
  // ============================

  /** POST /events */
  async createEvent(
    payload: SacmedCreateEventPayload,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<{ eventId: number }>> {
    try {
      const response = await axios.post(`${this.baseUrl(config)}/events`, payload, {
        headers: { ...this.createHeaders(config), 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      });

      if (response.status === 201) {
        // Sacmed responde el eventId como entero crudo en el body (ej: 1671543),
        // no como { eventId }. También expone el id en el header Location.
        return { success: true, data: { eventId: this.extractEventId(response) } };
      }
      if (response.status === 422) {
        return {
          success: false,
          error: 'El horario ya no está disponible, intenta en otro horario',
        };
      }
      return {
        success: false,
        error: `No fue posible crear la cita (status ${response.status})`,
      };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error creando cita: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Extrae el eventId de la respuesta de POST /events. Sacmed lo devuelve como
   * entero crudo en el body (`1671543`), pero soportamos también `{ eventId }`
   * y el header `Location: /api/v1/events/{id}` como fallback.
   */
  private extractEventId(response: any): number | undefined {
    const raw = response?.data;
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw === 'object' && raw.eventId != null) return Number(raw.eventId);
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
    const loc: string | undefined = response?.headers?.location;
    const match = loc?.match(/\/events\/(\d+)/);
    return match ? Number(match[1]) : undefined;
  }

  /** GET /events/by-patient/identification/{identification} */
  async getEventsByPatient(
    identification: string,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<SacmedEvent[]>> {
    try {
      const response = await axios.get(
        `${this.baseUrl(config)}/events/by-patient/identification/${encodeURIComponent(
          identification,
        )}`,
        { headers: this.createHeaders(config), timeout: 30000 },
      );
      return { success: true, data: response.data || [] };
    } catch (error) {
      // 404 = el paciente no tiene citas → resultado vacío, no es error
      if (error.response?.status === 404) {
        return { success: true, data: [] };
      }
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo citas del paciente: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /events/by-practitioner/identification/{identification}/fechas/{from}/{to}
   * (from/to en formato ISO o YYYY-MM-DD según la API)
   */
  async getEventsByPractitioner(
    identification: string,
    from: string,
    to: string,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<SacmedEvent[]>> {
    try {
      const response = await axios.get(
        `${this.baseUrl(config)}/events/by-practitioner/identification/${encodeURIComponent(
          identification,
        )}/fechas/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
        { headers: this.createHeaders(config), timeout: 30000 },
      );
      return { success: true, data: response.data || [] };
    } catch (error) {
      // 404 = el profesional no tiene citas en el rango → resultado vacío, no es error
      if (error.response?.status === 404) {
        return { success: true, data: [] };
      }
      const message = this.extractError(error);
      this.logger.error(`Error obteniendo citas del profesional: ${message}`);
      return { success: false, error: message };
    }
  }

  /** PUT /events/status (statusEventId: 2 = confirmar, 7 = cancelar) */
  async updateEventStatus(
    eventId: number,
    statusEventId: number,
    config: SacmedConfig,
  ): Promise<SacmedOperationResult<{ mensaje: string }>> {
    try {
      const payload: SacmedUpdateEventStatusPayload = { eventId, statusEventId };
      const response = await axios.put(`${this.baseUrl(config)}/events/status`, payload, {
        headers: { ...this.createHeaders(config), 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      });

      if (response.status === 404) {
        return { success: false, error: 'La cita no fue encontrada' };
      }
      if (response.status >= 400) {
        return {
          success: false,
          error: `No fue posible actualizar el estado de la cita (status ${response.status})`,
        };
      }
      return { success: true, data: { mensaje: 'Estado actualizado con éxito' } };
    } catch (error) {
      const message = this.extractError(error);
      this.logger.error(`Error actualizando estado de cita: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================
  // TEST DE CONEXIÓN
  // ============================

  async testConnection(
    config: SacmedConfig,
  ): Promise<{ connected: boolean; message: string; services?: number }> {
    try {
      const response = await axios.get(`${this.baseUrl(config)}/service/by-company`, {
        headers: this.createHeaders(config),
        timeout: 10000,
      });
      const services = Array.isArray(response.data) ? response.data.length : 0;
      return {
        connected: true,
        message: 'Conexión exitosa con Sacmed',
        services,
      };
    } catch (error) {
      if (error.response?.status === 401) {
        return { connected: false, message: 'API Key inválida (401)' };
      }
      return { connected: false, message: this.extractError(error) };
    }
  }
}

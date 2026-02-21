import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  GoHighLevelConfig,
  GHLOperationResult,
  GHLCalendar,
  GHLUser,
  GHLFreeSlots,
  GHLAppointment,
  GHLCreateAppointmentPayload,
  GHLUpdateContactPayload,
  GHL_API,
} from './gohighlevel.types';

@Injectable()
export class GoHighLevelService {
  private readonly logger = new Logger(GoHighLevelService.name);

  private createHeaders(config: GoHighLevelConfig) {
    return {
      Authorization: `Bearer ${config.ghlAccessToken}`,
      Version: GHL_API.apiVersion,
      Accept: 'application/json',
    };
  }

  // ============================
  // CALENDARIOS
  // ============================

  /**
   * Lista todos los calendarios de una ubicación
   * GET /calendars/?locationId={locationId}
   */
  async getCalendars(
    config: GoHighLevelConfig,
  ): Promise<GHLOperationResult<GHLCalendar[]>> {
    try {
      this.logger.log(`Obteniendo calendarios para location: ${config.ghlLocationId}`);

      const response = await axios.get(`${GHL_API.baseUrl}/calendars/`, {
        params: { locationId: config.ghlLocationId },
        headers: this.createHeaders(config),
        timeout: 15000,
      });

      const calendars = response.data?.calendars || [];
      this.logger.log(`Calendarios encontrados: ${calendars.length}`);
      return { success: true, data: calendars };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error obteniendo calendarios: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Obtiene información detallada de un calendario
   * GET /calendars/{calendarId}
   */
  async getCalendar(
    config: GoHighLevelConfig,
    calendarId: string,
  ): Promise<GHLOperationResult<GHLCalendar>> {
    try {
      this.logger.log(`Obteniendo info del calendario: ${calendarId}`);

      const response = await axios.get(`${GHL_API.baseUrl}/calendars/${calendarId}`, {
        headers: this.createHeaders(config),
        timeout: 15000,
      });

      const calendar = response.data?.calendar || response.data;
      return { success: true, data: calendar };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error obteniendo calendario: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // USUARIOS
  // ============================

  /**
   * Obtiene información de un usuario por ID
   * GET /users/{userId}
   */
  async getUser(
    config: GoHighLevelConfig,
    userId: string,
  ): Promise<GHLOperationResult<GHLUser>> {
    try {
      this.logger.log(`Obteniendo info del usuario: ${userId}`);

      const response = await axios.get(`${GHL_API.baseUrl}/users/${userId}`, {
        headers: this.createHeaders(config),
        timeout: 15000,
      });

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error obteniendo usuario: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  /**
   * Obtiene slots libres de un calendario
   * GET /calendars/{calendarId}/free-slots
   */
  async getFreeSlots(
    config: GoHighLevelConfig,
    calendarId: string,
    startDateMs: number,
    endDateMs: number,
  ): Promise<GHLOperationResult<GHLFreeSlots>> {
    try {
      const timezone = config.timezone || 'America/Santiago';
      this.logger.log(`Obteniendo slots libres: calendar=${calendarId}, timezone=${timezone}`);

      const response = await axios.get(
        `${GHL_API.baseUrl}/calendars/${calendarId}/free-slots`,
        {
          params: {
            startDate: startDateMs,
            endDate: endDateMs,
            timezone,
          },
          headers: this.createHeaders(config),
          timeout: 15000,
        },
      );

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error obteniendo slots libres: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // CITAS
  // ============================

  /**
   * Crea un appointment en GHL
   * POST /calendars/events/appointments
   */
  async createAppointment(
    config: GoHighLevelConfig,
    payload: GHLCreateAppointmentPayload,
  ): Promise<GHLOperationResult<GHLAppointment>> {
    try {
      this.logger.log(`Creando cita en GHL: calendar=${payload.calendarId}, contact=${payload.contactId}`);

      const response = await axios.post(
        `${GHL_API.baseUrl}/calendars/events/appointments`,
        payload,
        {
          headers: {
            ...this.createHeaders(config),
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      if (response.status < 200 || response.status >= 300) {
        return { success: false, error: `Error creando cita (${response.status})` };
      }

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data || error.message;
      this.logger.error(`Error creando cita: ${JSON.stringify(message)}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Obtiene un appointment por ID
   * GET /calendars/events/appointments/{eventId}
   */
  async getAppointment(
    config: GoHighLevelConfig,
    eventId: string,
  ): Promise<GHLOperationResult<GHLAppointment>> {
    try {
      this.logger.log(`Obteniendo cita: ${eventId}`);

      const response = await axios.get(
        `${GHL_API.baseUrl}/calendars/events/appointments/${eventId}`,
        {
          headers: {
            ...this.createHeaders(config),
            'Location-Id': config.ghlLocationId,
          },
          timeout: 15000,
        },
      );

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error obteniendo cita: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Actualiza un appointment
   * PUT /calendars/events/appointments/{eventId}
   */
  async updateAppointment(
    config: GoHighLevelConfig,
    eventId: string,
    payload: Partial<GHLCreateAppointmentPayload>,
  ): Promise<GHLOperationResult<GHLAppointment>> {
    try {
      this.logger.log(`Actualizando cita: ${eventId}`);

      const response = await axios.put(
        `${GHL_API.baseUrl}/calendars/events/appointments/${eventId}`,
        payload,
        {
          headers: {
            ...this.createHeaders(config),
            'Content-Type': 'application/json',
            'Location-Id': config.ghlLocationId,
          },
          timeout: 15000,
        },
      );

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error actualizando cita: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Elimina un evento/cita
   * DELETE /calendars/events/{eventId}
   */
  async deleteAppointment(
    config: GoHighLevelConfig,
    eventId: string,
  ): Promise<GHLOperationResult<{ succeeded: boolean }>> {
    try {
      this.logger.log(`Eliminando cita: ${eventId}`);

      const response = await axios.delete(
        `${GHL_API.baseUrl}/calendars/events/${eventId}`,
        {
          headers: this.createHeaders(config),
          timeout: 15000,
        },
      );

      if (response.status < 200 || response.status >= 300) {
        return { success: false, error: `Error eliminando cita (${response.status})` };
      }

      return { success: true, data: { succeeded: true } };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error eliminando cita: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // CONTACTOS
  // ============================

  /**
   * Obtiene las citas de un contacto
   * GET /contacts/{contactId}/appointments
   */
  async getContactAppointments(
    config: GoHighLevelConfig,
    contactId: string,
  ): Promise<GHLOperationResult<GHLAppointment[]>> {
    try {
      this.logger.log(`Obteniendo citas del contacto: ${contactId}`);

      const response = await axios.get(
        `${GHL_API.baseUrl}/contacts/${contactId}/appointments`,
        {
          headers: this.createHeaders(config),
          timeout: 15000,
        },
      );

      const events = response.data?.events || [];
      return { success: true, data: events };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error obteniendo citas del contacto: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  /**
   * Actualiza información de un contacto
   * PUT /contacts/{contactId}
   */
  async updateContact(
    config: GoHighLevelConfig,
    contactId: string,
    payload: GHLUpdateContactPayload,
  ): Promise<GHLOperationResult<any>> {
    try {
      this.logger.log(`Actualizando contacto: ${contactId}`);

      const response = await axios.put(
        `${GHL_API.baseUrl}/contacts/${contactId}`,
        payload,
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
      const message = error.response?.data?.message || error.message;
      this.logger.error(`Error actualizando contacto: ${message}`);
      return { success: false, error: typeof message === 'string' ? message : JSON.stringify(message) };
    }
  }

  // ============================
  // TEST DE CONEXION
  // ============================

  async testConnection(config: GoHighLevelConfig): Promise<{ connected: boolean; message: string; calendars?: number }> {
    try {
      const result = await this.getCalendars(config);

      if (result.success) {
        return {
          connected: true,
          message: `Conexion exitosa con GoHighLevel. ${result.data?.length || 0} calendarios encontrados.`,
          calendars: result.data?.length || 0,
        };
      }

      return {
        connected: false,
        message: result.error || 'Error desconocido al conectar con GoHighLevel',
      };
    } catch (error) {
      return {
        connected: false,
        message: error.message || 'Error de conexion con GoHighLevel',
      };
    }
  }
}

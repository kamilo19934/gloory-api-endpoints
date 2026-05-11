import { Injectable, Logger } from '@nestjs/common';
import {
  GoHighLevelConfig,
  GHLOperationResult,
  GHLCalendar,
  GHLUser,
  GHLFreeSlots,
  GHLAppointment,
  GHLCreateAppointmentPayload,
  GHLUpdateContactPayload,
} from './gohighlevel.types';
import { GHLApiClient } from '../../gohighlevel/oauth/ghl-api-client.service';

@Injectable()
export class GoHighLevelService {
  private readonly logger = new Logger(GoHighLevelService.name);

  constructor(private readonly ghlApiClient: GHLApiClient) {}

  /**
   * Llamada centralizada a GHL: decide OAuth vs PIT según el config y
   * delega en `GHLApiClient`. El wrapper maneja el retry on-401 (OAuth) y
   * el backoff en 429.
   */
  private async callGHL<T = any>(
    config: GoHighLevelConfig,
    axiosConfig: Parameters<GHLApiClient['request']>[1],
  ): Promise<T> {
    const merged: Parameters<GHLApiClient['request']>[1] = {
      timeout: 15000,
      ...axiosConfig,
    };

    if (config.ghlOAuthMode) {
      return this.ghlApiClient.request<T>(config.ghlLocationId, merged);
    }
    return this.ghlApiClient.requestWithToken<T>(config.ghlAccessToken, merged);
  }

  // ============================
  // CALENDARIOS
  // ============================

  async getCalendars(config: GoHighLevelConfig): Promise<GHLOperationResult<GHLCalendar[]>> {
    try {
      this.logger.log(`Obteniendo calendarios para location: ${config.ghlLocationId}`);

      const data = await this.callGHL<{ calendars?: GHLCalendar[] }>(config, {
        method: 'GET',
        url: '/calendars/',
        params: { locationId: config.ghlLocationId },
      });

      const calendars = data?.calendars || [];
      this.logger.log(`Calendarios encontrados: ${calendars.length}`);
      return { success: true, data: calendars };
    } catch (error) {
      return this.failureResult(error, 'Error obteniendo calendarios');
    }
  }

  async getCalendar(
    config: GoHighLevelConfig,
    calendarId: string,
  ): Promise<GHLOperationResult<GHLCalendar>> {
    try {
      this.logger.log(`Obteniendo info del calendario: ${calendarId}`);

      const data = await this.callGHL<any>(config, {
        method: 'GET',
        url: `/calendars/${calendarId}`,
      });

      const calendar = data?.calendar || data;
      return { success: true, data: calendar };
    } catch (error) {
      return this.failureResult(error, 'Error obteniendo calendario');
    }
  }

  // ============================
  // USUARIOS
  // ============================

  async getUser(config: GoHighLevelConfig, userId: string): Promise<GHLOperationResult<GHLUser>> {
    try {
      this.logger.log(`Obteniendo info del usuario: ${userId}`);
      const data = await this.callGHL<GHLUser>(config, {
        method: 'GET',
        url: `/users/${userId}`,
      });
      return { success: true, data };
    } catch (error) {
      return this.failureResult(error, 'Error obteniendo usuario');
    }
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  async getFreeSlots(
    config: GoHighLevelConfig,
    calendarId: string,
    startDateMs: number,
    endDateMs: number,
  ): Promise<GHLOperationResult<GHLFreeSlots>> {
    try {
      const timezone = config.timezone || 'America/Santiago';
      this.logger.log(`Obteniendo slots libres: calendar=${calendarId}, timezone=${timezone}`);

      const data = await this.callGHL<GHLFreeSlots>(config, {
        method: 'GET',
        url: `/calendars/${calendarId}/free-slots`,
        params: { startDate: startDateMs, endDate: endDateMs, timezone },
      });

      return { success: true, data };
    } catch (error) {
      return this.failureResult(error, 'Error obteniendo slots libres');
    }
  }

  // ============================
  // CITAS
  // ============================

  async createAppointment(
    config: GoHighLevelConfig,
    payload: GHLCreateAppointmentPayload,
  ): Promise<GHLOperationResult<GHLAppointment>> {
    try {
      this.logger.log(
        `Creando cita en GHL: calendar=${payload.calendarId}, contact=${payload.contactId}`,
      );

      const data = await this.callGHL<GHLAppointment>(config, {
        method: 'POST',
        url: '/calendars/events/appointments',
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });

      return { success: true, data };
    } catch (error) {
      return this.failureResult(error, 'Error creando cita');
    }
  }

  async getAppointment(
    config: GoHighLevelConfig,
    eventId: string,
  ): Promise<GHLOperationResult<GHLAppointment>> {
    try {
      this.logger.log(`Obteniendo cita: ${eventId}`);

      const data = await this.callGHL<GHLAppointment>(config, {
        method: 'GET',
        url: `/calendars/events/appointments/${eventId}`,
        headers: { 'Location-Id': config.ghlLocationId },
      });

      return { success: true, data };
    } catch (error) {
      return this.failureResult(error, 'Error obteniendo cita');
    }
  }

  async updateAppointment(
    config: GoHighLevelConfig,
    eventId: string,
    payload: Partial<GHLCreateAppointmentPayload>,
  ): Promise<GHLOperationResult<GHLAppointment>> {
    try {
      this.logger.log(`Actualizando cita: ${eventId}`);

      const data = await this.callGHL<GHLAppointment>(config, {
        method: 'PUT',
        url: `/calendars/events/appointments/${eventId}`,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          'Location-Id': config.ghlLocationId,
        },
      });

      return { success: true, data };
    } catch (error) {
      return this.failureResult(error, 'Error actualizando cita');
    }
  }

  async deleteAppointment(
    config: GoHighLevelConfig,
    eventId: string,
  ): Promise<GHLOperationResult<{ succeeded: boolean }>> {
    try {
      this.logger.log(`Eliminando cita: ${eventId}`);

      await this.callGHL(config, {
        method: 'DELETE',
        url: `/calendars/events/${eventId}`,
      });

      return { success: true, data: { succeeded: true } };
    } catch (error) {
      return this.failureResult(error, 'Error eliminando cita');
    }
  }

  // ============================
  // CONTACTOS
  // ============================

  async getContactAppointments(
    config: GoHighLevelConfig,
    contactId: string,
  ): Promise<GHLOperationResult<GHLAppointment[]>> {
    try {
      this.logger.log(`Obteniendo citas del contacto: ${contactId}`);

      const data = await this.callGHL<{ events?: GHLAppointment[] }>(config, {
        method: 'GET',
        url: `/contacts/${contactId}/appointments`,
      });

      return { success: true, data: data?.events || [] };
    } catch (error) {
      return this.failureResult(error, 'Error obteniendo citas del contacto');
    }
  }

  async updateContact(
    config: GoHighLevelConfig,
    contactId: string,
    payload: GHLUpdateContactPayload,
  ): Promise<GHLOperationResult<any>> {
    try {
      this.logger.log(`Actualizando contacto: ${contactId}`);

      const data = await this.callGHL<any>(config, {
        method: 'PUT',
        url: `/contacts/${contactId}`,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });

      return { success: true, data };
    } catch (error) {
      return this.failureResult(error, 'Error actualizando contacto');
    }
  }

  // ============================
  // TEST DE CONEXION
  // ============================

  async testConnection(
    config: GoHighLevelConfig,
  ): Promise<{ connected: boolean; message: string; calendars?: number }> {
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

  private failureResult<T>(error: any, context: string): GHLOperationResult<T> {
    const message = error.response?.data?.message || error.response?.data || error.message;
    this.logger.error(
      `${context}: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
    );
    return {
      success: false,
      error: typeof message === 'string' ? message : JSON.stringify(message),
    };
  }
}

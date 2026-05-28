import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { GHLApiClient } from '../gohighlevel/oauth/ghl-api-client.service';
import { GoHighLevelConfig } from '../integrations/gohighlevel/gohighlevel.types';

export interface IntegrarCitaPayload {
  userId: string; // GHL contact ID (lo provee el caller como `user_id`)
  fecha: string; // YYYY-MM-DD
  hora_inicio: string; // HH:mm o HH:mm:ss
  duracion: number; // minutos
  title?: string; // default 'Cita Médica'
  customFields?: Array<{ key: string; field_value: string }>; // opcional: actualiza contacto antes de crear cita
}

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);

  constructor(private readonly ghlApiClient: GHLApiClient) {}

  /**
   * Llamada a GHL respetando el modo del cliente:
   * - OAuth (ghlOAuthMode=true) → wrapper resuelve el token de la location y maneja retry on-401.
   * - PIT (default) → usa el ghlAccessToken explícito.
   */
  private async callGHL<T = any>(
    config: GoHighLevelConfig,
    axiosConfig: Parameters<GHLApiClient['request']>[1],
  ): Promise<T> {
    if (config.ghlOAuthMode) {
      return this.ghlApiClient.request<T>(config.ghlLocationId, axiosConfig);
    }
    return this.ghlApiClient.requestWithToken<T>(config.ghlAccessToken, axiosConfig);
  }

  /**
   * Espeja una cita recién creada (Dentalink/MediLink/Reservo) en GoHighLevel.
   *
   * Pasos:
   *  1. (opcional) PUT /contacts/{userId} con `customFields` si el caller los provee.
   *  2. GET /calendars/{ghlCalendarId} → resuelve `assignedUserId` (primer teamMember).
   *  3. POST /calendars/events/appointments con `appointmentStatus: 'new'`.
   *
   * Requiere que `config.ghlCalendarId` esté definido. Soporta tanto OAuth como PIT
   * via `callGHL`. Diseñado para correr en background (`setImmediate`) — el caller
   * debe capturar errores para no propagarlos a la respuesta del POST original.
   */
  async integrarCita(config: GoHighLevelConfig, payload: IntegrarCitaPayload): Promise<void> {
    if (!config.ghlCalendarId) {
      this.logger.warn(
        `⚠️ No se puede espejar cita en GHL: ghlCalendarId no configurado para location ${config.ghlLocationId}`,
      );
      return;
    }

    const timezone = config.timezone || 'America/Santiago';

    try {
      // 1. Actualizar contacto con custom fields (opcional)
      if (payload.customFields && payload.customFields.length > 0) {
        this.logger.log(`🌐 Actualizando contacto ${payload.userId} en GHL`);
        await this.callGHL(config, {
          method: 'PUT',
          url: `/contacts/${payload.userId}`,
          data: { customFields: payload.customFields },
        });
        this.logger.log('✅ Contacto actualizado en GHL');
      }

      // 2. Resolver assignedUserId del calendar (Version 2021-04-15 para calendars)
      this.logger.log(`🌐 Obteniendo calendar ${config.ghlCalendarId}`);
      const calendarData = await this.callGHL<{ calendar?: any }>(config, {
        method: 'GET',
        url: `/calendars/${config.ghlCalendarId}`,
        headers: { Version: '2021-04-15' },
      });

      const teamMembers = calendarData?.calendar?.teamMembers || [];
      const assignedUserId: string | null = teamMembers[0]?.userId || null;
      if (!assignedUserId) {
        this.logger.error('❌ No se pudo obtener assignedUserId del calendar');
        return;
      }
      this.logger.log(`✅ assignedUserId: ${assignedUserId}`);

      // 3. Crear appointment en GHL
      const inicioMoment = moment.tz(`${payload.fecha} ${payload.hora_inicio}`, timezone);
      const finMoment = inicioMoment.clone().add(payload.duracion, 'minutes');

      const appointmentPayload = {
        title: payload.title || 'Cita Médica',
        overrideLocationConfig: true,
        appointmentStatus: 'new',
        ignoreDateRange: true,
        ignoreFreeSlotValidation: true,
        calendarId: config.ghlCalendarId,
        locationId: config.ghlLocationId,
        assignedUserId,
        contactId: payload.userId,
        startTime: inicioMoment.format(),
        endTime: finMoment.format(),
      };

      this.logger.log(`📤 Creando appointment en GHL: ${JSON.stringify(appointmentPayload)}`);

      await this.callGHL(config, {
        method: 'POST',
        url: '/calendars/events/appointments',
        data: appointmentPayload,
        headers: { Version: '2021-04-15' },
      });

      this.logger.log('✅ Appointment creado en GHL');
    } catch (error) {
      this.logger.error(`❌ Error en integración GHL: ${error.message}`);

      if (error.response) {
        this.logger.error(`📛 Status: ${error.response.status}`);
        this.logger.error(`📛 Response GHL: ${JSON.stringify(error.response.data)}`);
      }

      throw error;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as moment from 'moment-timezone';
import { GHLApiClient } from '../gohighlevel/oauth/ghl-api-client.service';

interface GHLConfig {
  accessToken: string;
  calendarId: string;
  locationId: string;
}

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);

  constructor(private readonly ghlApiClient: GHLApiClient) {}

  /**
   * Integra una cita con GoHighLevel (se ejecuta en background).
   *
   * Esta ruta es legacy/PIT: usa `client.ghlEnabled + client.ghlAccessToken`.
   * No participa del flujo OAuth Marketplace, así que las llamadas usan
   * `requestWithToken` del wrapper (sin retry on-401, sólo backoff en 429).
   */
  async integrarCita(
    config: GHLConfig,
    citaData: {
      userId: string;
      fecha: string;
      hora_inicio: string;
      duracion: number;
      id_profesional: number;
      id_sucursal: number;
      comentario?: string;
    },
    dentalinkApiUrl: string,
    dentalinkHeaders: any,
    timezone: string,
  ): Promise<void> {
    try {
      // 1. Obtener nombres del profesional y sucursal desde Dentalink (no GHL)
      let nombreProfesional = `Profesional ${citaData.id_profesional}`;
      let nombreSucursal = `Sucursal ${citaData.id_sucursal}`;

      try {
        const profResp = await axios.get(`${dentalinkApiUrl}dentistas`, {
          headers: dentalinkHeaders,
        });
        if (profResp.status === 200) {
          const profesionales = profResp.data?.data || [];
          const prof = profesionales.find((p: any) => p.id === citaData.id_profesional);
          if (prof) {
            const apellido = prof.apellido || prof.apellidos || '';
            nombreProfesional = `${prof.nombre || 'Desconocido'} ${apellido}`.trim();
          }
        }

        const sucResp = await axios.get(`${dentalinkApiUrl}sucursales/${citaData.id_sucursal}`, {
          headers: dentalinkHeaders,
        });
        if (sucResp.status === 200) {
          nombreSucursal = sucResp.data?.data?.nombre || nombreSucursal;
        }
      } catch (error) {
        this.logger.warn(`⚠️ Error obteniendo nombres: ${error.message}`);
      }

      // 2. Actualizar contacto con custom fields
      const customFields: any[] = [
        { key: 'doctor', field_value: nombreProfesional },
        { key: 'clinica', field_value: nombreSucursal },
      ];

      if (citaData.comentario) {
        customFields.push({ key: 'comentario', field_value: citaData.comentario });
      }

      this.logger.log(`🌐 Actualizando contacto ${citaData.userId} en GHL`);

      await this.ghlApiClient.requestWithToken(config.accessToken, {
        method: 'PUT',
        url: `/contacts/${citaData.userId}`,
        data: { customFields },
      });
      this.logger.log(`✅ Contacto actualizado en GHL: ${nombreProfesional} - ${nombreSucursal}`);

      // 3. Obtener assignedUserId del calendar (Version 2021-04-15 para calendars)
      this.logger.log(`🌐 Obteniendo calendar ${config.calendarId}`);

      const calendarData = await this.ghlApiClient.requestWithToken<{ calendar?: any }>(
        config.accessToken,
        {
          method: 'GET',
          url: `/calendars/${config.calendarId}`,
          headers: { Version: '2021-04-15' },
        },
      );

      const teamMembers = calendarData?.calendar?.teamMembers || [];
      const assignedUserId: string | null = teamMembers[0]?.userId || null;

      if (!assignedUserId) {
        this.logger.error('❌ No se pudo obtener assignedUserId del calendar');
        return;
      }
      this.logger.log(`✅ Obtenido assignedUserId: ${assignedUserId}`);

      // 4. Crear appointment en GHL
      const inicioMoment = moment.tz(`${citaData.fecha} ${citaData.hora_inicio}`, timezone);
      const finMoment = inicioMoment.clone().add(citaData.duracion, 'minutes');

      const appointmentPayload = {
        title: 'Cita Médica',
        overrideLocationConfig: true,
        appointmentStatus: 'new',
        ignoreDateRange: true,
        ignoreFreeSlotValidation: true,
        calendarId: config.calendarId,
        locationId: config.locationId,
        assignedUserId,
        contactId: citaData.userId,
        startTime: inicioMoment.format(),
        endTime: finMoment.format(),
      };

      this.logger.log('📤 Payload para crear appointment en GHL:');
      this.logger.log(JSON.stringify(appointmentPayload, null, 2));

      await this.ghlApiClient.requestWithToken(config.accessToken, {
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
        this.logger.error(`📛 Response completa de GHL:`);
        this.logger.error(JSON.stringify(error.response.data, null, 2));

        if (error.config?.data) {
          this.logger.error(`📛 Payload que se intentó enviar:`);
          this.logger.error(error.config.data);
        }
      }

      throw error;
    }
  }
}

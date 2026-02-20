import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { formatearFechaHoraGHL } from '../utils/timezone.util';
import * as moment from 'moment-timezone';

interface GHLConfig {
  accessToken: string;
  calendarId: string;
  locationId: string;
}

@Injectable()
export class GHLService {
  private readonly logger = new Logger(GHLService.name);

  /**
   * Integra una cita con GoHighLevel (se ejecuta en background)
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
      const headers = {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      };

      // 1. Obtener nombres del profesional y sucursal desde Dentalink
      let nombreProfesional = `Profesional ${citaData.id_profesional}`;
      let nombreSucursal = `Sucursal ${citaData.id_sucursal}`;

      try {
        // Obtener nombre del profesional
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

        // Obtener nombre de la sucursal
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

      const updatePayload = {
        customFields,
      };

      const updateUrl = `https://services.leadconnectorhq.com/contacts/${citaData.userId}`;
      this.logger.log(`🌐 Actualizando contacto en: ${updateUrl}`);

      const contactResp = await axios.put(updateUrl, updatePayload, { headers });

      if (contactResp.status === 200) {
        this.logger.log(`✅ Contacto actualizado en GHL: ${nombreProfesional} - ${nombreSucursal}`);
      } else {
        this.logger.error(`❌ Error actualizando contacto: ${contactResp.status}`);
      }

      // 3. Obtener assignedUserId del calendar
      const headersCalendar = {
        ...headers,
        Version: '2021-04-15',
      };

      const calendarUrl = `https://services.leadconnectorhq.com/calendars/${config.calendarId}`;
      this.logger.log(`🌐 Obteniendo calendar desde: ${calendarUrl}`);

      const calendarResp = await axios.get(calendarUrl, { headers: headersCalendar });

      let assignedUserId: string | null = null;
      if (calendarResp.status === 200) {
        const calendarData = calendarResp.data?.calendar || {};
        const teamMembers = calendarData.teamMembers || [];

        if (teamMembers.length > 0) {
          assignedUserId = teamMembers[0].userId;
          this.logger.log(`✅ Obtenido assignedUserId: ${assignedUserId}`);
        } else {
          this.logger.error('❌ No hay teamMembers en el calendar');
        }
      }

      if (!assignedUserId) {
        this.logger.error('❌ No se pudo obtener assignedUserId del calendar');
        return;
      }

      // 4. Crear appointment en GHL
      const inicioMoment = moment.tz(`${citaData.fecha} ${citaData.hora_inicio}`, timezone);
      const finMoment = inicioMoment.clone().add(citaData.duracion, 'minutes');

      // Usar formato ISO 8601 completo con milisegundos (requerido por GHL)
      // Moment.format() sin parámetros devuelve ISO 8601 completo: YYYY-MM-DDTHH:mm:ss.SSSZ
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
        startTime: inicioMoment.format(), // ISO 8601 completo con milisegundos
        endTime: finMoment.format(), // ISO 8601 completo con milisegundos
      };

      // LOG DETALLADO DEL PAYLOAD
      this.logger.log('📤 Payload para crear appointment en GHL:');
      this.logger.log(JSON.stringify(appointmentPayload, null, 2));

      const apptResp = await axios.post(
        'https://services.leadconnectorhq.com/calendars/events/appointments',
        appointmentPayload,
        { headers: headersCalendar },
      );

      if (apptResp.status === 201) {
        this.logger.log('✅ Appointment creado en GHL');
      } else {
        this.logger.error(`❌ Error creando appointment: ${apptResp.status}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error en integración GHL: ${error.message}`);

      // LOG DETALLADO DEL ERROR
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

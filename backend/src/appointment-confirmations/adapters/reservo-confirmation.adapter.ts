import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { Client } from '../../clients/entities/client.entity';
import { ConfirmationConfig } from '../entities/confirmation-config.entity';
import { ReservoService } from '../../integrations/reservo/reservo.service';
import { ReservoConfig } from '../../integrations/reservo/reservo.types';
import {
  IConfirmationAdapter,
  FetchedAppointment,
} from './confirmation-adapter.interface';

@Injectable()
export class ReservoConfirmationAdapter implements IConfirmationAdapter {
  readonly platform = 'reservo';
  private readonly logger = new Logger(ReservoConfirmationAdapter.name);

  constructor(private readonly reservoService: ReservoService) {}

  async fetchAppointments(
    client: Client,
    config: ConfirmationConfig,
    appointmentDate: string,
    timezone: string,
  ): Promise<FetchedAppointment[]> {
    const integration = client.getIntegration('reservo');
    if (!integration) {
      this.logger.warn(`⚠️ [Reservo] Cliente ${client.id} no tiene integración Reservo`);
      return [];
    }

    const reservoConfig = integration.config as ReservoConfig;
    const tz = timezone || reservoConfig.timezone || 'America/Santiago';

    // Obtener citas por rango de fecha (un solo día)
    const citasResult = await this.reservoService.getAppointmentsByDateRange(
      appointmentDate,
      appointmentDate,
      reservoConfig,
    );

    if (!citasResult.success || !citasResult.data) {
      this.logger.warn(`⚠️ [Reservo] No se pudieron obtener citas: ${citasResult.error}`);
      return [];
    }

    const appointments = citasResult.data;
    this.logger.log(`✅ [Reservo] ${appointments.length} citas obtenidas para ${appointmentDate}`);

    // Filtrar solo citas No Confirmadas (NC)
    // Las citas en lista de espera NO se deben notificar (según doc de Reservo)
    const ncAppointments = appointments.filter(
      (apt) => apt.estado?.codigo === 'NC',
    );

    this.logger.log(
      `📋 [Reservo] ${ncAppointments.length} citas con estado NC (No Confirmado)`,
    );

    const fetched: FetchedAppointment[] = [];

    for (const apt of ncAppointments) {
      try {
        const cliente = apt.cliente;
        const profesional = apt.profesional;
        const sucursal = apt.sucursal;
        const tratamientos = apt.tratamientos || [];

        // Convertir inicio UTC a hora local
        const inicioLocal = moment.utc(apt.inicio).tz(apt.zona_horaria || tz);
        const finLocal = moment.utc(apt.fin).tz(apt.zona_horaria || tz);
        const fechaCita = inicioLocal.format('YYYY-MM-DD');
        const horaInicio = inicioLocal.format('HH:mm:ss');
        const horaFin = finLocal.format('HH:mm:ss');
        const duracion = finLocal.diff(inicioLocal, 'minutes');

        fetched.push({
          platformAppointmentId: apt.uuid,
          appointmentData: {
            id_paciente: cliente?.uuid || '',
            nombre_paciente: cliente
              ? `${cliente.nombre} ${cliente.apellido_paterno}`.trim()
              : 'Sin paciente',
            nombre_social_paciente: cliente?.nombre || '',
            rut_paciente: cliente?.identificador || '',
            email_paciente: cliente?.mail || '',
            telefono_paciente: cliente?.telefono_1 || cliente?.telefono_2 || '',
            id_tratamiento: tratamientos[0]?.uuid || '',
            nombre_tratamiento:
              tratamientos.map((t) => t.nombre).join(', ') || 'Sin tratamiento',
            fecha: fechaCita,
            hora_inicio: horaInicio,
            hora_fin: horaFin,
            duracion,
            id_dentista: profesional?.uuid || '',
            nombre_dentista: profesional?.nombre || 'Sin profesional',
            id_sucursal: sucursal?.uuid || '',
            nombre_sucursal: sucursal?.nombre || 'Sin sucursal',
            id_estado: apt.estado?.codigo || 'NC',
            estado_cita: apt.estado?.descripcion || 'No Confirmado',
            comentarios: apt.comentario || '',
          },
        });
      } catch (error) {
        this.logger.error(`❌ [Reservo] Error procesando cita ${apt.uuid}: ${error.message}`);
      }
    }

    return fetched;
  }

  async confirmAppointmentOnPlatform(
    client: Client,
    platformAppointmentId: string,
  ): Promise<void> {
    const integration = client.getIntegration('reservo');
    if (!integration) return;

    const reservoConfig = integration.config as ReservoConfig;

    this.logger.log(`🔄 [Reservo] Confirmando cita ${platformAppointmentId}`);

    const result = await this.reservoService.confirmAppointment(
      platformAppointmentId,
      reservoConfig,
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    this.logger.log(`✅ [Reservo] Cita ${platformAppointmentId} confirmada`);
  }
}

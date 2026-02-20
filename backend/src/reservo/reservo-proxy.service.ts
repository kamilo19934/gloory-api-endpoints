import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { ReservoService } from '../integrations/reservo/reservo.service';
import {
  ReservoConfig,
  ReservoAgenda,
  ReservoCreateAppointmentPayload,
} from '../integrations/reservo/reservo.types';
import { SearchPatientDto } from './dto/search-patient.dto';
import { ReservoSearchAvailabilityDto } from './dto/search-availability.dto';
import { ReservoCreateAppointmentDto } from './dto/create-appointment.dto';
import { ReservoCreatePatientDto } from './dto/create-patient.dto';
import { ReservoConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { ReservoCancelAppointmentDto } from './dto/cancel-appointment.dto';
import { ReservoGetProfessionalsDto } from './dto/get-professionals.dto';
import { ReservoGetTreatmentsDto } from './dto/get-treatments.dto';
import { ReservoGetSucursalesDto } from './dto/get-sucursales.dto';
import { ReservoGetAppointmentsDto } from './dto/get-appointments.dto';

@Injectable()
export class ReservoProxyService {
  private readonly logger = new Logger(ReservoProxyService.name);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly reservoService: ReservoService,
  ) {}

  private async getReservoConfig(clientId: string): Promise<ReservoConfig> {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('reservo');

    if (!integration) {
      throw new HttpException(
        'Este cliente no tiene integración con Reservo configurada',
        HttpStatus.BAD_REQUEST,
      );
    }

    return integration.config as ReservoConfig;
  }

  /**
   * Resuelve un agenda_id (asignado) al UUID real de Reservo
   * Permite que el agente IA use IDs simples (1, 2, 3) en vez de UUIDs largos
   */
  private resolveAgenda(config: ReservoConfig, agendaId: number): ReservoAgenda {
    const agenda = config.agendas.find((a) => a.id === agendaId);

    if (!agenda) {
      const availableIds = config.agendas.map((a) => `${a.id} (${a.nombre})`).join(', ');
      throw new HttpException(
        `Agenda con ID ${agendaId} no encontrada. Agendas disponibles: ${availableIds}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return agenda;
  }

  // ============================
  // AGENDAS
  // ============================

  async getAgendas(clientId: string) {
    const config = await this.getReservoConfig(clientId);

    if (!config.agendas || config.agendas.length === 0) {
      return [];
    }

    return config.agendas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      tipo: a.tipo,
    }));
  }

  // ============================
  // PACIENTES
  // ============================

  async searchPatient(clientId: string, dto: SearchPatientDto) {
    const config = await this.getReservoConfig(clientId);
    const result = await this.reservoService.searchPatient(
      { identificador: dto.identificador },
      config,
    );

    if (!result.success) {
      throw new HttpException(result.error || 'Error buscando paciente', HttpStatus.BAD_REQUEST);
    }

    return result.data;
  }

  async getPatientByUuid(clientId: string, uuid: string) {
    const config = await this.getReservoConfig(clientId);
    const result = await this.reservoService.getPatientByUuid(uuid, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo paciente',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  async createPatient(clientId: string, dto: ReservoCreatePatientDto) {
    const config = await this.getReservoConfig(clientId);

    // Mapear campos simplificados a los de Reservo
    // sexo: 0 = No especifica, 1 = Masculino, 2 = Femenino
    const payload = {
      identificador: dto.identificador,
      nombre: dto.nombre,
      apellido_paterno: dto.apellido,
      telefono_1: dto.telefono,
      mail: dto.mail,
      sexo: dto.sexo ?? 0,
      fecha_nacimiento: dto.fecha_nacimiento,
    };

    const result = await this.reservoService.createPatient(payload, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error creando paciente', HttpStatus.BAD_REQUEST);
    }

    const created = Array.isArray(result.data) ? result.data[0] : result.data;
    return {
      message: 'Paciente creado con exito',
      uuid: created?.uuid,
    };
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  async searchAvailability(clientId: string, dto: ReservoSearchAvailabilityDto) {
    const config = await this.getReservoConfig(clientId);
    const agenda = this.resolveAgenda(config, dto.agenda_id);
    const result = await this.reservoService.getAvailability(
      agenda.uuid,
      dto.fecha,
      dto.uuid_tratamiento,
      config,
      {
        uuid_profesional: dto.uuid_profesional,
        uuid_sucursal: dto.uuid_sucursal,
      },
    );

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo disponibilidad',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.transformAvailability(result.data || []);
  }

  private transformAvailability(data: any[]) {
    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const MESES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    const formatFecha = (fechaStr: string): string => {
      const [year, month, day] = fechaStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return `${DIAS[date.getDay()]} ${day} ${MESES[month - 1]} ${year}`;
    };

    const formatHora = (isoStr: string): string => {
      const match = isoStr.match(/T(\d{2}:\d{2})/);
      return match ? match[1] : isoStr;
    };

    // Agrupar por sucursal
    const sucursalMap = new Map<string, any>();

    for (const dia of data) {
      const fechaFormateada = formatFecha(dia.fecha);

      for (const suc of dia.sucursales || []) {
        const key = suc.uuid || suc.nombre;

        if (!sucursalMap.has(key)) {
          sucursalMap.set(key, {
            sucursal: {
              uuid: suc.uuid,
              nombre: suc.nombre,
              direccion: suc.direccion,
            },
            disponibilidad: [],
          });
        }

        const profesionales = (suc.profesionales || []).map((p: any) => ({
          uuid: p.agenda,
          nombre: p.nombre,
          horas_disponibles: (p.horas_disponibles || []).map(formatHora),
        }));

        sucursalMap.get(key).disponibilidad.push({
          fecha: fechaFormateada,
          profesionales,
        });
      }
    }

    return Array.from(sucursalMap.values());
  }

  // ============================
  // PROFESIONALES
  // ============================

  async getProfessionals(clientId: string, dto: ReservoGetProfessionalsDto) {
    const config = await this.getReservoConfig(clientId);
    const agenda = this.resolveAgenda(config, dto.agenda_id);
    const result = await this.reservoService.getProfessionals(agenda.uuid, config, {
      uuid_tratamiento: dto.uuid_tratamiento,
    });

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo profesionales',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Remover campos innecesarios
    return (result.data || []).map(({ agenda, identificador, ...rest }) => rest);
  }

  // ============================
  // TRATAMIENTOS
  // ============================

  async getTreatments(clientId: string, dto: ReservoGetTreatmentsDto) {
    const config = await this.getReservoConfig(clientId);
    const agenda = this.resolveAgenda(config, dto.agenda_id);
    const result = await this.reservoService.getTreatments(agenda.uuid, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo tratamientos',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  // ============================
  // SUCURSALES
  // ============================

  async getSucursales(clientId: string, dto: ReservoGetSucursalesDto) {
    const config = await this.getReservoConfig(clientId);
    const agenda = this.resolveAgenda(config, dto.agenda_id);
    const result = await this.reservoService.getSucursales(agenda.uuid, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo sucursales',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  // ============================
  // PREVISIONALES
  // ============================

  async getPrevisionOptions(clientId: string, dto: ReservoGetProfessionalsDto) {
    const config = await this.getReservoConfig(clientId);
    const agenda = this.resolveAgenda(config, dto.agenda_id);
    const result = await this.reservoService.getPrevisionOptions(agenda.uuid, config);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Error obteniendo opciones previsionales',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  // ============================
  // CITAS
  // ============================

  async createAppointment(clientId: string, dto: ReservoCreateAppointmentDto) {
    const config = await this.getReservoConfig(clientId);
    const agenda = this.resolveAgenda(config, dto.agenda_id);

    const payload: ReservoCreateAppointmentPayload = {
      sucursal: dto.id_sucursal,
      url: agenda.uuid,
      tratamientos_uuid: [dto.id_tratamiento],
      agendas_uuid: [dto.id_profesional],
      calendario: {
        time_zone: config.timezone || 'America/Santiago',
        date: dto.fecha,
        hour: dto.hora.length === 5 ? `${dto.hora}:00` : dto.hora,
      },
      cliente: {
        uuid: dto.uuid_paciente,
      },
    };

    const result = await this.reservoService.createAppointment(payload, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error creando cita', HttpStatus.BAD_REQUEST);
    }

    return this.transformAppointmentResponse(result.data);
  }

  private transformAppointmentResponse(data: any) {
    return {
      status: data.status,
      citas: (data.citas || []).map(this.transformCita),
      link: data.link,
      valor_pago: data.valor_pago,
      countdown: data.countdown,
    };
  }

  async confirmAppointment(clientId: string, dto: ReservoConfirmAppointmentDto) {
    const config = await this.getReservoConfig(clientId);
    const result = await this.reservoService.confirmAppointment(dto.id_cita, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error confirmando cita', HttpStatus.BAD_REQUEST);
    }

    return result.data;
  }

  async cancelAppointment(clientId: string, dto: ReservoCancelAppointmentDto) {
    const config = await this.getReservoConfig(clientId);
    const result = await this.reservoService.cancelAppointment(dto.id_cita, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error cancelando cita', HttpStatus.BAD_REQUEST);
    }

    return result.data;
  }

  async getAppointments(clientId: string, dto: ReservoGetAppointmentsDto) {
    const config = await this.getReservoConfig(clientId);
    const result = await this.reservoService.getAppointmentsByPatient(dto.id_paciente, config);

    if (!result.success) {
      throw new HttpException(result.error || 'Error obteniendo citas', HttpStatus.BAD_REQUEST);
    }

    return (result.data || []).map(this.transformCita);
  }

  async getFutureAppointments(clientId: string, dto: ReservoGetAppointmentsDto) {
    const config = await this.getReservoConfig(clientId);
    const result = await this.reservoService.getFutureAppointments(dto.id_paciente, config);

    if (!result.success) {
      throw new HttpException(result.error || 'No hay citas futuras', HttpStatus.NOT_FOUND);
    }

    return (result.data || []).map(this.transformCita);
  }

  private transformCita(cita: any) {
    return {
      uuid: cita.uuid,
      agenda: cita.agenda,
      sucursal: cita.sucursal,
      zona_horaria: cita.zona_horaria,
      inicio: cita.inicio,
      fin: cita.fin,
      estado: cita.estado,
      estado_pago: cita.estado_pago,
      profesional: cita.profesional,
      url_pago_online: cita.url_pago_online,
      url_videoconferencia: cita.url_videoconferencia,
    };
  }

  async testConnection(clientId: string) {
    const config = await this.getReservoConfig(clientId);
    return await this.reservoService.testConnection(config);
  }
}

import { IntegrationConfig } from './integration.interface';

/**
 * Interfaz para integraciones que soporten gestión de citas
 */
export interface IAppointmentProvider {
  /**
   * Agenda una nueva cita
   */
  scheduleAppointment(
    config: IntegrationConfig,
    params: ScheduleAppointmentParams,
  ): Promise<AppointmentResult>;

  /**
   * Cancela una cita
   */
  cancelAppointment(
    config: IntegrationConfig,
    params: CancelAppointmentParams,
  ): Promise<CancelAppointmentResult>;

  /**
   * Confirma una cita (opcional)
   */
  confirmAppointment?(
    config: IntegrationConfig,
    params: ConfirmAppointmentParams,
  ): Promise<AppointmentResult>;
}

export interface ScheduleAppointmentParams {
  patientIdentifier: string;
  professionalId: number;
  branchId: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // minutos
  treatmentId?: number;
  notes?: string;
  // Para integraciones secundarias (ej: GHL)
  externalUserId?: string;
}

export interface AppointmentResult {
  id: number;
  patientId: number;
  professionalId: number;
  branchId: number;
  date: string;
  time: string;
  duration: number;
  status: string;
  message?: string;
}

export interface CancelAppointmentParams {
  appointmentId: number;
}

export interface CancelAppointmentResult {
  success: boolean;
  message: string;
  appointmentId: number;
}

export interface ConfirmAppointmentParams {
  appointmentId: number;
}

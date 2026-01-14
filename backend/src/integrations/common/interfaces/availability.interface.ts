import { IntegrationConfig } from './integration.interface';

/**
 * Interfaz para integraciones que soporten búsqueda de disponibilidad
 */
export interface IAvailabilityProvider {
  /**
   * Busca disponibilidad de profesionales
   */
  searchAvailability(
    config: IntegrationConfig,
    params: SearchAvailabilityParams,
  ): Promise<AvailabilityResult>;
}

export interface SearchAvailabilityParams {
  professionalIds: number[];
  branchId: number;
  startDate?: string; // YYYY-MM-DD
  appointmentDuration?: number; // minutos
  timezone?: string;
}

export interface AvailabilityResult {
  availability: ProfessionalAvailability[];
  dateFrom: string;
  dateTo: string;
  message?: string;
}

export interface ProfessionalAvailability {
  professionalId: number;
  professionalName: string;
  dates: {
    [date: string]: string[]; // fecha formateada -> lista de horarios
  };
}

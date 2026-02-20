import { IntegrationConfig } from './integration.interface';

/**
 * Interfaz para integraciones que soporten gestión de pacientes
 */
export interface IPatientProvider {
  /**
   * Busca un paciente por identificador (RUT, DNI, etc.)
   */
  searchPatient(
    config: IntegrationConfig,
    params: SearchPatientParams,
  ): Promise<PatientResult | null>;

  /**
   * Crea un nuevo paciente
   */
  createPatient(config: IntegrationConfig, params: CreatePatientParams): Promise<PatientResult>;

  /**
   * Obtiene tratamientos de un paciente
   */
  getPatientTreatments?(
    config: IntegrationConfig,
    params: GetTreatmentsParams,
  ): Promise<TreatmentResult[]>;
}

export interface SearchPatientParams {
  identifier: string; // RUT, DNI, etc.
}

export interface CreatePatientParams {
  firstName: string;
  lastName: string;
  identifier: string; // RUT, DNI, etc.
  phone?: string;
  email?: string;
  birthDate?: string; // YYYY-MM-DD
  branchId?: number;
}

export interface PatientResult {
  id: number;
  identifier: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  email?: string;
  birthDate?: string;
}

export interface GetTreatmentsParams {
  patientIdentifier: string;
}

export interface TreatmentResult {
  id: number;
  name: string;
  status: string;
  date?: string;
  professional?: string;
  notes?: string;
}

/**
 * Tipos compartidos para APIs de HealthAtom (Dentalink y MediLink)
 */

export enum HealthAtomApi {
  DENTALINK = 'dentalink',
  MEDILINK = 'medilink',
}

export interface HealthAtomConfig {
  apiKey: string;
  timezone?: string;
  // GHL integration
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
}

export interface ApiEndpoints {
  baseUrl: string;
  professionals: string;
  patients: string;
  appointments: string;
  availability: string;
  treatments: string;
  branches: string;
}

export const DENTALINK_ENDPOINTS: ApiEndpoints = {
  baseUrl: 'https://api.dentalink.healthatom.com/api/v1/',
  professionals: 'dentistas',
  patients: 'pacientes',
  appointments: 'citas',
  availability: 'horariosdisponibles',
  treatments: 'tratamientos',
  branches: 'sucursales',
};

export const MEDILINK_ENDPOINTS: ApiEndpoints = {
  baseUrl: 'https://api.medilink2.healthatom.com/api/v5/',
  professionals: 'profesionales',
  patients: 'pacientes',
  appointments: 'citas',
  availability: 'horariosdisponibles',
  treatments: 'atenciones',
  branches: 'sucursales',
};

// URL específica para el endpoint de profesionales v6 de Medilink
// El endpoint de profesionales de Medilink requiere v6, no v5
export const MEDILINK_PROFESSIONALS_V6_URL = 'https://api.medilink2.healthatom.com/api/v6/profesionales';

/**
 * Estructura de profesional normalizada
 */
export interface NormalizedProfessional {
  id: number;
  rut?: string;
  nombre: string;
  apellidos?: string;
  especialidad?: string;
  intervalo?: number;
  habilitado: boolean;
  agendaOnline: boolean;
  sucursales: number[];
}

/**
 * Estructura de sucursal normalizada
 */
export interface NormalizedBranch {
  id: number;
  nombre: string;
  telefono?: string;
  ciudad?: string;
  comuna?: string;
  direccion?: string;
  habilitada: boolean;
}

/**
 * Estructura de paciente normalizada
 */
export interface NormalizedPatient {
  id: number;
  rut: string;
  nombre: string;
  apellidos?: string;
  celular?: string;
  email?: string;
}

/**
 * Estructura de disponibilidad normalizada
 */
export interface NormalizedAvailability {
  nombreProfesional: string;
  idProfesional: number;
  fechas: {
    [fecha: string]: string[];
  };
}

/**
 * Resultado de operación dual
 */
export interface DualApiOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

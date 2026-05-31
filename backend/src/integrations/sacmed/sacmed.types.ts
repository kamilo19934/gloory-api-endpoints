/**
 * Tipos compartidos para la integración con Sacmed
 * (Microservicio de disponibilidad médica — autenticación vía header X-ApiKey)
 *
 * Basado en el swagger oficial (availability-ms) y las funciones Lambda existentes.
 */

export interface SacmedConfig {
  apiKey: string;
  baseUrl?: string; // override; default = SACMED_API.prodBaseUrl
  timezone?: string;
  // GHL integration (opcional, mismo patrón que Reservo/Dentalsoft)
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
  ghlOAuthMode?: boolean; // true = OAuth Marketplace (token via cron), false/undefined = PIT
}

export const SACMED_API = {
  prodBaseUrl: 'https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1',
  testBaseUrl: 'https://availability-ms-test-860551794565.southamerica-west1.run.app/api/v1',
};

/**
 * Códigos de estado de evento (cita) en Sacmed
 */
export const SACMED_EVENT_STATUS = {
  CONFIRMED: 2,
  CANCELLED: 7,
};

/**
 * Resultado de operación de Sacmed
 */
export interface SacmedOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================
// SERVICIOS / ESPECIALIDADES
// ============================

export interface SacmedService {
  serviceId: number;
  name: string;
  serviceTypeId: number; // 1 = Presencial, 2 = Telemedicina
}

export interface SacmedBenefit {
  benefitId: number;
  name: string;
}

export interface SacmedSpecialty {
  specialtyId: number;
  serviceId: number;
  name: string;
  benefits?: SacmedBenefit[];
}

// ============================
// PROFESIONALES
// ============================

export interface SacmedPractitionerSpecialty {
  specialty_Id: number;
  name: string;
}

export interface SacmedPractitionerService {
  service_Id: number;
  name: string;
  specialties: SacmedPractitionerSpecialty[];
}

export interface SacmedPractitioner {
  identification: string; // RUT
  userId: string; // UUID
  name: string;
  services: SacmedPractitionerService[];
}

export interface SacmedPractitionersResponse {
  practitioners: SacmedPractitioner[];
}

/**
 * Especialista vinculado a una especialidad
 * (GET /practitioner/by-specialty/{specialtyId})
 */
export interface SacmedSpecialist {
  userId: string;
  specialties: number[];
  fullName: string;
  specialtyId: number;
  allowRol: boolean;
}

// ============================
// COMUNAS (DISTRICTS)
// ============================

export interface SacmedDistrict {
  districtId: number;
  name: string;
}

// ============================
// PACIENTES
// ============================

export interface SacmedAddressDTO {
  street?: string;
  number?: string;
  districtId?: number;
}

export interface SacmedPatient {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  identification: string;
  nationalityId?: number;
  nationality?: string;
  phone?: string;
  mobilePhone?: string;
  occupation?: string;
  email?: string;
  arrivalMode?: string;
  birthDay?: string;
  addressDTO?: SacmedAddressDTO;
}

export interface SacmedCreatePatientPayload {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  identification: string;
  nationalityId: number;
  phone: string;
  mobilePhone: string;
  email: string;
  birthDay: string; // YYYY-MM-DD
  addressDTO: SacmedAddressDTO;
}

// ============================
// DISPONIBILIDAD
// ============================

export interface SacmedAvailabilityRequest {
  from: string; // ISO
  to: string; // ISO
  specialtyId: number;
  customDuration?: number;
  serviceId?: number;
  userIds: string[];
}

export interface SacmedAvailabilitySlot {
  start: string;
  end: string;
  duration?: number;
  address?: string;
}

/**
 * Respuesta cruda de disponibilidad por profesional
 * (cada item agrupa los slots de un userId)
 */
export interface SacmedAvailabilityItem {
  userId?: string;
  fullName?: string;
  slots?: SacmedAvailabilitySlot[];
}

// ============================
// EVENTOS (CITAS)
// ============================

export interface SacmedCreateEventPayload {
  userId: string;
  start: string; // ISO
  end: string; // ISO
  patientIdentification: string;
  phone: string;
  email: string;
  serviceId: number;
  specialtyId: number;
}

export interface SacmedEventPatient {
  identification?: string;
  firstName?: string;
  paternalLastName?: string;
  maternalLastName?: string;
  mobilePhone?: string;
  email?: string;
}

export interface SacmedEventPractitioner {
  identification?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface SacmedEvent {
  eventId: number;
  userId?: string;
  start: string;
  end: string;
  statusEventId?: number;
  statusEvent?: string;
  statusPaidId?: number;
  statusPaid?: string;
  tipoServicio?: string;
  patient?: SacmedEventPatient;
  practitioner?: SacmedEventPractitioner;
  joinLink?: { link?: string | null } | null;
}

export interface SacmedUpdateEventStatusPayload {
  eventId: number;
  statusEventId: number;
}

/**
 * Tipos para la integración con GoHighLevel
 * Basado en la API de GHL: https://services.leadconnectorhq.com
 */

export interface GoHighLevelConfig {
  ghlAccessToken: string;
  ghlLocationId: string;
  timezone?: string; // default 'America/Santiago'
}

export const GHL_API = {
  baseUrl: 'https://services.leadconnectorhq.com',
  apiVersion: '2021-07-28',
};

/**
 * Resultado de operación de GHL
 */
export interface GHLOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Calendario de GHL
 */
export interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  calendarType?: string;
  slotDuration?: number;
  slotDurationUnit?: string; // 'mins' | 'hours'
  teamMembers?: GHLTeamMember[];
}

/**
 * Team member de un calendario GHL
 */
export interface GHLTeamMember {
  userId: string;
  priority?: number;
  meetingLocationType?: string;
  isPrimary?: boolean;
}

/**
 * Usuario/profesional de GHL
 */
export interface GHLUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

/**
 * Slots libres de un calendario
 */
export interface GHLFreeSlots {
  [date: string]: {
    slots: string[]; // ISO 8601 timestamps
  };
}

/**
 * Appointment/evento de GHL
 */
export interface GHLAppointment {
  id: string;
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  status?: string;
  appointmentStatus?: string;
  assignedUserId?: string;
}

/**
 * Payload para crear appointment en GHL
 */
export interface GHLCreateAppointmentPayload {
  calendarId: string;
  locationId: string;
  contactId: string;
  startTime: string; // ISO 8601
  endTime?: string; // ISO 8601
  title?: string;
  status?: string;
  assignedUserId?: string;
  ignoreDateRange?: boolean;
  ignoreFreeSlotValidation?: boolean;
}

/**
 * Payload para actualizar contacto en GHL
 */
export interface GHLUpdateContactPayload {
  name?: string;
  phone?: string;
  customFields?: {
    key: string;
    field_value: string;
  }[];
}

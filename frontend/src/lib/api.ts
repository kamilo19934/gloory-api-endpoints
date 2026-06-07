import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// INTEGRATION TYPES
// ============================================

export enum IntegrationType {
  DENTALINK = 'dentalink',
  MEDILINK = 'medilink',
  DENTALINK_MEDILINK = 'dentalink_medilink',
  RESERVO = 'reservo',
  DENTALSOFT = 'dentalsoft',
  SACMED = 'sacmed',
  GOHIGHLEVEL = 'gohighlevel',
}

export enum IntegrationCapability {
  AVAILABILITY = 'availability',
  PATIENTS = 'patients',
  APPOINTMENTS = 'appointments',
  CLINIC_CONFIG = 'clinic_config',
  TREATMENTS = 'treatments',
}

export interface IntegrationFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'password' | 'array';
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: any;
}

export interface IntegrationMetadata {
  type: IntegrationType;
  name: string;
  description: string;
  logo?: string;
  capabilities: IntegrationCapability[];
  requiredFields: IntegrationFieldDefinition[];
  optionalFields: IntegrationFieldDefinition[];
}

export interface ClientIntegration {
  id: string;
  clientId: string;
  integrationType: IntegrationType;
  isEnabled: boolean;
  config: Record<string, any>;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CLIENT TYPES
// ============================================

export interface Client {
  id: string;
  name: string;
  isActive: boolean;
  description?: string;
  timezone: string;
  integrations?: ClientIntegration[];
  // Legacy fields
  apiKey?: string;
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
  confirmationStateId?: number | null;
  contactedStateId?: number | null;
  notionPageId?: string | null;
  notionOnboardingStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointArgument {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  example?: any;
}

export interface EndpointDefinition {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  dentalinkPath: string;
  category: string;
  clientUrl?: string;
  arguments?: EndpointArgument[];
  requiresConfig?: boolean;
  configField?: string;
}

export interface IntegrationConfigDto {
  type: IntegrationType;
  isEnabled?: boolean;
  config?: Record<string, any>;
}

export interface CreateClientDto {
  name: string;
  description?: string;
  timezone?: string;
  integrations?: IntegrationConfigDto[];
  // Legacy fields
  apiKey?: string;
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
  confirmationStateId?: number | null;
  contactedStateId?: number | null;
}

export interface UpdateClientDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  timezone?: string;
  integrations?: IntegrationConfigDto[];
  // Legacy fields
  apiKey?: string;
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
  confirmationStateId?: number | null;
  contactedStateId?: number | null;
}

export interface AddIntegrationDto {
  type: IntegrationType;
  isEnabled?: boolean;
  config: Record<string, any>;
}

export interface UpdateIntegrationDto {
  isEnabled?: boolean;
  config?: Record<string, any>;
}

// ============================================
// INTEGRATIONS API
// ============================================

export const integrationsApi = {
  getAll: async (): Promise<IntegrationMetadata[]> => {
    const response = await api.get('/integrations');
    return response.data;
  },

  getByType: async (type: IntegrationType): Promise<IntegrationMetadata> => {
    const response = await api.get(`/integrations/${type}`);
    return response.data;
  },

  getByCapability: async (capability: IntegrationCapability): Promise<IntegrationMetadata[]> => {
    const response = await api.get(`/integrations/capability/${capability}`);
    return response.data;
  },
};

// ============================================
// CLIENTS API
// ============================================

export const clientsApi = {
  getAll: async (): Promise<Client[]> => {
    const response = await api.get('/clients');
    return response.data;
  },

  getById: async (id: string): Promise<Client> => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  create: async (data: CreateClientDto): Promise<Client> => {
    const response = await api.post('/clients', data);
    return response.data;
  },

  update: async (id: string, data: UpdateClientDto): Promise<Client> => {
    const response = await api.patch(`/clients/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },

  getEndpoints: async (clientId: string): Promise<EndpointDefinition[]> => {
    const response = await api.get(`/clients/${clientId}/endpoints`);
    return response.data;
  },

  testConnection: async (clientId: string): Promise<{ connected: boolean; message: string }> => {
    const response = await api.post(`/clients/${clientId}/test-connection`);
    return response.data;
  },

  testReservoConnection: async (clientId: string): Promise<{ connected: boolean; message: string }> => {
    const response = await api.post(`/clients/${clientId}/reservo/test-connection`);
    return response.data;
  },

  testGHLConnection: async (clientId: string): Promise<{ connected: boolean; message: string; calendars?: number }> => {
    const response = await api.post(`/clients/${clientId}/ghl/test-connection`);
    return response.data;
  },

  // Notion onboarding
  setupNotion: async (clientId: string): Promise<{ notionPageId: string; clientName: string; status: string; message: string }> => {
    const response = await api.post(`/clients/${clientId}/setup-notion`);
    return response.data;
  },

  // Integration management
  getIntegrations: async (clientId: string): Promise<ClientIntegration[]> => {
    const response = await api.get(`/clients/${clientId}/integrations`);
    return response.data;
  },

  addIntegration: async (clientId: string, data: AddIntegrationDto): Promise<ClientIntegration> => {
    const response = await api.post(`/clients/${clientId}/integrations`, data);
    return response.data;
  },

  getIntegration: async (clientId: string, type: IntegrationType): Promise<ClientIntegration | null> => {
    const response = await api.get(`/clients/${clientId}/integrations/${type}`);
    return response.data;
  },

  updateIntegration: async (
    clientId: string,
    type: IntegrationType,
    data: UpdateIntegrationDto,
  ): Promise<ClientIntegration> => {
    const response = await api.patch(`/clients/${clientId}/integrations/${type}`, data);
    return response.data;
  },

  removeIntegration: async (clientId: string, type: IntegrationType): Promise<void> => {
    await api.delete(`/clients/${clientId}/integrations/${type}`);
  },
};

// ============================================
// ENDPOINTS API
// ============================================

export const endpointsApi = {
  getAll: async (): Promise<EndpointDefinition[]> => {
    const response = await api.get('/endpoints');
    return response.data;
  },

  getById: async (id: string): Promise<EndpointDefinition> => {
    const response = await api.get(`/endpoints/${id}`);
    return response.data;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await api.get('/endpoints/categories');
    return response.data;
  },

  getByCategory: async (category: string): Promise<EndpointDefinition[]> => {
    const response = await api.get(`/endpoints/category/${category}`);
    return response.data;
  },
};

// ============================================
// CLINIC TYPES & API
// ============================================

export interface Branch {
  id: number;
  nombre: string;
  telefono?: string;
  ciudad?: string;
  comuna?: string;
  direccion?: string;
  habilitada?: boolean;  // Solo presente en panel admin
  activa?: boolean;      // Solo presente en panel admin
}

export interface Professional {
  id: number;
  rut?: string;
  nombre: string;
  apellidos?: string;
  especialidad?: string;
  intervalo?: number;
  sucursales: number[];
  habilitado?: boolean;  // Solo presente en panel admin
  activo?: boolean;      // Solo presente en panel admin
  agendaOnline?: boolean; // Solo presente en panel admin
}

export interface ClinicStats {
  totalSucursales: number;
  totalProfesionales: number;
  sucursalesHabilitadas: number;
  profesionalesHabilitados: number;
  sucursalesActivas: number;
  profesionalesActivos: number;
}

export interface SyncResult {
  sucursalesNuevas: number;
  profesionalesNuevos: number;
  profesionalesActualizados?: number;
  totalSucursalesAPI?: number;
  totalProfesionalesAPI?: number;
  mensaje: string;
}

export const clinicApi = {
  // Sucursales
  getBranches: async (clientId: string, includeInactive = false): Promise<Branch[]> => {
    const response = await api.get(`/clients/${clientId}/clinic/branches`, {
      params: includeInactive ? { includeInactive: 'true' } : {},
    });
    return response.data;
  },

  getAllBranches: async (clientId: string): Promise<Branch[]> => {
    const response = await api.get(`/clients/${clientId}/clinic/branches/all`);
    return response.data;
  },

  getBranchById: async (clientId: string, branchId: string): Promise<Branch> => {
    const response = await api.get(`/clients/${clientId}/clinic/branches/${branchId}`);
    return response.data;
  },

  toggleBranch: async (clientId: string, branchDentalinkId: number, activa: boolean): Promise<Branch> => {
    const response = await api.patch(`/clients/${clientId}/clinic/branches/${branchDentalinkId}/toggle`, {
      activa,
    });
    return response.data;
  },

  // Profesionales por sucursal
  getProfessionalsByBranch: async (
    clientId: string,
    branchDentalinkId: number,
    includeInactive = false,
  ): Promise<Professional[]> => {
    const response = await api.post(`/clients/${clientId}/clinic/branches/professionals`, {
      id_sucursal: branchDentalinkId,
      includeInactive,
    });
    return response.data;
  },

  // Profesionales
  getProfessionals: async (clientId: string, includeInactive = false): Promise<Professional[]> => {
    const response = await api.get(`/clients/${clientId}/clinic/professionals`, {
      params: includeInactive ? { includeInactive: 'true' } : {},
    });
    return response.data;
  },

  getAllProfessionals: async (clientId: string): Promise<Professional[]> => {
    const response = await api.get(`/clients/${clientId}/clinic/professionals/all`);
    return response.data;
  },

  getProfessionalById: async (clientId: string, professionalId: string): Promise<Professional> => {
    const response = await api.get(`/clients/${clientId}/clinic/professionals/${professionalId}`);
    return response.data;
  },

  toggleProfessional: async (clientId: string, professionalDentalinkId: number, activo: boolean): Promise<Professional> => {
    const response = await api.patch(`/clients/${clientId}/clinic/professionals/${professionalDentalinkId}/toggle`, {
      activo,
    });
    return response.data;
  },

  activateAgendaOnline: async (clientId: string, professionalDentalinkId: number): Promise<{ mensaje: string; profesional: Professional }> => {
    const response = await api.patch(`/clients/${clientId}/clinic/professionals/${professionalDentalinkId}/agenda-online`);
    return response.data;
  },

  // Stats y sync
  getStats: async (clientId: string): Promise<ClinicStats> => {
    const response = await api.get(`/clients/${clientId}/clinic/stats`);
    return response.data;
  },

  sync: async (clientId: string, force?: boolean): Promise<SyncResult> => {
    const response = await api.post(`/clients/${clientId}/clinic/sync`, { force });
    return response.data;
  },

  updateProfessionalSpecialty: async (
    clientId: string,
    professionalDentalinkId: string,
    especialidad: string,
  ): Promise<{ mensaje: string; profesional: Professional }> => {
    const response = await api.patch(
      `/clients/${clientId}/clinic/professionals/${professionalDentalinkId}`,
      { especialidad },
    );
    return response.data;
  },

  getSpecialties: async (clientId: string): Promise<string[]> => {
    const response = await api.get(`/clients/${clientId}/clinic/specialties`);
    return response.data;
  },

  getProfessionalsBySpecialty: async (
    clientId: string,
    especialidad: string,
    id_sucursal?: number,
  ): Promise<Professional[]> => {
    const response = await api.post(`/clients/${clientId}/clinic/specialties/professionals`, {
      especialidad,
      id_sucursal,
    });
    return response.data;
  },

};

// ============================================
// GHL TYPES & API (independiente de clinic)
// ============================================

export interface GHLCalendarResponse {
  id: number;
  nombre: string;
  slotDuration: number;
  especialidad?: string;
  activo: boolean;
  branches: number[];
}

export interface GHLBranchResponse {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
  comuna?: string;
  activa: boolean;
}

export interface GHLStats {
  totalCalendarios: number;
  calendariosActivos: number;
  totalSedes: number;
  sedesActivas: number;
}

export interface GHLSyncResult {
  calendariosNuevos: number;
  calendariosActualizados: number;
  totalCalendariosAPI: number;
  mensaje: string;
}

export const ghlApi = {
  // Sedes
  getBranches: async (clientId: string): Promise<GHLBranchResponse[]> => {
    const response = await api.get(`/clients/${clientId}/ghl/branches`);
    return response.data;
  },

  getAllBranches: async (clientId: string): Promise<GHLBranchResponse[]> => {
    const response = await api.get(`/clients/${clientId}/ghl/branches/all`);
    return response.data;
  },

  createBranch: async (
    clientId: string,
    data: { nombre: string; direccion?: string; telefono?: string; ciudad?: string; comuna?: string },
  ): Promise<{ mensaje: string; sucursal: GHLBranchResponse }> => {
    const response = await api.post(`/clients/${clientId}/ghl/branches`, data);
    return response.data;
  },

  updateBranch: async (
    clientId: string,
    branchId: number,
    data: { nombre?: string; direccion?: string; telefono?: string; ciudad?: string; comuna?: string },
  ): Promise<{ mensaje: string; sucursal: GHLBranchResponse }> => {
    const response = await api.put(`/clients/${clientId}/ghl/branches/${branchId}`, data);
    return response.data;
  },

  deleteBranch: async (clientId: string, branchId: number): Promise<{ mensaje: string }> => {
    const response = await api.delete(`/clients/${clientId}/ghl/branches/${branchId}`);
    return response.data;
  },

  toggleBranch: async (clientId: string, branchId: number, activa: boolean): Promise<GHLBranchResponse> => {
    const response = await api.patch(`/clients/${clientId}/ghl/branches/${branchId}/toggle`, { activa });
    return response.data;
  },

  // Calendarios
  getCalendars: async (clientId: string): Promise<GHLCalendarResponse[]> => {
    const response = await api.get(`/clients/${clientId}/ghl/calendars`);
    return response.data;
  },

  getAllCalendars: async (clientId: string): Promise<GHLCalendarResponse[]> => {
    const response = await api.get(`/clients/${clientId}/ghl/calendars/all`);
    return response.data;
  },

  toggleCalendar: async (clientId: string, calendarId: number, activo: boolean): Promise<GHLCalendarResponse> => {
    const response = await api.patch(`/clients/${clientId}/ghl/calendars/${calendarId}/toggle`, { activo });
    return response.data;
  },

  updateCalendarSpecialty: async (
    clientId: string,
    calendarId: number,
    especialidad: string,
  ): Promise<{ mensaje: string; calendario: GHLCalendarResponse }> => {
    const response = await api.patch(`/clients/${clientId}/ghl/calendars/${calendarId}/specialty`, { especialidad });
    return response.data;
  },

  assignCalendarToBranches: async (
    clientId: string,
    calendarId: number,
    branchIds: number[],
  ): Promise<{ mensaje: string; calendario: GHLCalendarResponse }> => {
    const response = await api.put(`/clients/${clientId}/ghl/calendars/${calendarId}/branches`, { branchIds });
    return response.data;
  },

  getCalendarsByBranch: async (clientId: string, branchId: number): Promise<GHLCalendarResponse[]> => {
    const response = await api.post(`/clients/${clientId}/ghl/branches/calendars`, { branchId });
    return response.data;
  },

  // Datos
  getSpecialties: async (clientId: string): Promise<string[]> => {
    const response = await api.get(`/clients/${clientId}/ghl/specialties`);
    return response.data;
  },

  getCalendarsBySpecialty: async (
    clientId: string,
    especialidad: string,
    id_sucursal?: number,
  ): Promise<GHLCalendarResponse[]> => {
    const response = await api.post(`/clients/${clientId}/ghl/specialties/calendars`, {
      especialidad,
      id_sucursal,
    });
    return response.data;
  },

  getStats: async (clientId: string): Promise<GHLStats> => {
    const response = await api.get(`/clients/${clientId}/ghl/stats`);
    return response.data;
  },

  sync: async (clientId: string, force?: boolean): Promise<GHLSyncResult> => {
    const response = await api.post(`/clients/${clientId}/ghl/sync`, { force });
    return response.data;
  },

  testConnection: async (clientId: string): Promise<{ connected: boolean; message: string; calendars?: number }> => {
    const response = await api.post(`/clients/${clientId}/ghl/test-connection`);
    return response.data;
  },
};

// ============================================
// DENTALSOFT API
// ============================================

export interface DentalsoftPaciente {
  id: number;
  cedula: string;
  tipo_cedula: number;
  celular?: string | null;
  sexo?: string | null;
  fecha_registro: string;
  fecha_nacimiento?: string | null;
  estado: number;
  nombre: string;
  email?: string;
}

export interface DentalsoftCita {
  id: number;
  fecha: string;
  id_paciente: number;
  id_sucursal: number;
  inicio: string;
  bloques: number;
  estado: number;
  estado_texto: string;
  id_sala: number;
  paciente?: DentalsoftPaciente | null;
  sala?: { id: number; nombre: string };
  notificable: boolean;
  confirmable: boolean;
  ingresable_a_en_espera: boolean;
  cancelable: boolean;
  observacion: string;
}

export interface DentalsoftSucursal {
  id: number;
  nombre: string;
  telefono?: string;
  direccion?: string;
  estado: number;
  estado_texto?: string;
}

export interface DentalsoftProfesional {
  id_profesional: number;
  nombre_completo: string;
}

export interface DentalsoftEspecialidad {
  id: number;
  nombre: string;
  abreviacion?: string | boolean;
  activo: boolean;
}

export const dentalsoftApi = {
  testConnection: async (
    clientId: string,
  ): Promise<{ connected: boolean; message: string; branches?: number; professionals?: number }> => {
    const response = await api.post(`/clients/${clientId}/dentalsoft/test-connection`);
    return response.data;
  },

  // Pacientes
  searchPatient: async (
    clientId: string,
    data: { cedula: string; tipo_cedula_texto: 'rut' | 'dni' },
  ): Promise<DentalsoftPaciente> => {
    const response = await api.post(`/clients/${clientId}/dentalsoft/patients/search`, data);
    return response.data;
  },

  createPatient: async (
    clientId: string,
    data: {
      cedula: string;
      tipo_cedula_texto: 'rut' | 'dni';
      nombre: string;
      apellido_paterno: string;
      apellido_materno?: string;
      email: string;
      celular: string;
      id_referencia?: number;
    },
  ): Promise<{ mensaje: string; paciente: number }> => {
    const response = await api.post(`/clients/${clientId}/dentalsoft/patients`, data);
    return response.data;
  },

  // Profesionales / especialidades / sucursales
  getProfessionals: async (clientId: string): Promise<DentalsoftProfesional[]> => {
    const response = await api.get(`/clients/${clientId}/dentalsoft/professionals`);
    return response.data;
  },

  getProfessionalsBySpecialty: async (clientId: string) => {
    const response = await api.get(
      `/clients/${clientId}/dentalsoft/professionals/by-specialty`,
    );
    return response.data;
  },

  getSpecialties: async (clientId: string): Promise<DentalsoftEspecialidad[]> => {
    const response = await api.get(`/clients/${clientId}/dentalsoft/specialties`);
    return response.data;
  },

  getBranches: async (clientId: string): Promise<DentalsoftSucursal[]> => {
    const response = await api.get(`/clients/${clientId}/dentalsoft/branches`);
    return response.data;
  },

  // Disponibilidad
  searchAvailability: async (
    clientId: string,
    data: {
      id_profesional: number | number[];
      id_sucursal: number;
      fecha_inicio: string;
      duracion_minutos: number;
    },
  ) => {
    const response = await api.post(`/clients/${clientId}/dentalsoft/availability/search`, data);
    return response.data;
  },

  getMonthlyAvailability: async (
    clientId: string,
    data: {
      id_profesional: number;
      year: number;
      month: number;
      id_sucursal: number;
      duracion_minutos: number;
    },
  ) => {
    const response = await api.post(`/clients/${clientId}/dentalsoft/availability/monthly`, data);
    return response.data;
  },

  getDailyAvailability: async (
    clientId: string,
    data: {
      id_profesional: number;
      fecha: string;
      id_sucursal: number;
      duracion_minutos: number;
    },
  ) => {
    const response = await api.post(`/clients/${clientId}/dentalsoft/availability/daily`, data);
    return response.data;
  },

  // Citas
  getAppointment: async (clientId: string, citaId: number): Promise<DentalsoftCita> => {
    const response = await api.get(`/clients/${clientId}/dentalsoft/appointments/${citaId}`);
    return response.data;
  },

  getAppointmentsByBranchAndDate: async (
    clientId: string,
    data: { fecha: string; id_sucursal: number },
  ): Promise<DentalsoftCita[]> => {
    const response = await api.post(
      `/clients/${clientId}/dentalsoft/appointments/day-branch`,
      data,
    );
    return response.data;
  },

  createAppointment: async (
    clientId: string,
    data: {
      id_sucursal: number;
      id_profesional: number;
      id_sala: number;
      id_paciente: number;
      fecha: string;
      inicio: string;
      duracion_minutos: number;
      comentario?: string;
      user_id?: string;
    },
  ) => {
    const response = await api.post(`/clients/${clientId}/dentalsoft/appointments`, data);
    return response.data;
  },

  getPatientAppointments: async (clientId: string, data: { id_paciente: number }) => {
    const response = await api.post(
      `/clients/${clientId}/dentalsoft/appointments/patient`,
      data,
    );
    return response.data;
  },

  confirmAppointment: async (clientId: string, data: { id: number }) => {
    const response = await api.post(
      `/clients/${clientId}/dentalsoft/appointments/confirm`,
      data,
    );
    return response.data;
  },

  cancelAppointment: async (clientId: string, data: { id: number }) => {
    const response = await api.post(
      `/clients/${clientId}/dentalsoft/appointments/cancel`,
      data,
    );
    return response.data;
  },

};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Obtiene el nombre legible de un tipo de integración
 */
export function getIntegrationDisplayName(type: IntegrationType): string {
  const names: Record<IntegrationType, string> = {
    [IntegrationType.DENTALINK]: 'Dentalink',
    [IntegrationType.MEDILINK]: 'MediLink',
    [IntegrationType.DENTALINK_MEDILINK]: 'Dentalink + MediLink',
    [IntegrationType.RESERVO]: 'Reservo',
    [IntegrationType.DENTALSOFT]: 'Dentalsoft',
    [IntegrationType.SACMED]: 'Sacmed',
    [IntegrationType.GOHIGHLEVEL]: 'GoHighLevel',
  };
  return names[type] || type;
}

/**
 * Obtiene el color asociado a una integración
 */
export function getIntegrationColor(type: IntegrationType): string {
  const colors: Record<IntegrationType, string> = {
    [IntegrationType.DENTALINK]: 'bg-blue-500',
    [IntegrationType.MEDILINK]: 'bg-green-500',
    [IntegrationType.DENTALINK_MEDILINK]: 'bg-gradient-to-r from-blue-500 to-green-500',
    [IntegrationType.RESERVO]: 'bg-purple-500',
    [IntegrationType.DENTALSOFT]: 'bg-pink-500',
    [IntegrationType.SACMED]: 'bg-teal-500',
    [IntegrationType.GOHIGHLEVEL]: 'bg-orange-500',
  };
  return colors[type] || 'bg-gray-500';
}

// ============================================
// APPOINTMENT CONFIRMATIONS TYPES & API
// ============================================

export interface ConfirmationConfig {
  id: string;
  clientId: string;
  name: string;
  daysBeforeAppointment: number;
  timeToSend: string; // HH:mm format
  ghlCalendarId: string;
  appointmentStates: string; // IDs separados por coma
  isEnabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentState {
  id: number;
  nombre: string;
  color: string;
  reservado: number;
  anulacion: number;
  uso_interno: number;
  habilitado: number;
}

export interface CreateConfirmationConfigDto {
  name: string;
  daysBeforeAppointment: number;
  timeToSend: string;
  ghlCalendarId: string;
  appointmentStates?: number[];
  isEnabled?: boolean;
  order: number;
}

export interface UpdateConfirmationConfigDto {
  name?: string;
  daysBeforeAppointment?: number;
  timeToSend?: string;
  ghlCalendarId?: string;
  appointmentStates?: number[];
  isEnabled?: boolean;
  order?: number;
}

export type ExecutionStepStatus = 'success' | 'error' | 'skipped' | 'warning';

export type ExecutionStepName =
  | 'resolve_ghl_credentials'
  | 'find_or_create_contact'
  | 'update_contact_custom_fields'
  | 'update_platform_status';

export interface ExecutionStepEntry {
  attempt: number;
  step: ExecutionStepName;
  status: ExecutionStepStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  errorMessage?: string;
  httpStatus?: number;
  metadata?: Record<string, any>;
}

export enum ConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface PendingConfirmation {
  id: string;
  clientId: string;
  confirmationConfigId: string;
  platformAppointmentId: string;
  appointmentData: {
    id_paciente: number;
    nombre_paciente: string;
    nombre_social_paciente?: string;
    rut_paciente?: string;
    email_paciente?: string;
    telefono_paciente?: string;
    id_tratamiento: number;
    nombre_tratamiento: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    duracion: number;
    id_dentista: number;
    nombre_dentista: string;
    id_sucursal: number;
    nombre_sucursal: string;
    id_estado: number;
    estado_cita: string;
    motivo_atencion?: string;
    comentarios?: string;
  };
  status: ConfirmationStatus;
  scheduledFor: string;
  ghlContactId?: string;
  ghlAppointmentId?: string;
  errorMessage?: string;
  attempts: number;
  executionLog?: ExecutionStepEntry[] | null;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const appointmentConfirmationsApi = {
  // Configuraciones
  getConfigs: async (clientId: string): Promise<ConfirmationConfig[]> => {
    const response = await api.get(`/clients/${clientId}/appointment-confirmations/configs`);
    return response.data;
  },

  getConfig: async (clientId: string, configId: string): Promise<ConfirmationConfig> => {
    const response = await api.get(`/clients/${clientId}/appointment-confirmations/configs/${configId}`);
    return response.data;
  },

  createConfig: async (clientId: string, data: CreateConfirmationConfigDto): Promise<ConfirmationConfig> => {
    const response = await api.post(`/clients/${clientId}/appointment-confirmations/configs`, data);
    return response.data;
  },

  updateConfig: async (
    clientId: string,
    configId: string,
    data: UpdateConfirmationConfigDto,
  ): Promise<ConfirmationConfig> => {
    const response = await api.put(`/clients/${clientId}/appointment-confirmations/configs/${configId}`, data);
    return response.data;
  },

  deleteConfig: async (clientId: string, configId: string): Promise<void> => {
    await api.delete(`/clients/${clientId}/appointment-confirmations/configs/${configId}`);
  },

  // Procesamiento
  trigger: async (
    clientId: string,
    params?: { confirmationConfigId?: string; targetDate?: string },
  ): Promise<{ message: string; stored: number; totalAppointments: number }> => {
    const response = await api.post(`/clients/${clientId}/appointment-confirmations/trigger`, params || {});
    return response.data;
  },

  process: async (
    clientId: string,
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/appointment-confirmations/process`);
    return response.data;
  },

  processSelected: async (
    clientId: string,
    confirmationIds: string[],
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/appointment-confirmations/process-selected`, {
      confirmationIds,
    });
    return response.data;
  },

  // Setup de GHL
  setupGHL: async (
    clientId: string,
  ): Promise<{
    success: boolean;
    message: string;
    created: string[];
    existing: string[];
    errors: string[];
    totalRequired: number;
    totalExisting: number;
    totalCreated: number;
  }> => {
    const response = await api.post(`/clients/${clientId}/appointment-confirmations/setup-ghl`);
    return response.data;
  },

  validateGHL: async (
    clientId: string,
  ): Promise<{
    valid: boolean;
    message: string;
    missing: string[];
    required: string[];
  }> => {
    const response = await api.get(`/clients/${clientId}/appointment-confirmations/validate-ghl`);
    return response.data;
  },

  // Consultas
  getPending: async (clientId: string): Promise<PendingConfirmation[]> => {
    const response = await api.get(`/clients/${clientId}/appointment-confirmations/pending`);
    return response.data;
  },

  getPendingByStatus: async (clientId: string, status: ConfirmationStatus): Promise<PendingConfirmation[]> => {
    const response = await api.get(`/clients/${clientId}/appointment-confirmations/pending/status/${status}`);
    return response.data;
  },

  // Estados de cita
  getAppointmentStates: async (clientId: string): Promise<AppointmentState[]> => {
    const response = await api.get(`/clients/${clientId}/appointment-confirmations/appointment-states`);
    return response.data;
  },

  // Crear estado de confirmación personalizado
  createBookysConfirmationState: async (clientId: string): Promise<{
    alreadyExists: boolean;
    state: AppointmentState;
    message: string;
    apiUsed?: string;
  }> => {
    const response = await api.post(`/clients/${clientId}/appointment-confirmations/appointment-states/create-bookys`);
    return response.data;
  },
};

// ============================================
// CLIENT API LOGS TYPES & API
// ============================================

export type StatusCategory = '2xx' | '4xx' | '5xx';

export interface ClientApiLog {
  id: string;
  clientId: string;
  method: string;
  endpoint: string;
  fullPath: string;
  requestBody: Record<string, any> | null;
  statusCode: number;
  statusCategory: StatusCategory;
  responseBody: Record<string, any> | null;
  errorMessage: string | null;
  duration: number;
  ipAddress: string | null;
  userAgent: string | null;
  // Trazabilidad del agente Gloory AI (headers X-Gloory-*)
  threadId: string | null;
  turn: number | null;
  agentUserId: string | null;
  createdAt: string;
}

export interface LogsQueryParams {
  search?: string;
  status?: StatusCategory;
  endpoint?: string;
  threadId?: string;
  page?: number;
  limit?: number;
}

export interface LogsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LogsResponse {
  data: ClientApiLog[];
  pagination: LogsPagination;
}

export interface LogStats {
  total: number;
  success: number;
  clientError: number;
  serverError: number;
  successPercentage: number;
  clientErrorPercentage: number;
  serverErrorPercentage: number;
}

export const clientApiLogsApi = {
  /**
   * Obtiene los logs de un cliente con paginación y filtros
   */
  getLogs: async (clientId: string, params?: LogsQueryParams): Promise<LogsResponse> => {
    const response = await api.get(`/clients/${clientId}/logs`, { params });
    return response.data;
  },

  /**
   * Obtiene las estadísticas de logs de un cliente
   */
  getStats: async (clientId: string): Promise<LogStats> => {
    const response = await api.get(`/clients/${clientId}/logs/stats`);
    return response.data;
  },

  /**
   * Obtiene los endpoints únicos para el filtro
   */
  getEndpoints: async (clientId: string): Promise<{ endpoints: string[] }> => {
    const response = await api.get(`/clients/${clientId}/logs/endpoints`);
    return response.data;
  },

  /**
   * Obtiene el detalle de un log específico
   */
  getLogDetail: async (clientId: string, logId: string): Promise<ClientApiLog> => {
    const response = await api.get(`/clients/${clientId}/logs/${logId}`);
    return response.data;
  },

  /**
   * Elimina todos los logs de un cliente
   */
  deleteLogs: async (clientId: string): Promise<{ message: string; deleted: number }> => {
    const response = await api.delete(`/clients/${clientId}/logs`);
    return response.data;
  },
};

/**
 * Obtiene el color del badge según la categoría de status
 */
export function getStatusCategoryColor(category: StatusCategory): string {
  const colors: Record<StatusCategory, string> = {
    '2xx': 'bg-green-100 text-green-800',
    '4xx': 'bg-yellow-100 text-yellow-800',
    '5xx': 'bg-red-100 text-red-800',
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}

/**
 * Obtiene el icono/emoji según la categoría de status
 */
export function getStatusCategoryIcon(category: StatusCategory): string {
  const icons: Record<StatusCategory, string> = {
    '2xx': '✅',
    '4xx': '⚠️',
    '5xx': '❌',
  };
  return icons[category] || '❓';
}

// ============================================
// RESERVO CONFIRMATIONS TYPES & API
// ============================================

export interface ReservoConfirmationConfig {
  id: string;
  clientId: string;
  name: string;
  daysBeforeAppointment: number;
  timeToSend: string; // HH:mm format
  ghlCalendarId: string;
  isEnabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReservoNormalizedAppointment {
  id_paciente: string;
  nombre_paciente: string;
  rut_paciente?: string;
  email_paciente?: string;
  telefono_paciente?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion: number;
  id_profesional: string;
  nombre_profesional: string;
  id_tratamiento: string;
  nombre_tratamiento: string;
  id_sucursal: string;
  nombre_sucursal: string;
  estado_codigo: string;
  estado_descripcion: string;
  comentarios?: string;
}

export enum ReservoConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ReservoPendingConfirmation {
  id: string;
  clientId: string;
  configId: string;
  reservoAppointmentUuid: string;
  appointmentData: ReservoNormalizedAppointment;
  status: ReservoConfirmationStatus;
  scheduledFor: string;
  ghlContactId?: string;
  errorMessage?: string;
  attempts: number;
  executionLog?: ExecutionStepEntry[] | null;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
  config?: ReservoConfirmationConfig;
}

export interface CreateReservoConfirmationConfigDto {
  name: string;
  daysBeforeAppointment: number;
  timeToSend: string;
  ghlCalendarId: string;
  isEnabled?: boolean;
  order: number;
}

export interface UpdateReservoConfirmationConfigDto {
  name?: string;
  daysBeforeAppointment?: number;
  timeToSend?: string;
  ghlCalendarId?: string;
  isEnabled?: boolean;
  order?: number;
}

export const reservoConfirmationsApi = {
  // Configuraciones
  getConfigs: async (clientId: string): Promise<ReservoConfirmationConfig[]> => {
    const response = await api.get(`/clients/${clientId}/reservo-confirmations/configs`);
    return response.data;
  },

  getConfig: async (clientId: string, configId: string): Promise<ReservoConfirmationConfig> => {
    const response = await api.get(`/clients/${clientId}/reservo-confirmations/configs/${configId}`);
    return response.data;
  },

  createConfig: async (
    clientId: string,
    data: CreateReservoConfirmationConfigDto,
  ): Promise<ReservoConfirmationConfig> => {
    const response = await api.post(`/clients/${clientId}/reservo-confirmations/configs`, data);
    return response.data;
  },

  updateConfig: async (
    clientId: string,
    configId: string,
    data: UpdateReservoConfirmationConfigDto,
  ): Promise<ReservoConfirmationConfig> => {
    const response = await api.put(
      `/clients/${clientId}/reservo-confirmations/configs/${configId}`,
      data,
    );
    return response.data;
  },

  deleteConfig: async (clientId: string, configId: string): Promise<void> => {
    await api.delete(`/clients/${clientId}/reservo-confirmations/configs/${configId}`);
  },

  // Procesamiento
  trigger: async (
    clientId: string,
    params?: { configId?: string; targetDate?: string },
  ): Promise<{ message: string; stored: number; totalAppointments: number }> => {
    const response = await api.post(
      `/clients/${clientId}/reservo-confirmations/trigger`,
      params || {},
    );
    return response.data;
  },

  process: async (
    clientId: string,
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/reservo-confirmations/process`);
    return response.data;
  },

  processSelected: async (
    clientId: string,
    confirmationIds: string[],
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/reservo-confirmations/process-selected`, {
      confirmationIds,
    });
    return response.data;
  },

  processAll: async (
    clientId: string,
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/reservo-confirmations/process-all`);
    return response.data;
  },

  // Setup de GHL
  setupGHL: async (
    clientId: string,
  ): Promise<{ success: boolean; message: string; created: string[]; existing: string[]; errors: string[] }> => {
    const response = await api.post(`/clients/${clientId}/reservo-confirmations/setup-ghl`);
    return response.data;
  },

  validateGHL: async (
    clientId: string,
  ): Promise<{ valid: boolean; message: string; missing?: string[]; required?: string[] }> => {
    const response = await api.get(`/clients/${clientId}/reservo-confirmations/validate-ghl`);
    return response.data;
  },

  // Consultas
  getPending: async (clientId: string): Promise<ReservoPendingConfirmation[]> => {
    const response = await api.get(`/clients/${clientId}/reservo-confirmations/pending`);
    return response.data;
  },

  getPendingByStatus: async (
    clientId: string,
    status: ReservoConfirmationStatus,
  ): Promise<ReservoPendingConfirmation[]> => {
    const response = await api.get(
      `/clients/${clientId}/reservo-confirmations/pending/status/${status}`,
    );
    return response.data;
  },
};

// ============================================
// SACMED API (proxy de catálogo, pacientes y citas)
// ============================================

export const sacmedApi = {
  getServices: async (clientId: string) => {
    const response = await api.get(`/clients/${clientId}/sacmed/services`);
    return response.data;
  },

  getSpecialties: async (clientId: string, idServicio: number) => {
    const response = await api.post(`/clients/${clientId}/sacmed/specialties`, {
      id_servicio: idServicio,
    });
    return response.data;
  },

  getPractitioners: async (clientId: string) => {
    const response = await api.get(`/clients/${clientId}/sacmed/practitioners`);
    return response.data;
  },

  getPractitionersByService: async (clientId: string, idServicio: number) => {
    const response = await api.post(`/clients/${clientId}/sacmed/practitioners/by-service`, {
      id_servicio: idServicio,
    });
    return response.data;
  },

  getPractitionersBySpecialty: async (clientId: string, idEspecialidad: number) => {
    const response = await api.post(`/clients/${clientId}/sacmed/practitioners/by-specialty`, {
      id_especialidad: idEspecialidad,
    });
    return response.data;
  },

  getDistricts: async (clientId: string) => {
    const response = await api.get(`/clients/${clientId}/sacmed/districts`);
    return response.data;
  },

  searchAvailability: async (
    clientId: string,
    data: {
      fecha: string;
      id_especialidad: number;
      id_profesionales: string[];
      id_servicio?: number;
      duracion_minutos?: number;
    },
  ) => {
    const response = await api.post(`/clients/${clientId}/sacmed/availability`, data);
    return response.data;
  },

  searchPatient: async (clientId: string, rut: string) => {
    const response = await api.post(`/clients/${clientId}/sacmed/patients/search`, { rut });
    return response.data;
  },

  createPatient: async (clientId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/clients/${clientId}/sacmed/patients`, data);
    return response.data;
  },

  getPatientAppointments: async (clientId: string, rut: string) => {
    const response = await api.post(`/clients/${clientId}/sacmed/patients/appointments`, { rut });
    return response.data;
  },

  createAppointment: async (clientId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/clients/${clientId}/sacmed/appointments`, data);
    return response.data;
  },

  confirmAppointment: async (clientId: string, idCita: number) => {
    const response = await api.post(`/clients/${clientId}/sacmed/appointments/confirm`, {
      id_cita: idCita,
    });
    return response.data;
  },

  cancelAppointment: async (clientId: string, idCita: number) => {
    const response = await api.post(`/clients/${clientId}/sacmed/appointments/cancel`, {
      id_cita: idCita,
    });
    return response.data;
  },

  testConnection: async (clientId: string): Promise<{ connected: boolean; message: string }> => {
    const response = await api.post(`/clients/${clientId}/sacmed/test-connection`);
    return response.data;
  },
};

// ============================================
// SACMED CONFIRMATIONS TYPES & API
// ============================================

export interface SacmedConfirmationConfig {
  id: string;
  clientId: string;
  name: string;
  daysBeforeAppointment: number;
  timeToSend: string; // HH:mm format
  ghlCalendarId: string;
  isEnabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SacmedNormalizedAppointment {
  id_paciente: string;
  nombre_paciente: string;
  rut_paciente?: string;
  email_paciente?: string;
  telefono_paciente?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion: number;
  id_profesional: string;
  nombre_profesional: string;
  estado_codigo: string;
  estado_descripcion: string;
  modalidad?: string;
}

export enum SacmedConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface SacmedPendingConfirmation {
  id: string;
  clientId: string;
  configId: string;
  sacmedEventId: string;
  appointmentData: SacmedNormalizedAppointment;
  status: SacmedConfirmationStatus;
  scheduledFor: string;
  ghlContactId?: string;
  errorMessage?: string;
  attempts: number;
  executionLog?: ExecutionStepEntry[] | null;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
  config?: SacmedConfirmationConfig;
}

export interface CreateSacmedConfirmationConfigDto {
  name: string;
  daysBeforeAppointment: number;
  timeToSend: string;
  ghlCalendarId: string;
  isEnabled?: boolean;
  order: number;
}

export interface UpdateSacmedConfirmationConfigDto {
  name?: string;
  daysBeforeAppointment?: number;
  timeToSend?: string;
  ghlCalendarId?: string;
  isEnabled?: boolean;
  order?: number;
}

export const sacmedConfirmationsApi = {
  // Configuraciones
  getConfigs: async (clientId: string): Promise<SacmedConfirmationConfig[]> => {
    const response = await api.get(`/clients/${clientId}/sacmed-confirmations/configs`);
    return response.data;
  },

  getConfig: async (clientId: string, configId: string): Promise<SacmedConfirmationConfig> => {
    const response = await api.get(`/clients/${clientId}/sacmed-confirmations/configs/${configId}`);
    return response.data;
  },

  createConfig: async (
    clientId: string,
    data: CreateSacmedConfirmationConfigDto,
  ): Promise<SacmedConfirmationConfig> => {
    const response = await api.post(`/clients/${clientId}/sacmed-confirmations/configs`, data);
    return response.data;
  },

  updateConfig: async (
    clientId: string,
    configId: string,
    data: UpdateSacmedConfirmationConfigDto,
  ): Promise<SacmedConfirmationConfig> => {
    const response = await api.put(
      `/clients/${clientId}/sacmed-confirmations/configs/${configId}`,
      data,
    );
    return response.data;
  },

  deleteConfig: async (clientId: string, configId: string): Promise<void> => {
    await api.delete(`/clients/${clientId}/sacmed-confirmations/configs/${configId}`);
  },

  // Procesamiento
  trigger: async (
    clientId: string,
    params?: { configId?: string; targetDate?: string },
  ): Promise<{ message: string; stored: number; totalAppointments: number }> => {
    const response = await api.post(
      `/clients/${clientId}/sacmed-confirmations/trigger`,
      params || {},
    );
    return response.data;
  },

  process: async (
    clientId: string,
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/sacmed-confirmations/process`);
    return response.data;
  },

  processSelected: async (
    clientId: string,
    confirmationIds: string[],
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/sacmed-confirmations/process-selected`, {
      confirmationIds,
    });
    return response.data;
  },

  processAll: async (
    clientId: string,
  ): Promise<{ message: string; processed: number; completed: number; failed: number }> => {
    const response = await api.post(`/clients/${clientId}/sacmed-confirmations/process-all`);
    return response.data;
  },

  // Setup de GHL
  setupGHL: async (
    clientId: string,
  ): Promise<{ success: boolean; message: string; created: string[]; existing: string[]; errors: string[] }> => {
    const response = await api.post(`/clients/${clientId}/sacmed-confirmations/setup-ghl`);
    return response.data;
  },

  validateGHL: async (
    clientId: string,
  ): Promise<{ valid: boolean; message: string; missing?: string[]; required?: string[] }> => {
    const response = await api.get(`/clients/${clientId}/sacmed-confirmations/validate-ghl`);
    return response.data;
  },

  // Consultas
  getPending: async (clientId: string): Promise<SacmedPendingConfirmation[]> => {
    const response = await api.get(`/clients/${clientId}/sacmed-confirmations/pending`);
    return response.data;
  },

  getPendingByStatus: async (
    clientId: string,
    status: SacmedConfirmationStatus,
  ): Promise<SacmedPendingConfirmation[]> => {
    const response = await api.get(
      `/clients/${clientId}/sacmed-confirmations/pending/status/${status}`,
    );
    return response.data;
  },
};

// ============================================
// DASHBOARD
// ============================================

export interface RecentError {
  id: string;
  clientId: string;
  clientName: string;
  method: string;
  endpoint: string;
  statusCode: number;
  statusCategory: StatusCategory;
  errorMessage: string | null;
  duration: number;
  createdAt: string;
}

export interface TopEndpoint {
  endpoint: string;
  count: number;
}

export interface TopClient {
  clientId: string;
  clientName: string;
  count: number;
}

export interface DashboardStats {
  connectedClients: number;
  totalClients: number;
  totalToday: number;
  successToday: number;
  clientErrorToday: number;
  serverErrorToday: number;
  successRate: number;
  avgResponseTime: number;
  topEndpoints: TopEndpoint[];
  topClients: TopClient[];
  recentErrors: RecentError[];
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },
};

// ============================================
// GHL OAUTH API
// ============================================

export interface GHLOAuthStatus {
  valid: boolean;
  companies: number;
}

export interface GHLOAuthLocation {
  locationId: string;
  locationName: string;
  companyId: string;
  tokenExpiry: Date;
}

export interface GHLCalendarPreview {
  id: string;
  name: string;
  calendarType?: string;
}

export const ghlOAuthApi = {
  getConnectUrl: async (): Promise<{ authUrl: string }> => {
    const response = await api.get('/hl/connect');
    return response.data;
  },

  checkStatus: async (): Promise<GHLOAuthStatus> => {
    const response = await api.get('/hl/check-oauth');
    return response.data;
  },

  getLocations: async (): Promise<GHLOAuthLocation[]> => {
    const response = await api.get('/hl/locations');
    return response.data;
  },

  disconnect: async (): Promise<void> => {
    await api.delete('/hl/disconnect');
  },

  syncLocations: async (): Promise<{ newLocations: number; totalLocations: number }> => {
    const response = await api.post('/hl/sync-locations');
    return response.data;
  },

  getCalendarsForLocation: async (locationId: string): Promise<GHLCalendarPreview[]> => {
    const response = await api.get(`/hl/locations/${locationId}/calendars`);
    return response.data;
  },
};

// ============================================
// WHATSAPP (Baileys) API
// ============================================

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface WhatsAppStatus {
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
  connectedAt: Date | null;
}

export interface WhatsAppGroup {
  id: string;
  groupJid: string;
  groupName: string;
  groupDescription?: string | null;
  participantCount: number;
  linkedClientId?: string | null;
  linkedClient?: Client | null;
  aiEnabled: boolean;
  debounceSeconds: number;
  status: 'active' | 'inactive' | 'removed';
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWhatsAppGroupDto {
  linkedClientId?: string | null;
  aiEnabled?: boolean;
  debounceSeconds?: number;
}

export interface WhatsAppQrStreamEvent {
  type: 'qr' | 'connected' | 'disconnected' | 'error';
  data?: string | { phoneNumber?: string };
  message?: string;
}

export const whatsappApi = {
  getStatus: async (): Promise<WhatsAppStatus> => {
    const response = await api.get('/whatsapp/status');
    return response.data;
  },

  connect: async (): Promise<{ status: string }> => {
    const response = await api.post('/whatsapp/connect');
    return response.data;
  },

  disconnect: async (): Promise<{ success: boolean }> => {
    const response = await api.post('/whatsapp/disconnect');
    return response.data;
  },

  getGroups: async (clientId?: string): Promise<WhatsAppGroup[]> => {
    const params = clientId ? { clientId } : {};
    const response = await api.get('/whatsapp/groups', { params });
    return response.data;
  },

  getGroup: async (id: string): Promise<WhatsAppGroup> => {
    const response = await api.get(`/whatsapp/groups/${id}`);
    return response.data;
  },

  updateGroup: async (
    id: string,
    data: UpdateWhatsAppGroupDto,
  ): Promise<WhatsAppGroup> => {
    const response = await api.patch(`/whatsapp/groups/${id}`, data);
    return response.data;
  },

  syncGroups: async (): Promise<{ synced: number }> => {
    const response = await api.post('/whatsapp/groups/sync');
    return response.data;
  },

  refreshGroupMetadata: async (id: string): Promise<WhatsAppGroup> => {
    const response = await api.post(`/whatsapp/groups/${id}/refresh`);
    return response.data;
  },

  /**
   * Retorna la URL absoluta del stream SSE para recibir QR codes.
   * El frontend debe usar esta URL con EventSource nativo.
   */
  getQrStreamUrl: (token?: string): string => {
    const baseUrl = API_URL.replace(/\/$/, '');
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${baseUrl}/whatsapp/connect/qr${qs}`;
  },
};

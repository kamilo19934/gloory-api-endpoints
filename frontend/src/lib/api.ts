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
  dentalinkAppointmentId: number;
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
  createdAt: string;
}

export interface LogsQueryParams {
  search?: string;
  status?: StatusCategory;
  endpoint?: string;
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

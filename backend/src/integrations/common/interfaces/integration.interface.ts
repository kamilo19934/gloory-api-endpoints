/**
 * Tipos de integraciones disponibles
 */
export enum IntegrationType {
  DENTALINK = 'dentalink',
  MEDILINK = 'medilink',
  DENTALINK_MEDILINK = 'dentalink_medilink', // Modo dual: usa ambas APIs
  RESERVO = 'reservo',
  GOHIGHLEVEL = 'gohighlevel',
}

/**
 * Capacidades que puede tener una integración
 */
export enum IntegrationCapability {
  AVAILABILITY = 'availability',
  PATIENTS = 'patients',
  APPOINTMENTS = 'appointments',
  CLINIC_CONFIG = 'clinic_config',
  TREATMENTS = 'treatments',
}

/**
 * Metadata de una integración
 */
export interface IntegrationMetadata {
  type: IntegrationType;
  name: string;
  description: string;
  logo?: string;
  capabilities: IntegrationCapability[];
  requiredFields: IntegrationFieldDefinition[];
  optionalFields: IntegrationFieldDefinition[];
}

/**
 * Definición de un campo de configuración
 */
export interface IntegrationFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'password' | 'array';
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[]; // Para tipo 'select'
  defaultValue?: any;
}

/**
 * Configuración almacenada de una integración
 */
export interface IntegrationConfig {
  [key: string]: any;
}

/**
 * Interfaz base que todas las integraciones deben implementar
 */
export interface IIntegrationProvider {
  /**
   * Retorna los metadatos de la integración
   */
  getMetadata(): IntegrationMetadata;

  /**
   * Valida la conexión con las credenciales proporcionadas
   */
  testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }>;

  /**
   * Retorna los endpoints disponibles para esta integración
   */
  getEndpoints(): IntegrationEndpoint[];
}

/**
 * Definición de un endpoint expuesto por la integración
 */
export interface IntegrationEndpoint {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  category: string;
  arguments: IntegrationEndpointArgument[];
}

/**
 * Argumento de un endpoint
 */
export interface IntegrationEndpointArgument {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  example: any;
}

/**
 * Resultado de una operación que intentó múltiples APIs
 */
export interface DualApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

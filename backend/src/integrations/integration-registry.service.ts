import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationType,
  IntegrationMetadata,
  IntegrationCapability,
  IntegrationFieldDefinition,
} from './common/interfaces';

/**
 * Registry central de todas las integraciones disponibles
 */
@Injectable()
export class IntegrationRegistryService {
  private readonly logger = new Logger(IntegrationRegistryService.name);
  private readonly integrations: Map<IntegrationType, IntegrationMetadata> = new Map();

  constructor() {
    this.registerDefaultIntegrations();
  }

  private registerDefaultIntegrations(): void {
    // Registrar Dentalink
    this.register({
      type: IntegrationType.DENTALINK,
      name: 'Dentalink',
      description: 'Sistema de gestión dental con agenda, pacientes y tratamientos',
      logo: '/integrations/dentalink.png',
      capabilities: [
        IntegrationCapability.AVAILABILITY,
        IntegrationCapability.PATIENTS,
        IntegrationCapability.APPOINTMENTS,
        IntegrationCapability.CLINIC_CONFIG,
        IntegrationCapability.TREATMENTS,
      ],
      requiredFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          description: 'Token de autenticación de Dentalink',
          placeholder: 'Ingresa tu API Key de Dentalink',
        },
      ],
      optionalFields: [
        {
          key: 'timezone',
          label: 'Zona Horaria',
          type: 'select',
          description: 'Zona horaria para las operaciones',
          defaultValue: 'America/Santiago',
          options: [
            { value: 'America/Santiago', label: 'Chile (Santiago)' },
            { value: 'America/Lima', label: 'Perú (Lima)' },
            { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
            { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
            { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
          ],
        },
        {
          key: 'ghlEnabled',
          label: 'Integración GoHighLevel',
          type: 'boolean',
          description: 'Sincronizar citas con GoHighLevel',
          defaultValue: false,
        },
        {
          key: 'ghlAccessToken',
          label: 'GHL Access Token',
          type: 'password',
          description: 'Token de acceso de GoHighLevel',
        },
        {
          key: 'ghlCalendarId',
          label: 'GHL Calendar ID',
          type: 'string',
          description: 'ID del calendario en GoHighLevel',
        },
        {
          key: 'ghlLocationId',
          label: 'GHL Location ID',
          type: 'string',
          description: 'ID de la ubicación en GoHighLevel',
        },
      ],
    });

    // Registrar MediLink
    this.register({
      type: IntegrationType.MEDILINK,
      name: 'MediLink',
      description: 'Sistema médico integral con gestión de pacientes y agenda',
      logo: '/integrations/medilink.png',
      capabilities: [
        IntegrationCapability.AVAILABILITY,
        IntegrationCapability.PATIENTS,
        IntegrationCapability.APPOINTMENTS,
        IntegrationCapability.CLINIC_CONFIG,
        IntegrationCapability.TREATMENTS,
      ],
      requiredFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          description: 'Token de autenticación de MediLink (mismo que Dentalink si usa HealthAtom)',
          placeholder: 'Ingresa tu API Key de MediLink',
        },
      ],
      optionalFields: [
        {
          key: 'timezone',
          label: 'Zona Horaria',
          type: 'select',
          description: 'Zona horaria para las operaciones',
          defaultValue: 'America/Santiago',
          options: [
            { value: 'America/Santiago', label: 'Chile (Santiago)' },
            { value: 'America/Lima', label: 'Perú (Lima)' },
            { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
            { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
            { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
          ],
        },
        {
          key: 'ghlEnabled',
          label: 'Integración GoHighLevel',
          type: 'boolean',
          description: 'Sincronizar citas con GoHighLevel',
          defaultValue: false,
        },
        {
          key: 'ghlAccessToken',
          label: 'GHL Access Token',
          type: 'password',
          description: 'Token de acceso de GoHighLevel',
        },
        {
          key: 'ghlCalendarId',
          label: 'GHL Calendar ID',
          type: 'string',
          description: 'ID del calendario en GoHighLevel',
        },
        {
          key: 'ghlLocationId',
          label: 'GHL Location ID',
          type: 'string',
          description: 'ID de la ubicación en GoHighLevel',
        },
      ],
    });

    // Registrar Dentalink + MediLink (Modo Dual)
    this.register({
      type: IntegrationType.DENTALINK_MEDILINK,
      name: 'Dentalink + MediLink',
      description:
        'Modo dual: intenta primero con Dentalink, si falla usa MediLink. Ideal para clínicas que tienen servicios dentales y médicos.',
      logo: '/integrations/healthatom.png',
      capabilities: [
        IntegrationCapability.AVAILABILITY,
        IntegrationCapability.PATIENTS,
        IntegrationCapability.APPOINTMENTS,
        IntegrationCapability.CLINIC_CONFIG,
        IntegrationCapability.TREATMENTS,
      ],
      requiredFields: [
        {
          key: 'apiKey',
          label: 'API Key (HealthAtom)',
          type: 'password',
          description: 'Token de autenticación compartido para Dentalink y MediLink',
          placeholder: 'Ingresa tu API Key de HealthAtom',
        },
      ],
      optionalFields: [
        {
          key: 'timezone',
          label: 'Zona Horaria',
          type: 'select',
          description: 'Zona horaria para las operaciones',
          defaultValue: 'America/Santiago',
          options: [
            { value: 'America/Santiago', label: 'Chile (Santiago)' },
            { value: 'America/Lima', label: 'Perú (Lima)' },
            { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
            { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
            { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
          ],
        },
        {
          key: 'ghlEnabled',
          label: 'Integración GoHighLevel',
          type: 'boolean',
          description: 'Sincronizar citas con GoHighLevel',
          defaultValue: false,
        },
        {
          key: 'ghlAccessToken',
          label: 'GHL Access Token',
          type: 'password',
          description: 'Token de acceso de GoHighLevel',
        },
        {
          key: 'ghlCalendarId',
          label: 'GHL Calendar ID',
          type: 'string',
          description: 'ID del calendario en GoHighLevel',
        },
        {
          key: 'ghlLocationId',
          label: 'GHL Location ID',
          type: 'string',
          description: 'ID de la ubicación en GoHighLevel',
        },
      ],
    });

    // Registrar Reservo
    this.register({
      type: IntegrationType.RESERVO,
      name: 'Reservo',
      description:
        'Sistema de reservas y agenda online con soporte de múltiples agendas (presencial/online)',
      logo: '/integrations/reservo.png',
      capabilities: [
        IntegrationCapability.AVAILABILITY,
        IntegrationCapability.PATIENTS,
        IntegrationCapability.APPOINTMENTS,
        IntegrationCapability.TREATMENTS,
        IntegrationCapability.CLINIC_CONFIG,
      ],
      requiredFields: [
        {
          key: 'apiToken',
          label: 'API Token',
          type: 'password',
          description: 'Token de autenticación de la API pública de Reservo',
          placeholder: 'Ingresa tu API Token de Reservo',
        },
      ],
      optionalFields: [
        {
          key: 'agendas',
          label: 'Agendas',
          type: 'array',
          description:
            'Lista de agendas configuradas (cada una con nombre, uuid y tipo: presencial/online)',
        },
        {
          key: 'timezone',
          label: 'Zona Horaria',
          type: 'select',
          description: 'Zona horaria para las operaciones',
          defaultValue: 'America/Santiago',
          options: [
            { value: 'America/Santiago', label: 'Chile (Santiago)' },
            { value: 'America/Lima', label: 'Perú (Lima)' },
            { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
          ],
        },
        {
          key: 'ghlEnabled',
          label: 'Integración GoHighLevel',
          type: 'boolean',
          description: 'Sincronizar citas con GoHighLevel',
          defaultValue: false,
        },
        {
          key: 'ghlAccessToken',
          label: 'GHL Access Token',
          type: 'password',
          description: 'Token de acceso de GoHighLevel',
        },
        {
          key: 'ghlCalendarId',
          label: 'GHL Calendar ID',
          type: 'string',
          description: 'ID del calendario en GoHighLevel',
        },
        {
          key: 'ghlLocationId',
          label: 'GHL Location ID',
          type: 'string',
          description: 'ID de la ubicación en GoHighLevel',
        },
      ],
    });

    // Registrar Dentalsoft
    this.register({
      type: IntegrationType.DENTALSOFT,
      name: 'Dentalsoft',
      description:
        'Sistema dental Dentalsoft con autenticación OAuth (client_credentials) y soporte de agenda, pacientes y especialidades',
      logo: '/integrations/dentalsoft.png',
      capabilities: [
        IntegrationCapability.AVAILABILITY,
        IntegrationCapability.PATIENTS,
        IntegrationCapability.APPOINTMENTS,
        IntegrationCapability.CLINIC_CONFIG,
      ],
      requiredFields: [
        {
          key: 'clientId',
          label: 'Client ID',
          type: 'string',
          description: 'Client ID OAuth proporcionado por Dentalsoft',
          placeholder: 'Ingresa el Client ID',
        },
        {
          key: 'clientSecret',
          label: 'Client Secret',
          type: 'password',
          description: 'Client Secret OAuth proporcionado por Dentalsoft',
          placeholder: 'Ingresa el Client Secret',
        },
        {
          key: 'scope',
          label: 'Scope (ID de Clínica)',
          type: 'number',
          description: 'ID de la clínica target en Dentalsoft (campo scope del OAuth)',
          placeholder: 'Ej: 123',
        },
      ],
      optionalFields: [
        {
          key: 'baseUrl',
          label: 'Base URL (override)',
          type: 'string',
          description:
            'URL base de la API (default: https://api.dentalsoft.cl/external). Usar https://api-test.dentalsoft.cl/external para sandbox.',
          placeholder: 'https://api.dentalsoft.cl/external',
        },
        {
          key: 'timezone',
          label: 'Zona Horaria',
          type: 'select',
          description: 'Zona horaria para las operaciones',
          defaultValue: 'America/Santiago',
          options: [
            { value: 'America/Santiago', label: 'Chile (Santiago)' },
            { value: 'America/Lima', label: 'Perú (Lima)' },
            { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
            { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
            { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
          ],
        },
        {
          key: 'ghlEnabled',
          label: 'Integración GoHighLevel',
          type: 'boolean',
          description: 'Sincronizar citas con GoHighLevel',
          defaultValue: false,
        },
        {
          key: 'ghlAccessToken',
          label: 'GHL Access Token',
          type: 'password',
          description: 'Token de acceso de GoHighLevel',
        },
        {
          key: 'ghlCalendarId',
          label: 'GHL Calendar ID',
          type: 'string',
          description: 'ID del calendario en GoHighLevel',
        },
        {
          key: 'ghlLocationId',
          label: 'GHL Location ID',
          type: 'string',
          description: 'ID de la ubicación en GoHighLevel',
        },
        {
          key: 'ghlOAuthMode',
          label: 'GHL OAuth Mode',
          type: 'boolean',
          description: 'true = OAuth Marketplace; false/undefined = PIT',
          defaultValue: false,
        },
      ],
    });

    // Registrar Sacmed
    this.register({
      type: IntegrationType.SACMED,
      name: 'Sacmed',
      description:
        'Microservicio de disponibilidad médica Sacmed (centros médicos). Autenticación vía API Key (X-ApiKey) con soporte de servicios, especialidades, profesionales, pacientes, disponibilidad y citas.',
      logo: '/integrations/sacmed.png',
      capabilities: [
        IntegrationCapability.AVAILABILITY,
        IntegrationCapability.PATIENTS,
        IntegrationCapability.APPOINTMENTS,
        IntegrationCapability.CLINIC_CONFIG,
      ],
      requiredFields: [
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          description: 'API Key de Sacmed (se envía en el header X-ApiKey)',
          placeholder: 'Ingresa tu API Key de Sacmed',
        },
      ],
      optionalFields: [
        {
          key: 'baseUrl',
          label: 'Base URL (override)',
          type: 'string',
          description:
            'URL base de la API (default: producción). Usar la URL de TEST (availability-ms-test-...) para sandbox.',
          placeholder:
            'https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1',
        },
        {
          key: 'timezone',
          label: 'Zona Horaria',
          type: 'select',
          description: 'Zona horaria para las operaciones',
          defaultValue: 'America/Santiago',
          options: [
            { value: 'America/Santiago', label: 'Chile (Santiago)' },
            { value: 'America/Lima', label: 'Perú (Lima)' },
            { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
            { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
            { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
          ],
        },
        {
          key: 'ghlEnabled',
          label: 'Integración GoHighLevel',
          type: 'boolean',
          description: 'Sincronizar citas con GoHighLevel',
          defaultValue: false,
        },
        {
          key: 'ghlAccessToken',
          label: 'GHL Access Token',
          type: 'password',
          description: 'Token de acceso de GoHighLevel',
        },
        {
          key: 'ghlCalendarId',
          label: 'GHL Calendar ID',
          type: 'string',
          description: 'ID del calendario en GoHighLevel',
        },
        {
          key: 'ghlLocationId',
          label: 'GHL Location ID',
          type: 'string',
          description: 'ID de la ubicación en GoHighLevel',
        },
        {
          key: 'ghlOAuthMode',
          label: 'GHL OAuth Mode',
          type: 'boolean',
          description: 'true = OAuth Marketplace; false/undefined = PIT',
          defaultValue: false,
        },
      ],
    });

    // Registrar GoHighLevel
    this.register({
      type: IntegrationType.GOHIGHLEVEL,
      name: 'GoHighLevel',
      description:
        'Sistema de calendarios y citas GoHighLevel. Los calendarios se mapean a profesionales y las sedes se configuran manualmente.',
      logo: '/integrations/gohighlevel.png',
      capabilities: [
        IntegrationCapability.AVAILABILITY,
        IntegrationCapability.APPOINTMENTS,
        IntegrationCapability.CLINIC_CONFIG,
      ],
      requiredFields: [
        {
          key: 'ghlAccessToken',
          label: 'GHL Access Token',
          type: 'password',
          description: 'Token de acceso (Private Integration Token) de GoHighLevel',
          placeholder: 'pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        },
        {
          key: 'ghlLocationId',
          label: 'GHL Location ID',
          type: 'string',
          description: 'ID de la ubicación en GoHighLevel',
          placeholder: 'Ingresa el Location ID',
        },
      ],
      optionalFields: [
        {
          key: 'timezone',
          label: 'Zona Horaria',
          type: 'select',
          description: 'Zona horaria para las operaciones',
          defaultValue: 'America/Santiago',
          options: [
            { value: 'America/Santiago', label: 'Chile (Santiago)' },
            { value: 'America/Lima', label: 'Perú (Lima)' },
            { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
            { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
            { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
          ],
        },
        {
          key: 'ghlOAuthMode',
          label: 'Usar OAuth Marketplace',
          type: 'boolean',
          description:
            'Activar para usar tokens OAuth del Marketplace en lugar del Private Integration Token (PIT). Requiere conectar la app via GET /api/hl/connect.',
          defaultValue: false,
        },
      ],
    });

    this.logger.log(`📦 Registradas ${this.integrations.size} integraciones disponibles`);
  }

  /**
   * Registra una nueva integración
   */
  register(metadata: IntegrationMetadata): void {
    this.integrations.set(metadata.type, metadata);
    this.logger.log(`✅ Integración registrada: ${metadata.name}`);
  }

  /**
   * Obtiene los metadatos de una integración
   */
  getMetadata(type: IntegrationType): IntegrationMetadata | undefined {
    return this.integrations.get(type);
  }

  /**
   * Obtiene todas las integraciones disponibles
   */
  getAll(): IntegrationMetadata[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Obtiene integraciones por capacidad
   */
  getByCapability(capability: IntegrationCapability): IntegrationMetadata[] {
    return this.getAll().filter((i) => i.capabilities.includes(capability));
  }

  /**
   * Valida la configuración de una integración
   */
  validateConfig(
    type: IntegrationType,
    config: Record<string, any>,
  ): { valid: boolean; errors: string[] } {
    const metadata = this.getMetadata(type);
    if (!metadata) {
      return { valid: false, errors: [`Integración ${type} no encontrada`] };
    }

    const errors: string[] = [];

    for (const field of metadata.requiredFields) {
      if (!config[field.key] || config[field.key] === '') {
        errors.push(`Campo requerido: ${field.label}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

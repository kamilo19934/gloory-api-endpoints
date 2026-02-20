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

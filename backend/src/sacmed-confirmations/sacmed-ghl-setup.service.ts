import { Injectable, Logger } from '@nestjs/common';
import { GHLApiClient } from '../gohighlevel/oauth/ghl-api-client.service';
import { GHLAuthParams } from '../appointment-confirmations/ghl-setup.service';

interface CustomFieldDefinition {
  name: string;
  dataType: string;
  placeholder?: string;
  model: string;
}

/**
 * Servicio independiente para configurar custom fields de GHL
 * para el sistema de confirmaciones de Sacmed.
 */
@Injectable()
export class SacmedGhlSetupService {
  private readonly logger = new Logger(SacmedGhlSetupService.name);

  constructor(private readonly ghlApiClient: GHLApiClient) {}

  /**
   * Custom fields requeridos para el sistema de confirmaciones de Sacmed.
   * Comparten nombre con los de Dentalink/Reservo para compatibilidad en una
   * misma location de GHL.
   */
  private readonly REQUIRED_CUSTOM_FIELDS: CustomFieldDefinition[] = [
    {
      name: 'id_cita',
      dataType: 'TEXT',
      placeholder: 'ID de la cita (evento) en Sacmed',
      model: 'contact',
    },
    {
      name: 'hora_inicio',
      dataType: 'TEXT',
      placeholder: 'Hora de inicio de la cita (HH:mm:ss)',
      model: 'contact',
    },
    {
      name: 'fecha',
      dataType: 'TEXT',
      placeholder: 'Fecha de la cita (YYYY-MM-DD)',
      model: 'contact',
    },
    {
      name: 'nombre_profesional',
      dataType: 'TEXT',
      placeholder: 'Nombre del profesional',
      model: 'contact',
    },
    {
      name: 'nombre_paciente',
      dataType: 'TEXT',
      placeholder: 'Nombre del paciente',
      model: 'contact',
    },
    {
      name: 'id_paciente',
      dataType: 'TEXT',
      placeholder: 'Identificación del paciente en Sacmed',
      model: 'contact',
    },
    {
      name: 'rut',
      dataType: 'TEXT',
      placeholder: 'RUT del paciente',
      model: 'contact',
    },
    {
      name: 'for_confirmation',
      dataType: 'TEXT',
      placeholder: 'Marcado para confirmación (true/false)',
      model: 'contact',
    },
  ];

  /** Lista pública de nombres requeridos (para el endpoint validate-ghl). */
  get requiredFieldNames(): string[] {
    return this.REQUIRED_CUSTOM_FIELDS.map((f) => f.name);
  }

  private async callGHL<T = any>(
    auth: GHLAuthParams,
    config: Parameters<GHLApiClient['request']>[1],
  ): Promise<T> {
    if (auth.pitToken) {
      return this.ghlApiClient.requestWithToken<T>(auth.pitToken, config);
    }
    return this.ghlApiClient.request<T>(auth.locationId, config);
  }

  /**
   * Verifica y crea los custom fields necesarios en GHL
   */
  async ensureCustomFields(
    auth: GHLAuthParams,
  ): Promise<{ created: string[]; existing: string[]; errors: string[] }> {
    this.logger.log(`Verificando custom fields en GHL para location ${auth.locationId}`);

    const created: string[] = [];
    const existing: string[] = [];
    const errors: string[] = [];

    try {
      const data = await this.callGHL<{ customFields?: any[] }>(auth, {
        method: 'GET',
        url: `/locations/${auth.locationId}/customFields`,
        params: { model: 'contact' },
      });

      const existingFields = data?.customFields || [];

      for (const fieldDef of this.REQUIRED_CUSTOM_FIELDS) {
        if (this.fieldExists(existingFields, fieldDef)) {
          existing.push(fieldDef.name);
        } else {
          try {
            await this.createCustomField(auth, fieldDef);
            created.push(fieldDef.name);
          } catch (error) {
            const errorMsg = `Error creando "${fieldDef.name}": ${error.message}`;
            this.logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }

      this.logger.log(
        `Resumen: ${existing.length} existentes, ${created.length} creados, ${errors.length} errores`,
      );

      return { created, existing, errors };
    } catch (error) {
      this.logger.error(`Error general verificando custom fields: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determina si un custom field requerido ya existe en GHL.
   *
   * GHL deriva un `fieldKey` inmutable (ej. `contact.rut`) a partir del nombre
   * al crear el campo. Comparar solo por nombre visible falla cuando el cliente
   * ya tiene el campo con otro nombre (ej. "RUT:") pero el mismo fieldKey: el
   * matching por nombre no lo reconoce e intenta recrearlo → GHL responde 400
   * (fieldKey duplicado). Por eso matcheamos por nombre O por fieldKey.
   */
  private fieldExists(existingFields: any[], fieldDef: CustomFieldDefinition): boolean {
    const nameLower = fieldDef.name.toLowerCase();
    const expectedKey = `${fieldDef.model}.${nameLower}`;
    return existingFields.some(
      (f) =>
        (f?.name || '').toLowerCase() === nameLower ||
        (f?.fieldKey || '').toLowerCase() === expectedKey,
    );
  }

  /**
   * Crea un custom field en GHL
   */
  private async createCustomField(
    auth: GHLAuthParams,
    fieldDef: CustomFieldDefinition,
  ): Promise<void> {
    const payload = {
      name: fieldDef.name,
      dataType: fieldDef.dataType,
      model: fieldDef.model,
      placeholder: fieldDef.placeholder || '',
      position: 0,
    };

    await this.callGHL(auth, {
      method: 'POST',
      url: `/locations/${auth.locationId}/customFields`,
      data: payload,
    });
  }

  /**
   * Valida que todos los custom fields requeridos existan
   */
  async validateCustomFields(auth: GHLAuthParams): Promise<{ valid: boolean; missing: string[] }> {
    try {
      const data = await this.callGHL<{ customFields?: any[] }>(auth, {
        method: 'GET',
        url: `/locations/${auth.locationId}/customFields`,
        params: { model: 'contact' },
      });

      const existingFields = data?.customFields || [];

      const missing: string[] = [];

      for (const fieldDef of this.REQUIRED_CUSTOM_FIELDS) {
        if (!this.fieldExists(existingFields, fieldDef)) {
          missing.push(fieldDef.name);
        }
      }

      return {
        valid: missing.length === 0,
        missing,
      };
    } catch (error) {
      this.logger.error(`Error validando custom fields: ${error.message}`);
      throw error;
    }
  }
}

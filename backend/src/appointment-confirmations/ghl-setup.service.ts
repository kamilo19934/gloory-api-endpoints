import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface CustomFieldDefinition {
  name: string;
  dataType: string;
  placeholder?: string;
  model: string;
}

@Injectable()
export class GHLSetupService {
  private readonly logger = new Logger(GHLSetupService.name);

  /**
   * Custom fields requeridos para el sistema de confirmaciones
   */
  private readonly REQUIRED_CUSTOM_FIELDS: CustomFieldDefinition[] = [
    {
      name: 'id_cita',
      dataType: 'TEXT',
      placeholder: 'ID de la cita en Dentalink',
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
      name: 'nombre_dentista',
      dataType: 'TEXT',
      placeholder: 'Nombre del dentista',
      model: 'contact',
    },
    {
      name: 'id_sucursal',
      dataType: 'TEXT',
      placeholder: 'ID de la sucursal',
      model: 'contact',
    },
    {
      name: 'nombre_sucursal',
      dataType: 'TEXT',
      placeholder: 'Nombre de la sucursal',
      model: 'contact',
    },
    {
      name: 'for_confirmation',
      dataType: 'TEXT',
      placeholder: 'Marcado para confirmación (true/false)',
      model: 'contact',
    },
  ];

  /**
   * Verifica y crea los custom fields necesarios en GHL
   */
  async ensureCustomFields(
    ghlAccessToken: string,
    ghlLocationId: string,
  ): Promise<{ created: string[]; existing: string[]; errors: string[] }> {
    this.logger.log(`🔍 Verificando custom fields en GHL para location ${ghlLocationId}`);

    const headers = {
      Authorization: `Bearer ${ghlAccessToken}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    };

    const created: string[] = [];
    const existing: string[] = [];
    const errors: string[] = [];

    try {
      // 1. Obtener custom fields existentes
      const getUrl = `https://services.leadconnectorhq.com/locations/${ghlLocationId}/customFields?model=contact`;
      this.logger.log(`📡 Obteniendo custom fields existentes: ${getUrl}`);

      const getResponse = await axios.get(getUrl, { headers });

      if (getResponse.status !== 200) {
        throw new Error(`Error al obtener custom fields: ${getResponse.status}`);
      }

      const existingFields = getResponse.data?.customFields || [];
      const existingFieldNames = existingFields.map((f: any) => f.name.toLowerCase());

      this.logger.log(`✅ Encontrados ${existingFields.length} custom fields existentes`);

      // 2. Verificar y crear los que faltan
      for (const fieldDef of this.REQUIRED_CUSTOM_FIELDS) {
        const fieldNameLower = fieldDef.name.toLowerCase();

        if (existingFieldNames.includes(fieldNameLower)) {
          this.logger.log(`✓ Custom field "${fieldDef.name}" ya existe`);
          existing.push(fieldDef.name);
        } else {
          // Crear el custom field
          try {
            await this.createCustomField(ghlLocationId, fieldDef, headers);
            created.push(fieldDef.name);
            this.logger.log(`✅ Custom field "${fieldDef.name}" creado exitosamente`);
          } catch (error) {
            const errorMsg = `Error creando "${fieldDef.name}": ${error.message}`;
            this.logger.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      }

      this.logger.log(
        `📊 Resumen: ${existing.length} existentes, ${created.length} creados, ${errors.length} errores`,
      );

      return { created, existing, errors };
    } catch (error) {
      this.logger.error(`❌ Error general verificando custom fields: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea un custom field en GHL
   */
  private async createCustomField(
    locationId: string,
    fieldDef: CustomFieldDefinition,
    headers: any,
  ): Promise<void> {
    const createUrl = `https://services.leadconnectorhq.com/locations/${locationId}/customFields`;

    const payload = {
      name: fieldDef.name,
      dataType: fieldDef.dataType,
      model: fieldDef.model,
      placeholder: fieldDef.placeholder || '',
      position: 0,
    };

    this.logger.log(`📤 Creando custom field: ${JSON.stringify(payload)}`);

    const response = await axios.post(createUrl, payload, { headers });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Status ${response.status}: ${JSON.stringify(response.data)}`);
    }
  }

  /**
   * Valida que todos los custom fields requeridos existan
   */
  async validateCustomFields(
    ghlAccessToken: string,
    ghlLocationId: string,
  ): Promise<{ valid: boolean; missing: string[] }> {
    try {
      const headers = {
        Authorization: `Bearer ${ghlAccessToken}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      };

      const getUrl = `https://services.leadconnectorhq.com/locations/${ghlLocationId}/customFields?model=contact`;
      const getResponse = await axios.get(getUrl, { headers });

      const existingFields = getResponse.data?.customFields || [];
      const existingFieldNames = existingFields.map((f: any) => f.name.toLowerCase());

      const missing: string[] = [];

      for (const fieldDef of this.REQUIRED_CUSTOM_FIELDS) {
        if (!existingFieldNames.includes(fieldDef.name.toLowerCase())) {
          missing.push(fieldDef.name);
        }
      }

      return {
        valid: missing.length === 0,
        missing,
      };
    } catch (error) {
      this.logger.error(`❌ Error validando custom fields: ${error.message}`);
      throw error;
    }
  }
}

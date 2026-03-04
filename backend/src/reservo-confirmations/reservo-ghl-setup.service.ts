import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface CustomFieldDefinition {
  name: string;
  dataType: string;
  placeholder?: string;
  model: string;
}

/**
 * Servicio independiente para configurar custom fields de GHL
 * para el sistema de confirmaciones de Reservo.
 */
@Injectable()
export class ReservoGhlSetupService {
  private readonly logger = new Logger(ReservoGhlSetupService.name);

  /**
   * Custom fields requeridos para el sistema de confirmaciones de Reservo.
   * Los nombres de campo son idénticos a los de Dentalink para compatibilidad
   * con GHL (un cliente podría usar ambos sistemas en la misma location).
   */
  private readonly REQUIRED_CUSTOM_FIELDS: CustomFieldDefinition[] = [
    {
      name: 'id_cita',
      dataType: 'TEXT',
      placeholder: 'ID de la cita en Reservo',
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
      placeholder: 'ID del paciente en Reservo',
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

  /**
   * Verifica y crea los custom fields necesarios en GHL
   */
  async ensureCustomFields(
    ghlAccessToken: string,
    ghlLocationId: string,
  ): Promise<{ created: string[]; existing: string[]; errors: string[] }> {
    this.logger.log(`Verificando custom fields en GHL para location ${ghlLocationId}`);

    const headers = {
      Authorization: `Bearer ${ghlAccessToken}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    };

    const created: string[] = [];
    const existing: string[] = [];
    const errors: string[] = [];

    try {
      const getUrl = `https://services.leadconnectorhq.com/locations/${ghlLocationId}/customFields?model=contact`;
      const getResponse = await axios.get(getUrl, { headers });

      if (getResponse.status !== 200) {
        throw new Error(`Error al obtener custom fields: ${getResponse.status}`);
      }

      const existingFields = getResponse.data?.customFields || [];
      const existingFieldNames = existingFields.map((f: any) => f.name.toLowerCase());

      for (const fieldDef of this.REQUIRED_CUSTOM_FIELDS) {
        const fieldNameLower = fieldDef.name.toLowerCase();

        if (existingFieldNames.includes(fieldNameLower)) {
          existing.push(fieldDef.name);
        } else {
          try {
            await this.createCustomField(ghlLocationId, fieldDef, headers);
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
      this.logger.error(`Error validando custom fields: ${error.message}`);
      throw error;
    }
  }
}

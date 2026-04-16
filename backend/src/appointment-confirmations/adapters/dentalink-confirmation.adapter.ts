import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Client } from '../../clients/entities/client.entity';
import { ConfirmationConfig } from '../entities/confirmation-config.entity';
import { HealthAtomService } from '../../integrations/healthatom/healthatom.service';
import { ClientsService } from '../../clients/clients.service';
import {
  IConfirmationAdapter,
  FetchedAppointment,
} from './confirmation-adapter.interface';

@Injectable()
export class DentalinkConfirmationAdapter implements IConfirmationAdapter {
  readonly platform = 'dentalink';
  private readonly logger = new Logger(DentalinkConfirmationAdapter.name);

  constructor(
    private readonly healthAtomService: HealthAtomService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Resuelve el API key desde la integración config, con fallback al campo legacy
   */
  private resolveApiKey(client: Client): string {
    const integration =
      client.getIntegration('dentalink') ||
      client.getIntegration('medilink') ||
      client.getIntegration('dentalink_medilink');
    return (integration?.config as any)?.apiKey || client.apiKey;
  }

  async fetchAppointments(
    client: Client,
    config: ConfirmationConfig,
    appointmentDate: string,
    timezone: string,
  ): Promise<FetchedAppointment[]> {
    const hasDentalinkMedilink = client.integrations?.some(
      (i) => i.integrationType === 'dentalink_medilink' && i.isEnabled,
    );
    const hasMedilinkOnly = !hasDentalinkMedilink && client.integrations?.some(
      (i) => i.integrationType === 'medilink' && i.isEnabled,
    );

    const apiKey = this.resolveApiKey(client);
    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const apisToTry = hasDentalinkMedilink
      ? [
          { type: 'dentalink', baseUrl: 'https://api.dentalink.healthatom.com/api/v1/' },
          { type: 'medilink', baseUrl: 'https://api.medilink2.healthatom.com/api/v5/' },
        ]
      : hasMedilinkOnly
        ? [{ type: 'medilink', baseUrl: 'https://api.medilink2.healthatom.com/api/v5/' }]
        : [{ type: 'dentalink', baseUrl: process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/' }];

    // Parsear los estados configurados
    const stateIds = config.appointmentStates.split(',').map((id) => parseInt(id.trim(), 10));
    this.logger.log(`📋 Filtrando por estados: [${stateIds.join(', ')}]`);

    let appointments = [];
    const seenIds = new Set<string>();

    for (const api of apisToTry) {
      this.logger.log(`🔍 Buscando citas en ${api.type.toUpperCase()}...`);

      for (const stateId of stateIds) {
        const filtro = JSON.stringify({
          fecha: { eq: appointmentDate },
          id_estado: { eq: stateId },
        });

        this.logger.log(`🔎 [${api.type}] Buscando citas con estado ${stateId}...`);

        try {
          const response = await axios.get(`${api.baseUrl}citas`, {
            headers,
            params: { q: filtro },
          });

          if (response.status === 200) {
            const stateAppointments = response.data?.data || [];
            this.logger.log(`   ✅ ${stateAppointments.length} citas con estado ${stateId} en ${api.type}`);
            // Deduplicar por ID (ambas APIs comparten backend HealthAtom)
            for (const apt of stateAppointments) {
              const aptId = String(apt.id);
              if (!seenIds.has(aptId)) {
                seenIds.add(aptId);
                appointments.push(apt);
              }
            }
          }
        } catch (error) {
          this.logger.error(`❌ [${api.type}] Error buscando citas con estado ${stateId}: ${error.message}`);
        }
      }
    }

    this.logger.log(`✅ Total de citas obtenidas: ${appointments.length}`);

    // Normalizar cada cita
    const fetched: FetchedAppointment[] = [];

    for (const apt of appointments) {
      try {
        // Obtener datos del paciente
        let emailPaciente = '';
        let telefonoPaciente = '';
        let rutPaciente = '';

        for (const api of apisToTry) {
          try {
            const patientResp = await axios.get(`${api.baseUrl}pacientes/${apt.id_paciente}`, {
              headers,
            });

            if (patientResp.status === 200) {
              const patient = patientResp.data?.data || {};
              emailPaciente = patient.email || '';
              telefonoPaciente = patient.celular || patient.telefono || '';
              rutPaciente = patient.rut || '';

              this.logger.log(
                `📋 [${api.type}] Paciente ${apt.id_paciente}: RUT=${rutPaciente}, Email=${emailPaciente}`,
              );
              break;
            }
          } catch (error) {
            this.logger.warn(`⚠️ [${api.type}] Error obteniendo paciente ${apt.id_paciente}: ${error.message}`);
          }
        }

        // Normalizar campos: Dentalink usa nombre_dentista/id_dentista/id_tratamiento,
        // MediLink usa nombre_profesional/id_profesional/id_atencion.
        // Los campos son mutuamente excluyentes, así que un fallback simple funciona.
        fetched.push({
          platformAppointmentId: String(apt.id),
          appointmentData: {
            id_paciente: String(apt.id_paciente),
            nombre_paciente: apt.nombre_paciente || '',
            nombre_social_paciente: apt.nombre_social_paciente || '',
            rut_paciente: rutPaciente,
            email_paciente: emailPaciente,
            telefono_paciente: telefonoPaciente,
            id_tratamiento: String(apt.id_tratamiento || apt.id_atencion || ''),
            nombre_tratamiento: apt.nombre_tratamiento || '',
            fecha: apt.fecha,
            hora_inicio: apt.hora_inicio,
            hora_fin: apt.hora_fin,
            duracion: apt.duracion,
            id_dentista: String(apt.id_dentista || apt.id_profesional || ''),
            nombre_dentista: apt.nombre_dentista || apt.nombre_profesional || '',
            id_sucursal: String(apt.id_sucursal || ''),
            nombre_sucursal: apt.nombre_sucursal || '',
            id_estado: String(apt.id_estado),
            estado_cita: apt.estado_cita || '',
            motivo_atencion: apt.motivo_atencion || '',
            comentarios: apt.comentarios || '',
          },
        });
      } catch (error) {
        this.logger.error(`❌ [Dentalink] Error procesando cita ${apt.id}: ${error.message}`);
      }
    }

    return fetched;
  }

  async confirmAppointmentOnPlatform(
    client: Client,
    platformAppointmentId: string,
    stateId?: number,
  ): Promise<void> {
    if (!stateId) return;

    const appointmentIdNum = parseInt(platformAppointmentId, 10);
    if (isNaN(appointmentIdNum)) {
      this.logger.warn(`⚠️ [Dentalink] ID de cita no numérico: ${platformAppointmentId}`);
      return;
    }

    this.logger.log(
      `🔄 [Dentalink] Actualizando estado de cita ${appointmentIdNum} al estado ${stateId}`,
    );

    const result = await this.healthAtomService.confirmAppointment(appointmentIdNum, stateId, {
      apiKey: this.resolveApiKey(client),
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    this.logger.log(`✅ [Dentalink] Estado de cita ${appointmentIdNum} actualizado`);
  }

  // ============================================
  // MÉTODOS ESPECÍFICOS DE DENTALINK
  // (no son parte de IConfirmationAdapter)
  // ============================================

  /**
   * Obtiene los estados de cita disponibles en Dentalink/MediLink
   */
  async getAppointmentStates(client: Client): Promise<any[]> {
    const hasDentalinkMedilink = client.integrations?.some(
      (i) => i.integrationType === 'dentalink_medilink' && i.isEnabled,
    );

    const apiType = hasDentalinkMedilink ? 'dual' : 'dentalink';

    const headers = {
      Authorization: `Token ${this.resolveApiKey(client)}`,
      'Content-Type': 'application/json',
    };

    const apisToTry =
      apiType === 'dual'
        ? [
            { type: 'dentalink', baseUrl: 'https://api.dentalink.healthatom.com/api/v1/' },
            { type: 'medilink', baseUrl: 'https://api.medilink2.healthatom.com/api/v5/' },
          ]
        : [{ type: 'dentalink', baseUrl: 'https://api.dentalink.healthatom.com/api/v1/' }];

    const allStates: any[] = [];
    const seenIds = new Set<number>();

    for (const api of apisToTry) {
      try {
        this.logger.log(`🔍 Obteniendo estados de cita de ${api.type.toUpperCase()}`);

        const response = await axios.get(`${api.baseUrl}citas/estados`, { headers });

        if (response.status === 200) {
          const states = response.data?.data || [];
          this.logger.log(`✅ Obtenidos ${states.length} estados de ${api.type.toUpperCase()}`);

          for (const state of states) {
            if (state.habilitado === 1 && !seenIds.has(state.id)) {
              seenIds.add(state.id);
              allStates.push(state);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`⚠️ Error obteniendo estados de ${api.type}: ${error.message}`);
      }
    }

    if (allStates.length === 0) {
      this.logger.error('❌ No se pudieron obtener estados de ninguna API');
      throw new Error('No se pudieron obtener los estados de cita');
    }

    this.logger.log(`✅ Total de estados únicos: ${allStates.length}`);
    return allStates;
  }

  /**
   * Crea los estados personalizados de Bookys: "Confirmado por Bookys" y "Contactado por Bookys"
   */
  async createBookysConfirmationState(client: Client): Promise<any> {
    const hasDentalinkMedilink = client.integrations?.some(
      (i) => i.integrationType === 'dentalink_medilink' && i.isEnabled,
    );

    const apiType = hasDentalinkMedilink ? 'dual' : 'dentalink';

    const headers = {
      Authorization: `Token ${this.resolveApiKey(client)}`,
      'Content-Type': 'application/json',
    };

    const statesToCreate = [
      {
        key: 'confirmed',
        data: {
          nombre: 'Confirmado por Bookys',
          color: '#10B981',
          anulacion: 0,
        },
      },
      {
        key: 'contacted',
        data: {
          nombre: 'Contactado por Bookys',
          color: '#3B82F6',
          anulacion: 0,
        },
      },
    ];

    const apisToTry =
      apiType === 'dual'
        ? [
            { type: 'dentalink', baseUrl: 'https://api.dentalink.healthatom.com/api/v1/' },
            { type: 'medilink', baseUrl: 'https://api.medilink2.healthatom.com/api/v5/' },
          ]
        : [{ type: 'dentalink', baseUrl: 'https://api.dentalink.healthatom.com/api/v1/' }];

    // Verificar si ya existen los estados
    const existingStates = await this.getAppointmentStates(client);
    const existingConfirmedState = existingStates.find((s: any) =>
      s.nombre.toLowerCase().includes('confirmado por bookys'),
    );
    const existingContactedState = existingStates.find((s: any) =>
      s.nombre.toLowerCase().includes('contactado por bookys'),
    );

    const results = {
      confirmedState: existingConfirmedState,
      contactedState: existingContactedState,
      created: [],
      alreadyExisting: [],
    };

    if (existingConfirmedState && existingContactedState) {
      this.logger.log(`✅ Ambos estados de Bookys ya existen`);
      return {
        alreadyExists: true,
        confirmedState: existingConfirmedState,
        contactedState: existingContactedState,
        message: 'Los estados de Bookys ya existen',
        ...results,
      };
    }

    for (const stateConfig of statesToCreate) {
      const existing =
        stateConfig.key === 'confirmed' ? existingConfirmedState : existingContactedState;

      if (existing) {
        this.logger.log(
          `✅ El estado "${stateConfig.data.nombre}" ya existe con ID ${existing.id}`,
        );
        results.alreadyExisting.push(existing);
        if (stateConfig.key === 'confirmed') results.confirmedState = existing;
        if (stateConfig.key === 'contacted') results.contactedState = existing;
        continue;
      }

      let created = false;
      for (const api of apisToTry) {
        try {
          this.logger.log(
            `🔄 Creando estado "${stateConfig.data.nombre}" en ${api.type.toUpperCase()}`,
          );

          const response = await axios.post(`${api.baseUrl}citas/estados`, stateConfig.data, {
            headers,
          });

          if (response.status === 201 || response.status === 200) {
            const newState = response.data?.data;
            this.logger.log(
              `✅ Estado "${stateConfig.data.nombre}" creado exitosamente con ID ${newState.id}`,
            );

            results.created.push(newState);
            if (stateConfig.key === 'confirmed') results.confirmedState = newState;
            if (stateConfig.key === 'contacted') results.contactedState = newState;
            created = true;
            break;
          }
        } catch (error) {
          this.logger.error(
            `❌ Error creando estado "${stateConfig.data.nombre}" en ${api.type}: ${error.message}`,
          );

          if (api === apisToTry[apisToTry.length - 1]) {
            this.logger.warn(`⚠️ No se pudo crear "${stateConfig.data.nombre}" en ninguna API`);
          }
        }
      }

      if (!created && !existing) {
        throw new Error(`No se pudo crear el estado "${stateConfig.data.nombre}"`);
      }
    }

    // Actualizar automáticamente el cliente con los IDs de ambos estados
    await this.clientsService.update(client.id, {
      confirmationStateId: results.confirmedState.id,
      contactedStateId: results.contactedState.id,
    });

    this.logger.log(
      `✅ Cliente actualizado con estados: Confirmado ID ${results.confirmedState.id}, Contactado ID ${results.contactedState.id}`,
    );

    return {
      alreadyExists: false,
      confirmedState: results.confirmedState,
      contactedState: results.contactedState,
      message: `Estados de Bookys creados y configurados exitosamente`,
      ...results,
    };
  }
}

import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Client } from '../clients/entities/client.entity';
import { ClientIntegration } from '../clients/entities/client-integration.entity';
import { ClientsService } from '../clients/clients.service';
import { IntegrationRegistryService } from '../integrations/integration-registry.service';
import { HealthAtomService } from '../integrations/healthatom/healthatom.service';
import { ReservoService } from '../integrations/reservo/reservo.service';
import { GoHighLevelService } from '../integrations/gohighlevel/gohighlevel.service';
import { IntegrationType } from '../integrations/common/interfaces';
import {
  ProvisionClientDto,
  ProvisionClientResponseDto,
} from './dto/provision-client.dto';
import {
  TestConnectionDto,
  TestConnectionResponseDto,
  UpdateIntegrationCredentialsDto,
} from './dto/test-connection.dto';
import { DENTALINK_ENDPOINTS } from '../integrations/healthatom/healthatom.types';

/**
 * Servicio para operaciones internas server-to-server entre
 * gloory-ai-server y gloory-api-endpoints.
 *
 * Incluye:
 * - Auto-provisioning de clientes (crear Client + ClientIntegration)
 * - Test de conexión contra APIs externas antes de guardar credenciales
 * - Actualización de credenciales post-onboarding
 */
@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(ClientIntegration)
    private readonly integrationsRepository: Repository<ClientIntegration>,
    private readonly clientsService: ClientsService,
    private readonly registryService: IntegrationRegistryService,
    private readonly healthAtomService: HealthAtomService,
    private readonly reservoService: ReservoService,
    private readonly ghlService: GoHighLevelService,
  ) {}

  // ============================
  // AUTO-PROVISIONING
  // ============================

  /**
   * Crea un Client + ClientIntegration de forma idempotente.
   * Si ya existe un Client con el mismo `gloory_business_id`, lo retorna
   * sin error (permite reintentos seguros desde gloory-ai-server).
   */
  async provisionClient(
    dto: ProvisionClientDto,
  ): Promise<ProvisionClientResponseDto> {
    this.logger.log(
      `🔧 Provisioning client para business ${dto.gloory_business_id}`,
    );

    // 1. Idempotencia: buscar si ya existe
    const existing = await this.clientsRepository.findOne({
      where: { gloory_business_id: dto.gloory_business_id },
      relations: ['integrations'],
    });

    if (existing) {
      this.logger.log(
        `✓ Client ya existe (id: ${existing.id}), retornando existente`,
      );

      // Si se pasó una integración y el cliente no la tiene, agregarla
      let integration: ClientIntegration | undefined;
      if (dto.integration) {
        integration = existing.integrations?.find(
          (i) => i.integrationType === dto.integration?.type,
        );

        if (!integration) {
          // Validar config
          const validation = this.registryService.validateConfig(
            dto.integration.type,
            dto.integration.config,
          );
          if (!validation.valid) {
            throw new BadRequestException(validation.errors.join(', '));
          }

          integration = await this.clientsService.addIntegration(existing.id, {
            type: dto.integration.type,
            isEnabled: true,
            config: dto.integration.config,
          });
        }
      }

      return {
        clientId: existing.id,
        name: existing.name,
        gloory_business_id: existing.gloory_business_id as string,
        created: false,
        integration: integration
          ? {
              type: integration.integrationType,
              isEnabled: integration.isEnabled,
            }
          : undefined,
      };
    }

    // 2. Validar config de integración antes de crear nada
    if (dto.integration) {
      const validation = this.registryService.validateConfig(
        dto.integration.type,
        dto.integration.config,
      );
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join(', '));
      }
    }

    // 3. Crear Client nuevo
    const client = this.clientsRepository.create({
      name: dto.name,
      description: dto.description,
      timezone: dto.timezone || 'America/Santiago',
      gloory_business_id: dto.gloory_business_id,
    });

    let savedClient: Client;
    try {
      savedClient = await this.clientsRepository.save(client);
    } catch (err: any) {
      // Race condition: otro request provisionó el mismo businessId en paralelo
      if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT') {
        this.logger.warn(
          `Race condition detectada para business ${dto.gloory_business_id}, reintentando lookup`,
        );
        const existingAfterRace = await this.clientsRepository.findOne({
          where: { gloory_business_id: dto.gloory_business_id },
          relations: ['integrations'],
        });
        if (existingAfterRace) {
          return {
            clientId: existingAfterRace.id,
            name: existingAfterRace.name,
            gloory_business_id: existingAfterRace.gloory_business_id as string,
            created: false,
          };
        }
      }
      throw err;
    }

    this.logger.log(`✅ Client creado: ${savedClient.id}`);

    // 4. Crear ClientIntegration si viene en el DTO
    let integration: ClientIntegration | undefined;
    if (dto.integration) {
      try {
        integration = await this.clientsService.addIntegration(savedClient.id, {
          type: dto.integration.type,
          isEnabled: true,
          config: dto.integration.config,
        });
      } catch (err: any) {
        // Rollback: si falla la integración, eliminar el Client
        this.logger.error(
          `Error creando integración, revirtiendo Client ${savedClient.id}`,
          err,
        );
        await this.clientsRepository.remove(savedClient);
        throw new InternalServerErrorException(
          `No se pudo crear la integración: ${err.message}`,
        );
      }
    }

    return {
      clientId: savedClient.id,
      name: savedClient.name,
      gloory_business_id: savedClient.gloory_business_id as string,
      created: true,
      integration: integration
        ? {
            type: integration.integrationType,
            isEnabled: integration.isEnabled,
          }
        : undefined,
    };
  }

  // ============================
  // TEST DE CONEXIÓN
  // ============================

  /**
   * Valida credenciales contra la API externa sin guardar nada.
   * Retorna un preview con stats básicos (nombre de clínica, # sucursales, etc.).
   */
  async testConnection(
    dto: TestConnectionDto,
  ): Promise<TestConnectionResponseDto> {
    this.logger.log(`🔍 Test-connection para plataforma ${dto.platform}`);

    try {
      switch (dto.platform) {
        case IntegrationType.DENTALINK:
        case IntegrationType.MEDILINK:
        case IntegrationType.DENTALINK_MEDILINK:
          return await this.testHealthAtomConnection(dto.credentials);

        case IntegrationType.RESERVO:
          return await this.testReservoConnection(dto.credentials);

        case IntegrationType.GOHIGHLEVEL:
          return await this.testGhlConnection(dto.credentials);

        default:
          return {
            ok: false,
            error: `Plataforma no soportada: ${String(dto.platform)}`,
          };
      }
    } catch (err: any) {
      this.logger.error(`Error en test-connection: ${err.message}`);
      return {
        ok: false,
        error: err.message || 'Error desconocido al conectar',
      };
    }
  }

  private async testHealthAtomConnection(
    credentials: Record<string, any>,
  ): Promise<TestConnectionResponseDto> {
    const apiKey = credentials.apiKey as string | undefined;
    if (!apiKey) {
      return { ok: false, error: 'Falta apiKey en las credenciales' };
    }

    try {
      // Hit directo al endpoint de sucursales de Dentalink como prueba de auth
      const response = await axios.get(
        `${DENTALINK_ENDPOINTS.baseUrl}${DENTALINK_ENDPOINTS.branches}`,
        {
          headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      const sucursales: any[] = response.data?.data || [];

      // Intentar también obtener profesionales para el preview
      let professionalsCount = 0;
      try {
        const profResponse = await axios.get(
          `${DENTALINK_ENDPOINTS.baseUrl}${DENTALINK_ENDPOINTS.professionals}`,
          {
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          },
        );
        professionalsCount = (profResponse.data?.data || []).length;
      } catch {
        // Ignorar — puede fallar en Medilink-only, no es crítico para el test
      }

      return {
        ok: true,
        preview: {
          branches_count: sucursales.length,
          professionals_count: professionalsCount,
        },
      };
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return { ok: false, error: 'Token inválido o sin permisos' };
      }
      return {
        ok: false,
        error: err.response?.data?.message || err.message || 'Error de conexión',
      };
    }
  }

  private async testReservoConnection(
    credentials: Record<string, any>,
  ): Promise<TestConnectionResponseDto> {
    const apiToken = credentials.apiToken as string | undefined;
    if (!apiToken) {
      return { ok: false, error: 'Falta apiToken en las credenciales' };
    }

    const result = await this.reservoService.testConnection({
      apiToken,
      agendas: Array.isArray(credentials.agendas) ? credentials.agendas : [],
      timezone: credentials.timezone || 'America/Santiago',
    });

    if (!result.connected) {
      return { ok: false, error: result.message };
    }

    return {
      ok: true,
      preview: {
        agendas_count: Array.isArray(credentials.agendas)
          ? credentials.agendas.length
          : 0,
      },
    };
  }

  private async testGhlConnection(
    credentials: Record<string, any>,
  ): Promise<TestConnectionResponseDto> {
    const ghlAccessToken = credentials.ghlAccessToken as string | undefined;
    const ghlLocationId = credentials.ghlLocationId as string | undefined;

    if (!ghlAccessToken || !ghlLocationId) {
      return {
        ok: false,
        error: 'Faltan ghlAccessToken o ghlLocationId en las credenciales',
      };
    }

    const result = await this.ghlService.testConnection({
      ghlAccessToken,
      ghlLocationId,
      timezone: credentials.timezone,
    });

    if (!result.connected) {
      return { ok: false, error: result.message };
    }

    return {
      ok: true,
      preview: {
        calendars_count: result.calendars,
      },
    };
  }

  // ============================
  // UPDATE CREDENTIALS (por business)
  // ============================

  /**
   * Actualiza las credenciales de la integración de un negocio ya provisionado.
   * Usado cuando el cliente renueva su token de la plataforma externa.
   */
  async updateIntegrationCredentials(
    gloory_business_id: string,
    dto: UpdateIntegrationCredentialsDto,
  ): Promise<{ ok: true; updatedAt: Date }> {
    const client = await this.clientsRepository.findOne({
      where: { gloory_business_id },
      relations: ['integrations'],
    });

    if (!client) {
      throw new BadRequestException(
        `No existe Client provisionado para business ${gloory_business_id}`,
      );
    }

    const integration = client.integrations?.find(
      (i) => i.integrationType === dto.platform,
    );

    if (!integration) {
      throw new ConflictException(
        `El cliente no tiene una integración ${dto.platform}`,
      );
    }

    // Merge: solo actualiza los campos que vengan
    integration.config = { ...integration.config, ...dto.credentials };
    const updated = await this.integrationsRepository.save(integration);

    this.logger.log(
      `🔐 Credenciales actualizadas para ${gloory_business_id} (${dto.platform})`,
    );

    return { ok: true, updatedAt: updated.updatedAt };
  }
}

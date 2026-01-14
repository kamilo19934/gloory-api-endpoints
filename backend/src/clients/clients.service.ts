import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { ClientIntegration } from './entities/client-integration.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddIntegrationDto, UpdateIntegrationDto } from './dto/add-integration.dto';
import { IntegrationRegistryService } from '../integrations/integration-registry.service';
import { IntegrationType } from '../integrations/common/interfaces';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    @InjectRepository(ClientIntegration)
    private integrationsRepository: Repository<ClientIntegration>,
    private readonly registryService: IntegrationRegistryService,
  ) {}

  async create(createClientDto: CreateClientDto): Promise<Client> {
    // Legacy: Check if API key already exists
    if (createClientDto.apiKey) {
      const existingClient = await this.clientsRepository.findOne({
        where: { apiKey: createClientDto.apiKey },
      });

      if (existingClient) {
        throw new ConflictException('A client with this API key already exists');
      }
    }

    // Create client
    const client = this.clientsRepository.create({
      name: createClientDto.name,
      description: createClientDto.description,
      timezone: createClientDto.timezone || 'America/Santiago',
      // Legacy fields
      apiKey: createClientDto.apiKey,
      ghlEnabled: createClientDto.ghlEnabled || false,
      ghlAccessToken: createClientDto.ghlAccessToken,
      ghlCalendarId: createClientDto.ghlCalendarId,
      ghlLocationId: createClientDto.ghlLocationId,
    });

    const savedClient = await this.clientsRepository.save(client);

    // Process integrations if provided
    if (createClientDto.integrations && createClientDto.integrations.length > 0) {
      for (const integrationDto of createClientDto.integrations) {
        await this.addIntegration(savedClient.id, {
          type: integrationDto.type,
          isEnabled: integrationDto.isEnabled ?? true,
          config: integrationDto.config || {},
        });
      }
    }

    // Auto-create Dentalink integration from legacy apiKey
    if (createClientDto.apiKey && !createClientDto.integrations?.some(i => i.type === IntegrationType.DENTALINK)) {
      await this.addIntegration(savedClient.id, {
        type: IntegrationType.DENTALINK,
        isEnabled: true,
        config: {
          apiKey: createClientDto.apiKey,
          timezone: createClientDto.timezone || 'America/Santiago',
          ghlEnabled: createClientDto.ghlEnabled || false,
          ghlAccessToken: createClientDto.ghlAccessToken,
          ghlCalendarId: createClientDto.ghlCalendarId,
          ghlLocationId: createClientDto.ghlLocationId,
        },
      });
    }

    return this.findOne(savedClient.id);
  }

  async findAll(): Promise<Client[]> {
    return await this.clientsRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['integrations'],
    });
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({
      where: { id },
      relations: ['integrations'],
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    // If updating API key, check if it already exists (legacy)
    if (updateClientDto.apiKey && updateClientDto.apiKey !== client.apiKey) {
      const existingClient = await this.clientsRepository.findOne({
        where: { apiKey: updateClientDto.apiKey },
      });

      if (existingClient) {
        throw new ConflictException('A client with this API key already exists');
      }
    }

    // Update basic fields
    if (updateClientDto.name !== undefined) client.name = updateClientDto.name;
    if (updateClientDto.description !== undefined) client.description = updateClientDto.description;
    if (updateClientDto.isActive !== undefined) client.isActive = updateClientDto.isActive;
    if (updateClientDto.timezone !== undefined) client.timezone = updateClientDto.timezone;

    // Legacy fields
    if (updateClientDto.apiKey !== undefined) client.apiKey = updateClientDto.apiKey;
    if (updateClientDto.ghlEnabled !== undefined) client.ghlEnabled = updateClientDto.ghlEnabled;
    if (updateClientDto.ghlAccessToken !== undefined) client.ghlAccessToken = updateClientDto.ghlAccessToken;
    if (updateClientDto.ghlCalendarId !== undefined) client.ghlCalendarId = updateClientDto.ghlCalendarId;
    if (updateClientDto.ghlLocationId !== undefined) client.ghlLocationId = updateClientDto.ghlLocationId;

    await this.clientsRepository.save(client);

    // Update integrations if provided
    if (updateClientDto.integrations) {
      for (const integrationDto of updateClientDto.integrations) {
        const existingIntegration = await this.integrationsRepository.findOne({
          where: { clientId: id, integrationType: integrationDto.type },
        });

        if (existingIntegration) {
          await this.updateIntegration(id, integrationDto.type, {
            isEnabled: integrationDto.isEnabled,
            config: integrationDto.config,
          });
        } else {
          await this.addIntegration(id, {
            type: integrationDto.type,
            isEnabled: integrationDto.isEnabled ?? true,
            config: integrationDto.config || {},
          });
        }
      }
    }

    // Sync legacy Dentalink config
    if (updateClientDto.apiKey || updateClientDto.ghlEnabled !== undefined) {
      const dentalinkIntegration = await this.integrationsRepository.findOne({
        where: { clientId: id, integrationType: IntegrationType.DENTALINK },
      });

      if (dentalinkIntegration) {
        dentalinkIntegration.config = {
          ...dentalinkIntegration.config,
          apiKey: client.apiKey,
          timezone: client.timezone,
          ghlEnabled: client.ghlEnabled,
          ghlAccessToken: client.ghlAccessToken,
          ghlCalendarId: client.ghlCalendarId,
          ghlLocationId: client.ghlLocationId,
        };
        await this.integrationsRepository.save(dentalinkIntegration);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);
    await this.clientsRepository.remove(client);
  }

  // ============================================
  // INTEGRATION MANAGEMENT
  // ============================================

  async addIntegration(clientId: string, dto: AddIntegrationDto): Promise<ClientIntegration> {
    // Verify client exists
    await this.findOne(clientId);

    // Validate integration type
    const metadata = this.registryService.getMetadata(dto.type);
    if (!metadata) {
      throw new BadRequestException(`Tipo de integración desconocido: ${dto.type}`);
    }

    // Validate required config
    const validation = this.registryService.validateConfig(dto.type, dto.config);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Check if integration already exists
    const existing = await this.integrationsRepository.findOne({
      where: { clientId, integrationType: dto.type },
    });

    if (existing) {
      throw new ConflictException(`El cliente ya tiene una integración de tipo ${dto.type}`);
    }

    const integration = this.integrationsRepository.create({
      clientId,
      integrationType: dto.type,
      isEnabled: dto.isEnabled ?? true,
      config: dto.config,
    });

    const saved = await this.integrationsRepository.save(integration);
    this.logger.log(`✅ Integración ${dto.type} agregada al cliente ${clientId}`);
    return saved;
  }

  async updateIntegration(
    clientId: string,
    type: IntegrationType,
    dto: UpdateIntegrationDto,
  ): Promise<ClientIntegration> {
    const integration = await this.integrationsRepository.findOne({
      where: { clientId, integrationType: type },
    });

    if (!integration) {
      throw new NotFoundException(`Integración ${type} no encontrada para este cliente`);
    }

    if (dto.isEnabled !== undefined) {
      integration.isEnabled = dto.isEnabled;
    }

    if (dto.config) {
      integration.config = { ...integration.config, ...dto.config };
    }

    return await this.integrationsRepository.save(integration);
  }

  async removeIntegration(clientId: string, type: IntegrationType): Promise<void> {
    const integration = await this.integrationsRepository.findOne({
      where: { clientId, integrationType: type },
    });

    if (!integration) {
      throw new NotFoundException(`Integración ${type} no encontrada para este cliente`);
    }

    await this.integrationsRepository.remove(integration);
    this.logger.log(`🗑️ Integración ${type} eliminada del cliente ${clientId}`);
  }

  async getClientIntegrations(clientId: string): Promise<ClientIntegration[]> {
    return await this.integrationsRepository.find({
      where: { clientId },
      order: { createdAt: 'ASC' },
    });
  }

  async getClientIntegration(
    clientId: string,
    type: IntegrationType,
  ): Promise<ClientIntegration | null> {
    return await this.integrationsRepository.findOne({
      where: { clientId, integrationType: type, isEnabled: true },
    });
  }

  // ============================================
  // LEGACY HELPERS
  // ============================================

  async getApiKey(clientId: string): Promise<string> {
    const client = await this.findOne(clientId);
    
    // Try new integration first
    const dentalinkIntegration = await this.getClientIntegration(clientId, IntegrationType.DENTALINK);
    if (dentalinkIntegration?.config?.apiKey) {
      return dentalinkIntegration.config.apiKey;
    }
    
    // Fallback to legacy
    return client.apiKey;
  }

  /**
   * Obtiene la configuración de una integración específica
   */
  async getIntegrationConfig(
    clientId: string,
    type: IntegrationType,
  ): Promise<Record<string, any> | null> {
    const integration = await this.getClientIntegration(clientId, type);
    return integration?.config || null;
  }
}

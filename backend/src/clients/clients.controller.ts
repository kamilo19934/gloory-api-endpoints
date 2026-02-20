import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddIntegrationDto, UpdateIntegrationDto } from './dto/add-integration.dto';
import { IntegrationType } from '../integrations/common/interfaces';
import { EndpointsService } from '../endpoints/endpoints.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly endpointsService: EndpointsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  /**
   * Obtiene las plataformas conectadas del cliente (sin exponer secretos)
   * Útil para integraciones externas que necesitan saber qué está conectado
   */
  @Public()
  @Get(':id/platform')
  getConnectedPlatforms(@Param('id') id: string) {
    return this.clientsService.getConnectedPlatforms(id);
  }

  @Get(':id/endpoints')
  async getEndpoints(@Param('id') id: string) {
    const client = await this.clientsService.findOne(id);
    const integrationTypes = (client.integrations || [])
      .filter((i) => i.isEnabled)
      .map((i) => i.integrationType);
    return this.endpointsService.getEndpointsForClient(id, integrationTypes);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  // ============================================
  // INTEGRATION ENDPOINTS
  // ============================================

  /**
   * Lista todas las integraciones de un cliente
   */
  @Get(':id/integrations')
  getIntegrations(@Param('id') id: string) {
    return this.clientsService.getClientIntegrations(id);
  }

  /**
   * Agrega una nueva integración a un cliente
   */
  @Post(':id/integrations')
  @HttpCode(HttpStatus.CREATED)
  addIntegration(@Param('id') id: string, @Body() dto: AddIntegrationDto) {
    return this.clientsService.addIntegration(id, dto);
  }

  /**
   * Obtiene una integración específica de un cliente
   */
  @Get(':id/integrations/:type')
  getIntegration(@Param('id') id: string, @Param('type') type: IntegrationType) {
    return this.clientsService.getClientIntegration(id, type);
  }

  /**
   * Actualiza una integración de un cliente
   */
  @Patch(':id/integrations/:type')
  updateIntegration(
    @Param('id') id: string,
    @Param('type') type: IntegrationType,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.clientsService.updateIntegration(id, type, dto);
  }

  /**
   * Elimina una integración de un cliente
   */
  @Delete(':id/integrations/:type')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeIntegration(@Param('id') id: string, @Param('type') type: IntegrationType) {
    return this.clientsService.removeIntegration(id, type);
  }
}

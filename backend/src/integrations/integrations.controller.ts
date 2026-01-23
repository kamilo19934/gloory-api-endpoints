import { Controller, Get, Param } from '@nestjs/common';
import { IntegrationRegistryService } from './integration-registry.service';
import { Public } from '../auth/decorators/public.decorator';
import {
  IntegrationType,
  IntegrationMetadata,
  IntegrationCapability,
} from './common/interfaces';

@Public()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly registryService: IntegrationRegistryService) {}

  /**
   * Lista todas las integraciones disponibles
   */
  @Get()
  getAllIntegrations(): IntegrationMetadata[] {
    return this.registryService.getAll();
  }

  /**
   * Obtiene los detalles de una integración específica
   */
  @Get(':type')
  getIntegration(@Param('type') type: IntegrationType): IntegrationMetadata | { error: string } {
    const metadata = this.registryService.getMetadata(type);
    if (!metadata) {
      return { error: `Integración ${type} no encontrada` };
    }
    return metadata;
  }

  /**
   * Lista integraciones por capacidad
   */
  @Get('capability/:capability')
  getByCapability(
    @Param('capability') capability: IntegrationCapability,
  ): IntegrationMetadata[] {
    return this.registryService.getByCapability(capability);
  }
}

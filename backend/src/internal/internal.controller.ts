import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { InternalTokenGuard } from './guards/internal-token.guard';
import { InternalService } from './internal.service';
import {
  ProvisionClientDto,
  ProvisionClientResponseDto,
} from './dto/provision-client.dto';
import {
  TestConnectionDto,
  TestConnectionResponseDto,
  UpdateIntegrationCredentialsDto,
} from './dto/test-connection.dto';

/**
 * Controller para endpoints internos server-to-server entre servicios de Gloory.
 *
 * Todas las rutas de este controller son:
 * - `@Public()` → saltan el JwtAuthGuard global
 * - Protegidas por `InternalTokenGuard` → requieren el header
 *   `X-Gloory-Internal-Token` con el shared secret.
 *
 * Usado exclusivamente por `gloory-ai-server` durante el onboarding
 * de clientes y la actualización de credenciales.
 */
@Controller('internal')
@Public()
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  /**
   * Auto-provisioning: crea un Client + ClientIntegration de forma idempotente.
   * Si ya existe un Client con el mismo `gloory_business_id`, lo retorna
   * sin error (para reintentos seguros).
   */
  @Post('clients/provision')
  @HttpCode(HttpStatus.OK)
  async provisionClient(
    @Body() dto: ProvisionClientDto,
  ): Promise<ProvisionClientResponseDto> {
    return this.internalService.provisionClient(dto);
  }

  /**
   * Valida credenciales contra la API externa sin guardar nada.
   * Retorna un preview con stats (nombre clínica, # sucursales, etc.)
   * para que el wizard de gloory-ai-client pueda mostrarlos antes de conectar.
   */
  @Post('integrations/test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(
    @Body() dto: TestConnectionDto,
  ): Promise<TestConnectionResponseDto> {
    return this.internalService.testConnection(dto);
  }

  /**
   * Actualiza las credenciales de una integración ya provisionada.
   * Usado cuando el cliente renueva su token en la plataforma externa.
   */
  @Patch('clients/:gloory_business_id/integrations/credentials')
  @HttpCode(HttpStatus.OK)
  async updateCredentials(
    @Param('gloory_business_id') gloory_business_id: string,
    @Body() dto: UpdateIntegrationCredentialsDto,
  ) {
    return this.internalService.updateIntegrationCredentials(
      gloory_business_id,
      dto,
    );
  }
}

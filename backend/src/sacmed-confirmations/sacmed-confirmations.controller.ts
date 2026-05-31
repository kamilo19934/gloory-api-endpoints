import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SacmedConfirmationsService } from './sacmed-confirmations.service';
import { SacmedGhlSetupService } from './sacmed-ghl-setup.service';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSacmedConfigDto } from './dto/create-sacmed-config.dto';
import { UpdateSacmedConfigDto } from './dto/update-sacmed-config.dto';
import { TriggerSacmedConfirmationDto } from './dto/trigger-sacmed-confirmation.dto';
import { ProcessSacmedSelectedDto } from './dto/process-sacmed-selected.dto';
import { SacmedConfirmationStatus } from './entities/sacmed-pending-confirmation.entity';
import { ClientsService } from '../clients/clients.service';
import { SacmedConfig } from '../integrations/sacmed/sacmed.types';
import { GoHighLevelConfig } from '../integrations/gohighlevel/gohighlevel.types';
import { GHLAuthParams } from '../appointment-confirmations/ghl-setup.service';

@Public()
@Controller('clients/:clientId/sacmed-confirmations')
export class SacmedConfirmationsController {
  constructor(
    private readonly confirmationsService: SacmedConfirmationsService,
    private readonly ghlSetupService: SacmedGhlSetupService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Resuelve los parámetros de auth para el wrapper GHLApiClient.
   * Para OAuth no incluye `pitToken` — el wrapper lo resuelve por cada call.
   */
  private resolveGHLAuthParams(client: any, sacmedConfig: SacmedConfig): GHLAuthParams | null {
    const ghlIntegration = client.getIntegration('gohighlevel');
    if (ghlIntegration) {
      const ghlConfig = ghlIntegration.config as GoHighLevelConfig;
      if (ghlConfig.ghlOAuthMode && ghlConfig.ghlLocationId) {
        return { locationId: ghlConfig.ghlLocationId };
      }
      if (ghlConfig.ghlAccessToken && ghlConfig.ghlLocationId) {
        return { locationId: ghlConfig.ghlLocationId, pitToken: ghlConfig.ghlAccessToken };
      }
    }

    if (sacmedConfig.ghlEnabled && sacmedConfig.ghlLocationId) {
      if (sacmedConfig.ghlOAuthMode) {
        return { locationId: sacmedConfig.ghlLocationId };
      }
      if (sacmedConfig.ghlAccessToken) {
        return { locationId: sacmedConfig.ghlLocationId, pitToken: sacmedConfig.ghlAccessToken };
      }
    }

    return null;
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  @Post('configs')
  async createConfig(@Param('clientId') clientId: string, @Body() dto: CreateSacmedConfigDto) {
    return await this.confirmationsService.createConfig(clientId, dto);
  }

  @Get('configs')
  async getConfigs(@Param('clientId') clientId: string) {
    return await this.confirmationsService.getConfigs(clientId);
  }

  @Get('configs/:configId')
  async getConfig(@Param('clientId') clientId: string, @Param('configId') configId: string) {
    return await this.confirmationsService.getConfig(clientId, configId);
  }

  @Put('configs/:configId')
  async updateConfig(
    @Param('clientId') clientId: string,
    @Param('configId') configId: string,
    @Body() dto: UpdateSacmedConfigDto,
  ) {
    return await this.confirmationsService.updateConfig(clientId, configId, dto);
  }

  @Delete('configs/:configId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('clientId') clientId: string, @Param('configId') configId: string) {
    await this.confirmationsService.deleteConfig(clientId, configId);
  }

  // ============================================
  // PROCESAMIENTO
  // ============================================

  @Post('trigger')
  async triggerConfirmation(
    @Param('clientId') clientId: string,
    @Body() dto: TriggerSacmedConfirmationDto,
  ) {
    const result = await this.confirmationsService.fetchAndStoreAppointments(
      clientId,
      dto.configId,
      dto.targetDate,
    );

    return {
      message: 'Confirmaciones Sacmed disparadas',
      stored: result.stored,
      totalAppointments: result.appointments.length,
    };
  }

  @Post('process')
  async processConfirmations(@Param('clientId') clientId: string) {
    const result = await this.confirmationsService.processPendingConfirmationsNow(clientId);

    return {
      message: 'Confirmaciones Sacmed procesadas (hasta 10)',
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    };
  }

  @Post('process-selected')
  async processSelectedConfirmations(
    @Param('clientId') clientId: string,
    @Body() dto: ProcessSacmedSelectedDto,
  ) {
    const result = await this.confirmationsService.processSelectedConfirmations(
      clientId,
      dto.confirmationIds,
    );

    return {
      message: `${result.completed} de ${result.processed} confirmaciones procesadas exitosamente`,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    };
  }

  @Post('process-all')
  async processAllConfirmations(@Param('clientId') clientId: string) {
    const result = await this.confirmationsService.processAllPendingConfirmationsNow(clientId);

    return {
      message: 'Todas las confirmaciones Sacmed procesadas',
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    };
  }

  // ============================================
  // CONSULTAS
  // ============================================

  @Get('pending')
  async getPendingConfirmations(@Param('clientId') clientId: string) {
    return await this.confirmationsService.getPendingConfirmations(clientId);
  }

  @Get('pending/status/:status')
  async getPendingByStatus(
    @Param('clientId') clientId: string,
    @Param('status') status: SacmedConfirmationStatus,
  ) {
    return await this.confirmationsService.getPendingConfirmationsByStatus(clientId, status);
  }

  // ============================================
  // SETUP DE GHL
  // ============================================

  @Post('setup-ghl')
  async setupGHL(@Param('clientId') clientId: string) {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('sacmed');

    if (!integration) {
      return {
        success: false,
        message: 'El cliente no tiene integración Sacmed configurada',
      };
    }

    const sacmedConfig = integration.config as SacmedConfig;
    const auth = this.resolveGHLAuthParams(client, sacmedConfig);

    if (!auth) {
      return {
        success: false,
        message: 'La integración Sacmed no tiene GoHighLevel configurado',
      };
    }

    const result = await this.ghlSetupService.ensureCustomFields(auth);

    return {
      success: true,
      message: 'Setup completado',
      created: result.created,
      existing: result.existing,
      errors: result.errors,
    };
  }

  @Get('validate-ghl')
  async validateGHL(@Param('clientId') clientId: string) {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('sacmed');

    if (!integration) {
      return {
        valid: false,
        message: 'El cliente no tiene integración Sacmed configurada',
      };
    }

    const sacmedConfig = integration.config as SacmedConfig;
    const auth = this.resolveGHLAuthParams(client, sacmedConfig);

    if (!auth) {
      return {
        valid: false,
        message: 'La integración Sacmed no tiene GoHighLevel configurado',
      };
    }

    const result = await this.ghlSetupService.validateCustomFields(auth);

    return {
      valid: result.valid,
      message: result.valid
        ? 'Todos los custom fields requeridos están configurados'
        : `Faltan ${result.missing.length} custom fields`,
      missing: result.missing,
      required: this.ghlSetupService.requiredFieldNames,
    };
  }
}

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
import { ReservoConfirmationsService } from './reservo-confirmations.service';
import { ReservoGhlSetupService } from './reservo-ghl-setup.service';
import { Public } from '../auth/decorators/public.decorator';
import { CreateReservoConfigDto } from './dto/create-reservo-config.dto';
import { UpdateReservoConfigDto } from './dto/update-reservo-config.dto';
import { TriggerReservoConfirmationDto } from './dto/trigger-reservo-confirmation.dto';
import { ProcessReservoSelectedDto } from './dto/process-reservo-selected.dto';
import { ReservoConfirmationStatus } from './entities/reservo-pending-confirmation.entity';
import { ClientsService } from '../clients/clients.service';
import { ReservoConfig } from '../integrations/reservo/reservo.types';
import { GHLOAuthService } from '../gohighlevel/oauth/ghl-oauth.service';
import { GoHighLevelConfig } from '../integrations/gohighlevel/gohighlevel.types';

@Public()
@Controller('clients/:clientId/reservo-confirmations')
export class ReservoConfirmationsController {
  constructor(
    private readonly confirmationsService: ReservoConfirmationsService,
    private readonly ghlSetupService: ReservoGhlSetupService,
    private readonly clientsService: ClientsService,
    private readonly ghlOAuthService: GHLOAuthService,
  ) {}

  /**
   * Resuelve las credenciales GHL para Reservo (OAuth, PIT en reservo config, o PIT en GHL integration)
   */
  private async resolveGHLCredentials(client: any, reservoConfig: ReservoConfig): Promise<{ ghlAccessToken: string; ghlLocationId: string } | null> {
    // 1. Intentar desde integración gohighlevel (OAuth mode)
    const ghlIntegration = client.getIntegration('gohighlevel');
    if (ghlIntegration) {
      const ghlConfig = ghlIntegration.config as GoHighLevelConfig;
      if (ghlConfig.ghlOAuthMode && ghlConfig.ghlLocationId) {
        const oauthToken = await this.ghlOAuthService.getLocationAccessToken(ghlConfig.ghlLocationId);
        if (oauthToken) {
          return { ghlAccessToken: oauthToken, ghlLocationId: ghlConfig.ghlLocationId };
        }
        return null; // OAuth configurado pero sin token disponible
      }
    }

    // 2. Usar campos GHL dentro de la configuración Reservo (PIT mode)
    if (reservoConfig.ghlEnabled && reservoConfig.ghlAccessToken && reservoConfig.ghlLocationId) {
      return { ghlAccessToken: reservoConfig.ghlAccessToken, ghlLocationId: reservoConfig.ghlLocationId };
    }

    return null;
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  @Post('configs')
  async createConfig(
    @Param('clientId') clientId: string,
    @Body() dto: CreateReservoConfigDto,
  ) {
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
    @Body() dto: UpdateReservoConfigDto,
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
    @Body() dto: TriggerReservoConfirmationDto,
  ) {
    const result = await this.confirmationsService.fetchAndStoreAppointments(
      clientId,
      dto.configId,
      dto.targetDate,
    );

    return {
      message: 'Confirmaciones Reservo disparadas',
      stored: result.stored,
      totalAppointments: result.appointments.length,
    };
  }

  @Post('process')
  async processConfirmations(@Param('clientId') clientId: string) {
    const result = await this.confirmationsService.processPendingConfirmationsNow(clientId);

    return {
      message: 'Confirmaciones Reservo procesadas (hasta 10)',
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    };
  }

  @Post('process-selected')
  async processSelectedConfirmations(
    @Param('clientId') clientId: string,
    @Body() dto: ProcessReservoSelectedDto,
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
      message: 'Todas las confirmaciones Reservo procesadas',
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
    @Param('status') status: ReservoConfirmationStatus,
  ) {
    return await this.confirmationsService.getPendingConfirmationsByStatus(clientId, status);
  }

  // ============================================
  // SETUP DE GHL
  // ============================================

  @Post('setup-ghl')
  async setupGHL(@Param('clientId') clientId: string) {
    const client = await this.clientsService.findOne(clientId);
    const integration = client.getIntegration('reservo');

    if (!integration) {
      return {
        success: false,
        message: 'El cliente no tiene integración Reservo configurada',
      };
    }

    const reservoConfig = integration.config as ReservoConfig;
    const credentials = await this.resolveGHLCredentials(client, reservoConfig);

    if (!credentials) {
      return {
        success: false,
        message: 'La integración Reservo no tiene GoHighLevel configurado',
      };
    }

    const result = await this.ghlSetupService.ensureCustomFields(
      credentials.ghlAccessToken,
      credentials.ghlLocationId,
    );

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
    const integration = client.getIntegration('reservo');

    if (!integration) {
      return {
        valid: false,
        message: 'El cliente no tiene integración Reservo configurada',
      };
    }

    const reservoConfig = integration.config as ReservoConfig;
    const credentials = await this.resolveGHLCredentials(client, reservoConfig);

    if (!credentials) {
      return {
        valid: false,
        message: 'La integración Reservo no tiene GoHighLevel configurado',
      };
    }

    const result = await this.ghlSetupService.validateCustomFields(
      credentials.ghlAccessToken,
      credentials.ghlLocationId,
    );

    return {
      valid: result.valid,
      message: result.valid
        ? 'Todos los custom fields requeridos están configurados'
        : `Faltan ${result.missing.length} custom fields`,
      missing: result.missing,
      required: [
        'id_cita',
        'hora_inicio',
        'fecha',
        'nombre_dentista',
        'nombre_paciente',
        'id_paciente',
        'id_sucursal',
        'nombre_sucursal',
        'rut',
        'for_confirmation',
      ],
    };
  }
}

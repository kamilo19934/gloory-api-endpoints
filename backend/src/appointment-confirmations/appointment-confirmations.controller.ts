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
  BadRequestException,
} from '@nestjs/common';
import { AppointmentConfirmationsService } from './appointment-confirmations.service';
import { Public } from '../auth/decorators/public.decorator';
import { GHLSetupService } from './ghl-setup.service';
import { CreateConfirmationConfigDto } from './dto/create-confirmation-config.dto';
import { UpdateConfirmationConfigDto } from './dto/update-confirmation-config.dto';
import { TriggerConfirmationDto } from './dto/trigger-confirmation.dto';
import { ConfirmationStatus } from './entities/pending-confirmation.entity';
import { ClientsService } from '../clients/clients.service';
import { ConfirmationAdapterFactory } from './adapters/confirmation-adapter.factory';
import { GHLOAuthService } from '../gohighlevel/oauth/ghl-oauth.service';
import { GoHighLevelConfig } from '../integrations/gohighlevel/gohighlevel.types';

@Public()
@Controller('clients/:clientId/appointment-confirmations')
export class AppointmentConfirmationsController {
  constructor(
    private readonly confirmationsService: AppointmentConfirmationsService,
    private readonly ghlSetupService: GHLSetupService,
    private readonly clientsService: ClientsService,
    private readonly adapterFactory: ConfirmationAdapterFactory,
    private readonly ghlOAuthService: GHLOAuthService,
  ) {}

  /**
   * Resuelve las credenciales GHL del cliente (OAuth o PIT/legacy)
   */
  private async resolveGHLCredentials(
    client: any,
  ): Promise<{ ghlAccessToken: string; ghlLocationId: string } | null> {
    const params = this.resolveGHLAuthParams(client);
    if (!params) return null;

    if (params.pitToken) {
      return { ghlAccessToken: params.pitToken, ghlLocationId: params.locationId };
    }

    const oauthToken = await this.ghlOAuthService.getLocationAccessToken(params.locationId);
    if (!oauthToken) return null;
    return { ghlAccessToken: oauthToken, ghlLocationId: params.locationId };
  }

  /**
   * Resuelve los parámetros de auth para llamar a `GHLApiClient` vía
   * los setup services. Diferencia OAuth (sin pitToken) de PIT (con pitToken).
   * Para OAuth el wrapper resuelve el token dinámicamente por cada request.
   *
   * Busca el config GHL en este orden:
   * 1. Integración 'gohighlevel' standalone.
   * 2. Embebido en el config de la integración Dentalink/MediLink/dual
   *    (donde la UI lo guarda hoy). Si el config tiene ghlOAuthMode=true
   *    se usa OAuth; si tiene ghlAccessToken se usa PIT.
   * 3. Fallback legacy a los campos del Client (ghlEnabled + ghlAccessToken
   *    + ghlLocationId).
   *
   * El cliente puede tener un PIT viejo en los campos legacy y haber migrado
   * después a OAuth dentro del config de su integración HealthAtom — en ese
   * caso el config embebido gana sobre el legacy.
   */
  private resolveGHLAuthParams(client: any): { locationId: string; pitToken?: string } | null {
    const ghlIntegration = client.getIntegration('gohighlevel');
    if (ghlIntegration) {
      const config = ghlIntegration.config as GoHighLevelConfig;
      if (config.ghlLocationId) {
        if (config.ghlOAuthMode) {
          return { locationId: config.ghlLocationId };
        }
        if (config.ghlAccessToken) {
          return { locationId: config.ghlLocationId, pitToken: config.ghlAccessToken };
        }
      }
    }

    // GHL embebido en el config de HealthAtom (Dentalink, MediLink o dual)
    const healthAtomTypes = ['dentalink', 'medilink', 'dentalink_medilink'];
    for (const type of healthAtomTypes) {
      const integration = client.getIntegration(type);
      if (!integration) continue;
      const haConfig = integration.config as Record<string, any>;
      if (!haConfig?.ghlEnabled || !haConfig?.ghlLocationId) continue;
      if (haConfig.ghlOAuthMode) {
        return { locationId: haConfig.ghlLocationId };
      }
      if (haConfig.ghlAccessToken) {
        return { locationId: haConfig.ghlLocationId, pitToken: haConfig.ghlAccessToken };
      }
    }

    // Fallback legacy
    if (client.ghlEnabled && client.ghlAccessToken && client.ghlLocationId) {
      return { locationId: client.ghlLocationId, pitToken: client.ghlAccessToken };
    }

    return null;
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  @Post('configs')
  async createConfig(
    @Param('clientId') clientId: string,
    @Body() dto: CreateConfirmationConfigDto,
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
    @Body() dto: UpdateConfirmationConfigDto,
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

  /**
   * Dispara manualmente la obtención y almacenamiento de citas.
   * Funciona con cualquier plataforma (Dentalink, Reservo, etc.)
   */
  @Post('trigger')
  async triggerConfirmation(
    @Param('clientId') clientId: string,
    @Body() dto: TriggerConfirmationDto,
  ) {
    const result = await this.confirmationsService.fetchAndStoreAppointments(
      clientId,
      dto.confirmationConfigId,
      dto.targetDate,
    );

    return {
      message: 'Confirmaciones disparadas',
      stored: result.stored,
      totalAppointments: result.appointments.length,
    };
  }

  /**
   * Procesa manualmente las confirmaciones pendientes (sincroniza con GHL)
   */
  @Post('process')
  async processConfirmations(@Param('clientId') clientId: string) {
    const result = await this.confirmationsService.processPendingConfirmationsNow(clientId);

    return {
      message: 'Confirmaciones procesadas (hasta 10)',
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    };
  }

  /**
   * Procesa confirmaciones seleccionadas específicamente
   */
  @Post('process-selected')
  async processSelectedConfirmations(
    @Param('clientId') clientId: string,
    @Body() processSelectedDto: { confirmationIds: string[] },
  ) {
    const result = await this.confirmationsService.processSelectedConfirmations(
      clientId,
      processSelectedDto.confirmationIds,
    );

    return {
      message: `${result.completed} de ${result.processed} confirmaciones procesadas exitosamente`,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    };
  }

  /**
   * Procesa TODAS las confirmaciones pendientes de un cliente (sin límite)
   */
  @Post('process-all')
  async processAllConfirmations(@Param('clientId') clientId: string) {
    const result = await this.confirmationsService.processAllPendingConfirmationsNow(clientId);

    return {
      message: 'Todas las confirmaciones procesadas',
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
    };
  }

  /**
   * Obtiene todas las confirmaciones pendientes
   */
  @Get('pending')
  async getPendingConfirmations(@Param('clientId') clientId: string) {
    return await this.confirmationsService.getPendingConfirmations(clientId);
  }

  /**
   * Obtiene confirmaciones por estado
   */
  @Get('pending/status/:status')
  async getPendingByStatus(
    @Param('clientId') clientId: string,
    @Param('status') status: ConfirmationStatus,
  ) {
    return await this.confirmationsService.getPendingConfirmationsByStatus(clientId, status);
  }

  // ============================================
  // ESTADOS DE CITA (solo Dentalink/MediLink)
  // ============================================

  /**
   * Obtiene los estados de cita disponibles en Dentalink/MediLink
   */
  @Get('appointment-states')
  async getAppointmentStates(@Param('clientId') clientId: string) {
    const client = await this.clientsService.findOne(clientId);

    if (client.hasIntegration('reservo')) {
      throw new BadRequestException(
        'Los estados de cita personalizados no están soportados para Reservo. ' +
          'Reservo usa estados fijos: NC (No Confirmado), C (Confirmado), S (Suspendido).',
      );
    }

    return await this.adapterFactory.getDentalinkAdapter().getAppointmentStates(client);
  }

  /**
   * Crea los estados personalizados "Confirmado por Bookys" y "Contactado por Bookys"
   */
  @Post('appointment-states/create-bookys')
  async createBookysState(@Param('clientId') clientId: string) {
    const client = await this.clientsService.findOne(clientId);

    if (client.hasIntegration('reservo')) {
      throw new BadRequestException(
        'La creación de estados personalizados no está soportada para Reservo.',
      );
    }

    return await this.adapterFactory.getDentalinkAdapter().createBookysConfirmationState(client);
  }

  // ============================================
  // SETUP DE GHL
  // ============================================

  /**
   * Configura los custom fields en GHL (verifica y crea los que faltan)
   */
  @Post('setup-ghl')
  async setupGHL(@Param('clientId') clientId: string) {
    const client = await this.clientsService.findOne(clientId);
    const auth = this.resolveGHLAuthParams(client);

    if (!auth) {
      return {
        success: false,
        message: 'El cliente no tiene GoHighLevel configurado correctamente',
      };
    }

    const result = await this.ghlSetupService.ensureCustomFields(auth);

    return {
      success: true,
      message: 'Setup completado',
      created: result.created,
      existing: result.existing,
      errors: result.errors,
      totalRequired: 7,
      totalExisting: result.existing.length,
      totalCreated: result.created.length,
    };
  }

  /**
   * Valida que todos los custom fields requeridos existan en GHL
   */
  @Get('validate-ghl')
  async validateGHL(@Param('clientId') clientId: string) {
    const client = await this.clientsService.findOne(clientId);
    const auth = this.resolveGHLAuthParams(client);

    if (!auth) {
      return {
        valid: false,
        message: 'El cliente no tiene GoHighLevel configurado correctamente',
      };
    }

    const result = await this.ghlSetupService.validateCustomFields(auth);

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

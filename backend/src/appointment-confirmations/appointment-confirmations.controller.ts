import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppointmentConfirmationsService } from './appointment-confirmations.service';
import { GHLSetupService } from './ghl-setup.service';
import { CreateConfirmationConfigDto } from './dto/create-confirmation-config.dto';
import { UpdateConfirmationConfigDto } from './dto/update-confirmation-config.dto';
import { TriggerConfirmationDto } from './dto/trigger-confirmation.dto';
import { ConfirmationStatus } from './entities/pending-confirmation.entity';
import { ClientsService } from '../clients/clients.service';

@Controller('clients/:clientId/appointment-confirmations')
export class AppointmentConfirmationsController {
  constructor(
    private readonly confirmationsService: AppointmentConfirmationsService,
    private readonly ghlSetupService: GHLSetupService,
    private readonly clientsService: ClientsService,
  ) {}

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
  async getConfig(
    @Param('clientId') clientId: string,
    @Param('configId') configId: string,
  ) {
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
  async deleteConfig(
    @Param('clientId') clientId: string,
    @Param('configId') configId: string,
  ) {
    await this.confirmationsService.deleteConfig(clientId, configId);
  }

  // ============================================
  // PROCESAMIENTO
  // ============================================

  /**
   * Dispara manualmente la obtención y almacenamiento de citas
   * Útil para testing o ejecución manual
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
   * Útil para testing - ignora el scheduledFor y procesa todo inmediatamente
   */
  @Post('process')
  async processConfirmations(@Param('clientId') clientId: string) {
    const result = await this.confirmationsService.processPendingConfirmationsNow(clientId);

    return {
      message: 'Confirmaciones procesadas',
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
    return await this.confirmationsService.getPendingConfirmationsByStatus(
      clientId,
      status,
    );
  }

  // ============================================
  // ESTADOS DE CITA
  // ============================================

  /**
   * Obtiene los estados de cita disponibles en Dentalink
   */
  @Get('appointment-states')
  async getAppointmentStates(@Param('clientId') clientId: string) {
    return await this.confirmationsService.getAppointmentStates(clientId);
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

    if (!client.ghlEnabled || !client.ghlAccessToken || !client.ghlLocationId) {
      return {
        success: false,
        message: 'El cliente no tiene GoHighLevel configurado correctamente',
      };
    }

    const result = await this.ghlSetupService.ensureCustomFields(
      client.ghlAccessToken,
      client.ghlLocationId,
    );

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

    if (!client.ghlEnabled || !client.ghlAccessToken || !client.ghlLocationId) {
      return {
        valid: false,
        message: 'El cliente no tiene GoHighLevel configurado correctamente',
      };
    }

    const result = await this.ghlSetupService.validateCustomFields(
      client.ghlAccessToken,
      client.ghlLocationId,
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
        'id_sucursal',
        'nombre_sucursal',
        'for_confirmation',
      ],
    };
  }
}

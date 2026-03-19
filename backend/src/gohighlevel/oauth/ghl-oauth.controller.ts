import { Controller, Get, Post, Delete, Param, Query, Res, HttpCode, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { GHLOAuthService } from './ghl-oauth.service';

@Public()
@Controller('hl')
export class GHLOAuthController {
  private readonly logger = new Logger(GHLOAuthController.name);

  constructor(private readonly ghlOAuthService: GHLOAuthService) {}

  /**
   * Genera la URL de autorización del Marketplace de GHL.
   * El frontend redirige al usuario a esta URL para aprobar la app.
   * GET /api/hl/connect
   */
  @Get('connect')
  async connect(): Promise<{ authUrl: string }> {
    const authUrl = await this.ghlOAuthService.connect();
    return { authUrl };
  }

  /**
   * GHL redirige aquí con el código de autorización tras aprobar la app.
   * Intercambia el código por tokens y redirige al frontend.
   * GET /api/hl/callback?code=XYZ
   */
  @HttpCode(302)
  @Get('callback')
  async oauthCallback(
    @Query('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.ghlOAuthService.handleCallback(code);
      res.redirect(process.env.CLIENT_HOST || 'http://localhost:3000');
    } catch (error) {
      this.logger.error(`Error en callback OAuth: ${error?.message} | GHL response: ${JSON.stringify(error?.response?.data)}`);
      res.redirect(
        `${process.env.CLIENT_HOST || 'http://localhost:3000'}?ghl_oauth_error=true`,
      );
    }
  }

  /**
   * Verifica si el OAuth GHL está activo y con tokens válidos.
   * GET /api/hl/check-oauth
   */
  @Get('check-oauth')
  async checkOauth(): Promise<{ valid: boolean; companies: number }> {
    return this.ghlOAuthService.checkOauth();
  }

  /**
   * Desconecta GHL OAuth — elimina todos los tokens de BD.
   * DELETE /api/hl/disconnect
   */
  @Delete('disconnect')
  async disconnect(): Promise<{ success: boolean }> {
    await this.ghlOAuthService.disconnect();
    return { success: true };
  }

  /**
   * Lista todas las locations OAuth conectadas.
   * Útil para el panel admin para saber qué locationIds tienen token OAuth.
   * GET /api/hl/locations
   */
  @Get('locations')
  async getLocations(): Promise<
    { locationId: string; locationName: string; companyId: string; tokenExpiry: Date }[]
  > {
    return this.ghlOAuthService.getConnectedLocations();
  }

  /**
   * Re-sincroniza locations desde GHL: descubre nuevas sub-cuentas instaladas.
   * POST /api/hl/sync-locations
   */
  @Post('sync-locations')
  async syncLocations(): Promise<{ newLocations: number; totalLocations: number }> {
    return this.ghlOAuthService.syncLocations();
  }

  /**
   * Obtiene los calendarios de una location OAuth conectada.
   * Útil para preview al crear/editar clientes.
   * GET /api/hl/locations/:locationId/calendars
   */
  @Get('locations/:locationId/calendars')
  async getLocationCalendars(
    @Param('locationId') locationId: string,
  ): Promise<{ id: string; name: string; calendarType?: string }[]> {
    return this.ghlOAuthService.getCalendarsForLocation(locationId);
  }
}

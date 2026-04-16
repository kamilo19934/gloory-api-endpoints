import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { GHLOAuthCompany } from './entities/ghl-oauth-company.entity';
import { GHLOAuthLocation } from './entities/ghl-oauth-location.entity';

@Injectable()
export class GHLOAuthService implements OnModuleInit {
  private readonly logger = new Logger(GHLOAuthService.name);

  private readonly CLIENT_ID = process.env.GHL_OAUTH_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.GHL_OAUTH_CLIENT_SECRET;
  private readonly BASE_URL = 'https://services.leadconnectorhq.com';
  private readonly REDIRECT_URL = process.env.GHL_OAUTH_REDIRECT_URL;

  // Tokens de empresa en memoria: companyId → accessToken
  private readonly tokenCache = new Map<string, string>();

  // companyIds cuyo refresh falló con invalid_grant
  private readonly invalidCompanies = new Set<string>();

  // Webhook para alertas de caída OAuth
  private readonly ALERT_WEBHOOK_URL =
    process.env.GHL_OAUTH_ALERT_WEBHOOK ??
    'https://services.leadconnectorhq.com/hooks/2wdyUgGKN304sYIbppAx/webhook-trigger/c8299d15-2ddb-45cc-8c3f-a97fc625298b';

  constructor(
    @InjectRepository(GHLOAuthCompany)
    private readonly companyRepo: Repository<GHLOAuthCompany>,
    @InjectRepository(GHLOAuthLocation)
    private readonly locationRepo: Repository<GHLOAuthLocation>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
      this.logger.warn(
        'GHL_OAUTH_CLIENT_ID o GHL_OAUTH_CLIENT_SECRET no configurados — OAuth GHL deshabilitado',
      );
      return;
    }
    await this.checkAndRefreshTokens();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASO 1 — Genera la URL de autorización del Marketplace de GHL
  // ══════════════════════════════════════════════════════════════════════════
  async connect(): Promise<string> {
    const scopes = [
      'contacts.readonly',
      'contacts.write',
      'opportunities.readonly',
      'opportunities.write',
      'calendars.readonly',
      'calendars.write',
      'calendars/events.readonly',
      'calendars/events.write',
      'calendars/groups.readonly',
      'calendars/groups.write',
      'calendars/resources.readonly',
      'calendars/resources.write',
      'locations/customFields.readonly',
      'locations/customFields.write',
      'companies.readonly',
      'locations.readonly',
      'oauth.write',
    ].join(' ');

    const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', this.REDIRECT_URL);
    authUrl.searchParams.append('client_id', this.CLIENT_ID);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('version_id', '69b77c0dd898d3315150de43');

    return authUrl.toString();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASO 2 — Recibe el código de autorización e inicia el intercambio
  // ══════════════════════════════════════════════════════════════════════════
  async handleCallback(code: string): Promise<void> {
    if (!code) throw new BadRequestException('No code provided');
    await this.exchangeCodeForToken(code);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASO 3 — Intercambia el código por tokens y guarda en BD
  // ══════════════════════════════════════════════════════════════════════════
  private async exchangeCodeForToken(code: string): Promise<void> {
    this.logger.log(`Intercambiando código OAuth — redirect_uri: ${this.REDIRECT_URL}, client_id: ${this.CLIENT_ID}`);

    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      user_type: 'Company',
      redirect_uri: this.REDIRECT_URL,
    });

    let data: any;
    try {
      const response = await axios.post(`${this.BASE_URL}/oauth/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });
      data = response.data;
    } catch (err) {
      this.logger.error(`GHL 401 body: ${JSON.stringify(err?.response?.data)} | status: ${err?.response?.status}`);
      throw err;
    }

    const { access_token, refresh_token, expires_in, scope, companyId } = data;

    const tokenExpiry = new Date();
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expires_in);

    this.tokenCache.set(companyId, access_token);
    this.invalidCompanies.delete(companyId);

    // Obtener nombre de la empresa (opcional — necesita companies.readonly)
    let companyName = companyId;
    try {
      const companyData = await this.getCompany(companyId, access_token);
      companyName = companyData.company?.name || companyId;
    } catch (err) {
      this.logger.warn(`No se pudo obtener nombre de empresa (¿falta companies.readonly?): ${JSON.stringify(err?.response?.data)}`);
    }

    // Guardar/actualizar company en BD
    await this.companyRepo.upsert(
      {
        companyId,
        companyName,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        scopes: (scope as string).split(' '),
      },
      ['companyId'],
    );

    // Obtener todas las locations y crear tokens por cada una
    const locations = await this.getAllLocations(companyId, access_token);
    let locationCount = 0;

    for (const location of locations) {
      try {
        const locationToken = await this.getLocationToken(
          companyId,
          location.id,
          access_token,
        );

        const locationExpiry = new Date();
        locationExpiry.setSeconds(locationExpiry.getSeconds() + locationToken.expires_in);

        await this.locationRepo.upsert(
          {
            locationId: location.id,
            locationName: location.name,
            companyId,
            accessToken: locationToken.access_token,
            refreshToken: locationToken.refresh_token,
            tokenExpiry: locationExpiry,
            scopes: (locationToken.scope as string).split(' '),
          },
          ['locationId'],
        );
        locationCount++;
      } catch (err) {
        this.logger.warn(
          `No se pudo obtener token para location ${location.id}: ${err?.message}`,
        );
      }
    }

    this.logger.log(
      `✅ OAuth GHL completado — Empresa: ${companyName}, Locations: ${locationCount}/${locations.length}`,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CRON — Verifica y refresca tokens cada hora
  // ══════════════════════════════════════════════════════════════════════════
  @Cron(CronExpression.EVERY_HOUR, { name: 'ghlOAuthRefreshTokens' })
  async checkAndRefreshTokens(): Promise<void> {
    if (!this.CLIENT_ID || !this.CLIENT_SECRET) return;

    const companies = await this.companyRepo.find();
    if (companies.length === 0) return;

    for (const company of companies) {
      // Saltar solo la empresa cuyo refresh falló (no todas)
      if (this.invalidCompanies.has(company.companyId)) {
        this.logger.warn(
          `OAuth inválido para ${company.companyName} — re-autenticación manual requerida vía GET /api/hl/connect`,
        );
        continue;
      }

      // Restaurar cache desde BD
      if (company.accessToken) {
        this.tokenCache.set(company.companyId, company.accessToken);
      }

      const secondsRemaining = Math.floor(
        (new Date(company.tokenExpiry).getTime() - Date.now()) / 1000,
      );

      if (secondsRemaining < 23 * 3600) {
        // Refrescar si quedan menos de 23 horas (tokens GHL duran 24h)
        await this.refreshCompanyToken(company);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Refresca tokens de una empresa y todas sus locations
  // ══════════════════════════════════════════════════════════════════════════
  private async refreshCompanyToken(company: GHLOAuthCompany): Promise<void> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        refresh_token: company.refreshToken,
      });

      const { data } = await axios.post(`${this.BASE_URL}/oauth/token`, params, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, refresh_token: newRefreshToken, expires_in } = data;
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expires_in);

      this.tokenCache.set(company.companyId, access_token);

      await this.companyRepo.update(
        { companyId: company.companyId },
        { accessToken: access_token, refreshToken: newRefreshToken, tokenExpiry },
      );

      // Refrescar tokens de todas las locations de esta empresa
      const locations = await this.locationRepo.find({
        where: { companyId: company.companyId },
      });

      for (const location of locations) {
        try {
          const locationToken = await this.getLocationToken(
            company.companyId,
            location.locationId,
            access_token,
          );
          const locationExpiry = new Date();
          locationExpiry.setSeconds(locationExpiry.getSeconds() + locationToken.expires_in);

          await this.locationRepo.update(
            { locationId: location.locationId },
            {
              accessToken: locationToken.access_token,
              refreshToken: locationToken.refresh_token,
              tokenExpiry: locationExpiry,
            },
          );
        } catch (err) {
          this.logger.warn(
            `Error refrescando token de location ${location.locationId}: ${err?.message}`,
          );
        }
      }

      this.logger.log(`🔄 Tokens refrescados — Empresa: ${company.companyName}`);
    } catch (error) {
      this.handleRefreshError(error, company);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Manejo de error invalid_grant
  // ══════════════════════════════════════════════════════════════════════════
  private handleRefreshError(error: any, company: GHLOAuthCompany): void {
    const errorData = error?.response?.data;

    if (errorData?.error === 'invalid_grant') {
      this.logger.error(
        `❌ REFRESH TOKEN INVÁLIDO para empresa ${company.companyName} — Re-autenticación manual requerida via GET /api/hl/connect`,
      );
      this.invalidCompanies.add(company.companyId);
      this.tokenCache.delete(company.companyId);

      // Limpiar tokens en BD sin borrar el registro
      this.companyRepo.update(
        { companyId: company.companyId },
        { accessToken: '', refreshToken: '' },
      );

      // Notificar caída vía webhook
      this.sendAlertWebhook(company, 'invalid_grant', errorData);
    } else {
      this.logger.error(
        `Error refrescando token empresa ${company.companyName}:`,
        errorData || error?.message,
      );

      // Notificar error de refresh (no invalid_grant) vía webhook
      this.sendAlertWebhook(company, 'refresh_error', errorData || error?.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Webhook de alerta cuando OAuth falla
  // ══════════════════════════════════════════════════════════════════════════
  private async sendAlertWebhook(
    company: GHLOAuthCompany,
    errorType: string,
    errorDetail: any,
  ): Promise<void> {
    try {
      await axios.post(this.ALERT_WEBHOOK_URL, {
        event: 'oauth_token_refresh_failed',
        severity: errorType === 'invalid_grant' ? 'critical' : 'warning',
        source: 'gloory-api-endpoints',
        timestamp: new Date().toISOString(),
        company: {
          id: company.companyId,
          name: company.companyName,
        },
        error: errorType,
        error_detail: typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail),
        message:
          errorType === 'invalid_grant'
            ? `OAuth GHL caído para ${company.companyName}. Reconectar manualmente via /settings/ghl-oauth`
            : `Error refrescando token de ${company.companyName}. Se reintentará en el próximo ciclo.`,
        action_required: errorType === 'invalid_grant' ? 'Reconectar OAuth en /settings/ghl-oauth' : 'Revisar logs del servidor',
      });
      this.logger.log(`🔔 Alerta webhook enviada — ${errorType} para ${company.companyName}`);
    } catch (webhookErr) {
      this.logger.warn(`No se pudo enviar alerta webhook: ${webhookErr?.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // API Helpers
  // ══════════════════════════════════════════════════════════════════════════

  private async getCompany(companyId: string, accessToken: string): Promise<any> {
    const { data } = await axios.get(`${this.BASE_URL}/companies/${companyId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Version: '2021-07-28',
      },
    });
    return data;
  }

  private async getAllLocations(companyId: string, accessToken: string): Promise<any[]> {
    const { data } = await axios.get(
      `${this.BASE_URL}/locations/search?companyId=${companyId}&limit=1000`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Version: '2021-07-28',
        },
      },
    );
    return data.locations || [];
  }

  private async getLocationToken(
    companyId: string,
    locationId: string,
    companyAccessToken: string,
  ): Promise<any> {
    const params = new URLSearchParams({ companyId, locationId });
    const { data } = await axios.post(
      `${this.BASE_URL}/oauth/locationToken`,
      params,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          Version: '2021-07-28',
          Authorization: `Bearer ${companyAccessToken}`,
        },
      },
    );
    return data;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Métodos públicos para uso en GoHighLevelProxyService
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene el access token OAuth para una location específica.
   * Verifica expiración y refresca on-demand si quedan menos de 5 minutos.
   * Usado por GoHighLevelProxyService cuando ghlOAuthMode = true.
   */
  async getLocationAccessToken(locationId: string): Promise<string | null> {
    const location = await this.locationRepo.findOne({ where: { locationId } });
    if (!location?.accessToken) return null;

    const secondsRemaining = Math.floor(
      (new Date(location.tokenExpiry).getTime() - Date.now()) / 1000,
    );

    // Si quedan más de 5 minutos, retornar el token actual
    if (secondsRemaining > 300) {
      return location.accessToken;
    }

    // Token expirado o próximo a expirar — intentar refresh on-demand
    this.logger.warn(
      `Token de location ${locationId} expira en ${secondsRemaining}s — refrescando on-demand`,
    );

    const company = await this.companyRepo.findOne({
      where: { companyId: location.companyId },
    });
    if (!company?.accessToken) {
      this.logger.error(`No hay company token para refrescar location ${locationId}`);
      return location.accessToken; // Retornar el que hay como último recurso
    }

    try {
      const locationToken = await this.getLocationToken(
        company.companyId,
        locationId,
        company.accessToken,
      );
      const locationExpiry = new Date();
      locationExpiry.setSeconds(locationExpiry.getSeconds() + locationToken.expires_in);

      await this.locationRepo.update(
        { locationId },
        {
          accessToken: locationToken.access_token,
          refreshToken: locationToken.refresh_token,
          tokenExpiry: locationExpiry,
        },
      );

      this.logger.log(`🔄 Token de location ${locationId} refrescado on-demand`);
      return locationToken.access_token;
    } catch (err) {
      this.logger.error(`Error refrescando token on-demand para location ${locationId}: ${err?.message}`);
      return location.accessToken; // Retornar el existente como fallback
    }
  }

  /**
   * Elimina todos los tokens OAuth de BD y limpia el cache en memoria.
   */
  async disconnect(): Promise<void> {
    await this.locationRepo.clear();
    await this.companyRepo.clear();
    this.tokenCache.clear();
    this.invalidCompanies.clear();
    this.logger.log('🔌 OAuth GHL desconectado — todos los tokens eliminados');
  }

  /**
   * Retorna true si hay al menos una empresa conectada con token válido.
   */
  async checkOauth(): Promise<{ valid: boolean; companies: number }> {
    const companies = await this.companyRepo.count();
    return {
      valid: companies > 0 && this.invalidCompanies.size === 0,
      companies,
    };
  }

  /**
   * Re-sincroniza locations desde GHL: descubre nuevas sub-cuentas y genera sus tokens.
   * Retorna cuántas locations nuevas se encontraron.
   */
  async syncLocations(): Promise<{ newLocations: number; totalLocations: number }> {
    const companies = await this.companyRepo.find();
    if (companies.length === 0) {
      throw new BadRequestException('No hay empresa OAuth conectada. Conecta primero via GET /api/hl/connect');
    }

    let totalNew = 0;
    let totalLocations = 0;

    for (const company of companies) {
      if (!company.accessToken) continue;

      const remoteLocations = await this.getAllLocations(company.companyId, company.accessToken);
      totalLocations += remoteLocations.length;

      for (const location of remoteLocations) {
        const existing = await this.locationRepo.findOne({
          where: { locationId: location.id },
        });

        if (!existing) {
          try {
            const locationToken = await this.getLocationToken(
              company.companyId,
              location.id,
              company.accessToken,
            );

            const locationExpiry = new Date();
            locationExpiry.setSeconds(locationExpiry.getSeconds() + locationToken.expires_in);

            await this.locationRepo.upsert(
              {
                locationId: location.id,
                locationName: location.name,
                companyId: company.companyId,
                accessToken: locationToken.access_token,
                refreshToken: locationToken.refresh_token,
                tokenExpiry: locationExpiry,
                scopes: (locationToken.scope as string).split(' '),
              },
              ['locationId'],
            );
            totalNew++;
            this.logger.log(`➕ Nueva location sincronizada: ${location.name} (${location.id})`);
          } catch (err) {
            this.logger.warn(
              `No se pudo obtener token para nueva location ${location.id}: ${err?.message}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `🔄 Sincronización completada — ${totalNew} nuevas locations, ${totalLocations} total`,
    );
    return { newLocations: totalNew, totalLocations };
  }

  /**
   * Lista todas las locations OAuth conectadas (para panel admin).
   */
  async getConnectedLocations(): Promise<
    { locationId: string; locationName: string; companyId: string; tokenExpiry: Date }[]
  > {
    const locations = await this.locationRepo.find({
      select: ['locationId', 'locationName', 'companyId', 'tokenExpiry'],
    });
    return locations;
  }

  /**
   * Obtiene los calendarios de una location usando su token OAuth.
   * Útil para preview en el formulario de creación de clientes.
   */
  async getCalendarsForLocation(
    locationId: string,
  ): Promise<{ id: string; name: string; calendarType?: string }[]> {
    const location = await this.locationRepo.findOne({ where: { locationId } });
    if (!location?.accessToken) {
      throw new BadRequestException(
        `No hay token OAuth para la location ${locationId}. Conecta via GET /api/hl/connect`,
      );
    }

    const { data } = await axios.get(`${this.BASE_URL}/calendars/`, {
      params: { locationId },
      headers: {
        Authorization: `Bearer ${location.accessToken}`,
        Version: '2021-07-28',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const calendars = data?.calendars || [];
    return calendars.map((cal: any) => ({
      id: cal.id,
      name: cal.name,
      calendarType: cal.calendarType,
    }));
  }
}

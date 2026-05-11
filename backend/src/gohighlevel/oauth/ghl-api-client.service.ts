import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { GHLOAuthService } from './ghl-oauth.service';

/**
 * Cliente HTTP centralizado para llamadas a GoHighLevel.
 *
 * Para OAuth Marketplace usar `request(locationId, config)`:
 *   - Resuelve el access token de la location vía GHLOAuthService.
 *   - Si la respuesta es 401, mintea un token fresco desde la company y
 *     reintenta UNA VEZ.
 *   - Si el reintento también responde 401, marca la location como
 *     inválida, dispara webhook y lanza UnauthorizedException.
 *   - Maneja 429 con backoff exponencial.
 *
 * Para PIT (Private Integration Token, legacy) usar `requestWithToken(token, config)`:
 *   - Pasa el token tal cual. Sin retry, sin invalidación.
 *
 * Ambos métodos inyectan `Version: 2021-07-28` y `Authorization: Bearer ...`
 * en headers (preservando los que el caller pase explícitamente).
 */
@Injectable()
export class GHLApiClient {
  private readonly logger = new Logger(GHLApiClient.name);
  private readonly BASE_URL = 'https://services.leadconnectorhq.com';
  private readonly MAX_RATE_LIMIT_RETRIES = 3;

  constructor(private readonly ghlOAuthService: GHLOAuthService) {}

  /**
   * Llamada HTTP a GHL usando OAuth Marketplace para una location concreta.
   * Maneja retry on-401 (mint+retry) y 429 (backoff exponencial).
   */
  async request<T = any>(locationId: string, config: AxiosRequestConfig): Promise<T> {
    const token = await this.ghlOAuthService.getLocationAccessToken(locationId);
    if (!token) {
      throw new BadRequestException(
        `No hay token OAuth disponible para location ${locationId}. Reconectar via /settings/ghl-oauth`,
      );
    }

    try {
      return await this.executeWithToken<T>(token, config);
    } catch (error) {
      const status = (error as AxiosError)?.response?.status;

      if (status !== 401) {
        throw error;
      }

      // 401 — intentar mint fresco y reintentar UNA vez.
      this.logger.warn(
        `🔁 401 en ${config.method?.toUpperCase() ?? 'GET'} ${config.url} para location ${locationId} — forzando mint+retry`,
      );

      let freshToken: string;
      try {
        freshToken = await this.ghlOAuthService.forceRefreshLocationToken(locationId);
      } catch (refreshErr) {
        // No pudimos mintear (company inválida, etc.). Marcar location y propagar.
        const reason = `forceRefreshLocationToken falló: ${(refreshErr as Error)?.message}`;
        await this.ghlOAuthService.markLocationInvalid(locationId, reason);
        throw new UnauthorizedException(
          `OAuth de location ${locationId} inválido — reconectar via /settings/ghl-oauth`,
        );
      }

      try {
        return await this.executeWithToken<T>(freshToken, config);
      } catch (retryError) {
        const retryStatus = (retryError as AxiosError)?.response?.status;
        if (retryStatus === 401) {
          // El token recién minteado también dio 401. La location está
          // realmente revocada del lado de GHL.
          await this.ghlOAuthService.markLocationInvalid(
            locationId,
            'Token recién minteado también respondió 401',
          );
          throw new UnauthorizedException(
            `OAuth de location ${locationId} inválido — reconectar via /settings/ghl-oauth`,
          );
        }
        throw retryError;
      }
    }
  }

  /**
   * Llamada HTTP a GHL con un token explícito (PIT o cualquier otro).
   * Sin retry on-401, sin invalidación. Sólo backoff en 429.
   */
  async requestWithToken<T = any>(token: string, config: AxiosRequestConfig): Promise<T> {
    return this.executeWithToken<T>(token, config);
  }

  /**
   * Ejecuta la request con un token dado, aplicando headers estándar y
   * reintentos en 429 con backoff exponencial.
   */
  private async executeWithToken<T>(token: string, config: AxiosRequestConfig): Promise<T> {
    const merged: AxiosRequestConfig = {
      ...config,
      headers: {
        Accept: 'application/json',
        Version: '2021-07-28',
        ...(config.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    };

    if (merged.url && !merged.url.startsWith('http')) {
      merged.url = `${this.BASE_URL}${merged.url.startsWith('/') ? '' : '/'}${merged.url}`;
    }

    let lastError: any;
    for (let attempt = 0; attempt < this.MAX_RATE_LIMIT_RETRIES; attempt++) {
      try {
        const response: AxiosResponse<T> = await axios.request<T>(merged);
        return response.data;
      } catch (error) {
        lastError = error;
        const status = (error as AxiosError)?.response?.status;

        if (status === 429 && attempt < this.MAX_RATE_LIMIT_RETRIES - 1) {
          const waitMs = Math.pow(2, attempt) * 2000;
          this.logger.warn(
            `⚠️ Rate limit (429) en ${merged.method?.toUpperCase() ?? 'GET'} ${merged.url} — reintentando en ${waitMs}ms (intento ${attempt + 1}/${this.MAX_RATE_LIMIT_RETRIES})`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }
}

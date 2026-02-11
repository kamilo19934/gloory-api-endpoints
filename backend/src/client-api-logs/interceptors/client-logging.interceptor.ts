import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ClientApiLogsService } from '../client-api-logs.service';
import { Request, Response } from 'express';

/**
 * Interceptor que registra las peticiones a endpoints de cliente
 * Solo captura rutas que coinciden con /api/clients/:clientId/*
 * Excluye rutas de logs para evitar recursión
 */
@Injectable()
export class ClientLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ClientLoggingInterceptor.name);

  constructor(private readonly logsService: ClientApiLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Extraer información de la ruta
    const { method, path, body, ip, headers } = request;

    // Solo procesar rutas de clientes: /api/clients/:clientId/*
    // Regex para capturar clientId de rutas como /api/clients/uuid/endpoint
    const clientRouteMatch = path.match(/^\/api\/clients\/([a-f0-9-]+)\/(.+)$/i);

    if (!clientRouteMatch) {
      // No es una ruta de cliente, continuar sin logging
      return next.handle();
    }

    const clientId = clientRouteMatch[1];
    const endpoint = clientRouteMatch[2];

    // Excluir rutas que no son "tools" reales:
    // - logs: para evitar recursión infinita
    // - endpoints: es solo para mostrar la lista de endpoints en el panel admin
    const excludedEndpoints = ['logs', 'endpoints'];
    if (excludedEndpoints.some(excluded => endpoint.startsWith(excluded))) {
      return next.handle();
    }

    const startTime = Date.now();
    const userAgent = headers['user-agent'] || null;

    return next.handle().pipe(
      tap((responseBody) => {
        // Éxito: capturar respuesta 2xx
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Solo registrar 2xx, 4xx, 5xx
        if (statusCode >= 200) {
          this.logRequestAsync({
            clientId,
            method,
            endpoint,
            fullPath: path,
            requestBody: this.sanitizeBody(body),
            statusCode,
            responseBody: this.sanitizeBody(responseBody),
            errorMessage: null,
            duration,
            ipAddress: this.getClientIp(request),
            userAgent,
          });
        }
      }),
      catchError((error) => {
        // Error: capturar respuesta 4xx o 5xx
        const duration = Date.now() - startTime;
        const statusCode = error.status || error.statusCode || 500;
        const errorMessage = error.message || 'Unknown error';

        this.logRequestAsync({
          clientId,
          method,
          endpoint,
          fullPath: path,
          requestBody: this.sanitizeBody(body),
          statusCode,
          responseBody: error.response || null,
          errorMessage,
          duration,
          ipAddress: this.getClientIp(request),
          userAgent,
        });

        // Re-lanzar el error para que lo maneje el filter de excepciones
        throw error;
      }),
    );
  }

  /**
   * Registra el log de forma asíncrona (no bloquea la respuesta)
   */
  private logRequestAsync(data: {
    clientId: string;
    method: string;
    endpoint: string;
    fullPath: string;
    requestBody: Record<string, any> | null;
    statusCode: number;
    responseBody: Record<string, any> | null;
    errorMessage: string | null;
    duration: number;
    ipAddress: string | null;
    userAgent: string | null;
  }): void {
    // Ejecutar de forma asíncrona sin bloquear
    setImmediate(async () => {
      try {
        await this.logsService.createLog(data);
      } catch (err) {
        // Solo loggear el error, no fallar la petición
        // Si es AggregateError, mostrar todos los errores internos
        if (err.name === 'AggregateError' && err.errors) {
          this.logger.error(`Error guardando log (AggregateError):`);
          err.errors.forEach((e: Error, i: number) => {
            this.logger.error(`  [${i + 1}] ${e.name}: ${e.message}`);
          });
        } else {
          this.logger.error(`Error guardando log: ${err.message || err}`);
        }

        // Log completo para debugging
        if (process.env.NODE_ENV === 'development') {
          this.logger.debug(`Error stack: ${err.stack}`);
        }
      }
    });
  }

  /**
   * Sanitiza el body removiendo campos sensibles
   */
  private sanitizeBody(body: any): Record<string, any> | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    // Clonar para no modificar el original
    const sanitized = { ...body };

    // Campos sensibles a ocultar
    const sensitiveFields = ['password', 'token', 'accessToken', 'apiKey', 'secret'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Obtiene la IP real del cliente (considerando proxies)
   */
  private getClientIp(request: Request): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
      return ips[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || null;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard para endpoints internos entre servicios de Gloory.
 *
 * Valida el header `X-Gloory-Internal-Token` contra el shared secret
 * `GLOORY_INTERNAL_TOKEN` en env vars. No es auth de usuario — es auth
 * de servicio (server-to-server entre gloory-ai-server y gloory-api-endpoints).
 *
 * Las rutas que usen este guard deben marcarse también como `@Public()`
 * para saltarse el JwtAuthGuard global.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  private readonly logger = new Logger(InternalTokenGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedToken = request.header('x-gloory-internal-token');

    const expectedToken = this.config.get<string>('GLOORY_INTERNAL_TOKEN');

    if (!expectedToken) {
      this.logger.error(
        'GLOORY_INTERNAL_TOKEN no está configurado en el servidor',
      );
      throw new UnauthorizedException('Servicio no configurado correctamente');
    }

    if (!providedToken) {
      throw new UnauthorizedException(
        'Falta header X-Gloory-Internal-Token',
      );
    }

    if (providedToken !== expectedToken) {
      this.logger.warn(
        `Intento de acceso interno con token inválido desde ${request.ip}`,
      );
      throw new UnauthorizedException('Token interno inválido');
    }

    return true;
  }
}

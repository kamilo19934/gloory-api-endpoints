import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { InternalTokenGuard } from '../internal/guards/internal-token.guard';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Endpoint del Tool Registry consumido por gloory-ai-server.
 *
 * Protegido con InternalTokenGuard — solo gloory-ai-server puede llamarlo
 * (no es para clientes finales ni para el swarm directamente).
 */
@Controller('tool-registry')
@Public()
@UseGuards(InternalTokenGuard)
export class ToolRegistryController {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  @Get()
  getRegistry(@Query('platform') platform: string) {
    if (!platform) {
      throw new BadRequestException('Query param "platform" es requerido');
    }
    return this.toolRegistryService.getRegistry(platform);
  }

  @Get('platforms')
  getSupportedPlatforms() {
    return {
      platforms: this.toolRegistryService.getSupportedPlatforms(),
    };
  }
}

import { Module } from '@nestjs/common';
import { ToolRegistryController } from './tool-registry.controller';
import { ToolRegistryService } from './tool-registry.service';
import { InternalTokenGuard } from '../internal/guards/internal-token.guard';

/**
 * Módulo del Tool Registry: expone schemas de tools por plataforma
 * para que gloory-ai-server los consuma y los pase al swarm.
 */
@Module({
  controllers: [ToolRegistryController],
  providers: [ToolRegistryService, InternalTokenGuard],
  exports: [ToolRegistryService],
})
export class ToolRegistryModule {}

import { Module, Global } from '@nestjs/common';
import { IntegrationRegistryService } from './integration-registry.service';
import { IntegrationsController } from './integrations.controller';

@Global()
@Module({
  providers: [IntegrationRegistryService],
  controllers: [IntegrationsController],
  exports: [IntegrationRegistryService],
})
export class IntegrationsModule {}

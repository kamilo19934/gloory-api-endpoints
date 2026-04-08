import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalTokenGuard } from './guards/internal-token.guard';
import { Client } from '../clients/entities/client.entity';
import { ClientIntegration } from '../clients/entities/client-integration.entity';
import { ClientsModule } from '../clients/clients.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { HealthAtomModule } from '../integrations/healthatom/healthatom.module';
import { ReservoModule } from '../integrations/reservo/reservo.module';
import { GoHighLevelModule } from '../integrations/gohighlevel/gohighlevel.module';

/**
 * Módulo para endpoints internos server-to-server entre gloory-ai-server
 * y gloory-api-endpoints. Maneja auto-provisioning de clientes y validación
 * de credenciales antes de persistir.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientIntegration]),
    ClientsModule,
    IntegrationsModule,
    HealthAtomModule,
    ReservoModule,
    GoHighLevelModule,
  ],
  controllers: [InternalController],
  providers: [InternalService, InternalTokenGuard],
})
export class InternalModule {}

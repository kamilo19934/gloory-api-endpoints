import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservoConfirmationsController } from './reservo-confirmations.controller';
import { ReservoConfirmationsService } from './reservo-confirmations.service';
import { ReservoGhlSetupService } from './reservo-ghl-setup.service';
import { ReservoConfirmationConfig } from './entities/reservo-confirmation-config.entity';
import { ReservoPendingConfirmation } from './entities/reservo-pending-confirmation.entity';
import { ClientsModule } from '../clients/clients.module';
import { GHLOAuthModule } from '../gohighlevel/oauth/ghl-oauth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReservoConfirmationConfig, ReservoPendingConfirmation]),
    ClientsModule,
    GHLOAuthModule,
    // ReservoModule is @Global() so no explicit import needed
  ],
  controllers: [ReservoConfirmationsController],
  providers: [
    ReservoConfirmationsService,
    ReservoGhlSetupService,
  ],
  exports: [ReservoConfirmationsService],
})
export class ReservoConfirmationsModule {}

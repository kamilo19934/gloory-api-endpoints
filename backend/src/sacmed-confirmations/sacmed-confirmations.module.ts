import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SacmedConfirmationsController } from './sacmed-confirmations.controller';
import { SacmedConfirmationsService } from './sacmed-confirmations.service';
import { SacmedGhlSetupService } from './sacmed-ghl-setup.service';
import { SacmedConfirmationConfig } from './entities/sacmed-confirmation-config.entity';
import { SacmedPendingConfirmation } from './entities/sacmed-pending-confirmation.entity';
import { ClientsModule } from '../clients/clients.module';
import { GHLOAuthModule } from '../gohighlevel/oauth/ghl-oauth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SacmedConfirmationConfig, SacmedPendingConfirmation]),
    ClientsModule,
    GHLOAuthModule,
    // SacmedModule is @Global() so no explicit import needed
  ],
  controllers: [SacmedConfirmationsController],
  providers: [SacmedConfirmationsService, SacmedGhlSetupService],
  exports: [SacmedConfirmationsService],
})
export class SacmedConfirmationsModule {}

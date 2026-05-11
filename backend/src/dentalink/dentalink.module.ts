import { Module } from '@nestjs/common';
import { DentalinkService } from './dentalink.service';
import { DentalinkController } from './dentalink.controller';
import { GHLService } from './ghl.service';
import { ClientsModule } from '../clients/clients.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { GHLOAuthModule } from '../gohighlevel/oauth/ghl-oauth.module';

@Module({
  imports: [ClientsModule, EndpointsModule, GHLOAuthModule],
  controllers: [DentalinkController],
  providers: [DentalinkService, GHLService],
  exports: [DentalinkService],
})
export class DentalinkModule {}

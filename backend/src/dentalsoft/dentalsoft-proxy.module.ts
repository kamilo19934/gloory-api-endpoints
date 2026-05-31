import { Module } from '@nestjs/common';
import { DentalsoftController } from './dentalsoft.controller';
import { DentalsoftProxyService } from './dentalsoft-proxy.service';
import { ClientsModule } from '../clients/clients.module';
import { DentalinkModule } from '../dentalink/dentalink.module';

@Module({
  imports: [ClientsModule, DentalinkModule], // DentalinkModule expone GHLService para el mirror
  controllers: [DentalsoftController],
  providers: [DentalsoftProxyService],
  exports: [DentalsoftProxyService],
})
export class DentalsoftProxyModule {}

import { Module } from '@nestjs/common';
import { SacmedController } from './sacmed.controller';
import { SacmedProxyService } from './sacmed-proxy.service';
import { ClientsModule } from '../clients/clients.module';
import { DentalinkModule } from '../dentalink/dentalink.module';

@Module({
  imports: [ClientsModule, DentalinkModule],
  controllers: [SacmedController],
  providers: [SacmedProxyService],
  exports: [SacmedProxyService],
})
export class SacmedProxyModule {}

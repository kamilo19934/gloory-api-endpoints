import { Module } from '@nestjs/common';
import { ReservoController } from './reservo.controller';
import { ReservoProxyService } from './reservo-proxy.service';
import { ClientsModule } from '../clients/clients.module';
import { DentalinkModule } from '../dentalink/dentalink.module';

@Module({
  imports: [ClientsModule, DentalinkModule],
  controllers: [ReservoController],
  providers: [ReservoProxyService],
  exports: [ReservoProxyService],
})
export class ReservoProxyModule {}

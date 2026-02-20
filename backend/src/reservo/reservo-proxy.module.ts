import { Module } from '@nestjs/common';
import { ReservoController } from './reservo.controller';
import { ReservoProxyService } from './reservo-proxy.service';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [ClientsModule],
  controllers: [ReservoController],
  providers: [ReservoProxyService],
  exports: [ReservoProxyService],
})
export class ReservoProxyModule {}

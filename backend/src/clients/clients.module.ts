import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Client } from './entities/client.entity';
import { ClientIntegration } from './entities/client-integration.entity';
import { EndpointsModule } from '../endpoints/endpoints.module';

@Module({
  imports: [TypeOrmModule.forFeature([Client, ClientIntegration]), EndpointsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}

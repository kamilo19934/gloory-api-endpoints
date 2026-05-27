import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppAuthState } from './entities/whatsapp-auth-state.entity';
import { WhatsAppGroup } from './entities/whatsapp-group.entity';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { WhatsAppGroupService } from './whatsapp-group.service';
import { WhatsAppMessageService } from './whatsapp-message.service';
import { WhatsAppController } from './whatsapp.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsAppAuthState, WhatsAppGroup]),
    ConfigModule,
    ClientsModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppConnectionService, WhatsAppGroupService, WhatsAppMessageService],
  exports: [WhatsAppConnectionService, WhatsAppGroupService],
})
export class WhatsAppModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppointmentConfirmationsController } from './appointment-confirmations.controller';
import { AppointmentConfirmationsService } from './appointment-confirmations.service';
import { GHLSetupService } from './ghl-setup.service';
import { ConfirmationConfig } from './entities/confirmation-config.entity';
import { PendingConfirmation } from './entities/pending-confirmation.entity';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfirmationConfig, PendingConfirmation]),
    ScheduleModule.forRoot(),
    ClientsModule,
  ],
  controllers: [AppointmentConfirmationsController],
  providers: [AppointmentConfirmationsService, GHLSetupService],
  exports: [AppointmentConfirmationsService, GHLSetupService],
})
export class AppointmentConfirmationsModule {}

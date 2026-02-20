import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppointmentConfirmationsController } from './appointment-confirmations.controller';
import { AppointmentConfirmationsService } from './appointment-confirmations.service';
import { GHLSetupService } from './ghl-setup.service';
import { ConfirmationConfig } from './entities/confirmation-config.entity';
import { PendingConfirmation } from './entities/pending-confirmation.entity';
import { ClientsModule } from '../clients/clients.module';
import { HealthAtomModule } from '../integrations/healthatom/healthatom.module';
import { DentalinkConfirmationAdapter } from './adapters/dentalink-confirmation.adapter';
import { ReservoConfirmationAdapter } from './adapters/reservo-confirmation.adapter';
import { ConfirmationAdapterFactory } from './adapters/confirmation-adapter.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfirmationConfig, PendingConfirmation]),
    ScheduleModule.forRoot(),
    ClientsModule,
    HealthAtomModule,
    // ReservoModule is @Global() so no explicit import needed
  ],
  controllers: [AppointmentConfirmationsController],
  providers: [
    AppointmentConfirmationsService,
    GHLSetupService,
    DentalinkConfirmationAdapter,
    ReservoConfirmationAdapter,
    ConfirmationAdapterFactory,
  ],
  exports: [AppointmentConfirmationsService, GHLSetupService],
})
export class AppointmentConfirmationsModule {}

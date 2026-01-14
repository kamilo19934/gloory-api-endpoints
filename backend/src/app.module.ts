import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from './clients/clients.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { DentalinkModule } from './dentalink/dentalink.module';
import { ClinicModule } from './clinic/clinic.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthAtomModule } from './integrations/healthatom/healthatom.module';
import { AppointmentConfirmationsModule } from './appointment-confirmations/appointment-confirmations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './database.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Set to false in production
      logging: false,
    }),
    IntegrationsModule, // Global module for integration registry
    HealthAtomModule, // Unified HealthAtom service (Dentalink + MediLink)
    ClientsModule,
    EndpointsModule,
    DentalinkModule,
    ClinicModule,
    AppointmentConfirmationsModule,
  ],
})
export class AppModule {}

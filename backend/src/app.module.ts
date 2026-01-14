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
      type: (process.env.DATABASE_TYPE || 'sqlite') as any,
      ...(process.env.DATABASE_TYPE === 'postgres'
        ? {
            // PostgreSQL configuration
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            username: process.env.DATABASE_USERNAME,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            // O usar DATABASE_URL si está disponible (Railway/Render)
            ...(process.env.DATABASE_URL && {
              url: process.env.DATABASE_URL,
            }),
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
          }
        : {
            // SQLite configuration (desarrollo)
            database: process.env.DATABASE_PATH || './database.sqlite',
          }),
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production', // false en producción
      logging: process.env.NODE_ENV === 'development',
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

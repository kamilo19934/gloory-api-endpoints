import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseType = configService.get('DATABASE_TYPE', 'sqlite');
        const isPostgres = databaseType === 'postgres';

        if (isPostgres) {
          // PostgreSQL configuration
          const config: any = {
            type: 'postgres',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: configService.get('NODE_ENV') !== 'production',
            logging: configService.get('NODE_ENV') === 'development',
          };

          // Si hay DATABASE_URL, usarla (Railway/Render)
          const databaseUrl = configService.get('DATABASE_URL');
          if (databaseUrl) {
            config.url = databaseUrl;
          } else {
            // Configuración manual
            config.host = configService.get('DATABASE_HOST');
            config.port = parseInt(configService.get('DATABASE_PORT', '5432'));
            config.username = configService.get('DATABASE_USERNAME');
            config.password = configService.get('DATABASE_PASSWORD');
            config.database = configService.get('DATABASE_NAME');
          }

          // SSL configuration
          if (configService.get('DATABASE_SSL') === 'true') {
            config.ssl = { rejectUnauthorized: false };
          }

          return config;
        } else {
          // SQLite configuration (desarrollo)
          return {
            type: 'sqlite',
            database: configService.get('DATABASE_PATH', './database.sqlite'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: configService.get('NODE_ENV') !== 'production',
            logging: configService.get('NODE_ENV') === 'development',
          };
        }
      },
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

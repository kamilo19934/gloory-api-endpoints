import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule } from './clients/clients.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { DentalinkModule } from './dentalink/dentalink.module';
import { ClinicModule } from './clinic/clinic.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthAtomModule } from './integrations/healthatom/healthatom.module';
import { AppointmentConfirmationsModule } from './appointment-confirmations/appointment-confirmations.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ClientApiLogsModule } from './client-api-logs/client-api-logs.module';
import { ClientLoggingInterceptor } from './client-api-logs/interceptors/client-logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseType = configService.get('DATABASE_TYPE', 'postgres');
        const isPostgres = databaseType === 'postgres';

        if (isPostgres) {
          // PostgreSQL configuration
          // DB_SYNC=true permite crear tablas en producción (usar solo la primera vez)
          const shouldSync = configService.get('DB_SYNC') === 'true' || configService.get('NODE_ENV') !== 'production';
          
          const config: any = {
            type: 'postgres',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: shouldSync,
            logging: configService.get('NODE_ENV') === 'development',
          };
          
          console.log(`📦 PostgreSQL - Synchronize: ${shouldSync}`);

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
    // Auth modules
    AuthModule,
    UsersModule,
    // Application modules
    IntegrationsModule, // Global module for integration registry
    HealthAtomModule, // Unified HealthAtom service (Dentalink + MediLink)
    ClientsModule,
    EndpointsModule,
    DentalinkModule,
    ClinicModule,
    AppointmentConfirmationsModule,
    ClientApiLogsModule, // API Logs module (with cron cleanup)
  ],
  providers: [
    // Aplicar JwtAuthGuard globalmente
    // Todas las rutas requieren autenticación excepto las marcadas con @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Interceptor global para logging de peticiones a endpoints de cliente
    {
      provide: APP_INTERCEPTOR,
      useClass: ClientLoggingInterceptor,
    },
  ],
})
export class AppModule {}

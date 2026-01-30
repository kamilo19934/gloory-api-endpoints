import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientApiLog } from './entities/client-api-log.entity';
import { ClientApiLogsService } from './client-api-logs.service';
import { ClientApiLogsController } from './client-api-logs.controller';
import { ClientLoggingInterceptor } from './interceptors/client-logging.interceptor';

@Global() // Hacer global para que el interceptor pueda acceder al servicio
@Module({
  imports: [
    TypeOrmModule.forFeature([ClientApiLog]),
    ScheduleModule.forRoot(), // Para el cron de limpieza
  ],
  controllers: [ClientApiLogsController],
  providers: [ClientApiLogsService, ClientLoggingInterceptor],
  exports: [ClientApiLogsService, ClientLoggingInterceptor],
})
export class ClientApiLogsModule {}

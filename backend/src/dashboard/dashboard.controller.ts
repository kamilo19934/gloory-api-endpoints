import { Controller, Get } from '@nestjs/common';
import { ClientApiLogsService } from '../client-api-logs/client-api-logs.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly logsService: ClientApiLogsService) {}

  @Get('stats')
  async getStats() {
    return this.logsService.getDashboardStats();
  }
}

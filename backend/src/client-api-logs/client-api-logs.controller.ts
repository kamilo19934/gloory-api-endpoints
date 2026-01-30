import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ClientApiLogsService } from './client-api-logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';

@Controller('clients/:clientId/logs')
export class ClientApiLogsController {
  constructor(private readonly logsService: ClientApiLogsService) {}

  /**
   * GET /api/clients/:clientId/logs
   * Obtiene los logs de un cliente con paginación y filtros
   */
  @Get()
  async getLogs(
    @Param('clientId') clientId: string,
    @Query() query: QueryLogsDto,
  ) {
    const result = await this.logsService.findLogs(clientId, query);

    return {
      data: result.logs,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  /**
   * GET /api/clients/:clientId/logs/stats
   * Obtiene estadísticas de logs del cliente
   */
  @Get('stats')
  async getStats(@Param('clientId') clientId: string) {
    return this.logsService.getStats(clientId);
  }

  /**
   * GET /api/clients/:clientId/logs/endpoints
   * Obtiene la lista de endpoints únicos (para el filtro)
   */
  @Get('endpoints')
  async getEndpoints(@Param('clientId') clientId: string) {
    const endpoints = await this.logsService.getUniqueEndpoints(clientId);
    return { endpoints };
  }

  /**
   * GET /api/clients/:clientId/logs/:logId
   * Obtiene el detalle de un log específico
   */
  @Get(':logId')
  async getLogDetail(
    @Param('clientId') clientId: string,
    @Param('logId') logId: string,
  ) {
    const log = await this.logsService.findOne(clientId, logId);

    if (!log) {
      throw new NotFoundException('Log no encontrado');
    }

    return log;
  }

  /**
   * DELETE /api/clients/:clientId/logs
   * Elimina todos los logs del cliente (admin only)
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteLogs(@Param('clientId') clientId: string) {
    const deleted = await this.logsService.deleteAllLogs(clientId);

    return {
      message: `${deleted} logs eliminados`,
      deleted,
    };
  }
}

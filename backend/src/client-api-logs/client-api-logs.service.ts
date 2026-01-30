import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientApiLog, StatusCategory } from './entities/client-api-log.entity';
import { QueryLogsDto, LogStatsDto } from './dto/query-logs.dto';

export interface CreateLogDto {
  clientId: string;
  method: string;
  endpoint: string;
  fullPath: string;
  requestBody?: Record<string, any> | null;
  statusCode: number;
  responseBody?: Record<string, any> | null;
  errorMessage?: string | null;
  duration: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ClientApiLogsService {
  private readonly logger = new Logger(ClientApiLogsService.name);

  constructor(
    @InjectRepository(ClientApiLog)
    private readonly logsRepository: Repository<ClientApiLog>,
  ) {}

  /**
   * Crea un nuevo log de API (llamado asíncronamente desde el interceptor)
   */
  async createLog(data: CreateLogDto): Promise<ClientApiLog> {
    const log = this.logsRepository.create({
      ...data,
      statusCategory: ClientApiLog.getStatusCategory(data.statusCode),
      // Limitar el tamaño del responseBody a 10KB aproximadamente
      responseBody: this.truncateJson(data.responseBody, 10000),
      requestBody: this.truncateJson(data.requestBody, 10000),
    });

    return this.logsRepository.save(log);
  }

  /**
   * Obtiene los logs de un cliente con filtros y paginación
   */
  async findLogs(
    clientId: string,
    query: QueryLogsDto,
  ): Promise<{ logs: ClientApiLog[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 50;

    const qb = this.logsRepository
      .createQueryBuilder('log')
      .where('log.clientId = :clientId', { clientId });

    // Búsqueda en requestBody, responseBody, errorMessage
    if (query.search && query.search.length >= 2) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(CAST(log.requestBody AS TEXT)) LIKE :search 
          OR LOWER(CAST(log.responseBody AS TEXT)) LIKE :search 
          OR LOWER(log.errorMessage) LIKE :search)`,
        { search: searchTerm },
      );
    }

    // Filtro por categoría de status
    if (query.status) {
      qb.andWhere('log.statusCategory = :status', { status: query.status });
    }

    // Filtro por endpoint
    if (query.endpoint) {
      qb.andWhere('log.endpoint LIKE :endpoint', {
        endpoint: `%${query.endpoint}%`,
      });
    }

    const [logs, total] = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { logs, total, page, limit };
  }

  /**
   * Obtiene un log específico por ID
   */
  async findOne(clientId: string, logId: string): Promise<ClientApiLog | null> {
    return this.logsRepository.findOne({
      where: { id: logId, clientId },
    });
  }

  /**
   * Obtiene estadísticas de logs para un cliente
   */
  async getStats(clientId: string): Promise<LogStatsDto> {
    const stats = await this.logsRepository
      .createQueryBuilder('log')
      .select('log.statusCategory', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('log.clientId = :clientId', { clientId })
      .groupBy('log.statusCategory')
      .getRawMany();

    const result: LogStatsDto = {
      total: 0,
      success: 0,
      clientError: 0,
      serverError: 0,
      successPercentage: 0,
      clientErrorPercentage: 0,
      serverErrorPercentage: 0,
    };

    for (const stat of stats) {
      const count = parseInt(stat.count, 10);
      result.total += count;

      switch (stat.category) {
        case '2xx':
          result.success = count;
          break;
        case '4xx':
          result.clientError = count;
          break;
        case '5xx':
          result.serverError = count;
          break;
      }
    }

    if (result.total > 0) {
      result.successPercentage = Math.round((result.success / result.total) * 100);
      result.clientErrorPercentage = Math.round((result.clientError / result.total) * 100);
      result.serverErrorPercentage = Math.round((result.serverError / result.total) * 100);
    }

    return result;
  }

  /**
   * Obtiene los endpoints únicos de un cliente (para el filtro)
   */
  async getUniqueEndpoints(clientId: string): Promise<string[]> {
    const results = await this.logsRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.endpoint', 'endpoint')
      .where('log.clientId = :clientId', { clientId })
      .orderBy('log.endpoint', 'ASC')
      .getRawMany();

    return results.map((r) => r.endpoint);
  }

  /**
   * Elimina todos los logs de un cliente
   */
  async deleteAllLogs(clientId: string): Promise<number> {
    const result = await this.logsRepository.delete({ clientId });
    return result.affected || 0;
  }

  /**
   * Cron job: Limpieza de logs antiguos (más de 30 días)
   * Se ejecuta todos los días a las 3:00 AM
   */
  @Cron('0 3 * * *')
  async cleanupOldLogs(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.logger.log('🧹 Iniciando limpieza de logs antiguos (>30 días)...');

    const result = await this.logsRepository.delete({
      createdAt: LessThan(thirtyDaysAgo),
    });

    const deleted = result.affected || 0;
    this.logger.log(`✅ Limpieza completada: ${deleted} logs eliminados`);
  }

  /**
   * Limita el tamaño de un objeto JSON
   */
  private truncateJson(
    obj: Record<string, any> | null | undefined,
    maxLength: number,
  ): Record<string, any> | null {
    if (!obj) return null;

    const str = JSON.stringify(obj);
    if (str.length <= maxLength) return obj;

    // Si es muy grande, devolver un resumen
    return {
      _truncated: true,
      _originalSize: str.length,
      _message: 'Response too large, truncated for storage',
    };
  }
}

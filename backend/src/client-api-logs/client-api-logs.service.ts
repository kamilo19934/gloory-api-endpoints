import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientApiLog, StatusCategory } from './entities/client-api-log.entity';
import { Client } from '../clients/entities/client.entity';
import { QueryLogsDto, LogStatsDto } from './dto/query-logs.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';

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
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  /**
   * Crea un nuevo log de API (llamado asíncronamente desde el interceptor)
   * Incluye retry logic para manejar errores temporales de BD
   */
  async createLog(data: CreateLogDto): Promise<ClientApiLog> {
    const log = this.logsRepository.create({
      ...data,
      statusCategory: ClientApiLog.getStatusCategory(data.statusCode),
      // Limitar el tamaño del responseBody a 10KB aproximadamente
      responseBody: this.truncateJson(data.responseBody, 10000),
      requestBody: this.truncateJson(data.requestBody, 10000),
    });

    // Retry logic: intentar hasta 3 veces con delays exponenciales
    return this.retryOperation(() => this.logsRepository.save(log), 3);
  }

  /**
   * Ejecuta una operación con retry logic
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    currentAttempt: number = 1,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (currentAttempt >= maxRetries) {
        // No more retries, throw error
        throw error;
      }

      // Calcular delay exponencial: 100ms, 200ms, 400ms...
      const delay = 100 * Math.pow(2, currentAttempt - 1);

      this.logger.warn(
        `⚠️  Intento ${currentAttempt}/${maxRetries} falló, reintentando en ${delay}ms...`,
      );

      // Esperar antes de reintentar
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Reintentar
      return this.retryOperation(operation, maxRetries, currentAttempt + 1);
    }
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
   * Obtiene estadísticas globales para el dashboard de monitoreo
   */
  async getDashboardStats(): Promise<DashboardStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      statusCounts,
      avgDuration,
      topEndpoints,
      topClients,
      recentErrors,
      connectedClients,
      totalClients,
    ] = await Promise.all([
      // 1. Conteo por statusCategory del día
      this.logsRepository
        .createQueryBuilder('log')
        .select('log.statusCategory', 'category')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :today', { today })
        .groupBy('log.statusCategory')
        .getRawMany(),

      // 2. Tiempo promedio de respuesta del día
      this.logsRepository
        .createQueryBuilder('log')
        .select('AVG(log.duration)', 'avg')
        .where('log.createdAt >= :today', { today })
        .getRawOne(),

      // 3. Top 5 endpoints del día
      this.logsRepository
        .createQueryBuilder('log')
        .select('log.endpoint', 'endpoint')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :today', { today })
        .groupBy('log.endpoint')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),

      // 4. Top 5 clientes más activos del día
      this.logsRepository
        .createQueryBuilder('log')
        .select('log.clientId', 'clientId')
        .addSelect('client.name', 'clientName')
        .addSelect('COUNT(*)', 'count')
        .leftJoin('log.client', 'client')
        .where('log.createdAt >= :today', { today })
        .groupBy('log.clientId')
        .addGroupBy('client.name')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),

      // 5. Últimos 20 errores con nombre de cliente
      this.logsRepository
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.client', 'client')
        .where('log.statusCategory IN (:...categories)', {
          categories: ['4xx', '5xx'],
        })
        .orderBy('log.createdAt', 'DESC')
        .take(20)
        .getMany(),

      // 6. Clientes conectados (activos con al menos 1 integración habilitada)
      this.clientRepository
        .createQueryBuilder('client')
        .innerJoin(
          'client.integrations',
          'integration',
          'integration.isEnabled = :enabled',
          { enabled: true },
        )
        .where('client.isActive = :active', { active: true })
        .getCount(),

      // 7. Total de clientes
      this.clientRepository.createQueryBuilder('client').getCount(),
    ]);

    // Parsear conteos por status
    let totalToday = 0;
    let successToday = 0;
    let clientErrorToday = 0;
    let serverErrorToday = 0;

    for (const row of statusCounts) {
      const count = parseInt(row.count, 10);
      totalToday += count;
      if (row.category === '2xx') successToday = count;
      else if (row.category === '4xx') clientErrorToday = count;
      else if (row.category === '5xx') serverErrorToday = count;
    }

    return {
      connectedClients,
      totalClients,
      totalToday,
      successToday,
      clientErrorToday,
      serverErrorToday,
      successRate:
        totalToday > 0
          ? Math.round((successToday / totalToday) * 100)
          : 0,
      avgResponseTime: Math.round(parseFloat(avgDuration?.avg || '0')),
      topEndpoints: topEndpoints.map((r) => ({
        endpoint: r.endpoint,
        count: parseInt(r.count, 10),
      })),
      topClients: topClients.map((r) => ({
        clientId: r.clientId,
        clientName: r.clientName,
        count: parseInt(r.count, 10),
      })),
      recentErrors: recentErrors.map((log) => ({
        id: log.id,
        clientId: log.clientId,
        clientName: log.client?.name || 'Desconocido',
        method: log.method,
        endpoint: log.endpoint,
        statusCode: log.statusCode,
        statusCategory: log.statusCategory,
        errorMessage: log.errorMessage,
        duration: log.duration,
        createdAt: log.createdAt,
      })),
    };
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

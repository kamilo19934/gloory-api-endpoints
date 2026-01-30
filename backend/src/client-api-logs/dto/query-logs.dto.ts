import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLogsDto {
  /**
   * Búsqueda de texto libre en requestBody, responseBody, errorMessage
   */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Filtro por categoría de status: 2xx, 4xx, 5xx
   */
  @IsOptional()
  @IsIn(['2xx', '4xx', '5xx'])
  status?: '2xx' | '4xx' | '5xx';

  /**
   * Filtro por endpoint específico (ej: "appointments", "patients")
   */
  @IsOptional()
  @IsString()
  endpoint?: string;

  /**
   * Número de página (1-based)
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Items por página (máximo 100)
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class LogStatsDto {
  total: number;
  success: number; // 2xx
  clientError: number; // 4xx
  serverError: number; // 5xx
  successPercentage: number;
  clientErrorPercentage: number;
  serverErrorPercentage: number;
}

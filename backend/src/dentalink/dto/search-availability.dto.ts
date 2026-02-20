import { IsArray, IsInt, IsOptional, IsString, Matches, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchAvailabilityDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Se requiere al menos un ID de profesional' })
  @IsInt({ each: true })
  @Type(() => Number)
  ids_profesionales: number[];

  @IsInt()
  @Type(() => Number)
  id_sucursal: number;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha debe ser YYYY-MM-DD' })
  fecha_inicio?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  tiempo_cita?: number; // Minutos requeridos para la cita
}

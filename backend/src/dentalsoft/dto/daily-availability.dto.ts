import { IsNumber, IsOptional, IsString, IsNotEmpty, Matches, Min } from 'class-validator';

export class DentalsoftDailyAvailabilityDto {
  @IsNumber()
  @IsNotEmpty({ message: 'id_profesional es requerido' })
  id_profesional: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha: string;

  @IsNumber()
  @IsNotEmpty({ message: 'id_sucursal es requerido' })
  id_sucursal: number;

  /**
   * Si se omite, el proxy usa la duración mínima de la clínica (1 bloque de agenda).
   */
  @IsNumber()
  @Min(5, { message: 'duracion_minutos mínima es 5' })
  @IsOptional()
  duracion_minutos?: number;
}

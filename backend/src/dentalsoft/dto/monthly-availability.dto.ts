import { IsNumber, IsNotEmpty, IsOptional, Min, Max } from 'class-validator';

export class DentalsoftMonthlyAvailabilityDto {
  @IsNumber()
  @IsNotEmpty({ message: 'id_profesional es requerido' })
  id_profesional: number;

  @IsNumber()
  @Min(2000)
  year: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

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

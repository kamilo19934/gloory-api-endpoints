import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsArray,
  IsOptional,
  ArrayNotEmpty,
  Min,
} from 'class-validator';

export class SacmedSearchAvailabilityDto {
  @IsString()
  @IsNotEmpty({ message: 'La fecha es requerida (ISO8601 o YYYY-MM-DD)' })
  fecha: string;

  @IsInt({ message: 'id_especialidad debe ser un entero' })
  id_especialidad: number;

  @IsArray({ message: 'id_profesionales debe ser un array de UUIDs' })
  @ArrayNotEmpty({ message: 'id_profesionales no puede estar vacío' })
  @IsString({ each: true })
  id_profesionales: string[];

  @IsOptional()
  @IsInt({ message: 'id_servicio debe ser un entero' })
  id_servicio?: number;

  /**
   * Duración custom del bloque en minutos (ej: 90 para un tratamiento definido).
   * Si se omite, Sacmed usa la duración por defecto de la especialidad.
   */
  @IsOptional()
  @IsInt({ message: 'duracion_minutos debe ser un entero' })
  @Min(1, { message: 'duracion_minutos debe ser mayor a 0' })
  duracion_minutos?: number;
}

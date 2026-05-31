import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class DentalsoftSearchAvailabilityDto {
  /**
   * Uno o varios IDs de profesional. Acepta `123` o `[123, 456]`. Cuando se
   * pasan varios, el proxy busca la primera semana donde al menos uno de ellos
   * tenga disponibilidad.
   */
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value === undefined ? [] : [value],
  )
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe pasar al menos un id_profesional' })
  @IsInt({ each: true })
  id_profesional: number[];

  @IsInt()
  @IsNotEmpty({ message: 'id_sucursal es requerido' })
  id_sucursal: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha_inicio debe ser YYYY-MM-DD' })
  fecha_inicio: string;

  /**
   * Si se omite, el proxy usa la duración mínima de la clínica (1 bloque de agenda).
   * El response indica con `default_aplicado: true` cuando se usó el default.
   */
  @IsInt()
  @Min(5, { message: 'duracion_minutos mínima es 5' })
  @IsOptional()
  duracion_minutos?: number;
}

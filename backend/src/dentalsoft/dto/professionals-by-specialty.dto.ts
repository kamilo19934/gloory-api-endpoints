import { IsNotEmpty, IsString } from 'class-validator';

export class DentalsoftProfessionalsBySpecialtyDto {
  /**
   * Especialidad a filtrar — match parcial case-insensitive contra
   * `nombre_especialidad`. El filtro se aplica en el proxy porque la API
   * de Dentalsoft no acepta filtros server-side.
   */
  @IsString()
  @IsNotEmpty({ message: 'La especialidad es requerida' })
  especialidad: string;
}

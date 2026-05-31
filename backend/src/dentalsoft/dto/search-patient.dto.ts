import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class DentalsoftSearchPatientDto {
  @IsString()
  @IsNotEmpty({ message: 'La cédula es requerida' })
  cedula: string;

  /** Default: 'rut'. Solo pasar 'dni' explícitamente si la clínica usa DNI extranjeros. */
  @IsString()
  @IsOptional()
  @IsIn(['rut', 'dni'], { message: 'tipo_cedula_texto debe ser "rut" o "dni"' })
  tipo_cedula_texto?: 'rut' | 'dni';
}

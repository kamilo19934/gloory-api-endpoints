import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, IsEmail } from 'class-validator';

export class DentalsoftCreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'La cédula es requerida' })
  cedula: string;

  @IsString()
  @IsIn(['rut', 'dni'], { message: 'tipo_cedula_texto debe ser "rut" o "dni"' })
  tipo_cedula_texto: 'rut' | 'dni';

  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido paterno es requerido' })
  apellido_paterno: string;

  @IsString()
  @IsOptional()
  apellido_materno?: string;

  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El celular es requerido' })
  celular: string;

  @IsNumber()
  @IsOptional()
  id_referencia?: number;
}

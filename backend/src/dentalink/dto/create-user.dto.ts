import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsEmail({}, { message: 'Email debe ser válido' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de nacimiento debe ser YYYY-MM-DD' })
  fecha_nacimiento?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  id_sucursal?: number;
}

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
  @IsOptional()
  rut?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?\d[\d\s\-]{6,15}$/, {
    message: 'Teléfono debe contener entre 7 y 16 dígitos',
  })
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

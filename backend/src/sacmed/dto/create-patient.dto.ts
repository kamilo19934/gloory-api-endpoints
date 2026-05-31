import { IsString, IsNotEmpty, IsInt, Matches } from 'class-validator';

export class SacmedCreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido paterno es requerido' })
  apellido_paterno: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido materno es requerido' })
  apellido_materno: string;

  @IsString()
  @IsNotEmpty({ message: 'El rut es requerido' })
  rut: string;

  @IsInt({ message: 'La nacionalidad debe ser un entero (1 = Chilena)' })
  nacionalidad: number;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  telefono: string;

  @IsString()
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}/, { message: 'fecha_nacimiento debe ser YYYY-MM-DD' })
  fecha_nacimiento: string;

  @IsInt({ message: 'La comuna debe ser un ID entero (districtId)' })
  comuna: number;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es requerida' })
  direccion: string;
}

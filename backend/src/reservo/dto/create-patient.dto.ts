import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class ReservoCreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'El identificador (RUT) es requerido' })
  identificador: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  apellido: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  telefono: string;

  @IsString()
  @IsOptional()
  mail?: string;

  /** 0 = No especifica, 1 = Masculino, 2 = Femenino */
  @IsNumber()
  @IsOptional()
  sexo?: number;

  @IsString()
  @IsOptional()
  fecha_nacimiento?: string;
}

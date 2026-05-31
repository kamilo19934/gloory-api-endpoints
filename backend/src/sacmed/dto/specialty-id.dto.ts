import { IsInt, IsNotEmpty } from 'class-validator';

export class SacmedSpecialtyIdDto {
  @IsInt({ message: 'id_especialidad debe ser un entero' })
  @IsNotEmpty({ message: 'id_especialidad es requerido' })
  id_especialidad: number;
}

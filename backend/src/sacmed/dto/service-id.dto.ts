import { IsInt, IsNotEmpty } from 'class-validator';

export class SacmedServiceIdDto {
  @IsInt({ message: 'id_servicio debe ser un entero' })
  @IsNotEmpty({ message: 'id_servicio es requerido' })
  id_servicio: number;
}

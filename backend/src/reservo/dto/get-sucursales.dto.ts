import { IsNumber, IsNotEmpty } from 'class-validator';

export class ReservoGetSucursalesDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El ID de la agenda es requerido' })
  agenda_id: number;
}

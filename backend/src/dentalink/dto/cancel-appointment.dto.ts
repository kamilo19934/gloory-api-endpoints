import { IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CancelAppointmentDto {
  @IsInt()
  @IsNotEmpty({ message: 'El ID de la cita es requerido' })
  @Type(() => Number)
  id_cita: number;
}

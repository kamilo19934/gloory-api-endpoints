import { IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmAppointmentDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  id_cita: number;
}

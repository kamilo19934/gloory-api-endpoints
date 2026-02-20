import { IsString, IsNotEmpty } from 'class-validator';

export class ReservoCancelAppointmentDto {
  @IsString()
  @IsNotEmpty({ message: 'El UUID de la cita es requerido' })
  id_cita: string;
}

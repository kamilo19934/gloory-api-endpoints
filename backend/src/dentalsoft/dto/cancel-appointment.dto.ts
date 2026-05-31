import { IsNumber, IsNotEmpty } from 'class-validator';

export class DentalsoftCancelAppointmentDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El id de la cita es requerido' })
  id: number;
}

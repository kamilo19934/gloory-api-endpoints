import { IsNumber, IsNotEmpty } from 'class-validator';

export class DentalsoftConfirmAppointmentDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El id de la cita es requerido' })
  id: number;
}

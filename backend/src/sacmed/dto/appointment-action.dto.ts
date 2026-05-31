import { IsInt, IsNotEmpty } from 'class-validator';

export class SacmedAppointmentActionDto {
  @IsInt({ message: 'El id_cita debe ser un entero' })
  @IsNotEmpty({ message: 'El id_cita es requerido' })
  id_cita: number;
}

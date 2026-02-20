import { IsString, IsNotEmpty } from 'class-validator';

export class ReservoGetAppointmentsDto {
  @IsString()
  @IsNotEmpty({ message: 'El UUID del paciente es requerido' })
  id_paciente: string;
}

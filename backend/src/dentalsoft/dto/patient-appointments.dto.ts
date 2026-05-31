import { IsNumber } from 'class-validator';

export class DentalsoftPatientAppointmentsDto {
  @IsNumber()
  id_paciente: number;
}

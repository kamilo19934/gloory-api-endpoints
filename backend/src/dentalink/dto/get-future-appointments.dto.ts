import { IsString } from 'class-validator';

export class GetFutureAppointmentsDto {
  @IsString()
  rut: string;
}

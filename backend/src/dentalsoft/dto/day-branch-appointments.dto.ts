import { IsNumber, IsString, Matches } from 'class-validator';

export class DentalsoftDayBranchAppointmentsDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha: string;

  @IsNumber()
  id_sucursal: number;
}

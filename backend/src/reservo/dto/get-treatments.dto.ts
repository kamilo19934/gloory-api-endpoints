import { IsNumber, IsNotEmpty } from 'class-validator';

export class ReservoGetTreatmentsDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El ID de la agenda es requerido' })
  agenda_id: number;
}

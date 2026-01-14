import { IsString, IsNotEmpty } from 'class-validator';

export class GetTreatmentsDto {
  @IsString()
  @IsNotEmpty()
  rut: string;
}


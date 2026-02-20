import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ReservoGetProfessionalsDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El ID de la agenda es requerido' })
  agenda_id: number;

  @IsString()
  @IsOptional()
  uuid_tratamiento?: string;
}

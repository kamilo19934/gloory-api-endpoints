import { IsString, IsNotEmpty } from 'class-validator';

export class SearchPatientDto {
  @IsString()
  @IsNotEmpty({ message: 'El identificador del paciente es requerido' })
  identificador: string;
}

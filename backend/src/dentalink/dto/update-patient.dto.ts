import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdatePatientDto {
  @IsInt()
  id_paciente: number;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellidos?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  celular?: string;
}

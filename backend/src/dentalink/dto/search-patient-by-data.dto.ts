import { IsString, IsOptional } from 'class-validator';

export class SearchPatientByDataDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  correo?: string;
}

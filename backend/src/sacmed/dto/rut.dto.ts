import { IsString, IsNotEmpty } from 'class-validator';

export class SacmedRutDto {
  @IsString()
  @IsNotEmpty({ message: 'El rut es requerido' })
  rut: string;
}

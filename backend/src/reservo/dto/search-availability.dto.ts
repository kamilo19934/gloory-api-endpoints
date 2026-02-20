import { IsNumber, IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class ReservoSearchAvailabilityDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El ID de la agenda es requerido' })
  agenda_id: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha debe ser YYYY-MM-DD' })
  fecha: string;

  @IsString()
  @IsNotEmpty({ message: 'El UUID del tratamiento es requerido' })
  uuid_tratamiento: string;

  @IsString()
  @IsOptional()
  uuid_profesional?: string;

  @IsString()
  @IsOptional()
  uuid_sucursal?: string;
}

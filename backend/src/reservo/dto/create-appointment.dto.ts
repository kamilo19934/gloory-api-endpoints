import { IsString, IsNumber, IsNotEmpty, Matches } from 'class-validator';

export class ReservoCreateAppointmentDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El ID de la agenda es requerido' })
  agenda_id: number;

  @IsString()
  @IsNotEmpty({ message: 'El UUID de la sucursal es requerido' })
  id_sucursal: string;

  @IsString()
  @IsNotEmpty({ message: 'El UUID del tratamiento es requerido' })
  id_tratamiento: string;

  @IsString()
  @IsNotEmpty({ message: 'El UUID del profesional es requerido' })
  id_profesional: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha debe ser YYYY-MM-DD' })
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Hora debe ser HH:MM' })
  hora: string;

  @IsString()
  @IsNotEmpty({ message: 'El UUID del paciente es requerido' })
  uuid_paciente: string;
}

import { IsNumber, IsString, IsNotEmpty, IsOptional, Matches, Min } from 'class-validator';

export class DentalsoftCreateAppointmentDto {
  @IsNumber()
  @IsNotEmpty({ message: 'id_sucursal es requerido' })
  id_sucursal: number;

  @IsNumber()
  @IsNotEmpty({ message: 'id_profesional es requerido' })
  id_profesional: number;

  @IsNumber()
  @IsNotEmpty({ message: 'id_sala es requerido' })
  id_sala: number;

  @IsNumber()
  @IsNotEmpty({ message: 'id_paciente es requerido' })
  id_paciente: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'inicio debe ser HH:MM' })
  inicio: string;

  /**
   * Si se omite, el proxy usa la duración mínima de la clínica (1 bloque de agenda).
   */
  @IsNumber()
  @Min(5, { message: 'duracion_minutos mínima es 5' })
  @IsOptional()
  duracion_minutos?: number;

  /**
   * Comentario libre asociado a la cita (motivo de consulta, indicaciones, etc.).
   * Internamente se envía a Dentalsoft como `observacion` y, si la cita se espeja
   * a GHL, también va como custom field `comentario` del contacto.
   */
  @IsString()
  @IsOptional()
  comentario?: string;

  /**
   * GHL contact ID — si está presente y el cliente tiene `ghlCalendarId`,
   * la cita se espeja en GHL en background.
   */
  @IsString()
  @IsOptional()
  user_id?: string;
}

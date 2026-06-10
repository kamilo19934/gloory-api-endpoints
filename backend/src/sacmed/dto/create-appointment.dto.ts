import { IsString, IsNotEmpty, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class SacmedCreateAppointmentDto {
  @IsString()
  @IsNotEmpty({ message: 'El id_profesional (UUID) es requerido' })
  id_profesional: string;

  // Acepta el formato legible que devuelve obtener_disponibilidad ("10 de Junio
  // 2026") o YYYY-MM-DD; el proxy lo normaliza a ISO antes de usarlo.
  @IsString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'hora_inicio debe ser HH:MM' })
  hora_inicio: string;

  @IsInt({ message: 'duracion_minutos debe ser un entero' })
  @Min(1, { message: 'duracion_minutos debe ser mayor a 0' })
  duracion_minutos: number;

  @IsString()
  @IsNotEmpty({ message: 'El rut_paciente es requerido' })
  rut_paciente: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  telefono: string;

  @IsString()
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @IsInt({ message: 'id_servicio debe ser un entero' })
  id_servicio: number;

  @IsInt({ message: 'id_especialidad debe ser un entero' })
  id_especialidad: number;

  @IsOptional()
  @IsString()
  comentario?: string;

  /**
   * GHL contact ID — si está presente y el cliente tiene `ghlCalendarId`
   * configurado, la cita se espeja en GoHighLevel en background.
   */
  @IsOptional()
  @IsString()
  user_id?: string;
}

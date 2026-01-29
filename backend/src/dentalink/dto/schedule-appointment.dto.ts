import { IsInt, IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleAppointmentDto {
  @IsInt()
  @Type(() => Number)
  id_paciente: number;

  @IsInt()
  @Type(() => Number)
  id_profesional: number;

  @IsInt()
  @Type(() => Number)
  id_sucursal: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha debe ser YYYY-MM-DD' })
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Hora debe ser HH:MM' })
  hora_inicio: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  tiempo_cita?: number; // Duración en minutos

  @IsString()
  @IsOptional()
  comentario?: string;

  @IsString()
  @IsOptional()
  user_id?: string; // Contact ID de GHL (solo si GHL está habilitado)
}


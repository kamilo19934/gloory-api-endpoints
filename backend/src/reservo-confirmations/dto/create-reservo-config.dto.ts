import {
  IsString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  Matches,
  IsOptional,
} from 'class-validator';

export class CreateReservoConfigDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  daysBeforeAppointment: number;

  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'timeToSend debe estar en formato HH:mm (ej: 09:00)',
  })
  timeToSend: string;

  @IsString()
  ghlCalendarId: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(3)
  order: number;
}

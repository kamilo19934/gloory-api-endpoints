import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class TriggerConfirmationDto {
  @IsUUID()
  @IsOptional()
  confirmationConfigId?: string;

  @IsDateString()
  @IsOptional()
  targetDate?: string; // YYYY-MM-DD para probar una fecha específica
}

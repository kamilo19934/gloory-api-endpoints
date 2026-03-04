import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class TriggerReservoConfirmationDto {
  @IsUUID()
  @IsOptional()
  configId?: string;

  @IsDateString()
  @IsOptional()
  targetDate?: string; // YYYY-MM-DD para probar una fecha específica
}

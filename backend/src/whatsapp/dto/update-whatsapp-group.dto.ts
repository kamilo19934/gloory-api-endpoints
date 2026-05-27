import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class UpdateWhatsAppGroupDto {
  /**
   * ID del cliente al que vincular el grupo.
   * Pasar `null` para desvincular.
   */
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  linkedClientId?: string | null;

  /**
   * Habilita o deshabilita el agente AI para este grupo.
   */
  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  /**
   * Tiempo de debounce en segundos antes de procesar un batch de mensajes.
   * 0 = procesar inmediatamente. Máximo 600 (10 minutos).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  debounceSeconds?: number;
}

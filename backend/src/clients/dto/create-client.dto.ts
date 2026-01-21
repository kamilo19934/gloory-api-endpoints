import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Matches,
  ValidateIf,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IntegrationType } from '../../integrations/common/interfaces';

/**
 * DTO para configuración de una integración
 */
export class IntegrationConfigDto {
  @IsEnum(IntegrationType)
  @IsNotEmpty()
  type: IntegrationType;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsOptional()
  config?: Record<string, any>;
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z]+\/[A-Za-z_]+$/, {
    message: 'Timezone debe ser válido (ej: America/Santiago)',
  })
  timezone?: string;

  /**
   * Lista de integraciones a configurar
   */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => IntegrationConfigDto)
  integrations?: IntegrationConfigDto[];

  // ============================================
  // CAMPOS LEGACY - Mantener compatibilidad
  // ============================================

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsBoolean()
  @IsOptional()
  ghlEnabled?: boolean;

  @ValidateIf((o) => o.ghlEnabled === true)
  @IsString()
  @IsOptional()
  ghlAccessToken?: string;

  @ValidateIf((o) => o.ghlEnabled === true)
  @IsString()
  @IsOptional()
  ghlCalendarId?: string;

  @ValidateIf((o) => o.ghlEnabled === true)
  @IsString()
  @IsOptional()
  ghlLocationId?: string;

  @ValidateIf((o) => o.confirmationStateId !== null)
  @IsInt()
  @IsOptional()
  confirmationStateId?: number | null;

  @ValidateIf((o) => o.contactedStateId !== null)
  @IsInt()
  @IsOptional()
  contactedStateId?: number | null;
}

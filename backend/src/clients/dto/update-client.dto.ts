import {
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
  ValidateIf,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IntegrationConfigDto } from './create-client.dto';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z]+\/[A-Za-z_]+$/, {
    message: 'Timezone debe ser válido (ej: America/Santiago)',
  })
  timezone?: string;

  /**
   * Lista de integraciones a actualizar
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
}

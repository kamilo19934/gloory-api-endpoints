import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IntegrationType } from '../../integrations/common/interfaces';

export class ProvisionIntegrationDto {
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @IsObject()
  config: Record<string, any>;
}

export class ProvisionClientDto {
  /**
   * ID del negocio en gloory-ai-server. Usado para idempotencia.
   */
  @IsString()
  @IsNotEmpty()
  gloory_business_id: string;

  /**
   * Nombre del cliente (viene del Business en gloory-ai-server).
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Timezone (ej: America/Santiago).
   */
  @IsString()
  @IsOptional()
  timezone?: string;

  /**
   * Descripción opcional.
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Integración inicial. Si no se pasa, el Client se crea sin integraciones.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ProvisionIntegrationDto)
  integration?: ProvisionIntegrationDto;
}

export class ProvisionClientResponseDto {
  clientId: string;
  name: string;
  gloory_business_id: string;
  created: boolean; // true si recién creado, false si ya existía (idempotencia)
  integration?: {
    type: IntegrationType;
    isEnabled: boolean;
  };
}

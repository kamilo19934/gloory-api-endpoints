import { IsEnum, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { IntegrationType } from '../../integrations/common/interfaces';

export class AddIntegrationDto {
  @IsEnum(IntegrationType)
  @IsNotEmpty()
  type: IntegrationType;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsNotEmpty()
  config: Record<string, any>;
}

export class UpdateIntegrationDto {
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsOptional()
  config?: Record<string, any>;
}

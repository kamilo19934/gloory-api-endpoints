import { IsEnum, IsObject, IsNotEmpty } from 'class-validator';
import { IntegrationType } from '../../integrations/common/interfaces';

export class TestConnectionDto {
  @IsEnum(IntegrationType)
  platform: IntegrationType;

  @IsObject()
  @IsNotEmpty()
  credentials: Record<string, any>;
}

export class TestConnectionResponseDto {
  ok: boolean;
  preview?: {
    branches_count?: number;
    professionals_count?: number;
    clinic_name?: string;
    agendas_count?: number;
    [key: string]: any;
  };
  error?: string;
}

export class UpdateIntegrationCredentialsDto {
  @IsEnum(IntegrationType)
  platform: IntegrationType;

  @IsObject()
  @IsNotEmpty()
  credentials: Record<string, any>;
}

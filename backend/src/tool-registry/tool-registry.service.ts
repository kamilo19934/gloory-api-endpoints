import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationType } from '../integrations/common/interfaces';
import {
  ToolRegistryResponse,
  ToolSchema,
} from './interfaces/tool-schema.interface';
import { DENTALINK_TOOLS } from './definitions/dentalink.tools';
import {
  MEDILINK_TOOLS,
  DENTALINK_MEDILINK_TOOLS,
} from './definitions/medilink.tools';
import { RESERVO_TOOLS } from './definitions/reservo.tools';
import { GHL_TOOLS } from './definitions/ghl.tools';

/**
 * Service que expone el Tool Registry por plataforma.
 *
 * Los schemas son estáticos (definidos en código) porque las tools las
 * definimos nosotros — los clientes no pueden encender/apagarlas. Para
 * agregar una tool nueva: editar el array de la plataforma y redesplegar
 * este servicio. gloory-ai-server luego sincroniza vía el endpoint.
 */
@Injectable()
export class ToolRegistryService {
  private readonly registry: Record<string, ToolSchema[]> = {
    [IntegrationType.DENTALINK]: DENTALINK_TOOLS,
    [IntegrationType.MEDILINK]: MEDILINK_TOOLS,
    [IntegrationType.DENTALINK_MEDILINK]: DENTALINK_MEDILINK_TOOLS,
    [IntegrationType.RESERVO]: RESERVO_TOOLS,
    [IntegrationType.GOHIGHLEVEL]: GHL_TOOLS,
  };

  private readonly versions: Record<string, string> = {
    [IntegrationType.DENTALINK]: '1.0.0',
    [IntegrationType.MEDILINK]: '1.0.0',
    [IntegrationType.DENTALINK_MEDILINK]: '1.0.0',
    [IntegrationType.RESERVO]: '1.0.0',
    [IntegrationType.GOHIGHLEVEL]: '1.0.0',
  };

  getRegistry(platform: string): ToolRegistryResponse {
    const normalized = platform.toLowerCase() as IntegrationType;
    const tools = this.registry[normalized];

    if (!tools) {
      throw new NotFoundException(
        `Plataforma no soportada: ${platform}. Plataformas disponibles: ${Object.keys(this.registry).join(', ')}`,
      );
    }

    return {
      platform: normalized,
      version: this.versions[normalized] || '1.0.0',
      tools,
    };
  }

  /**
   * Retorna la lista de plataformas soportadas por el registry.
   */
  getSupportedPlatforms(): string[] {
    return Object.keys(this.registry);
  }
}

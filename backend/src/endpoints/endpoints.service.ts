import { Injectable } from '@nestjs/common';
import { AVAILABLE_ENDPOINTS, EndpointDefinition } from './endpoint-config';

/**
 * Mapeo de cada categoría de endpoint a las integraciones que la usan.
 * Un endpoint se muestra a un cliente solo si su categoría pertenece a alguna
 * de las integraciones que el cliente tiene habilitadas.
 *
 * IMPORTANTE: al agregar una categoría nueva (nueva plataforma), mapearla aquí.
 * Una categoría sin mapear se muestra a TODOS los clientes (fail-open) para no
 * ocultar endpoints por olvido.
 */
const HEALTHATOM = ['dentalink', 'medilink', 'dentalink_medilink'];
const CATEGORY_INTEGRATIONS: Record<string, string[]> = {
  // Endpoints legacy de Dentalink/MediLink (rutas sin prefijo de plataforma)
  availability: HEALTHATOM,
  patients: HEALTHATOM,
  appointments: HEALTHATOM,
  clinic: HEALTHATOM,
  testing: HEALTHATOM,
  // Exclusivas por plataforma
  reservo: ['reservo'],
  dentalsoft: ['dentalsoft'],
  sacmed: ['sacmed'],
  gohighlevel: ['gohighlevel'],
};

@Injectable()
export class EndpointsService {
  private readonly BASE_URL = 'https://gloory-api-endpoints-production.up.railway.app';

  getAllEndpoints(): EndpointDefinition[] {
    return AVAILABLE_ENDPOINTS;
  }

  getEndpointById(id: string): EndpointDefinition | undefined {
    return AVAILABLE_ENDPOINTS.find((endpoint) => endpoint.id === id);
  }

  getEndpointsByCategory(category: string): EndpointDefinition[] {
    return AVAILABLE_ENDPOINTS.filter((endpoint) => endpoint.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(AVAILABLE_ENDPOINTS.map((e) => e.category));
    return Array.from(categories);
  }

  /**
   * Obtiene las tools de un cliente en formato JSON estructurado para plataformas externas.
   * Incluye nombre, descripción y argumentos con su metadata.
   */
  getToolsForClient(
    clientId: string,
    integrationTypes: string[],
  ): {
    tools: {
      name: string;
      description: string;
      arguments: { name: string; required: boolean; description: string; type: string }[];
    }[];
  } {
    const endpoints = this.getEndpointsForClient(clientId, integrationTypes);
    return {
      tools: endpoints.map((endpoint) => ({
        name: endpoint.name,
        description: endpoint.description,
        arguments: endpoint.arguments.map((arg) => ({
          name: arg.name,
          required: arg.required,
          description: arg.description,
          type: arg.type,
        })),
      })),
    };
  }

  /**
   * Obtiene los endpoints de un cliente filtrados por sus integraciones,
   * con URLs completas.
   */
  getEndpointsForClient(clientId: string, integrationTypes: string[]): EndpointDefinition[] {
    const active = new Set(integrationTypes);

    const filtered = AVAILABLE_ENDPOINTS.filter((endpoint) => {
      const owners = CATEGORY_INTEGRATIONS[endpoint.category];
      // Categoría sin mapear → fail-open (visible) para no ocultar endpoints nuevos.
      if (!owners) return true;
      // Mostrar solo si el cliente tiene habilitada alguna integración dueña de la categoría.
      return owners.some((type) => active.has(type));
    });

    return filtered.map((endpoint) => ({
      ...endpoint,
      clientUrl: `${this.BASE_URL}/api/clients/${clientId}${endpoint.path}`,
    }));
  }
}

import { Injectable } from '@nestjs/common';
import { AVAILABLE_ENDPOINTS, EndpointDefinition } from './endpoint-config';

/** Categorías de endpoints que pertenecen a Reservo */
const RESERVO_CATEGORIES = new Set(['reservo']);

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
   * Obtiene los endpoints de un cliente filtrados por sus integraciones,
   * con URLs completas.
   */
  getEndpointsForClient(clientId: string, integrationTypes: string[]): EndpointDefinition[] {
    const hasReservo = integrationTypes.includes('reservo');
    const hasDentalink =
      integrationTypes.includes('dentalink') || integrationTypes.includes('dentalink_medilink');

    const filtered = AVAILABLE_ENDPOINTS.filter((endpoint) => {
      const isReservoEndpoint = RESERVO_CATEGORIES.has(endpoint.category);

      if (hasReservo && hasDentalink) return true;
      if (hasReservo) return isReservoEndpoint;
      return !isReservoEndpoint;
    });

    return filtered.map((endpoint) => ({
      ...endpoint,
      clientUrl: `${this.BASE_URL}/api/clients/${clientId}${endpoint.path}`,
    }));
  }
}

import { Injectable } from '@nestjs/common';
import { AVAILABLE_ENDPOINTS, EndpointDefinition } from './endpoint-config';

/** Categorías de endpoints que pertenecen exclusivamente a una integración */
const RESERVO_CATEGORIES = new Set(['reservo']);
const GHL_CATEGORIES = new Set(['gohighlevel']);
/** Categorías que pertenecen exclusivamente a Dentalink/MediLink */
const DENTALINK_CATEGORIES = new Set(['clinic']);

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
      integrationTypes.includes('dentalink') ||
      integrationTypes.includes('dentalink_medilink') ||
      integrationTypes.includes('medilink');
    const hasGHL = integrationTypes.includes('gohighlevel');

    const filtered = AVAILABLE_ENDPOINTS.filter((endpoint) => {
      const isReservoEndpoint = RESERVO_CATEGORIES.has(endpoint.category);
      const isGHLEndpoint = GHL_CATEGORIES.has(endpoint.category);
      const isDentalinkEndpoint = DENTALINK_CATEGORIES.has(endpoint.category);

      // GHL-only clients: show only GHL endpoints
      if (hasGHL && !hasDentalink && !hasReservo) {
        return isGHLEndpoint;
      }

      // Reservo-only clients: show only Reservo endpoints
      if (hasReservo && !hasDentalink && !hasGHL) {
        return isReservoEndpoint;
      }

      // Dentalink-only clients: show everything except Reservo and GHL
      if (hasDentalink && !hasReservo && !hasGHL) {
        return !isReservoEndpoint && !isGHLEndpoint;
      }

      // Mixed: show all applicable
      if (hasReservo) {
        if (isGHLEndpoint && !hasGHL) return false;
        return true;
      }
      if (hasGHL) {
        if (isReservoEndpoint && !hasReservo) return false;
        return true;
      }

      // Default: show non-exclusive endpoints
      return !isReservoEndpoint && !isGHLEndpoint && !isDentalinkEndpoint;
    });

    return filtered.map((endpoint) => ({
      ...endpoint,
      clientUrl: `${this.BASE_URL}/api/clients/${clientId}${endpoint.path}`,
    }));
  }
}

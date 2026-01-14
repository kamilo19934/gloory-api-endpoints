import { Injectable } from '@nestjs/common';
import { AVAILABLE_ENDPOINTS, EndpointDefinition } from './endpoint-config';

@Injectable()
export class EndpointsService {
  getAllEndpoints(): EndpointDefinition[] {
    return AVAILABLE_ENDPOINTS;
  }

  getEndpointById(id: string): EndpointDefinition | undefined {
    return AVAILABLE_ENDPOINTS.find(endpoint => endpoint.id === id);
  }

  getEndpointsByCategory(category: string): EndpointDefinition[] {
    return AVAILABLE_ENDPOINTS.filter(endpoint => endpoint.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(AVAILABLE_ENDPOINTS.map(e => e.category));
    return Array.from(categories);
  }
}


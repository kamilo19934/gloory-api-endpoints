import { Controller, Get, Param } from '@nestjs/common';
import { EndpointsService } from './endpoints.service';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('endpoints')
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Get()
  getAllEndpoints() {
    return this.endpointsService.getAllEndpoints();
  }

  @Get('categories')
  getCategories() {
    return this.endpointsService.getCategories();
  }

  @Get('category/:category')
  getEndpointsByCategory(@Param('category') category: string) {
    return this.endpointsService.getEndpointsByCategory(category);
  }

  @Get(':id')
  getEndpointById(@Param('id') id: string) {
    return this.endpointsService.getEndpointById(id);
  }
}


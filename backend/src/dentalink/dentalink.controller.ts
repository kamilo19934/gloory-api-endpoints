import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DentalinkService } from './dentalink.service';
import { ClientsService } from '../clients/clients.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ScheduleAppointmentDto } from './dto/schedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { GetTreatmentsDto } from './dto/get-treatments.dto';

@Controller('clients/:clientId')
export class DentalinkController {
  constructor(
    private readonly dentalinkService: DentalinkService,
    private readonly clientsService: ClientsService,
    private readonly endpointsService: EndpointsService,
  ) {}

  @Get('endpoints')
  async getClientEndpoints(@Param('clientId') clientId: string) {
    // Verify client exists
    await this.clientsService.findOne(clientId);

    // Return all available endpoints with client-specific URLs
    const endpoints = this.endpointsService.getAllEndpoints();

    return endpoints.map((endpoint) => ({
      ...endpoint,
      clientUrl: `/api/clients/${clientId}${endpoint.path}`,
    }));
  }

  // ============================
  // AVAILABILITY ENDPOINTS
  // ============================

  @Post('availability')
  @HttpCode(HttpStatus.OK)
  async searchAvailability(
    @Param('clientId') clientId: string,
    @Body() searchAvailabilityDto: SearchAvailabilityDto,
  ) {
    return await this.dentalinkService.searchAvailability(clientId, searchAvailabilityDto);
  }

  // ============================
  // PATIENTS ENDPOINTS
  // ============================

  @Post('patients/search')
  @HttpCode(HttpStatus.OK)
  async searchUser(
    @Param('clientId') clientId: string,
    @Body() searchUserDto: SearchUserDto,
  ) {
    return await this.dentalinkService.searchUser(clientId, searchUserDto);
  }

  @Post('patients')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Param('clientId') clientId: string,
    @Body() createUserDto: CreateUserDto,
  ) {
    return await this.dentalinkService.createUser(clientId, createUserDto);
  }

  @Post('patients/treatments')
  @HttpCode(HttpStatus.OK)
  async getPatientTreatments(
    @Param('clientId') clientId: string,
    @Body() getTreatmentsDto: GetTreatmentsDto,
  ) {
    return await this.dentalinkService.getPatientTreatments(clientId, getTreatmentsDto);
  }

  // ============================
  // APPOINTMENTS ENDPOINTS
  // ============================

  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  async scheduleAppointment(
    @Param('clientId') clientId: string,
    @Body() scheduleAppointmentDto: ScheduleAppointmentDto,
  ) {
    return await this.dentalinkService.scheduleAppointment(clientId, scheduleAppointmentDto);
  }

  @Post('appointments/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(
    @Param('clientId') clientId: string,
    @Body() cancelAppointmentDto: CancelAppointmentDto,
  ) {
    return await this.dentalinkService.cancelAppointment(clientId, cancelAppointmentDto);
  }

  // Test connection endpoint
  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Param('clientId') clientId: string) {
    try {
      // Try to get dentists list as a simple connection test
      const client = await this.clientsService.findOne(clientId);
      const apiKey = client.apiKey;
      const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';
      
      const axios = require('axios');
      const response = await axios.get(`${baseURL}dentistas`, {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      if (response.status === 200) {
        return {
          connected: true,
          message: 'Conexión exitosa con Dentalink',
        };
      }
    } catch (error) {
      return {
        connected: false,
        message: 'Error de conexión con Dentalink',
        error: error.message,
      };
    }
  }
}

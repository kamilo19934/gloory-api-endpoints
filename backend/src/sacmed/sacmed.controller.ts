import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SacmedProxyService } from './sacmed-proxy.service';
import { SacmedCreatePatientDto } from './dto/create-patient.dto';
import { SacmedSearchAvailabilityDto } from './dto/search-availability.dto';
import { SacmedCreateAppointmentDto } from './dto/create-appointment.dto';
import { SacmedAppointmentActionDto } from './dto/appointment-action.dto';
import { SacmedServiceIdDto } from './dto/service-id.dto';
import { SacmedSpecialtyIdDto } from './dto/specialty-id.dto';
import { SacmedRutDto } from './dto/rut.dto';

@Public()
@Controller('clients/:clientId/sacmed')
export class SacmedController {
  constructor(private readonly sacmedProxyService: SacmedProxyService) {}

  // ============================
  // CATÁLOGO (lecturas sin parámetros → GET)
  // ============================

  @Get('services')
  async getServices(@Param('clientId') clientId: string) {
    return await this.sacmedProxyService.getServices(clientId);
  }

  @Get('practitioners')
  async getPractitioners(@Param('clientId') clientId: string) {
    return await this.sacmedProxyService.getPractitioners(clientId);
  }

  @Get('districts')
  async getDistricts(@Param('clientId') clientId: string) {
    return await this.sacmedProxyService.getDistricts(clientId);
  }

  // ============================
  // CATÁLOGO (lecturas con parámetros → POST con body)
  // ============================

  @Post('specialties')
  @HttpCode(HttpStatus.OK)
  async getSpecialties(@Param('clientId') clientId: string, @Body() dto: SacmedServiceIdDto) {
    return await this.sacmedProxyService.getSpecialtiesByService(clientId, dto.id_servicio);
  }

  @Post('practitioners/by-service')
  @HttpCode(HttpStatus.OK)
  async getPractitionersByService(
    @Param('clientId') clientId: string,
    @Body() dto: SacmedServiceIdDto,
  ) {
    return await this.sacmedProxyService.getPractitioners(clientId, dto.id_servicio);
  }

  @Post('practitioners/by-specialty')
  @HttpCode(HttpStatus.OK)
  async getPractitionersBySpecialty(
    @Param('clientId') clientId: string,
    @Body() dto: SacmedSpecialtyIdDto,
  ) {
    return await this.sacmedProxyService.getPractitionersBySpecialty(clientId, dto.id_especialidad);
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  @Post('availability')
  @HttpCode(HttpStatus.OK)
  async searchAvailability(
    @Param('clientId') clientId: string,
    @Body() dto: SacmedSearchAvailabilityDto,
  ) {
    return await this.sacmedProxyService.searchAvailability(clientId, dto);
  }

  // ============================
  // PACIENTES
  // ============================

  @Post('patients/search')
  @HttpCode(HttpStatus.OK)
  async searchPatient(@Param('clientId') clientId: string, @Body() dto: SacmedRutDto) {
    return await this.sacmedProxyService.searchPatient(clientId, dto.rut);
  }

  @Post('patients')
  @HttpCode(HttpStatus.CREATED)
  async createPatient(@Param('clientId') clientId: string, @Body() dto: SacmedCreatePatientDto) {
    return await this.sacmedProxyService.createPatient(clientId, dto);
  }

  @Post('patients/appointments')
  @HttpCode(HttpStatus.OK)
  async getPatientAppointments(@Param('clientId') clientId: string, @Body() dto: SacmedRutDto) {
    return await this.sacmedProxyService.getPatientAppointments(clientId, dto.rut);
  }

  // ============================
  // CITAS
  // ============================

  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  async createAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: SacmedCreateAppointmentDto,
  ) {
    return await this.sacmedProxyService.createAppointment(clientId, dto);
  }

  @Post('appointments/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: SacmedAppointmentActionDto,
  ) {
    return await this.sacmedProxyService.confirmAppointment(clientId, dto);
  }

  @Post('appointments/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: SacmedAppointmentActionDto,
  ) {
    return await this.sacmedProxyService.cancelAppointment(clientId, dto);
  }

  // ============================
  // TEST DE CONEXIÓN
  // ============================

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Param('clientId') clientId: string) {
    return await this.sacmedProxyService.testConnection(clientId);
  }
}

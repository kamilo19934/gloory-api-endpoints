import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ReservoProxyService } from './reservo-proxy.service';
import { SearchPatientDto } from './dto/search-patient.dto';
import { ReservoSearchAvailabilityDto } from './dto/search-availability.dto';
import { ReservoCreateAppointmentDto } from './dto/create-appointment.dto';
import { ReservoCreatePatientDto } from './dto/create-patient.dto';
import { ReservoConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { ReservoCancelAppointmentDto } from './dto/cancel-appointment.dto';
import { ReservoGetProfessionalsDto } from './dto/get-professionals.dto';
import { ReservoGetTreatmentsDto } from './dto/get-treatments.dto';
import { ReservoGetSucursalesDto } from './dto/get-sucursales.dto';
import { ReservoGetAppointmentsDto } from './dto/get-appointments.dto';

@Public()
@Controller('clients/:clientId/reservo')
export class ReservoController {
  constructor(private readonly reservoProxyService: ReservoProxyService) {}

  // ============================
  // AGENDAS
  // ============================

  @Get('agendas')
  async getAgendas(@Param('clientId') clientId: string) {
    return await this.reservoProxyService.getAgendas(clientId);
  }

  // ============================
  // PACIENTES
  // ============================

  @Post('patients/search')
  @HttpCode(HttpStatus.OK)
  async searchPatient(@Param('clientId') clientId: string, @Body() dto: SearchPatientDto) {
    return await this.reservoProxyService.searchPatient(clientId, dto);
  }

  @Get('patients/:uuid')
  async getPatientByUuid(
    @Param('clientId') clientId: string,
    @Param('uuid') uuid: string,
  ) {
    return await this.reservoProxyService.getPatientByUuid(clientId, uuid);
  }

  @Post('patients')
  @HttpCode(HttpStatus.CREATED)
  async createPatient(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoCreatePatientDto,
  ) {
    return await this.reservoProxyService.createPatient(clientId, dto);
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  @Post('availability')
  @HttpCode(HttpStatus.OK)
  async searchAvailability(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoSearchAvailabilityDto,
  ) {
    return await this.reservoProxyService.searchAvailability(clientId, dto);
  }

  // ============================
  // PROFESIONALES
  // ============================

  @Post('professionals')
  @HttpCode(HttpStatus.OK)
  async getProfessionals(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoGetProfessionalsDto,
  ) {
    return await this.reservoProxyService.getProfessionals(clientId, dto);
  }

  // ============================
  // TRATAMIENTOS
  // ============================

  @Post('treatments')
  @HttpCode(HttpStatus.OK)
  async getTreatments(@Param('clientId') clientId: string, @Body() dto: ReservoGetTreatmentsDto) {
    return await this.reservoProxyService.getTreatments(clientId, dto);
  }

  // ============================
  // SUCURSALES
  // ============================

  @Post('sucursales')
  @HttpCode(HttpStatus.OK)
  async getSucursales(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoGetSucursalesDto,
  ) {
    return await this.reservoProxyService.getSucursales(clientId, dto);
  }

  // ============================
  // PREVISIONALES
  // ============================

  @Post('prevision')
  @HttpCode(HttpStatus.OK)
  async getPrevisionOptions(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoGetProfessionalsDto,
  ) {
    return await this.reservoProxyService.getPrevisionOptions(clientId, dto);
  }

  // ============================
  // CITAS
  // ============================

  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  async createAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoCreateAppointmentDto,
  ) {
    return await this.reservoProxyService.createAppointment(clientId, dto);
  }

  @Post('appointments/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoConfirmAppointmentDto,
  ) {
    return await this.reservoProxyService.confirmAppointment(clientId, dto);
  }

  @Post('appointments/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoCancelAppointmentDto,
  ) {
    return await this.reservoProxyService.cancelAppointment(clientId, dto);
  }

  @Post('appointments/search')
  @HttpCode(HttpStatus.OK)
  async getAppointments(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoGetAppointmentsDto,
  ) {
    return await this.reservoProxyService.getAppointments(clientId, dto);
  }

  @Post('appointments/future')
  @HttpCode(HttpStatus.OK)
  async getFutureAppointments(
    @Param('clientId') clientId: string,
    @Body() dto: ReservoGetAppointmentsDto,
  ) {
    return await this.reservoProxyService.getFutureAppointments(clientId, dto);
  }

  // ============================
  // TEST DE CONEXION
  // ============================

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Param('clientId') clientId: string) {
    return await this.reservoProxyService.testConnection(clientId);
  }
}

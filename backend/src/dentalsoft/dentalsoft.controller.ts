import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { DentalsoftProxyService } from './dentalsoft-proxy.service';
import { DentalsoftSearchPatientDto } from './dto/search-patient.dto';
import { DentalsoftCreatePatientDto } from './dto/create-patient.dto';
import { DentalsoftMonthlyAvailabilityDto } from './dto/monthly-availability.dto';
import { DentalsoftDailyAvailabilityDto } from './dto/daily-availability.dto';
import { DentalsoftCreateAppointmentDto } from './dto/create-appointment.dto';
import { DentalsoftConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { DentalsoftCancelAppointmentDto } from './dto/cancel-appointment.dto';
import { DentalsoftDayBranchAppointmentsDto } from './dto/day-branch-appointments.dto';
import { DentalsoftPatientAppointmentsDto } from './dto/patient-appointments.dto';
import { DentalsoftProfessionalsBySpecialtyDto } from './dto/professionals-by-specialty.dto';
import { DentalsoftSearchAvailabilityDto } from './dto/search-availability.dto';

@Public()
@Controller('clients/:clientId/dentalsoft')
export class DentalsoftController {
  constructor(private readonly proxy: DentalsoftProxyService) {}

  // ============================
  // TEST DE CONEXION
  // ============================

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Param('clientId') clientId: string) {
    return this.proxy.testConnection(clientId);
  }

  // ============================
  // PACIENTES
  // ============================

  @Post('patients/search')
  @HttpCode(HttpStatus.OK)
  async searchPatient(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftSearchPatientDto,
  ) {
    return this.proxy.searchPatient(clientId, dto);
  }

  @Post('patients')
  @HttpCode(HttpStatus.CREATED)
  async createPatient(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftCreatePatientDto,
  ) {
    return this.proxy.createPatient(clientId, dto);
  }

  // ============================
  // PROFESIONALES / ESPECIALIDADES
  // ============================

  @Get('professionals')
  async getProfesionales(@Param('clientId') clientId: string) {
    return this.proxy.getProfesionales(clientId);
  }

  @Post('professionals/by-specialty')
  @HttpCode(HttpStatus.OK)
  async getProfesionalesPorEspecialidad(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftProfessionalsBySpecialtyDto,
  ) {
    return this.proxy.getProfesionalesPorEspecialidad(clientId, dto);
  }

  @Get('specialties')
  async getEspecialidades(@Param('clientId') clientId: string) {
    return this.proxy.getEspecialidades(clientId);
  }

  // ============================
  // SUCURSALES
  // ============================

  @Get('branches')
  async getSucursales(@Param('clientId') clientId: string) {
    return this.proxy.getSucursales(clientId);
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  @Post('availability/search')
  @HttpCode(HttpStatus.OK)
  async searchAvailability(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftSearchAvailabilityDto,
  ) {
    return this.proxy.searchAvailability(clientId, dto);
  }

  @Post('availability/monthly')
  @HttpCode(HttpStatus.OK)
  async getMonthlyAvailability(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftMonthlyAvailabilityDto,
  ) {
    return this.proxy.getMonthlyAvailability(clientId, dto);
  }

  @Post('availability/daily')
  @HttpCode(HttpStatus.OK)
  async getDailyAvailability(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftDailyAvailabilityDto,
  ) {
    return this.proxy.getDailyAvailability(clientId, dto);
  }

  // ============================
  // CITAS
  // ============================

  @Get('appointments/:id')
  async getAppointment(
    @Param('clientId') clientId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proxy.getAppointment(clientId, id);
  }

  @Post('appointments/day-branch')
  @HttpCode(HttpStatus.OK)
  async getAppointmentsByBranchAndDate(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftDayBranchAppointmentsDto,
  ) {
    return this.proxy.getAppointmentsByBranchAndDate(clientId, dto);
  }

  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  async createAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftCreateAppointmentDto,
  ) {
    return this.proxy.createAppointment(clientId, dto);
  }

  @Post('appointments/patient')
  @HttpCode(HttpStatus.OK)
  async getPatientAppointments(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftPatientAppointmentsDto,
  ) {
    return this.proxy.getPatientAppointments(clientId, dto);
  }

  @Post('appointments/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftConfirmAppointmentDto,
  ) {
    return this.proxy.confirmAppointment(clientId, dto);
  }

  @Post('appointments/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(
    @Param('clientId') clientId: string,
    @Body() dto: DentalsoftCancelAppointmentDto,
  ) {
    return this.proxy.cancelAppointment(clientId, dto);
  }
}

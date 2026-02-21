import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { GoHighLevelProxyService } from './gohighlevel-proxy.service';

@Public()
@Controller('clients/:clientId/ghl')
export class GoHighLevelController {
  constructor(private readonly ghlProxyService: GoHighLevelProxyService) {}

  // ============================
  // SEDES
  // ============================

  @Get('branches')
  async getBranches(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.getActiveBranches(clientId);
  }

  @Get('branches/all')
  async getAllBranches(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.getAllBranches(clientId);
  }

  @Post('branches')
  async createBranch(
    @Param('clientId') clientId: string,
    @Body() body: { nombre: string; direccion?: string; telefono?: string; ciudad?: string; comuna?: string },
  ) {
    const branch = await this.ghlProxyService.createBranch(clientId, body);
    return { mensaje: 'Sede creada exitosamente', sucursal: branch };
  }

  @Put('branches/:branchId')
  async updateBranch(
    @Param('clientId') clientId: string,
    @Param('branchId') branchId: string,
    @Body() body: { nombre?: string; direccion?: string; telefono?: string; ciudad?: string; comuna?: string },
  ) {
    const branch = await this.ghlProxyService.updateBranch(clientId, parseInt(branchId, 10), body);
    return { mensaje: 'Sede actualizada', sucursal: branch };
  }

  @Delete('branches/:branchId')
  async deleteBranch(
    @Param('clientId') clientId: string,
    @Param('branchId') branchId: string,
  ) {
    await this.ghlProxyService.deleteBranch(clientId, parseInt(branchId, 10));
    return { mensaje: 'Sede eliminada exitosamente' };
  }

  @Patch('branches/:branchId/toggle')
  async toggleBranch(
    @Param('clientId') clientId: string,
    @Param('branchId') branchId: string,
    @Body() body: { activa: boolean },
  ) {
    return await this.ghlProxyService.toggleBranch(clientId, parseInt(branchId, 10), body.activa);
  }

  @Post('branches/calendars')
  @HttpCode(HttpStatus.OK)
  async getCalendarsByBranch(
    @Param('clientId') clientId: string,
    @Body() body: { branchId: number },
  ) {
    return await this.ghlProxyService.getCalendarsByBranch(clientId, body.branchId);
  }

  // ============================
  // CALENDARIOS
  // ============================

  @Get('calendars')
  async getCalendars(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.getActiveCalendars(clientId);
  }

  @Get('calendars/all')
  async getAllCalendars(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.getAllCalendars(clientId);
  }

  @Patch('calendars/:calendarId/toggle')
  async toggleCalendar(
    @Param('clientId') clientId: string,
    @Param('calendarId', ParseIntPipe) calendarId: number,
    @Body() body: { activo: boolean },
  ) {
    return await this.ghlProxyService.toggleCalendar(clientId, calendarId, body.activo);
  }

  @Patch('calendars/:calendarId/specialty')
  async updateCalendarSpecialty(
    @Param('clientId') clientId: string,
    @Param('calendarId', ParseIntPipe) calendarId: number,
    @Body() body: { especialidad: string },
  ) {
    const calendar = await this.ghlProxyService.updateCalendarSpecialty(clientId, calendarId, body.especialidad);
    return { mensaje: 'Especialidad actualizada', calendario: calendar };
  }

  @Put('calendars/:calendarId/branches')
  async assignCalendarToBranches(
    @Param('clientId') clientId: string,
    @Param('calendarId', ParseIntPipe) calendarId: number,
    @Body() body: { branchIds: number[] },
  ) {
    const calendar = await this.ghlProxyService.assignCalendarToBranches(clientId, calendarId, body.branchIds);
    return { mensaje: 'Sedes asignadas', calendario: calendar };
  }

  // ============================
  // DATOS CLINICOS
  // ============================

  @Get('specialties')
  async getSpecialties(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.getSpecialties(clientId);
  }

  @Post('specialties/calendars')
  @HttpCode(HttpStatus.OK)
  async getCalendarsBySpecialty(
    @Param('clientId') clientId: string,
    @Body() body: { especialidad: string; id_sucursal?: number },
  ) {
    return await this.ghlProxyService.getCalendarsBySpecialty(clientId, body.especialidad, body.id_sucursal);
  }

  @Get('stats')
  async getStats(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.getStats(clientId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncCalendars(
    @Param('clientId') clientId: string,
    @Body() body?: { force?: boolean },
  ) {
    return await this.ghlProxyService.syncCalendars(clientId, body?.force === true);
  }

  // ============================
  // DISPONIBILIDAD
  // ============================

  @Post('availability')
  @HttpCode(HttpStatus.OK)
  async searchAvailability(
    @Param('clientId') clientId: string,
    @Body() body: { profesionales: number[]; fecha_inicio?: string; tiempo_cita?: number },
  ) {
    return await this.ghlProxyService.searchAvailability(clientId, body);
  }

  // ============================
  // CITAS
  // ============================

  @Post('appointments')
  @HttpCode(HttpStatus.OK)
  async createAppointment(
    @Param('clientId') clientId: string,
    @Body() body: {
      user_id: string;
      profesional: number;
      fecha: string;
      hora_inicio: string;
      tiempo_cita?: number;
      nombre?: string;
      comentario?: string;
      telefono?: string;
      email?: string;
    },
  ) {
    return await this.ghlProxyService.createAppointment(clientId, body);
  }

  @Post('appointments/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(
    @Param('clientId') clientId: string,
    @Body() body: { event_id: string },
  ) {
    return await this.ghlProxyService.cancelAppointment(clientId, body);
  }

  @Post('appointments/update')
  @HttpCode(HttpStatus.OK)
  async updateAppointment(
    @Param('clientId') clientId: string,
    @Body() body: { event_id: string; user_id?: string; comentario?: string; telefono?: string },
  ) {
    return await this.ghlProxyService.updateAppointment(clientId, body);
  }

  @Post('appointments/contact')
  @HttpCode(HttpStatus.OK)
  async getContactAppointments(
    @Param('clientId') clientId: string,
    @Body() body: { user_id: string },
  ) {
    return await this.ghlProxyService.getContactAppointments(clientId, body);
  }

  // ============================
  // CALENDARIOS REMOTOS (API GHL)
  // ============================

  @Get('remote-calendars')
  async getRemoteCalendars(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.getRemoteCalendars(clientId);
  }

  // ============================
  // TEST DE CONEXION
  // ============================

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Param('clientId') clientId: string) {
    return await this.ghlProxyService.testConnection(clientId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClinicService } from './clinic.service';
import { Branch } from './entities/branch.entity';
import { Professional } from './entities/professional.entity';

// Interfaces para respuestas limpias (para agentes IA)
interface BranchResponse {
  id: number;
  nombre: string;
  telefono?: string;
  ciudad?: string;
  comuna?: string;
  direccion?: string;
  habilitada?: boolean;  // Solo para panel admin
  activa?: boolean;      // Solo para panel admin
}

interface ProfessionalResponse {
  id: number;
  rut?: string;
  nombre: string;
  apellidos?: string;
  especialidad?: string;
  intervalo?: number;
  sucursales: number[];
  habilitado?: boolean;  // Solo para panel admin
  activo?: boolean;      // Solo para panel admin
}

@Controller('clients/:clientId/clinic')
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  /**
   * Transforma una sucursal a formato limpio
   * @param includeStatus Si es true, incluye campos habilitada/activa (para panel admin)
   */
  private transformBranch(branch: Branch, includeStatus = false): BranchResponse {
    const response: BranchResponse = {
      id: branch.dentalinkId,
      nombre: branch.nombre,
    };

    // Solo agregar campos que no sean null
    if (branch.telefono) response.telefono = branch.telefono;
    if (branch.ciudad) response.ciudad = branch.ciudad;
    if (branch.comuna) response.comuna = branch.comuna;
    if (branch.direccion) response.direccion = branch.direccion;

    // Solo incluir estados para panel admin
    if (includeStatus) {
      response.habilitada = branch.habilitada;
      response.activa = branch.activa;
    }

    return response;
  }

  /**
   * Transforma un profesional a formato limpio
   * @param includeStatus Si es true, incluye campos habilitado/activo (para panel admin)
   */
  private transformProfessional(prof: Professional, includeStatus = false): ProfessionalResponse {
    // Combinar contratos y horarios en un solo array de sucursales
    const sucursalesSet = new Set([
      ...(prof.contratosSucursal || []),
      ...(prof.horariosSucursal || []),
    ]);

    const response: ProfessionalResponse = {
      id: prof.dentalinkId,
      nombre: prof.nombre,
      sucursales: Array.from(sucursalesSet),
    };

    // Solo agregar campos que no sean null
    if (prof.rut) response.rut = prof.rut;
    if (prof.apellidos) response.apellidos = prof.apellidos;
    if (prof.especialidad) response.especialidad = prof.especialidad;
    if (prof.intervalo) response.intervalo = prof.intervalo;

    // Solo incluir estados para panel admin
    if (includeStatus) {
      response.habilitado = prof.habilitado;
      response.activo = prof.activo;
    }

    return response;
  }

  /**
   * Filtra profesionales activos con agenda online
   */
  private filterActiveProfessionals(professionals: Professional[]): Professional[] {
    return professionals.filter((p) => p.habilitado === true && p.agendaOnline === true);
  }

  /**
   * Obtiene todas las sucursales cacheadas del cliente
   * @param includeInactive - Si es true, incluye sucursales desactivadas localmente
   */
  @Get('branches')
  async getBranches(
    @Param('clientId') clientId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<BranchResponse[]> {
    const includeAll = includeInactive === 'true';
    const branches = includeAll
      ? await this.clinicService.getAllBranches(clientId)
      : await this.clinicService.getActiveBranches(clientId);
    // No incluir estados para agentes IA
    return branches.map((b) => this.transformBranch(b, false));
  }

  /**
   * Obtiene todas las sucursales para el panel admin (incluye desactivadas)
   */
  @Get('branches/all')
  async getAllBranches(@Param('clientId') clientId: string): Promise<BranchResponse[]> {
    const branches = await this.clinicService.getAllBranches(clientId);
    // Incluir estados para panel admin
    return branches.map((b) => this.transformBranch(b, true));
  }

  /**
   * Activa/desactiva una sucursal localmente (usa ID de Dentalink)
   */
  @Patch('branches/:branchId/toggle')
  async toggleBranch(
    @Param('clientId') clientId: string,
    @Param('branchId') branchId: string,
    @Body() body: { activa: boolean },
  ): Promise<BranchResponse> {
    const branch = await this.clinicService.toggleBranch(clientId, parseInt(branchId, 10), body.activa);
    // Incluir estados para respuesta de toggle
    return this.transformBranch(branch, true);
  }

  /**
   * Obtiene una sucursal específica por su ID de Dentalink
   */
  @Get('branches/:branchId')
  async getBranchById(
    @Param('clientId') clientId: string,
    @Param('branchId') branchId: string,
  ): Promise<BranchResponse> {
    const branch = await this.clinicService.getBranchById(clientId, branchId);
    // No incluir estados
    return this.transformBranch(branch, false);
  }

  /**
   * Obtiene profesionales de una sucursal específica (por dentalinkId de la sucursal)
   * El id_sucursal se envía en el body JSON
   * Solo devuelve profesionales habilitados, activos y con agenda online
   * Si la sucursal está desactivada, retorna lista vacía
   */
  @Post('branches/professionals')
  @HttpCode(HttpStatus.OK)
  async getProfessionalsByBranch(
    @Param('clientId') clientId: string,
    @Body() body: { id_sucursal: number; includeInactive?: boolean },
  ): Promise<ProfessionalResponse[]> {
    const includeAll = body.includeInactive === true;
    
    if (includeAll) {
      // Para admin: obtener todos los profesionales de la sucursal sin filtros
      const professionals = await this.clinicService.getProfessionalsByBranch(
        clientId,
        body.id_sucursal,
      );
      // Incluir estados para panel admin
      return professionals.map((p) => this.transformProfessional(p, true));
    }
    
    // Para agentes IA: solo activos
    const professionals = await this.clinicService.getActiveProfessionalsByBranch(
      clientId,
      body.id_sucursal,
    );
    const withAgenda = professionals.filter((p) => p.agendaOnline === true);
    // No incluir estados para agentes IA
    return withAgenda.map((p) => this.transformProfessional(p, false));
  }

  /**
   * Obtiene todos los profesionales cacheados del cliente
   * Por defecto solo devuelve profesionales habilitados y activos
   * @param includeInactive - Si es true, incluye profesionales desactivados localmente
   */
  @Get('professionals')
  async getProfessionals(
    @Param('clientId') clientId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ProfessionalResponse[]> {
    const includeAll = includeInactive === 'true';
    const professionals = includeAll
      ? await this.clinicService.getAllProfessionals(clientId)
      : await this.clinicService.getActiveProfessionals(clientId);
    
    // Solo filtrar por agenda online si no incluimos inactivos
    const filtered = includeAll
      ? professionals
      : professionals.filter((p) => p.agendaOnline === true);
    
    // No incluir estados para agentes IA
    return filtered.map((p) => this.transformProfessional(p, false));
  }

  /**
   * Obtiene todos los profesionales para el panel admin (incluye desactivados)
   */
  @Get('professionals/all')
  async getAllProfessionals(@Param('clientId') clientId: string): Promise<ProfessionalResponse[]> {
    const professionals = await this.clinicService.getAllProfessionals(clientId);
    // Incluir estados para panel admin
    return professionals.map((p) => this.transformProfessional(p, true));
  }

  /**
   * Obtiene un profesional específico
   */
  @Get('professionals/:professionalId')
  async getProfessionalById(
    @Param('clientId') clientId: string,
    @Param('professionalId') professionalId: string,
  ): Promise<ProfessionalResponse> {
    const professional = await this.clinicService.getProfessionalById(clientId, professionalId);
    // No incluir estados
    return this.transformProfessional(professional, false);
  }

  /**
   * Actualiza la especialidad de un profesional (usa ID de Dentalink)
   */
  @Patch('professionals/:professionalId')
  async updateProfessional(
    @Param('clientId') clientId: string,
    @Param('professionalId') professionalId: string,
    @Body() body: { especialidad?: string },
  ): Promise<{ mensaje: string; profesional: ProfessionalResponse }> {
    const professional = await this.clinicService.updateProfessionalSpecialty(
      clientId,
      parseInt(professionalId, 10),
      body.especialidad,
    );
    return {
      mensaje: 'Especialidad actualizada',
      profesional: this.transformProfessional(professional, true),
    };
  }

  /**
   * Activa/desactiva un profesional localmente (usa ID de Dentalink)
   */
  @Patch('professionals/:professionalId/toggle')
  async toggleProfessional(
    @Param('clientId') clientId: string,
    @Param('professionalId') professionalId: string,
    @Body() body: { activo: boolean },
  ): Promise<ProfessionalResponse> {
    const professional = await this.clinicService.toggleProfessional(clientId, parseInt(professionalId, 10), body.activo);
    // Incluir estados para respuesta de toggle
    return this.transformProfessional(professional, true);
  }

  /**
   * Obtiene lista de especialidades únicas del cliente
   * Solo de profesionales habilitados con agenda online
   */
  @Get('specialties')
  async getSpecialties(@Param('clientId') clientId: string): Promise<string[]> {
    return this.clinicService.getSpecialties(clientId);
  }

  /**
   * Obtiene profesionales filtrados por especialidad
   * Parámetro especialidad en el body JSON
   */
  @Post('specialties/professionals')
  @HttpCode(HttpStatus.OK)
  async getProfessionalsBySpecialty(
    @Param('clientId') clientId: string,
    @Body() body: { especialidad: string; id_sucursal?: number },
  ): Promise<ProfessionalResponse[]> {
    let professionals;
    
    if (body.id_sucursal) {
      // Filtrar por especialidad Y sucursal
      professionals = await this.clinicService.getProfessionalsBySpecialtyAndBranch(
        clientId,
        body.especialidad,
        body.id_sucursal,
      );
    } else {
      // Solo filtrar por especialidad
      professionals = await this.clinicService.getProfessionalsBySpecialty(
        clientId,
        body.especialidad,
      );
    }

    // No incluir estados para agentes IA
    return professionals.map((p) => this.transformProfessional(p, false));
  }

  /**
   * Obtiene estadísticas de sincronización
   */
  @Get('stats')
  async getSyncStats(@Param('clientId') clientId: string) {
    return this.clinicService.getSyncStats(clientId);
  }

  /**
   * Sincroniza datos desde Dentalink (solo agrega nuevos)
   * force: true en el body para eliminar datos existentes antes de sincronizar
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncFromDentalink(
    @Param('clientId') clientId: string,
    @Body() body?: { force?: boolean },
  ) {
    const forceSync = body?.force === true;
    return this.clinicService.syncFromDentalink(clientId, forceSync);
  }
}

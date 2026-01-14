import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Branch } from './entities/branch.entity';
import { Professional } from './entities/professional.entity';
import { ClientsService } from '../clients/clients.service';

@Injectable()
export class ClinicService {
  private readonly logger = new Logger(ClinicService.name);

  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Professional)
    private professionalRepository: Repository<Professional>,
    private clientsService: ClientsService,
  ) {}

  /**
   * Obtiene todas las sucursales cacheadas de un cliente
   */
  async getBranches(clientId: string): Promise<Branch[]> {
    return this.branchRepository.find({
      where: { clientId },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene una sucursal por su ID interno
   */
  async getBranchById(clientId: string, branchId: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, clientId },
    });

    if (!branch) {
      throw new HttpException('Sucursal no encontrada', HttpStatus.NOT_FOUND);
    }

    return branch;
  }

  /**
   * Obtiene todos los profesionales cacheados de un cliente
   */
  async getProfessionals(clientId: string): Promise<Professional[]> {
    return this.professionalRepository.find({
      where: { clientId },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene profesionales habilitados que trabajan en una sucursal específica
   * (para panel admin - incluye activos e inactivos localmente)
   */
  async getProfessionalsByBranch(clientId: string, branchDentalinkId: number): Promise<Professional[]> {
    const allProfessionals = await this.professionalRepository.find({
      where: { clientId, habilitado: true, agendaOnline: true },
      order: { nombre: 'ASC' },
    });

    // Filtrar por los que tienen contrato o horario en esa sucursal
    return allProfessionals.filter((prof) => {
      const tieneContrato = prof.contratosSucursal?.includes(branchDentalinkId);
      const tieneHorario = prof.horariosSucursal?.includes(branchDentalinkId);
      return tieneContrato || tieneHorario;
    });
  }

  /**
   * Obtiene un profesional por su ID interno
   */
  async getProfessionalById(clientId: string, professionalId: string): Promise<Professional> {
    const professional = await this.professionalRepository.findOne({
      where: { id: professionalId, clientId },
    });

    if (!professional) {
      throw new HttpException('Profesional no encontrado', HttpStatus.NOT_FOUND);
    }

    return professional;
  }

  /**
   * Obtiene la lista de especialidades únicas de un cliente
   * Solo de profesionales habilitados con agenda online
   */
  async getSpecialties(clientId: string): Promise<string[]> {
    const professionals = await this.professionalRepository.find({
      where: {
        clientId,
        habilitado: true,
        agendaOnline: true,
      },
      select: ['especialidad'],
    });

    // Obtener especialidades únicas, filtrar nulls y ordenar
    const especialidades = [...new Set(
      professionals
        .map((p) => p.especialidad)
        .filter((e): e is string => e !== null && e !== '')
    )].sort();

    return especialidades;
  }

  /**
   * Obtiene profesionales filtrados por especialidad
   * Solo habilitados con agenda online
   */
  async getProfessionalsBySpecialty(
    clientId: string,
    especialidad: string,
  ): Promise<Professional[]> {
    return this.professionalRepository.find({
      where: {
        clientId,
        especialidad,
        habilitado: true,
        agendaOnline: true,
      },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene profesionales filtrados por especialidad Y sucursal
   * Solo habilitados con agenda online
   */
  async getProfessionalsBySpecialtyAndBranch(
    clientId: string,
    especialidad: string,
    branchDentalinkId: number,
  ): Promise<Professional[]> {
    const professionals = await this.professionalRepository.find({
      where: {
        clientId,
        especialidad,
        habilitado: true,
        agendaOnline: true,
      },
      order: { nombre: 'ASC' },
    });

    // Filtrar por sucursal
    return professionals.filter((prof) => {
      const tieneContrato = prof.contratosSucursal?.includes(branchDentalinkId);
      const tieneHorario = prof.horariosSucursal?.includes(branchDentalinkId);
      return tieneContrato || tieneHorario;
    });
  }

  /**
   * Elimina todos los datos de clínica de un cliente (para resincronización)
   */
  async clearClinicData(clientId: string): Promise<void> {
    this.logger.log(`🗑️ Eliminando datos de clínica para cliente ${clientId}`);
    await this.professionalRepository.delete({ clientId });
    await this.branchRepository.delete({ clientId });
    this.logger.log(`✅ Datos eliminados`);
  }

  /**
   * Sincroniza sucursales y profesionales desde Dentalink
   * Solo agrega nuevos registros, no modifica los existentes
   * @param force Si es true, elimina todos los datos antes de sincronizar
   */
  async syncFromDentalink(clientId: string, force: boolean = false): Promise<{
    sucursalesNuevas: number;
    profesionalesNuevos: number;
    mensaje: string;
  }> {
    this.logger.log(`🔄 Iniciando sincronización para cliente ${clientId}${force ? ' (FORZADA)' : ''}`);

    // Si es forzada, eliminar datos existentes primero
    if (force) {
      await this.clearClinicData(clientId);
    }

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const baseURL = process.env.DENTALINK_BASE_URL || 'https://api.dentalink.healthatom.com/api/v1/';

    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    let sucursalesNuevas = 0;
    let profesionalesNuevos = 0;

    // 1. Sincronizar Sucursales
    try {
      this.logger.log('📍 Obteniendo sucursales de Dentalink...');
      const sucursalesResp = await axios.get(`${baseURL}sucursales/`, { headers });

      if (sucursalesResp.status === 200) {
        const sucursalesData = sucursalesResp.data?.data || [];
        this.logger.log(`📍 Encontradas ${sucursalesData.length} sucursales en Dentalink`);

        for (const sucursal of sucursalesData) {
          // Verificar si ya existe
          const existente = await this.branchRepository.findOne({
            where: { clientId, dentalinkId: sucursal.id },
          });

          if (!existente) {
            // Crear nueva sucursal
            const nuevaSucursal = this.branchRepository.create({
              clientId,
              dentalinkId: sucursal.id,
              nombre: sucursal.nombre || 'Sin nombre',
              telefono: sucursal.telefono || null,
              ciudad: sucursal.ciudad || null,
              comuna: sucursal.comuna || null,
              direccion: sucursal.direccion || null,
              habilitada: sucursal.habilitada === 1,
            });

            await this.branchRepository.save(nuevaSucursal);
            sucursalesNuevas++;
            this.logger.log(`✅ Nueva sucursal agregada: ${sucursal.nombre} (ID: ${sucursal.id})`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error obteniendo sucursales: ${error.message}`);
      throw new HttpException(
        `Error al sincronizar sucursales: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Sincronizar Profesionales (Dentistas)
    try {
      this.logger.log('👨‍⚕️ Obteniendo profesionales de Dentalink...');
      const dentistasResp = await axios.get(`${baseURL}dentistas/`, { headers });

      if (dentistasResp.status === 200) {
        const dentistasData = dentistasResp.data?.data || [];
        this.logger.log(`👨‍⚕️ Encontrados ${dentistasData.length} profesionales en Dentalink`);

        for (const dentista of dentistasData) {
          // Verificar si ya existe
          const existente = await this.professionalRepository.findOne({
            where: { clientId, dentalinkId: dentista.id },
          });

          if (!existente) {
            // Log raw data para debugging
            this.logger.debug(`📋 Raw dentista data - ${dentista.nombre}: contratos=${JSON.stringify(dentista.contratos_sucursal)}, horarios=${JSON.stringify(dentista.horarios_sucursal)}`);

            // Filtrar y convertir arrays - Dentalink devuelve strings como "2" en lugar de números
            const contratos = Array.isArray(dentista.contratos_sucursal)
              ? dentista.contratos_sucursal
                  .map((id: any) => parseInt(id, 10))
                  .filter((id: number) => !isNaN(id))
              : [];
            const horarios = Array.isArray(dentista.horarios_sucursal)
              ? dentista.horarios_sucursal
                  .map((id: any) => parseInt(id, 10))
                  .filter((id: number) => !isNaN(id))
              : [];

            // Log datos filtrados
            if (contratos.length > 0 || horarios.length > 0) {
              this.logger.log(`✅ ${dentista.nombre}: contratos=${JSON.stringify(contratos)}, horarios=${JSON.stringify(horarios)}`);
            }

            // Crear nuevo profesional
            const nuevoProfesional = this.professionalRepository.create({
              clientId,
              dentalinkId: dentista.id,
              rut: dentista.rut || null,
              nombre: dentista.nombre || 'Sin nombre',
              apellidos: dentista.apellidos || null,
              celular: dentista.celular || null,
              telefono: dentista.telefono || null,
              email: dentista.email || null,
              ciudad: dentista.ciudad || null,
              comuna: dentista.comuna || null,
              direccion: dentista.direccion || null,
              idEspecialidad: dentista.id_especialidad || null,
              especialidad: dentista.especialidad || null,
              agendaOnline: dentista.agenda_online === 1,
              intervalo: dentista.intervalo || null,
              habilitado: dentista.habilitado === 1,
              contratosSucursal: contratos,
              horariosSucursal: horarios,
            });

            await this.professionalRepository.save(nuevoProfesional);
            profesionalesNuevos++;
            this.logger.log(
              `✅ Nuevo profesional agregado: ${dentista.nombre} ${dentista.apellidos || ''} (ID: ${dentista.id})`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error obteniendo profesionales: ${error.message}`);
      throw new HttpException(
        `Error al sincronizar profesionales: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const mensaje =
      sucursalesNuevas === 0 && profesionalesNuevos === 0
        ? 'No se encontraron nuevos registros para agregar'
        : `Sincronización completada: ${sucursalesNuevas} sucursales y ${profesionalesNuevos} profesionales nuevos`;

    this.logger.log(`✅ ${mensaje}`);

    return {
      sucursalesNuevas,
      profesionalesNuevos,
      mensaje,
    };
  }

  /**
   * Verifica si el cliente tiene datos sincronizados
   */
  async hasSyncedData(clientId: string): Promise<boolean> {
    const branchCount = await this.branchRepository.count({ where: { clientId } });
    const professionalCount = await this.professionalRepository.count({ where: { clientId } });
    return branchCount > 0 || professionalCount > 0;
  }

  /**
   * Obtiene estadísticas de sincronización
   * Solo cuenta profesionales con agenda online (los que se pueden mostrar)
   */
  async getSyncStats(clientId: string): Promise<{
    totalSucursales: number;
    totalProfesionales: number;
    sucursalesHabilitadas: number;
    profesionalesHabilitados: number;
    sucursalesActivas: number;
    profesionalesActivos: number;
  }> {
    const [totalSucursales, sucursalesHabilitadas, sucursalesActivas] = await Promise.all([
      this.branchRepository.count({ where: { clientId } }),
      this.branchRepository.count({ where: { clientId, habilitada: true } }),
      this.branchRepository.count({ where: { clientId, habilitada: true, activa: true } }),
    ]);

    // Solo contar profesionales con agenda online (los que se pueden mostrar en el panel)
    const [totalProfesionales, profesionalesHabilitados, profesionalesActivos] = await Promise.all([
      this.professionalRepository.count({ where: { clientId } }),
      this.professionalRepository.count({ where: { clientId, habilitado: true, agendaOnline: true } }),
      this.professionalRepository.count({ where: { clientId, habilitado: true, agendaOnline: true, activo: true } }),
    ]);

    return {
      totalSucursales,
      totalProfesionales,
      sucursalesHabilitadas,
      profesionalesHabilitados,
      sucursalesActivas,
      profesionalesActivos,
    };
  }

  // ============================================
  // TOGGLE ACTIVACIÓN LOCAL
  // ============================================

  /**
   * Activa/desactiva una sucursal localmente por su ID de Dentalink
   * No afecta Dentalink, solo el caché local
   */
  async toggleBranch(clientId: string, branchDentalinkId: number, activa: boolean): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { dentalinkId: branchDentalinkId, clientId },
    });

    if (!branch) {
      throw new HttpException('Sucursal no encontrada', HttpStatus.NOT_FOUND);
    }

    branch.activa = activa;
    await this.branchRepository.save(branch);

    this.logger.log(`${activa ? '✅' : '🔴'} Sucursal ${branch.nombre} ${activa ? 'activada' : 'desactivada'} localmente`);
    return branch;
  }

  /**
   * Actualiza la especialidad de un profesional localmente por su ID de Dentalink
   * No afecta Dentalink, solo el caché local
   */
  async updateProfessionalSpecialty(clientId: string, professionalDentalinkId: number, especialidad: string): Promise<Professional> {
    const professional = await this.professionalRepository.findOne({
      where: { dentalinkId: professionalDentalinkId, clientId },
    });

    if (!professional) {
      throw new HttpException('Profesional no encontrado', HttpStatus.NOT_FOUND);
    }

    professional.especialidad = especialidad;
    await this.professionalRepository.save(professional);

    this.logger.log(`✏️ Especialidad actualizada para ${professional.nombre}: ${especialidad}`);
    return professional;
  }

  /**
   * Activa/desactiva un profesional localmente por su ID de Dentalink
   * No afecta Dentalink, solo el caché local
   */
  async toggleProfessional(clientId: string, professionalDentalinkId: number, activo: boolean): Promise<Professional> {
    const professional = await this.professionalRepository.findOne({
      where: { dentalinkId: professionalDentalinkId, clientId },
    });

    if (!professional) {
      throw new HttpException('Profesional no encontrado', HttpStatus.NOT_FOUND);
    }

    professional.activo = activo;
    await this.professionalRepository.save(professional);

    this.logger.log(`${activo ? '✅' : '🔴'} Profesional ${professional.nombre} ${activo ? 'activado' : 'desactivado'} localmente`);
    return professional;
  }

  /**
   * Obtiene sucursales filtradas (solo activas por defecto)
   */
  async getActiveBranches(clientId: string): Promise<Branch[]> {
    return this.branchRepository.find({
      where: { clientId, habilitada: true, activa: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene todas las sucursales habilitadas en Dentalink (para panel admin)
   * Incluye activas e inactivas localmente para poder hacer toggle
   * Solo muestra las que están habilitadas en Dentalink
   */
  async getAllBranches(clientId: string): Promise<Branch[]> {
    return this.branchRepository.find({
      where: { clientId, habilitada: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene profesionales activos (habilitados en Dentalink + activos localmente)
   */
  async getActiveProfessionals(clientId: string): Promise<Professional[]> {
    return this.professionalRepository.find({
      where: { clientId, habilitado: true, activo: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene todos los profesionales habilitados en Dentalink (para panel admin)
   * Incluye activos e inactivos localmente para poder hacer toggle
   * Solo muestra los que están habilitados en Dentalink con agenda online
   */
  async getAllProfessionals(clientId: string): Promise<Professional[]> {
    return this.professionalRepository.find({
      where: { clientId, habilitado: true, agendaOnline: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene profesionales activos de una sucursal activa
   */
  async getActiveProfessionalsByBranch(clientId: string, branchDentalinkId: number): Promise<Professional[]> {
    // Verificar que la sucursal esté activa
    const branch = await this.branchRepository.findOne({
      where: { clientId, dentalinkId: branchDentalinkId },
    });

    if (!branch || !branch.activa) {
      return [];
    }

    const allProfessionals = await this.professionalRepository.find({
      where: { clientId, habilitado: true, activo: true },
      order: { nombre: 'ASC' },
    });

    return allProfessionals.filter((prof) => {
      const tieneContrato = prof.contratosSucursal?.includes(branchDentalinkId);
      const tieneHorario = prof.horariosSucursal?.includes(branchDentalinkId);
      return tieneContrato || tieneHorario;
    });
  }
}

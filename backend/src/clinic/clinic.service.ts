import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosRequestConfig } from 'axios';
import { Branch } from './entities/branch.entity';
import { Professional } from './entities/professional.entity';
import { ClientsService } from '../clients/clients.service';

interface DentalinkResponse<T> {
  data: T[];
  links?: { rel: string; href: string; method: string }[] | { next?: string; prev?: string };
}

@Injectable()
export class ClinicService {
  private readonly logger = new Logger(ClinicService.name);
  private readonly MAX_PAGES = 50; // Límite de seguridad para evitar loops infinitos

  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Professional)
    private professionalRepository: Repository<Professional>,
    private clientsService: ClientsService,
  ) {}

  /**
   * Método auxiliar para obtener todos los datos de un endpoint con paginación
   * Maneja tanto la paginación por links como por parámetro page
   */
  private async fetchAllPaginated<T>(
    baseUrl: string,
    headers: Record<string, string>,
    entityName: string,
  ): Promise<T[]> {
    const allData: T[] = [];
    let currentUrl = baseUrl;
    let pageCount = 0;

    while (currentUrl && pageCount < this.MAX_PAGES) {
      pageCount++;
      this.logger.log(`📄 ${entityName}: Obteniendo página ${pageCount}...`);

      try {
        const response = await axios.get<DentalinkResponse<T>>(currentUrl, { headers });

        if (response.status !== 200) {
          this.logger.warn(`⚠️ ${entityName}: Respuesta no exitosa en página ${pageCount}`);
          break;
        }

        const pageData = response.data?.data || [];
        this.logger.log(`📄 ${entityName}: Página ${pageCount} tiene ${pageData.length} registros`);
        
        if (pageData.length === 0) {
          // No hay más datos
          break;
        }

        allData.push(...pageData);

        // Buscar el link a la siguiente página
        const nextUrl = this.getNextPageUrl(response.data);
        
        if (!nextUrl || nextUrl === currentUrl) {
          // No hay más páginas o es la misma URL (evitar loop)
          break;
        }

        currentUrl = nextUrl;
      } catch (error) {
        this.logger.error(`❌ ${entityName}: Error en página ${pageCount}: ${error.message}`);
        throw error;
      }
    }

    if (pageCount >= this.MAX_PAGES) {
      this.logger.warn(`⚠️ ${entityName}: Se alcanzó el límite máximo de páginas (${this.MAX_PAGES})`);
    }

    this.logger.log(`✅ ${entityName}: Total obtenido: ${allData.length} registros en ${pageCount} página(s)`);
    return allData;
  }

  /**
   * Extrae la URL de la siguiente página de la respuesta de Dentalink
   */
  private getNextPageUrl<T>(response: DentalinkResponse<T>): string | null {
    if (!response.links) {
      return null;
    }

    // Formato 1: links es un array de objetos con rel/href
    if (Array.isArray(response.links)) {
      const nextLink = response.links.find(
        (link) => link.rel === 'next' || link.rel === 'siguiente',
      );
      return nextLink?.href || null;
    }

    // Formato 2: links es un objeto con propiedades next/prev
    if (typeof response.links === 'object') {
      return (response.links as { next?: string }).next || null;
    }

    return null;
  }

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
   * Tamaño del lote para bulk inserts
   */
  private readonly BATCH_SIZE = 100;

  /**
   * URLs base de las APIs
   */
  private readonly DENTALINK_BASE_URL = 'https://api.dentalink.healthatom.com/api/v1/';
  private readonly MEDILINK_BASE_URL = 'https://api.medilink2.healthatom.com/api/v5/';
  private readonly MEDILINK_PROFESSIONALS_V6_URL = 'https://api.medilink2.healthatom.com/api/v6/profesionales';

  /**
   * Determina qué APIs usar según el tipo de integración del cliente
   */
  private getApisToUse(client: any): Array<{ type: 'dentalink' | 'medilink'; baseUrl: string }> {
    const dentalinkIntegration = client.getIntegration('dentalink');
    const medilinkIntegration = client.getIntegration('medilink');
    const dualIntegration = client.getIntegration('dentalink_medilink');

    if (dualIntegration) {
      // Modo dual: usar ambas APIs
      this.logger.log('🔵 Modo dual: sincronizará desde Dentalink y Medilink');
      return [
        { type: 'dentalink', baseUrl: this.DENTALINK_BASE_URL },
        { type: 'medilink', baseUrl: this.MEDILINK_BASE_URL },
      ];
    } else if (medilinkIntegration) {
      // Solo Medilink
      this.logger.log('🔵 Usando API Medilink');
      return [
        { type: 'medilink', baseUrl: this.MEDILINK_BASE_URL },
      ];
    } else {
      // Default: Solo Dentalink
      this.logger.log('🔵 Usando API Dentalink');
      return [
        { type: 'dentalink', baseUrl: process.env.DENTALINK_BASE_URL || this.DENTALINK_BASE_URL },
      ];
    }
  }

  /**
   * Sincroniza sucursales y profesionales desde Dentalink/Medilink
   * Soporta integración dual (dentalink_medilink)
   * Solo agrega nuevos registros, no modifica los existentes
   * Usa bulk insert optimizado para clientes con muchos profesionales
   * @param force Si es true, elimina todos los datos antes de sincronizar
   */
  async syncFromDentalink(clientId: string, force: boolean = false): Promise<{
    sucursalesNuevas: number;
    profesionalesNuevos: number;
    totalSucursalesAPI: number;
    totalProfesionalesAPI: number;
    mensaje: string;
  }> {
    this.logger.log(`🔄 Iniciando sincronización para cliente ${clientId}${force ? ' (FORZADA)' : ''}`);

    // Si es forzada, eliminar datos existentes primero
    if (force) {
      await this.clearClinicData(clientId);
    }

    const client = await this.clientsService.findOne(clientId);
    const apiKey = client.apiKey;
    const apisToUse = this.getApisToUse(client);

    const headers = {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    let sucursalesNuevas = 0;
    let profesionalesNuevos = 0;
    let totalSucursalesAPI = 0;
    let totalProfesionalesAPI = 0;

    // Obtener IDs existentes una sola vez
    const existingBranches = await this.branchRepository.find({
      where: { clientId },
      select: ['dentalinkId'],
    });
    const existingBranchIds = new Set(existingBranches.map(b => b.dentalinkId));
    this.logger.log(`📍 Sucursales existentes en BD: ${existingBranchIds.size}`);

    const existingProfessionals = await this.professionalRepository.find({
      where: { clientId },
      select: ['dentalinkId'],
    });
    const existingProfIds = new Set(existingProfessionals.map(p => p.dentalinkId));
    this.logger.log(`👨‍⚕️ Profesionales existentes en BD: ${existingProfIds.size}`);

    // Sincronizar desde cada API configurada
    for (const api of apisToUse) {
      this.logger.log(`\n📡 Sincronizando desde ${api.type.toUpperCase()}...`);

      // 1. Sincronizar Sucursales
      try {
        this.logger.log(`📍 Obteniendo sucursales de ${api.type.toUpperCase()} (con paginación)...`);
        
        const sucursalesData = await this.fetchAllPaginated<any>(
          `${api.baseUrl}sucursales/`,
          headers,
          `Sucursales-${api.type}`,
        );
        
        const sucursalesFromApi = sucursalesData.length;
        totalSucursalesAPI += sucursalesFromApi;
        this.logger.log(`📍 Total de sucursales obtenidas de ${api.type.toUpperCase()}: ${sucursalesFromApi}`);

        // Filtrar solo las nuevas (que no existan ya en la BD)
        const newSucursales = sucursalesData.filter(s => !existingBranchIds.has(s.id));
        this.logger.log(`📍 Sucursales nuevas a insertar desde ${api.type}: ${newSucursales.length}`);

        // Bulk insert en lotes
        if (newSucursales.length > 0) {
          const branchEntities = newSucursales.map(sucursal => {
            // Agregar el ID al set para evitar duplicados en la siguiente API
            existingBranchIds.add(sucursal.id);
            
            return this.branchRepository.create({
              clientId,
              dentalinkId: sucursal.id,
              nombre: sucursal.nombre || 'Sin nombre',
              telefono: sucursal.telefono || null,
              ciudad: sucursal.ciudad || null,
              comuna: sucursal.comuna || null,
              direccion: sucursal.direccion || null,
              habilitada: sucursal.habilitada === 1,
            });
          });

          // Insertar en lotes
          for (let i = 0; i < branchEntities.length; i += this.BATCH_SIZE) {
            const batch = branchEntities.slice(i, i + this.BATCH_SIZE);
            await this.branchRepository.save(batch);
            this.logger.log(`📍 Insertadas ${Math.min(i + this.BATCH_SIZE, branchEntities.length)}/${branchEntities.length} sucursales de ${api.type}`);
          }

          sucursalesNuevas += newSucursales.length;
          this.logger.log(`✅ ${newSucursales.length} sucursales nuevas agregadas de ${api.type}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error obteniendo sucursales de ${api.type}: ${error.message}`);
        // En modo dual, continuar con la otra API; en modo simple, lanzar error
        if (apisToUse.length === 1) {
          throw new HttpException(
            `Error al sincronizar sucursales: ${error.message}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // 2. Sincronizar Profesionales
      try {
        this.logger.log(`👨‍⚕️ Obteniendo profesionales de ${api.type.toUpperCase()} (con paginación)...`);
        
        let profesionalesData: any[] = [];
        
        if (api.type === 'dentalink') {
          // Dentalink usa endpoint /dentistas
          profesionalesData = await this.fetchAllPaginated<any>(
            `${api.baseUrl}dentistas/`,
            headers,
            `Profesionales-${api.type}`,
          );
        } else {
          // Medilink usa endpoint v6/profesionales (no v5)
          profesionalesData = await this.fetchAllPaginated<any>(
            `${this.MEDILINK_PROFESSIONALS_V6_URL}?limit=100`,
            headers,
            `Profesionales-${api.type}`,
          );
        }
        
        const profesFromApi = profesionalesData.length;
        totalProfesionalesAPI += profesFromApi;
        this.logger.log(`👨‍⚕️ Total de profesionales obtenidos de ${api.type.toUpperCase()}: ${profesFromApi}`);

        // Filtrar solo los nuevos
        const newProfesionales = profesionalesData.filter(d => !existingProfIds.has(d.id));
        this.logger.log(`👨‍⚕️ Profesionales nuevos a insertar desde ${api.type}: ${newProfesionales.length}`);

        // Preparar entidades para bulk insert
        if (newProfesionales.length > 0) {
          const professionalEntities = newProfesionales.map(profesional => {
            // Agregar el ID al set para evitar duplicados en la siguiente API
            existingProfIds.add(profesional.id);
            
            // Filtrar y convertir arrays - APIs devuelven strings como "2" en lugar de números
            const contratos = Array.isArray(profesional.contratos_sucursal)
              ? profesional.contratos_sucursal
                  .map((id: any) => parseInt(id, 10))
                  .filter((id: number) => !isNaN(id))
              : [];
            const horarios = Array.isArray(profesional.horarios_sucursal)
              ? profesional.horarios_sucursal
                  .map((id: any) => parseInt(id, 10))
                  .filter((id: number) => !isNaN(id))
              : [];

            // Normalizar nombres de campos según API
            // Dentalink: nombre, apellidos, agenda_online, id_especialidad
            // Medilink: nombre, apellido (singular), agenda_online, id_especialidad
            const apellidos = profesional.apellidos || profesional.apellido || null;

            return this.professionalRepository.create({
              clientId,
              dentalinkId: profesional.id,
              rut: profesional.rut || null,
              nombre: profesional.nombre || 'Sin nombre',
              apellidos: apellidos,
              celular: profesional.celular || null,
              telefono: profesional.telefono || null,
              email: profesional.email || null,
              ciudad: profesional.ciudad || null,
              comuna: profesional.comuna || null,
              direccion: profesional.direccion || null,
              idEspecialidad: profesional.id_especialidad || null,
              especialidad: profesional.especialidad || null,
              agendaOnline: profesional.agenda_online === 1,
              intervalo: profesional.intervalo || null,
              habilitado: profesional.habilitado === 1,
              contratosSucursal: contratos,
              horariosSucursal: horarios,
            });
          });

          // Insertar en lotes
          for (let i = 0; i < professionalEntities.length; i += this.BATCH_SIZE) {
            const batch = professionalEntities.slice(i, i + this.BATCH_SIZE);
            await this.professionalRepository.save(batch);
            this.logger.log(`👨‍⚕️ Insertados ${Math.min(i + this.BATCH_SIZE, professionalEntities.length)}/${professionalEntities.length} profesionales de ${api.type}`);
          }

          profesionalesNuevos += newProfesionales.length;
          this.logger.log(`✅ ${newProfesionales.length} profesionales nuevos agregados de ${api.type}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error obteniendo profesionales de ${api.type}: ${error.message}`);
        // En modo dual, continuar con la otra API; en modo simple, lanzar error
        if (apisToUse.length === 1) {
          throw new HttpException(
            `Error al sincronizar profesionales: ${error.message}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }

    const apisUsadas = apisToUse.map(a => a.type.toUpperCase()).join(' + ');
    const mensaje =
      sucursalesNuevas === 0 && profesionalesNuevos === 0
        ? `No se encontraron nuevos registros para agregar (${apisUsadas} tiene ${totalSucursalesAPI} sucursales y ${totalProfesionalesAPI} profesionales)`
        : `Sincronización completada desde ${apisUsadas}: ${sucursalesNuevas} sucursales y ${profesionalesNuevos} profesionales nuevos (de ${totalSucursalesAPI} sucursales y ${totalProfesionalesAPI} profesionales en API)`;

    this.logger.log(`✅ ${mensaje}`);

    return {
      sucursalesNuevas,
      profesionalesNuevos,
      totalSucursalesAPI,
      totalProfesionalesAPI,
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

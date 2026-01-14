import { IntegrationConfig } from './integration.interface';

/**
 * Interfaz para integraciones que soporten configuración de clínica
 */
export interface IClinicProvider {
  /**
   * Obtiene las sucursales disponibles
   */
  getBranches(config: IntegrationConfig): Promise<BranchResult[]>;

  /**
   * Obtiene los profesionales disponibles
   */
  getProfessionals(config: IntegrationConfig): Promise<ProfessionalResult[]>;

  /**
   * Obtiene profesionales por sucursal
   */
  getProfessionalsByBranch(
    config: IntegrationConfig,
    branchId: number,
  ): Promise<ProfessionalResult[]>;
}

export interface BranchResult {
  id: number;
  name: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
  enabled: boolean;
}

export interface ProfessionalResult {
  id: number;
  internalId?: string;
  identifier?: string; // RUT, DNI, etc.
  firstName: string;
  lastName?: string;
  fullName: string;
  specialty?: string;
  interval?: number;
  branches: number[]; // IDs de sucursales
  enabled: boolean;
  onlineScheduling: boolean;
}

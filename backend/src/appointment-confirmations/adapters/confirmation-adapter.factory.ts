import { Injectable, Logger } from '@nestjs/common';
import { Client } from '../../clients/entities/client.entity';
import { IConfirmationAdapter } from './confirmation-adapter.interface';
import { DentalinkConfirmationAdapter } from './dentalink-confirmation.adapter';
import { ReservoConfirmationAdapter } from './reservo-confirmation.adapter';

@Injectable()
export class ConfirmationAdapterFactory {
  private readonly logger = new Logger(ConfirmationAdapterFactory.name);
  private readonly adapters: Map<string, IConfirmationAdapter>;

  constructor(
    private readonly dentalinkAdapter: DentalinkConfirmationAdapter,
    private readonly reservoAdapter: ReservoConfirmationAdapter,
  ) {
    this.adapters = new Map();
    this.adapters.set('dentalink', this.dentalinkAdapter);
    this.adapters.set('dentalink_medilink', this.dentalinkAdapter);
    this.adapters.set('reservo', this.reservoAdapter);
  }

  /**
   * Resuelve el adapter correcto según las integraciones del cliente.
   * Prioridad: reservo > dentalink_medilink > dentalink
   */
  getAdapterForClient(client: Client): IConfirmationAdapter {
    if (client.hasIntegration('reservo')) {
      return this.adapters.get('reservo');
    }
    if (client.hasIntegration('dentalink_medilink')) {
      return this.adapters.get('dentalink_medilink');
    }
    if (client.hasIntegration('dentalink')) {
      return this.adapters.get('dentalink');
    }
    // Fallback para clientes legacy que solo tienen apiKey
    this.logger.warn(`⚠️ Cliente ${client.id} sin integración conocida, usando Dentalink por defecto`);
    return this.adapters.get('dentalink');
  }

  /**
   * Obtiene adapter por nombre de plataforma directamente.
   */
  getAdapter(platform: string): IConfirmationAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Obtiene el adapter de Dentalink tipado para operaciones específicas
   * (getAppointmentStates, createBookysConfirmationState)
   */
  getDentalinkAdapter(): DentalinkConfirmationAdapter {
    return this.dentalinkAdapter;
  }
}

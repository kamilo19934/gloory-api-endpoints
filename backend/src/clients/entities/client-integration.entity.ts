import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Client } from './client.entity';
import { IntegrationType } from '../../integrations/common/interfaces';

@Entity('client_integrations')
@Unique(['clientId', 'integrationType'])
export class ClientIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({
    type: 'varchar',
    length: 50,
  })
  integrationType: IntegrationType;

  @Column({ default: true })
  isEnabled: boolean;

  /**
   * Configuración específica de la integración almacenada como JSON
   * Ejemplo para Dentalink: { apiKey: '...', timezone: 'America/Santiago' }
   * Ejemplo para GHL: { accessToken: '...', calendarId: '...', locationId: '...' }
   */
  @Column({ type: 'simple-json', nullable: true })
  config: Record<string, any>;

  /**
   * Última vez que se sincronizó datos de esta integración
   */
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  /**
   * Estado de la última sincronización
   */
  @Column({ nullable: true })
  lastSyncStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

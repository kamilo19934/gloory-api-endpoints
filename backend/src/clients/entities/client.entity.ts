import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ClientIntegration } from './client-integration.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Timezone por defecto del cliente
   */
  @Column({ default: 'America/Santiago' })
  timezone: string;

  /**
   * Integraciones configuradas para este cliente
   */
  @OneToMany(() => ClientIntegration, (integration) => integration.client, {
    cascade: true,
    eager: true,
  })
  integrations: ClientIntegration[];

  // ============================================
  // CAMPOS LEGACY - Para migración gradual
  // Estos campos se mantendrán temporalmente
  // ============================================

  @Column({ unique: true, nullable: true })
  apiKey: string; // Legacy: Dentalink API key

  @Column({ default: false })
  ghlEnabled: boolean; // Legacy: GHL enabled

  @Column({ nullable: true })
  ghlAccessToken: string; // Legacy: GHL token

  @Column({ nullable: true })
  ghlCalendarId: string; // Legacy: GHL calendar

  @Column({ nullable: true })
  ghlLocationId: string; // Legacy: GHL location

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Helper: Obtiene la configuración de una integración específica
   */
  getIntegration(type: string): ClientIntegration | undefined {
    return this.integrations?.find((i) => i.integrationType === type && i.isEnabled);
  }

  /**
   * Helper: Verifica si tiene una integración habilitada
   */
  hasIntegration(type: string): boolean {
    return !!this.getIntegration(type);
  }
}

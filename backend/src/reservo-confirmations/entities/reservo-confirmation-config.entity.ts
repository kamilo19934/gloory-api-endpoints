import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

/**
 * Configuración de confirmación de citas de Reservo para un cliente.
 * Permite configurar hasta 3 confirmaciones automáticas.
 * Independiente del sistema de confirmaciones de Dentalink.
 */
@Entity('reservo_confirmation_configs')
export class ReservoConfirmationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  /**
   * Nombre descriptivo de la configuración (ej: "Recordatorio 24h antes")
   */
  @Column()
  name: string;

  /**
   * Número de días antes de la cita para enviar confirmación
   */
  @Column({ type: 'int' })
  daysBeforeAppointment: number;

  /**
   * Hora a la que se debe enviar la confirmación (formato HH:mm, ej: "09:00")
   */
  @Column()
  timeToSend: string;

  /**
   * ID del calendario de GoHighLevel
   */
  @Column()
  ghlCalendarId: string;

  /**
   * Si está habilitada esta configuración
   */
  @Column({ default: true })
  isEnabled: boolean;

  /**
   * Orden de la configuración (1, 2 o 3)
   */
  @Column({ type: 'int' })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

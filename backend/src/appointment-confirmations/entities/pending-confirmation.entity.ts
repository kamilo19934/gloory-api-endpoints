import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { ConfirmationConfig } from './confirmation-config.entity';
import { NormalizedAppointmentData } from '../adapters/confirmation-adapter.interface';

export enum ConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Cita pendiente de confirmar.
 * Almacena citas obtenidas de cualquier plataforma (Dentalink, Reservo, etc.)
 * que deben ser sincronizadas con GHL.
 */
@Entity('pending_confirmations')
@Index(['scheduledFor', 'status'])
@Index(['clientId', 'confirmationConfigId', 'platform', 'platformAppointmentId'])
export class PendingConfirmation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  confirmationConfigId: string;

  @ManyToOne(() => ConfirmationConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'confirmationConfigId' })
  confirmationConfig: ConfirmationConfig;

  /**
   * Plataforma de origen: 'dentalink', 'reservo', etc.
   */
  @Column({ default: 'dentalink' })
  platform: string;

  /**
   * ID de la cita en la plataforma de origen.
   * Para Dentalink es el ID numérico como string ("12345").
   * Para Reservo es el UUID ("3fa85f64-5717-4562-b3fc-2c963f66afa6").
   */
  @Column({ default: '0' })
  platformAppointmentId: string;

  /**
   * Datos normalizados de la cita, independiente de la plataforma.
   * Todos los IDs son string para uniformidad.
   */
  @Column({ type: 'json' })
  appointmentData: NormalizedAppointmentData;

  /**
   * Estado de la confirmación
   */
  @Column({
    type: 'text',
    default: ConfirmationStatus.PENDING,
  })
  status: ConfirmationStatus;

  /**
   * Fecha y hora programada para enviar la confirmación
   */
  @Column({ type: 'datetime' })
  scheduledFor: Date;

  /**
   * ID del contacto creado/encontrado en GHL
   */
  @Column({ nullable: true })
  ghlContactId: string;

  /**
   * ID de la cita creada en GHL
   */
  @Column({ nullable: true })
  ghlAppointmentId: string;

  /**
   * Mensaje de error si falló el procesamiento
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  /**
   * Número de intentos de procesamiento
   */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  /**
   * Fecha de procesamiento
   */
  @Column({ type: 'datetime', nullable: true })
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

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
import { SacmedConfirmationConfig } from './sacmed-confirmation-config.entity';
import { ExecutionLog } from '../../appointment-confirmations/types/execution-log.type';

export enum SacmedConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Datos normalizados de una cita (evento) de Sacmed para sincronización con GHL.
 */
export interface SacmedNormalizedAppointment {
  // Paciente
  id_paciente: string; // identificación (RUT) — Sacmed no expone UUID de paciente
  nombre_paciente: string;
  rut_paciente?: string;
  email_paciente?: string;
  telefono_paciente?: string;

  // Cita
  fecha: string; // YYYY-MM-DD (timezone local)
  hora_inicio: string; // HH:mm:ss (timezone local)
  hora_fin: string;
  duracion: number; // minutos

  // Profesional
  id_profesional: string; // UUID (userId)
  nombre_profesional: string;

  // Estado
  estado_codigo: string; // statusEventId
  estado_descripcion: string; // statusEvent

  // Metadata
  modalidad?: string; // tipoServicio
}

/**
 * Cita (evento) de Sacmed pendiente de confirmar via GHL.
 * Totalmente independiente de los sistemas de confirmación de Dentalink y Reservo.
 */
@Entity('sacmed_pending_confirmations')
@Index(['scheduledFor', 'status'])
@Index(['clientId', 'configId', 'sacmedEventId'])
export class SacmedPendingConfirmation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  configId: string;

  @ManyToOne(() => SacmedConfirmationConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'configId' })
  config: SacmedConfirmationConfig;

  /**
   * ID del evento (cita) en Sacmed
   */
  @Column()
  sacmedEventId: string;

  /**
   * Datos normalizados de la cita
   */
  @Column({ type: 'json' })
  appointmentData: SacmedNormalizedAppointment;

  /**
   * Estado de la confirmación
   */
  @Column({
    type: 'text',
    default: SacmedConfirmationStatus.PENDING,
  })
  status: SacmedConfirmationStatus;

  /**
   * Fecha y hora programada para enviar la confirmación
   */
  @Column()
  scheduledFor: Date;

  /**
   * ID del contacto creado/encontrado en GHL
   */
  @Column({ nullable: true })
  ghlContactId: string;

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
   * Log paso-a-paso de cada intento de procesamiento.
   */
  @Column({ type: 'json', nullable: true })
  executionLog: ExecutionLog | null;

  /**
   * Fecha de procesamiento exitoso
   */
  @Column({ nullable: true })
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

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
import { ReservoConfirmationConfig } from './reservo-confirmation-config.entity';

export enum ReservoConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Datos normalizados de una cita de Reservo para sincronización con GHL.
 */
export interface ReservoNormalizedAppointment {
  // Paciente
  id_paciente: string;
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
  id_profesional: string;
  nombre_profesional: string;

  // Tratamiento
  id_tratamiento: string;
  nombre_tratamiento: string;

  // Sucursal
  id_sucursal: string;
  nombre_sucursal: string;

  // Estado
  estado_codigo: string; // 'NC', 'C', 'S'
  estado_descripcion: string;

  // Metadata
  comentarios?: string;
}

/**
 * Cita de Reservo pendiente de confirmar via GHL.
 * Totalmente independiente del sistema de confirmaciones de Dentalink.
 */
@Entity('reservo_pending_confirmations')
@Index(['scheduledFor', 'status'])
@Index(['clientId', 'configId', 'reservoAppointmentUuid'])
export class ReservoPendingConfirmation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  configId: string;

  @ManyToOne(() => ReservoConfirmationConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'configId' })
  config: ReservoConfirmationConfig;

  /**
   * UUID de la cita en Reservo
   */
  @Column()
  reservoAppointmentUuid: string;

  /**
   * Datos normalizados de la cita
   */
  @Column({ type: 'json' })
  appointmentData: ReservoNormalizedAppointment;

  /**
   * Estado de la confirmación
   */
  @Column({
    type: 'text',
    default: ReservoConfirmationStatus.PENDING,
  })
  status: ReservoConfirmationStatus;

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
   * Fecha de procesamiento exitoso
   */
  @Column({ nullable: true })
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

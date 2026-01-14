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

export enum ConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Cita pendiente de confirmar
 * Almacena las citas obtenidas de Dentalink que deben ser sincronizadas con GHL
 */
@Entity('pending_confirmations')
@Index(['scheduledFor', 'status'])
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
   * ID de la cita en Dentalink
   */
  @Column()
  dentalinkAppointmentId: number;

  /**
   * Datos de la cita obtenidos de Dentalink
   */
  @Column({ type: 'json' })
  appointmentData: {
    id_paciente: number;
    nombre_paciente: string;
    nombre_social_paciente?: string;
    email_paciente?: string;
    telefono_paciente?: string;
    id_tratamiento: number;
    nombre_tratamiento: string;
    fecha: string; // YYYY-MM-DD
    hora_inicio: string; // HH:mm:ss
    hora_fin: string;
    duracion: number;
    id_dentista: number;
    nombre_dentista: string;
    id_sucursal: number;
    nombre_sucursal: string;
    id_estado: number;
    estado_cita: string;
    motivo_atencion?: string;
    comentarios?: string;
  };

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
  @Column({ type: 'timestamp' })
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
  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

@Entity('ghl_calendars')
@Index(['clientId', 'calendarId'], { unique: true })
export class GHLCalendar {
  @PrimaryColumn()
  clientId: string;

  @PrimaryColumn()
  id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  calendarId: string; // UUID del calendario en GoHighLevel

  @Column()
  nombre: string; // Nombre del profesional/calendario

  @Column({ nullable: true })
  slotDuration: number; // Duración de la cita en minutos (from GHL API)

  @Column({ nullable: true })
  slotInterval: number; // Minutos entre slots disponibles (from GHL API)

  @Column({ nullable: true })
  especialidad: string; // Editable por admin

  @Column({ default: true })
  activo: boolean; // Toggle local

  // Array de IDs de GHLBranch asignadas
  @Column({ type: 'simple-json', nullable: true })
  branches: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

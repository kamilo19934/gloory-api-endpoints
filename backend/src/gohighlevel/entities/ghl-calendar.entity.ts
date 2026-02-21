import {
  Entity,
  PrimaryGeneratedColumn,
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
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  calendarId: string; // UUID del calendario en GoHighLevel

  @Column()
  nombre: string; // Nombre del profesional/calendario

  @Column({ default: 30 })
  slotDuration: number; // Minutos por slot

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

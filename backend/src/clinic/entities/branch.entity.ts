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

@Entity('branches')
@Index(['clientId', 'dentalinkId'], { unique: true })
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  dentalinkId: number; // ID de Dentalink

  @Column({ nullable: true })
  externalId: string; // ID externo genérico (UUID para Reservo, etc.)

  @Column()
  nombre: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  ciudad: string;

  @Column({ nullable: true })
  comuna: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ default: true })
  habilitada: boolean;

  /**
   * Estado local (controlado por el usuario)
   * Si es false, la sucursal no aparece en búsquedas
   */
  @Column({ default: true })
  activa: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

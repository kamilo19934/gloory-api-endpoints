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

@Entity('professionals')
@Index(['clientId', 'dentalinkId'], { unique: true })
export class Professional {
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

  @Column({ nullable: true })
  rut: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  apellidos: string;

  @Column({ nullable: true })
  celular: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  ciudad: string;

  @Column({ nullable: true })
  comuna: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  idEspecialidad: number;

  @Column({ nullable: true })
  especialidad: string;

  @Column({ default: false })
  agendaOnline: boolean;

  @Column({ nullable: true })
  intervalo: number; // Minutos entre citas

  @Column({ default: true })
  habilitado: boolean;

  /**
   * Estado local (controlado por el usuario)
   * Si es false, el profesional no aparece en búsquedas
   */
  @Column({ default: true })
  activo: boolean;

  // Array de IDs de sucursales donde tiene contrato
  @Column({ type: 'simple-json', nullable: true })
  contratosSucursal: number[];

  // Array de IDs de sucursales donde tiene horario configurado
  @Column({ type: 'simple-json', nullable: true })
  horariosSucursal: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

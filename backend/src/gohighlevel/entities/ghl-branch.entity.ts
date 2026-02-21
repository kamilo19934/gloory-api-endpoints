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

@Entity('ghl_branches')
@Index(['clientId'])
export class GHLBranch {
  @PrimaryGeneratedColumn('increment')
  id: number; // Auto-increment para IDs simples (1, 2, 3...)

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  ciudad: string;

  @Column({ nullable: true })
  comuna: string;

  @Column({ default: true })
  activa: boolean; // Toggle local

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

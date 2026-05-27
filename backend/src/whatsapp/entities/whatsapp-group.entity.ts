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
 * Representa un grupo de WhatsApp detectado por el bot.
 * Los grupos se descubren automáticamente cuando el bot es agregado a ellos
 * (via event `group-participants.update` de Baileys).
 *
 * Cada grupo puede ser vinculado a un Cliente de la plataforma, habilitando
 * el agente AI de soporte para ese grupo específico.
 */
@Entity('whatsapp_groups')
export class WhatsAppGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * JID del grupo en WhatsApp. Formato: '120363XXXXX@g.us'
   */
  @Column({ type: 'varchar', unique: true })
  groupJid: string;

  @Column()
  groupName: string;

  @Column({ type: 'text', nullable: true })
  groupDescription: string;

  @Column({ type: 'int', default: 0 })
  participantCount: number;

  /**
   * Cliente de la plataforma al que está vinculado este grupo.
   * Null = grupo sin vincular.
   */
  @Column({ type: 'varchar', nullable: true })
  linkedClientId: string | null;

  @ManyToOne(() => Client, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'linkedClientId' })
  linkedClient: Client;

  /**
   * Si true, los mensajes del grupo se reenvían al servidor AI para procesamiento.
   */
  @Column({ default: false })
  aiEnabled: boolean;

  /**
   * Tiempo en segundos que el sistema espera antes de enviar un batch de mensajes
   * al servidor AI. Si llega un nuevo mensaje dentro de este tiempo, el timer
   * se resetea. Esto evita procesar mensajes parciales mientras el usuario escribe.
   * 0 = procesar inmediatamente (útil para testing).
   */
  @Column({ type: 'int', default: 60 })
  debounceSeconds: number;

  /**
   * Estado del grupo: 'active' | 'inactive' | 'removed'
   * varchar en vez de DB enum por compatibilidad con SQLite.
   */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  /**
   * Metadata raw de Baileys (groupMetadata result).
   * Se guarda para referencia/debugging.
   */
  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  lastMessageAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

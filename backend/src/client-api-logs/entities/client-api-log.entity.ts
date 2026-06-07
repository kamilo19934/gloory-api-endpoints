import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

export type StatusCategory = '2xx' | '4xx' | '5xx';

@Entity('client_api_logs')
@Index(['clientId', 'createdAt'])
@Index(['clientId', 'statusCategory'])
@Index(['clientId', 'threadId'])
export class ClientApiLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  // Request info
  @Column({ length: 10 })
  method: string; // GET, POST, PUT, DELETE, PATCH

  @Column({ length: 100 })
  endpoint: string; // availability, patients/search, appointments, etc.

  @Column({ length: 255 })
  fullPath: string; // /api/clients/:clientId/appointments

  @Column({ type: 'simple-json', nullable: true })
  requestBody: Record<string, any> | null;

  // Response info
  @Column({ type: 'int' })
  statusCode: number; // 200, 201, 400, 404, 500, etc.

  @Column({ length: 3 })
  statusCategory: StatusCategory; // '2xx', '4xx', '5xx'

  @Column({ type: 'simple-json', nullable: true })
  responseBody: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  // Metadata
  @Column({ type: 'int' })
  duration: number; // Response time in ms

  @Column({ length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ length: 500, nullable: true })
  userAgent: string | null;

  // Trazabilidad del agente (Gloory AI) — llega vía headers X-Gloory-*
  // Permite correlacionar cada tool call con el thread/conversación que la originó.
  @Column({ length: 255, nullable: true })
  threadId: string | null; // X-Gloory-Thread-Id

  @Column({ type: 'int', nullable: true })
  turn: number | null; // X-Gloory-Turn (turno del usuario o paso de LangGraph)

  @Column({ length: 255, nullable: true })
  agentUserId: string | null; // X-Gloory-User-Id (contact_id del CRM)

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  /**
   * Helper: Determina la categoría de status
   */
  static getStatusCategory(statusCode: number): StatusCategory {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    return '5xx';
  }
}

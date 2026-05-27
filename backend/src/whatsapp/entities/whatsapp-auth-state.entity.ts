import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Almacena el estado de autenticación de Baileys en la base de datos.
 * Reemplaza `useMultiFileAuthState` (que usa filesystem) para permitir
 * persistencia en containers efímeros (Railway/Render).
 *
 * Cada fila representa un archivo del auth state:
 * - `creds`: credenciales principales
 * - `pre-key-<id>`: pre-keys del protocolo Signal
 * - `session-<id>`: sesiones
 * - `app-state-sync-key-<id>`: keys de sincronización
 * - etc.
 */
@Entity('whatsapp_auth_state')
export class WhatsAppAuthState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identificador único del valor de auth state.
   * Ejemplos: 'creds', 'pre-key-1', 'app-state-sync-key-AABB'
   */
  @Column({ type: 'varchar', unique: true })
  key: string;

  /**
   * JSON serializado del valor (usando BufferJSON de Baileys para manejar Buffers).
   */
  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

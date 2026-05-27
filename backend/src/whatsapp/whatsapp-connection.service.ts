import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, Observable } from 'rxjs';
import makeWASocket, {
  DisconnectReason,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { WhatsAppAuthState } from './entities/whatsapp-auth-state.entity';
import { useDbAuthState } from './helpers/use-db-auth-state';
import { WhatsAppGroupService } from './whatsapp-group.service';
import { WhatsAppMessageService } from './whatsapp-message.service';

/**
 * Estado del stream SSE que se envía al frontend mientras se genera el QR.
 */
export interface QrStreamEvent {
  type: 'qr' | 'connected' | 'disconnected' | 'error';
  data?: string | { phoneNumber?: string };
  message?: string;
}

/**
 * Estado de conexión del socket de Baileys.
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/**
 * Servicio singleton que gestiona el socket de Baileys (WhatsApp Web).
 *
 * Responsabilidades:
 * - Mantener un único socket activo con WhatsApp
 * - Generar QR codes y emitirlos via Subject RxJS para SSE
 * - Persistir auth state en DB (via useDbAuthState)
 * - Reconexión automática con backoff exponencial
 * - Delegar eventos de grupos y mensajes a los servicios correspondientes
 */
@Injectable()
export class WhatsAppConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppConnectionService.name);

  private sock: WASocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private connectedAt: Date | null = null;
  private phoneNumber: string | null = null;

  private retryCount = 0;
  private readonly MAX_RETRIES = 5;
  private retryTimer: NodeJS.Timeout | null = null;

  /** Subject que emite eventos para el stream SSE de QR */
  private qrSubject = new Subject<QrStreamEvent>();

  /** Referencia al helper de auth state (para poder limpiar en disconnect) */
  private authHelper: Awaited<ReturnType<typeof useDbAuthState>> | null = null;

  constructor(
    @InjectRepository(WhatsAppAuthState)
    private readonly authRepo: Repository<WhatsAppAuthState>,
    @Inject(forwardRef(() => WhatsAppGroupService))
    private readonly groupService: WhatsAppGroupService,
    @Inject(forwardRef(() => WhatsAppMessageService))
    private readonly messageService: WhatsAppMessageService,
  ) {}

  /**
   * Al arrancar el módulo, si existe auth state en DB, auto-reconectar.
   */
  async onModuleInit(): Promise<void> {
    try {
      const existingCreds = await this.authRepo.findOne({
        where: { key: 'creds' },
      });

      if (existingCreds) {
        this.logger.log('Auth state encontrado en DB, intentando reconexión automática...');
        await this.connect();
      } else {
        this.logger.log(
          'Sin auth state en DB. Esperando conexión manual via /api/whatsapp/connect',
        );
      }
    } catch (error) {
      this.logger.error(`Error durante auto-reconexión: ${(error as Error).message}`);
    }
  }

  /**
   * Al destruir el módulo, cerrar el socket de forma limpia.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {
        // ignorar
      }
    }
  }

  /**
   * Inicia una nueva conexión con WhatsApp.
   * Si ya hay una conexión activa, la termina primero.
   * @param isRetry true cuando se llama desde el retry interno (no bloquea)
   */
  async connect(isRetry = false): Promise<void> {
    if (this.status === 'connecting' && !isRetry) {
      this.logger.warn('Ya hay una conexión en progreso');
      return;
    }

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {
        // ignorar
      }
      this.sock = null;
    }

    this.status = 'connecting';

    try {
      this.authHelper = await useDbAuthState(this.authRepo);

      // Obtener la versión más reciente del protocolo WA desde GitHub
      // La versión bundled en el paquete puede estar desactualizada y WhatsApp
      // la rechaza con status 405 (Connection Failure)
      const { version } = await fetchLatestBaileysVersion();
      this.logger.log(`Usando versión WA: ${version.join('.')}`);

      // Logger que filtra ruido de Baileys (init queries errors son normales)
      const baileysLogger: any = {
        level: 'warn',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: (...args: any[]) => {
          const msg = JSON.stringify(args);
          if (msg.includes('init queries')) return; // normal, no afecta
          this.logger.warn(`[Baileys] ${msg}`);
        },
        error: (...args: any[]) => {
          const msg = JSON.stringify(args);
          if (msg.includes('init queries')) return; // normal, no afecta
          this.logger.error(`[Baileys] ${msg}`);
        },
      };
      baileysLogger.child = () => baileysLogger;

      this.sock = makeWASocket({
        version,
        auth: this.authHelper.state,
        browser: ['Gloory AI', 'Chrome', '125.0.6422.112'],
        logger: baileysLogger,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        qrTimeout: 60_000,
      });

      this.setupEventListeners();
    } catch (error) {
      this.logger.error(`Error al crear socket: ${(error as Error).message}`);
      this.status = 'disconnected';
      throw error;
    }
  }

  /**
   * Configura los listeners de Baileys sobre el socket actual.
   */
  private setupEventListeners(): void {
    if (!this.sock) return;

    // Persistir credenciales cuando cambien
    this.sock.ev.on('creds.update', async () => {
      if (this.authHelper) {
        await this.authHelper.saveCreds();
      }
    });

    // Eventos de conexión (QR, open, close)
    this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));

    // Eventos de grupos (bot agregado/removido, cambios de participantes)
    this.sock.ev.on('group-participants.update', async (event) => {
      try {
        await this.groupService.handleParticipantUpdate(event);
      } catch (error) {
        this.logger.error(`Error al procesar participantes del grupo: ${(error as Error).message}`);
      }
    });

    // Mensajes entrantes
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          await this.messageService.handleIncomingMessage(msg);
        } catch (error) {
          this.logger.error(`Error al procesar mensaje: ${(error as Error).message}`);
        }
      }
    });
  }

  /**
   * Maneja eventos de `connection.update`:
   * - qr: Genera data URI y lo emite via SSE
   * - open: Conexión exitosa, sincronizar grupos
   * - close: Determinar si reintentar o terminar
   */
  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    this.logger.debug(
      `connection.update: connection=${connection}, qr=${qr ? 'present' : 'none'}, ` +
        `lastDisconnect=${lastDisconnect ? JSON.stringify(lastDisconnect.error?.message || lastDisconnect) : 'none'}`,
    );

    if (qr) {
      try {
        const dataUri = await QRCode.toDataURL(qr);
        this.qrSubject.next({ type: 'qr', data: dataUri });
        this.logger.log('QR code generado y emitido');
      } catch (error) {
        this.logger.error(`Error al convertir QR: ${(error as Error).message}`);
      }
    }

    if (connection === 'open') {
      this.status = 'connected';
      this.connectedAt = new Date();
      this.retryCount = 0;
      this.phoneNumber = this.sock?.user?.id?.split(':')[0] || null;
      this.logger.log(`Conectado a WhatsApp. Número: ${this.phoneNumber || 'desconocido'}`);

      this.qrSubject.next({
        type: 'connected',
        data: { phoneNumber: this.phoneNumber || undefined },
      });

      // Sincronizar grupos después de un pequeño delay para que el socket
      // termine de inicializar
      setTimeout(async () => {
        try {
          await this.groupService.syncAllGroups();
        } catch (error) {
          this.logger.error(`Error sincronizando grupos: ${(error as Error).message}`);
        }
      }, 3000);
    }

    if (connection === 'close') {
      const boomError = lastDisconnect?.error as Boom | undefined;
      const statusCode = boomError?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      this.logger.warn(`Conexión cerrada. StatusCode: ${statusCode}, LoggedOut: ${isLoggedOut}`);

      if (isLoggedOut) {
        // Sesión invalidada → limpiar auth state
        this.status = 'disconnected';
        this.connectedAt = null;
        this.phoneNumber = null;
        if (this.authHelper) {
          await this.authHelper.clearAll();
        }
        this.qrSubject.next({
          type: 'disconnected',
          message: 'Sesión cerrada por el usuario',
        });
        return;
      }

      // Reintentar con backoff exponencial
      if (this.retryCount < this.MAX_RETRIES) {
        const delayMs = Math.pow(2, this.retryCount) * 2000;
        this.retryCount += 1;
        this.logger.log(
          `Reintentando conexión en ${delayMs / 1000}s (intento ${this.retryCount}/${this.MAX_RETRIES})`,
        );
        this.status = 'connecting';
        this.retryTimer = setTimeout(() => {
          this.connect(true).catch((err) => {
            this.logger.error(`Error en reintento: ${(err as Error).message}`);
          });
        }, delayMs);
      } else {
        this.logger.error(
          `Se alcanzó el máximo de reintentos (${this.MAX_RETRIES}). Conexión abandonada.`,
        );
        this.status = 'disconnected';
        this.retryCount = 0;
        this.qrSubject.next({
          type: 'error',
          message: 'No se pudo reconectar a WhatsApp después de varios intentos',
        });
      }
    }
  }

  /**
   * Cierra la sesión activa y limpia el auth state de DB.
   */
  async disconnect(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (error) {
        this.logger.warn(`Error en logout (ignorable): ${(error as Error).message}`);
      }
      try {
        this.sock.end(undefined);
      } catch {
        // ignorar
      }
      this.sock = null;
    }

    if (this.authHelper) {
      await this.authHelper.clearAll();
      this.authHelper = null;
    }

    this.status = 'disconnected';
    this.connectedAt = null;
    this.phoneNumber = null;
    this.retryCount = 0;

    this.qrSubject.next({
      type: 'disconnected',
      message: 'Desconectado manualmente',
    });

    this.logger.log('WhatsApp desconectado');
  }

  /**
   * Retorna el estado actual de la conexión.
   */
  getStatus(): {
    status: ConnectionStatus;
    phoneNumber: string | null;
    connectedAt: Date | null;
  } {
    return {
      status: this.status,
      phoneNumber: this.phoneNumber,
      connectedAt: this.connectedAt,
    };
  }

  /**
   * Retorna el socket activo. Null si no hay conexión.
   */
  getSocket(): WASocket | null {
    return this.sock;
  }

  /**
   * Observable para el stream SSE de eventos de conexión (QR, open, close).
   */
  getQrStream(): Observable<QrStreamEvent> {
    return this.qrSubject.asObservable();
  }

  /**
   * Health check proactivo del socket de Baileys.
   * Baileys puede desconectarse silenciosamente sin disparar connection.update.
   * Este cron verifica cada 2 minutos que el socket realmente responde.
   */
  @Cron('*/2 * * * *')
  async healthCheck(): Promise<void> {
    if (this.status !== 'connected' || !this.sock) return;

    try {
      await this.sock.sendPresenceUpdate('available');
    } catch (error) {
      this.logger.warn(`Health check falló: ${(error as Error).message}. Reconectando...`);
      this.status = 'disconnected';
      try {
        await this.connect(true);
      } catch (reconnectError) {
        this.logger.error(
          `Error en reconexión post-healthcheck: ${(reconnectError as Error).message}`,
        );
      }
    }
  }
}

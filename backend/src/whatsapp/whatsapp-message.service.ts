import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  forwardRef,
  Inject,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WAMessage } from '@whiskeysockets/baileys';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { WhatsAppGroupService } from './whatsapp-group.service';
import { WhatsAppConnectionService } from './whatsapp-connection.service';

interface BatchMessage {
  text: string;
  senderName: string;
  senderJid: string;
  receivedAt: string; // ISO 8601
}

interface PendingBatch {
  clientId: string;
  messages: BatchMessage[];
  timer: NodeJS.Timeout;
}

interface OutboundMessage {
  groupJid: string;
  text: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

/**
 * Procesa mensajes entrantes de WhatsApp con debounce buffer y los reenvía
 * al servidor AI. También maneja las respuestas que llegan del servidor AI
 * via webhook, con rate limiting de mensajes salientes.
 *
 * Flujo entrada:
 *   Mensaje (Baileys) → filtros → buffer por grupo → timer expira → POST batch al AI server
 *
 * Flujo salida:
 *   AI server → POST webhook → cola de salida (1.5s entre mensajes) → sock.sendMessage
 */
@Injectable()
export class WhatsAppMessageService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppMessageService.name);

  /** Buffer de mensajes pendientes por grupo (debounce). Key = groupJid */
  private pendingBatches = new Map<string, PendingBatch>();

  /** Cola de mensajes salientes con rate limiting */
  private outboundQueue: OutboundMessage[] = [];
  private isProcessingOutbound = false;

  constructor(
    @Inject(forwardRef(() => WhatsAppGroupService))
    private readonly groupService: WhatsAppGroupService,
    @Inject(forwardRef(() => WhatsAppConnectionService))
    private readonly connectionService: WhatsAppConnectionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Graceful shutdown: flush todos los batches pendientes antes de limpiar.
   * Evita perder mensajes en cada deploy.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Graceful shutdown: flushing batches pendientes...');
    const flushPromises: Promise<void>[] = [];
    for (const [groupJid, batch] of this.pendingBatches.entries()) {
      clearTimeout(batch.timer);
      flushPromises.push(
        this.flushBatch(groupJid).catch((err) =>
          this.logger.error(`Error flushing batch para ${groupJid}: ${(err as Error).message}`),
        ),
      );
    }
    await Promise.all(flushPromises);
    this.pendingBatches.clear();
    this.logger.log('Todos los batches flushed');
  }

  // ============================================
  // ENTRADA: Mensajes de WhatsApp → buffer → AI server
  // ============================================

  /**
   * Procesa un mensaje entrante del evento `messages.upsert` de Baileys.
   * Aplica filtros y lo agrega al buffer de debounce del grupo.
   */
  async handleIncomingMessage(msg: WAMessage): Promise<void> {
    if (msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || !remoteJid.endsWith('@g.us')) return;

    const text = this.extractMessageText(msg);
    if (!text) return;

    const group = await this.groupService.findByJid(remoteJid);
    if (!group) return;
    if (!group.aiEnabled) return;
    if (!group.linkedClientId) return;

    const senderJid = msg.key.participant || remoteJid;
    const senderName = msg.pushName || 'Desconocido';

    this.addToBatch(
      remoteJid,
      group.linkedClientId,
      {
        text,
        senderName,
        senderJid,
        receivedAt: new Date().toISOString(),
      },
      group.debounceSeconds,
    );
  }

  /**
   * Agrega un mensaje al buffer del grupo y resetea el timer de debounce.
   * Si debounceSeconds es 0, envía inmediatamente.
   */
  private addToBatch(
    groupJid: string,
    clientId: string,
    message: BatchMessage,
    debounceSeconds: number,
  ): void {
    const existing = this.pendingBatches.get(groupJid);

    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(message);
    } else {
      this.pendingBatches.set(groupJid, {
        clientId,
        messages: [message],
        timer: null as any, // se setea abajo
      });
    }

    const batch = this.pendingBatches.get(groupJid)!;

    // debounceSeconds = 0 → flush inmediato
    if (debounceSeconds <= 0) {
      batch.timer = setTimeout(() => this.flushBatch(groupJid), 0);
    } else {
      batch.timer = setTimeout(() => this.flushBatch(groupJid), debounceSeconds * 1000);
    }
  }

  /**
   * Envía el batch acumulado al AI server con un correlationId para tracing.
   */
  private async flushBatch(groupJid: string): Promise<void> {
    const batch = this.pendingBatches.get(groupJid);
    if (!batch || batch.messages.length === 0) {
      this.pendingBatches.delete(groupJid);
      return;
    }

    const correlationId = randomUUID();
    const { clientId, messages } = batch;
    this.pendingBatches.delete(groupJid);

    // Enriquecer payload con datos del cliente (nombre + notionPageId)
    const group = await this.groupService.findByJid(groupJid);
    const clientName = group?.linkedClient?.name || 'Cliente desconocido';
    const notionClientPageId = (group?.linkedClient as any)?.notionPageId || null;

    this.logger.log(
      `[${correlationId}] Flushing batch: ${messages.length} mensaje(s) para ${groupJid} (${clientName})`,
    );

    await this.forwardToAIServer({
      correlationId,
      groupJid,
      clientId,
      clientName,
      notionClientPageId,
      messages,
    });
  }

  private extractMessageText(msg: WAMessage): string | null {
    const m = msg.message;
    if (!m) return null;
    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      null
    );
  }

  /**
   * POST fire-and-forget al servidor Python/LangChain con el batch completo.
   */
  private async forwardToAIServer(payload: {
    correlationId: string;
    groupJid: string;
    clientId: string;
    clientName: string;
    notionClientPageId: string | null;
    messages: BatchMessage[];
  }): Promise<void> {
    const aiServerUrl = this.configService.get<string>('WHATSAPP_AI_SERVER_URL');
    if (!aiServerUrl) {
      this.logger.debug(
        `[${payload.correlationId}] WHATSAPP_AI_SERVER_URL no configurada, batch ignorado`,
      );
      return;
    }

    try {
      await axios.post(aiServerUrl, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });
      this.logger.log(
        `[${payload.correlationId}] Batch enviado al AI server: ${payload.messages.length} msg(s)`,
      );
    } catch (error) {
      this.logger.error(
        `[${payload.correlationId}] Error enviando batch al AI server: ${(error as Error).message}`,
      );
    }
  }

  // ============================================
  // SALIDA: Webhook del AI server → cola rate-limited → WhatsApp
  // ============================================

  /**
   * Recibe una respuesta del servidor AI via webhook y la encola para envío.
   * Verifica que el grupo exista y esté activo.
   */
  async handleAIResponse(groupJid: string, message: string): Promise<void> {
    if (!groupJid || !message) {
      throw new BadRequestException('groupJid y message son requeridos');
    }

    const group = await this.groupService.findByJid(groupJid);
    if (!group) {
      throw new NotFoundException(`Grupo con JID ${groupJid} no encontrado`);
    }

    if (group.status !== 'active') {
      throw new BadRequestException(
        `El grupo ${group.groupName} no está activo (status: ${group.status})`,
      );
    }

    await this.sendMessageToGroup(groupJid, message);
  }

  /**
   * Encola un mensaje para envío con rate limiting (1.5s entre mensajes).
   * WhatsApp banea agresivamente si se envían muchos mensajes seguidos.
   */
  sendMessageToGroup(groupJid: string, text: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.outboundQueue.push({ groupJid, text, resolve, reject });
      if (!this.isProcessingOutbound) {
        this.processOutboundQueue();
      }
    });
  }

  private async processOutboundQueue(): Promise<void> {
    this.isProcessingOutbound = true;

    while (this.outboundQueue.length > 0) {
      const item = this.outboundQueue.shift()!;
      const sock = this.connectionService.getSocket();

      if (!sock) {
        item.reject(new BadRequestException('WhatsApp no está conectado'));
        continue;
      }

      try {
        await sock.sendMessage(item.groupJid, { text: item.text });
        this.logger.log(`Mensaje enviado a ${item.groupJid}`);
        item.resolve();
      } catch (error) {
        this.logger.error(`Error enviando mensaje a ${item.groupJid}: ${(error as Error).message}`);
        item.reject(error as Error);
      }

      // Rate limit: 1.5s entre mensajes salientes
      if (this.outboundQueue.length > 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    this.isProcessingOutbound = false;
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Sse,
  MessageEvent,
  UnauthorizedException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, map } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { WhatsAppGroupService } from './whatsapp-group.service';
import { WhatsAppMessageService } from './whatsapp-message.service';
import { UpdateWhatsAppGroupDto } from './dto/update-whatsapp-group.dto';
import { AIWebhookResponseDto } from './dto/ai-webhook-response.dto';

/** TTL para cache de idempotencia del webhook (5 minutos) */
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  /** Cache de responseIds procesados para idempotencia. Key = responseId, Value = timestamp */
  private processedResponses = new Map<string, number>();

  constructor(
    private readonly connectionService: WhatsAppConnectionService,
    private readonly groupService: WhatsAppGroupService,
    private readonly messageService: WhatsAppMessageService,
    private readonly configService: ConfigService,
  ) {
    // Limpiar entradas expiradas cada minuto
    setInterval(() => this.cleanIdempotencyCache(), 60_000);
  }

  // ============================================
  // CONEXIÓN (Admin - requieren JWT)
  // ============================================

  /**
   * Estado actual de la conexión con WhatsApp.
   */
  @Get('status')
  getStatus() {
    return this.connectionService.getStatus();
  }

  /**
   * Inicia una nueva conexión con WhatsApp.
   * Después de llamar este endpoint, el frontend debe abrir un EventSource
   * a `/api/whatsapp/connect/qr` para recibir los QR codes.
   */
  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect() {
    await this.connectionService.connect();
    return { status: 'connecting' };
  }

  /**
   * Stream SSE que emite QR codes y eventos de conexión.
   *
   * Es `@Public()` porque EventSource no soporta headers custom (no se puede
   * enviar JWT via Authorization header). Recibe el token via query param.
   */
  @Public()
  @Sse('connect/qr')
  connectQrStream(@Query('token') _token?: string): Observable<MessageEvent> {
    // Nota: en una implementación completa, validaríamos el token JWT aquí.
    // Por ahora el endpoint queda accesible solo desde la UI autenticada.
    return this.connectionService.getQrStream().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );
  }

  /**
   * Desconecta la sesión actual y limpia el auth state.
   */
  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect() {
    await this.connectionService.disconnect();
    return { success: true };
  }

  // ============================================
  // GRUPOS (Admin - requieren JWT)
  // ============================================

  /**
   * Lista todos los grupos detectados.
   * Query param opcional: ?clientId=XXX para filtrar por cliente vinculado.
   */
  @Get('groups')
  async getGroups(@Query('clientId') clientId?: string) {
    return this.groupService.findAll(clientId);
  }

  /**
   * Obtiene un grupo específico por ID.
   */
  @Get('groups/:id')
  async getGroup(@Param('id') id: string) {
    return this.groupService.findOne(id);
  }

  /**
   * Actualiza un grupo: vincular/desvincular cliente, habilitar/deshabilitar AI.
   */
  @Patch('groups/:id')
  async updateGroup(@Param('id') id: string, @Body() dto: UpdateWhatsAppGroupDto) {
    return this.groupService.update(id, dto);
  }

  /**
   * Fuerza la sincronización de todos los grupos desde WhatsApp.
   */
  @Post('groups/sync')
  @HttpCode(HttpStatus.OK)
  async syncGroups() {
    return this.groupService.syncAllGroups();
  }

  /**
   * Re-obtiene el metadata de un grupo específico desde WhatsApp.
   */
  @Post('groups/:id/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshGroupMetadata(@Param('id') id: string) {
    return this.groupService.refreshMetadata(id);
  }

  // ============================================
  // WEBHOOK AI (Público + token secreto)
  // ============================================

  /**
   * Webhook que recibe respuestas del servidor AI (Python/LangChain)
   * y las envía al grupo correspondiente via Baileys.
   *
   * Autenticación: header `X-Webhook-Secret` debe coincidir con la env var
   * `WHATSAPP_WEBHOOK_SECRET`.
   */
  @Public()
  @Post('webhook/response')
  @HttpCode(HttpStatus.OK)
  async handleAIResponseWebhook(
    @Body() dto: AIWebhookResponseDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    const expectedSecret = this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET');

    if (!expectedSecret) {
      throw new UnauthorizedException('WHATSAPP_WEBHOOK_SECRET no está configurado en el servidor');
    }

    if (secret !== expectedSecret) {
      throw new UnauthorizedException('Secret inválido');
    }

    // Idempotencia: deduplicar por responseId
    if (this.processedResponses.has(dto.responseId)) {
      this.logger.debug(
        `[${dto.correlationId || '-'}] Webhook duplicado ignorado: ${dto.responseId}`,
      );
      return { success: true, deduplicated: true };
    }
    this.processedResponses.set(dto.responseId, Date.now());

    this.logger.log(
      `[${dto.correlationId || '-'}] Webhook recibido para ${dto.groupJid} (responseId: ${dto.responseId})`,
    );

    await this.messageService.handleAIResponse(dto.groupJid, dto.message);
    return { success: true };
  }

  /**
   * Limpia entradas expiradas del cache de idempotencia.
   */
  private cleanIdempotencyCache(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.processedResponses.entries()) {
      if (now - timestamp > IDEMPOTENCY_TTL_MS) {
        this.processedResponses.delete(id);
      }
    }
  }
}

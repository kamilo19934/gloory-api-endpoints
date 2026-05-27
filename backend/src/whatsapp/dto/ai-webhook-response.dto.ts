import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Body del webhook que recibe respuestas del servidor AI (LangChain/Python).
 * El servidor AI decide asíncronamente si responder a un mensaje y envía
 * esta estructura para que se reenvíe al grupo correspondiente.
 */
export class AIWebhookResponseDto {
  /**
   * UUID único para idempotencia.
   * Si el AI server hace retry, Node descarta duplicados con este ID.
   */
  @IsString()
  @IsNotEmpty()
  responseId: string;

  /**
   * UUID de correlación generado por Node al hacer flush del batch.
   * Permite tracing end-to-end entre Node y el AI server.
   */
  @IsString()
  @IsOptional()
  correlationId?: string;

  /**
   * JID del grupo de WhatsApp al que enviar la respuesta.
   * Ejemplo: '120363XXXXX@g.us'
   */
  @IsString()
  @IsNotEmpty()
  groupJid: string;

  /**
   * Texto de la respuesta generada por el agente AI.
   */
  @IsString()
  @IsNotEmpty()
  message: string;
}

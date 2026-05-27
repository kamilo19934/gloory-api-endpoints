import {
  Controller,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { NotionService } from './notion.service';

@Controller('clients')
export class NotionController {
  private readonly logger = new Logger(NotionController.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly notionService: NotionService,
  ) {}

  /**
   * Crea el cliente en Notion y genera las 29 tareas de implementación.
   *
   * - Si notionOnboardingStatus === 'complete' → 409 (ya completado)
   * - Si notionOnboardingStatus === 'failed' o 'pending' → permite reintento
   * - Las tareas se crean en background (fire-and-forget) con tracking de status
   */
  @Post(':id/setup-notion')
  @HttpCode(HttpStatus.OK)
  async setupNotion(@Param('id') clientId: string) {
    if (!this.notionService.isConfigured()) {
      throw new BadRequestException(
        'Notion no está configurado. Verifica NOTION_API_KEY, NOTION_CLIENTS_DB_ID y NOTION_TASKS_DB_ID',
      );
    }

    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException(`Cliente con ID ${clientId} no encontrado`);
    }

    if (client.notionOnboardingStatus === 'complete') {
      throw new ConflictException(
        `El cliente "${client.name}" ya tiene onboarding completo en Notion`,
      );
    }

    // Si no tiene notionPageId, crear el cliente en Notion
    if (!client.notionPageId) {
      try {
        const notionPageId = await this.notionService.createClient({
          name: client.name,
          glooryClientId: client.id,
          estado: 'Implementación',
        });
        client.notionPageId = notionPageId;
      } catch (error) {
        this.logger.error(`Error creando cliente en Notion: ${(error as Error).message}`);
        throw new BadRequestException(
          `Error creando cliente en Notion: ${(error as Error).message}`,
        );
      }
    }

    // Marcar como pending y guardar
    client.notionOnboardingStatus = 'pending';
    await this.clientRepo.save(client);

    // Crear tareas en background (no bloquea el response)
    const notionPageId = client.notionPageId;
    this.createTasksInBackground(clientId, notionPageId).catch((err) =>
      this.logger.error(
        `Error fatal en background tasks para ${clientId}: ${(err as Error).message}`,
      ),
    );

    return {
      notionPageId: client.notionPageId,
      clientName: client.name,
      status: 'pending',
      message:
        'Cliente creado en Notion. Las 29 tareas se están creando en background (~11 segundos).',
    };
  }

  /**
   * Crea las 29 tareas en background y actualiza el status del onboarding.
   */
  private async createTasksInBackground(clientId: string, notionPageId: string): Promise<void> {
    try {
      const created = await this.notionService.createImplementationTasks(notionPageId);

      await this.clientRepo.update(clientId, {
        notionOnboardingStatus: 'complete',
      });

      this.logger.log(`Onboarding Notion completado para ${clientId}: ${created} tareas creadas`);
    } catch (error) {
      this.logger.error(`Onboarding Notion falló para ${clientId}: ${(error as Error).message}`);

      await this.clientRepo.update(clientId, {
        notionOnboardingStatus: 'failed',
      });
    }
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import type { ParticipantAction } from '@whiskeysockets/baileys';
import { WhatsAppGroup } from './entities/whatsapp-group.entity';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { ClientsService } from '../clients/clients.service';
import { UpdateWhatsAppGroupDto } from './dto/update-whatsapp-group.dto';

/**
 * Gestiona los grupos de WhatsApp detectados por el bot.
 *
 * Responsabilidades:
 * - Sincronizar grupos existentes al conectar
 * - Detectar cuando el bot es agregado/removido de un grupo
 * - CRUD para que el admin vincule grupos a clientes y habilite/deshabilite AI
 */
@Injectable()
export class WhatsAppGroupService {
  private readonly logger = new Logger(WhatsAppGroupService.name);

  constructor(
    @InjectRepository(WhatsAppGroup)
    private readonly groupRepo: Repository<WhatsAppGroup>,
    @Inject(forwardRef(() => WhatsAppConnectionService))
    private readonly connectionService: WhatsAppConnectionService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Sincroniza todos los grupos en los que participa el bot desde WhatsApp.
   * Se llama automáticamente al conectar, o manualmente via endpoint admin.
   */
  async syncAllGroups(): Promise<{ synced: number }> {
    const sock = this.connectionService.getSocket();
    if (!sock) {
      throw new BadRequestException('WhatsApp no está conectado');
    }

    const allGroups = await sock.groupFetchAllParticipating();
    const groupJids = Object.keys(allGroups);

    let syncedCount = 0;
    for (const jid of groupJids) {
      const meta = allGroups[jid];
      await this.upsertGroupFromMetadata(jid, meta);
      syncedCount += 1;
    }

    // Marcar como 'removed' los grupos que estaban en DB pero ya no están
    // en la lista actual de participantes
    const existingGroups = await this.groupRepo.find({
      where: { status: 'active' },
    });
    for (const existing of existingGroups) {
      if (!groupJids.includes(existing.groupJid)) {
        existing.status = 'removed';
        await this.groupRepo.save(existing);
      }
    }

    this.logger.log(`Sincronizados ${syncedCount} grupos de WhatsApp`);
    return { synced: syncedCount };
  }

  /**
   * Maneja el evento `group-participants.update` de Baileys.
   * Detecta si el bot fue agregado/removido de un grupo.
   */
  async handleParticipantUpdate(event: {
    id: string;
    participants: string[];
    action: ParticipantAction;
  }): Promise<void> {
    const sock = this.connectionService.getSocket();
    if (!sock) return;

    const botJid = sock.user?.id;
    if (!botJid) return;

    // Normalizar JID del bot (puede venir como '569xxxx:1@s.whatsapp.net')
    const botNumber = botJid.split(':')[0].split('@')[0];
    const botInvolved = event.participants.some((p) => p.startsWith(botNumber));

    if (!botInvolved) {
      // El cambio no nos involucra directamente, solo actualizar count
      const existing = await this.groupRepo.findOne({
        where: { groupJid: event.id },
      });
      if (existing) {
        try {
          const meta = await sock.groupMetadata(event.id);
          existing.participantCount = meta.participants.length;
          existing.metadata = meta as any;
          await this.groupRepo.save(existing);
        } catch {
          // ignorar
        }
      }
      return;
    }

    if (event.action === 'add') {
      // El bot fue agregado al grupo → crear/activar registro
      try {
        const meta = await sock.groupMetadata(event.id);
        await this.upsertGroupFromMetadata(event.id, meta);
        this.logger.log(`Bot agregado al grupo: ${meta.subject} (${event.id})`);
      } catch (error) {
        this.logger.error(
          `Error al obtener metadata del grupo ${event.id}: ${(error as Error).message}`,
        );
      }
    } else if (event.action === 'remove') {
      // El bot fue removido del grupo → marcar como removed
      const existing = await this.groupRepo.findOne({
        where: { groupJid: event.id },
      });
      if (existing) {
        existing.status = 'removed';
        await this.groupRepo.save(existing);
        this.logger.log(`Bot removido del grupo: ${existing.groupName} (${event.id})`);
      }
    }
  }

  /**
   * Crea o actualiza un grupo a partir del metadata de Baileys.
   */
  private async upsertGroupFromMetadata(groupJid: string, metadata: any): Promise<WhatsAppGroup> {
    let group = await this.groupRepo.findOne({ where: { groupJid } });

    if (group) {
      group.groupName = metadata.subject || group.groupName;
      group.groupDescription = metadata.desc || null;
      group.participantCount = metadata.participants?.length || 0;
      group.metadata = metadata;
      group.status = 'active';
    } else {
      group = this.groupRepo.create({
        groupJid,
        groupName: metadata.subject || 'Grupo sin nombre',
        groupDescription: metadata.desc || null,
        participantCount: metadata.participants?.length || 0,
        metadata,
        status: 'active',
        aiEnabled: false,
        linkedClientId: null,
      });
    }

    return this.groupRepo.save(group);
  }

  /**
   * Lista todos los grupos. Opcionalmente filtra por clientId.
   */
  async findAll(clientId?: string): Promise<WhatsAppGroup[]> {
    const where = clientId ? { linkedClientId: clientId } : {};
    return this.groupRepo.find({
      where,
      relations: ['linkedClient'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retorna los grupos que tienen al menos un cliente vinculado.
   * Usado por el dashboard del cliente para mostrar el badge.
   */
  async findLinked(): Promise<WhatsAppGroup[]> {
    return this.groupRepo.find({
      where: { linkedClientId: Not(IsNull()) },
      relations: ['linkedClient'],
    });
  }

  /**
   * Retorna un grupo por ID con su cliente vinculado.
   */
  async findOne(id: string): Promise<WhatsAppGroup> {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: ['linkedClient'],
    });
    if (!group) {
      throw new NotFoundException(`Grupo con ID ${id} no encontrado`);
    }
    return group;
  }

  /**
   * Busca un grupo por su JID (usado por el webhook de respuesta del AI).
   */
  async findByJid(groupJid: string): Promise<WhatsAppGroup | null> {
    return this.groupRepo.findOne({
      where: { groupJid },
      relations: ['linkedClient'],
    });
  }

  /**
   * Actualiza un grupo: vincular cliente y/o toggle AI.
   */
  async update(id: string, dto: UpdateWhatsAppGroupDto): Promise<WhatsAppGroup> {
    const group = await this.findOne(id);

    if (dto.linkedClientId !== undefined) {
      if (dto.linkedClientId === null) {
        group.linkedClientId = null;
        // Si se desvincula el cliente, también desactivar AI
        group.aiEnabled = false;
      } else {
        // Validar que el cliente exista
        await this.clientsService.findOne(dto.linkedClientId);
        group.linkedClientId = dto.linkedClientId;
      }
    }

    if (dto.aiEnabled !== undefined) {
      if (dto.aiEnabled && !group.linkedClientId) {
        throw new BadRequestException(
          'No se puede habilitar el agente AI sin un cliente vinculado',
        );
      }
      group.aiEnabled = dto.aiEnabled;
    }

    if (dto.debounceSeconds !== undefined) {
      group.debounceSeconds = dto.debounceSeconds;
    }

    return this.groupRepo.save(group);
  }

  /**
   * Re-obtiene el metadata del grupo desde WhatsApp y lo actualiza en DB.
   */
  async refreshMetadata(id: string): Promise<WhatsAppGroup> {
    const group = await this.findOne(id);
    const sock = this.connectionService.getSocket();
    if (!sock) {
      throw new BadRequestException('WhatsApp no está conectado');
    }

    const meta = await sock.groupMetadata(group.groupJid);
    return this.upsertGroupFromMetadata(group.groupJid, meta);
  }
}

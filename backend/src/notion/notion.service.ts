import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ImplementationTask, IMPLEMENTATION_TASKS } from './templates/implementation-tasks';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/**
 * Servicio para comunicación con la API de Notion.
 * Encapsula la creación de clientes y tareas de implementación.
 * Rate limit: 350ms entre requests (Notion limit: 3 req/s).
 */
@Injectable()
export class NotionService {
  private readonly logger = new Logger(NotionService.name);
  private lastRequestTime = 0;

  private readonly apiKey: string;
  private readonly clientsDbId: string;
  private readonly tasksDbId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('NOTION_API_KEY', '');
    this.clientsDbId = this.configService.get<string>('NOTION_CLIENTS_DB_ID', '');
    this.tasksDbId = this.configService.get<string>('NOTION_TASKS_DB_ID', '');
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    };
  }

  /**
   * Rate limit: espera 350ms entre requests a Notion.
   */
  private async rateLimitDelay(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < 350) {
      await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Crea un cliente en la DB Clientes de Notion.
   * Retorna el ID de la página creada (notionPageId).
   */
  async createClient(data: {
    name: string;
    glooryClientId: string;
    estado?: string;
    crm?: string;
    canales?: string[];
    pais?: string;
    contactoPrincipal?: string;
    telefono?: string;
    email?: string;
  }): Promise<string> {
    await this.rateLimitDelay();

    const properties: Record<string, any> = {
      Nombre: { title: [{ text: { content: data.name } }] },
      Estado: { select: { name: data.estado || 'Implementación' } },
      gloory_client_id: {
        rich_text: [{ text: { content: data.glooryClientId } }],
      },
    };

    if (data.crm) {
      properties['CRM'] = { select: { name: data.crm } };
    }
    if (data.canales?.length) {
      properties['Canales'] = {
        multi_select: data.canales.map((c) => ({ name: c })),
      };
    }
    if (data.pais) {
      properties['País'] = { select: { name: data.pais } };
    }
    if (data.contactoPrincipal) {
      properties['Contacto Principal'] = {
        rich_text: [{ text: { content: data.contactoPrincipal } }],
      };
    }
    if (data.telefono) {
      properties['Teléfono'] = { phone_number: data.telefono };
    }
    if (data.email) {
      properties['Email'] = { email: data.email };
    }
    properties['Fecha Inicio'] = {
      date: { start: new Date().toISOString().split('T')[0] },
    };

    const response = await axios.post(
      `${NOTION_API_BASE}/pages`,
      {
        parent: { database_id: this.clientsDbId },
        properties,
      },
      { headers: this.headers },
    );

    const notionPageId = response.data.id;
    this.logger.log(`Cliente creado en Notion: ${data.name} → ${notionPageId}`);
    return notionPageId;
  }

  /**
   * Crea una tarea en la DB Tareas de Notion vinculada a un cliente.
   */
  async createTask(clientNotionPageId: string, task: ImplementationTask): Promise<string> {
    await this.rateLimitDelay();

    const response = await axios.post(
      `${NOTION_API_BASE}/pages`,
      {
        parent: { database_id: this.tasksDbId },
        properties: {
          Nombre: { title: [{ text: { content: task.name } }] },
          Cliente: { relation: [{ id: clientNotionPageId }] },
          Tipo: { select: { name: 'Implementación' } },
          Estado: { select: { name: 'Not Started' } },
          Prioridad: { select: { name: 'Tarea' } },
          Fase: { select: { name: task.phase } },
          Orden: { number: task.order },
          Descripción: {
            rich_text: [{ text: { content: task.description } }],
          },
        },
      },
      { headers: this.headers },
    );

    return response.data.id;
  }

  /**
   * Crea las 29 tareas de implementación para un cliente.
   * Ejecuta secuencialmente con rate limiting (350ms entre cada una).
   * Verifica tareas existentes para permitir reintentos idempotentes.
   *
   * @returns Número de tareas creadas (puede ser < 29 si algunas ya existían)
   */
  async createImplementationTasks(
    clientNotionPageId: string,
    onProgress?: (current: number, total: number, taskName: string) => void,
  ): Promise<number> {
    // Obtener tareas existentes para este cliente (para reintentos)
    const existingTasks = await this.getExistingTaskNames(clientNotionPageId);
    let created = 0;

    for (const task of IMPLEMENTATION_TASKS) {
      if (existingTasks.has(task.name)) {
        this.logger.debug(`Tarea ya existe, saltando: "${task.name}" (${task.order}/29)`);
        continue;
      }

      try {
        await this.createTask(clientNotionPageId, task);
        created++;
        this.logger.log(`Tarea ${task.order}/29 creada: "${task.name}" (fase: ${task.phase})`);
        if (onProgress) {
          onProgress(task.order, IMPLEMENTATION_TASKS.length, task.name);
        }
      } catch (error) {
        this.logger.error(
          `Error creando tarea ${task.order}/29 "${task.name}": ${(error as Error).message}`,
        );
        throw error;
      }
    }

    this.logger.log(
      `Onboarding completado: ${created} tareas creadas (${existingTasks.size} ya existían)`,
    );
    return created;
  }

  /**
   * Obtiene los nombres de tareas que ya existen para un cliente.
   * Usado para reintentos idempotentes.
   */
  private async getExistingTaskNames(clientNotionPageId: string): Promise<Set<string>> {
    await this.rateLimitDelay();

    try {
      const response = await axios.post(
        `${NOTION_API_BASE}/databases/${this.tasksDbId}/query`,
        {
          filter: {
            property: 'Cliente',
            relation: { contains: clientNotionPageId },
          },
          page_size: 100,
        },
        { headers: this.headers },
      );

      const names = new Set<string>();
      for (const page of response.data.results) {
        const titleProp = page.properties?.Nombre?.title;
        if (titleProp?.length) {
          names.add(titleProp[0].plain_text);
        }
      }
      return names;
    } catch {
      return new Set();
    }
  }

  /**
   * Verifica si la API de Notion está accesible y configurada.
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.clientsDbId && this.tasksDbId);
  }
}

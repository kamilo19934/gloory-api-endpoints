/**
 * Contrato del Tool Registry para el swarm (gloory-ai-swarm).
 *
 * El swarm consume estos schemas y genera dinámicamente @tool functions
 * de LangChain con ToolFactory. Cada tool apunta a:
 * - `target: 'external'` → gloory-api-endpoints (proxy a API externa)
 * - `target: 'server'` → gloory-ai-server (datos curados por el cliente)
 *
 * NO incluye prompts ni personalidad — eso es responsabilidad del swarm/server.
 */

export type ToolTarget = 'external' | 'server';
export type ToolCategory = 'read' | 'write';
export type ToolMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ToolFieldType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'array';

export interface ToolFieldDefinition {
  type: ToolFieldType;
  /** Requerido solo cuando `type === 'array'`. Tipo de los items. */
  items?: Exclude<ToolFieldType, 'array'>;
  required: boolean;
  description: string;
  /** Si `true`, el campo puede ser deshabilitado por config por negocio. */
  configurable?: boolean;
}

export interface ToolSchema {
  name: string;
  description: string;
  /** Dónde se ejecuta esta tool (server interno vs proxy externo). */
  target: ToolTarget;
  /**
   * Path del endpoint. Puede contener placeholders:
   * - `{clientId}` → se reemplaza por el externalClientId del negocio
   */
  endpoint: string;
  method: ToolMethod;
  category: ToolCategory;
  requires_validation?: boolean;
  validation_rules?: string;
  fields: Record<string, ToolFieldDefinition>;
}

export interface ToolRegistryResponse {
  platform: string;
  version: string;
  tools: ToolSchema[];
}

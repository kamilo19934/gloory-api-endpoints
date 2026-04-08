import { ToolSchema } from '../interfaces/tool-schema.interface';

/**
 * Definiciones de tools para GoHighLevel.
 *
 * Nota: Se difiere el OAuth marketplace a una fase posterior.
 * Por ahora solo las tools básicas con Private Integration Token (PIT).
 */
export const GHL_TOOLS: ToolSchema[] = [
  // ============================
  // DATOS CURADOS (server target)
  // ============================
  {
    name: 'listar_profesionales',
    description:
      'Lista los profesionales activos del negocio (mapeados desde calendarios GHL).',
    target: 'server',
    endpoint: '/api/v1/assistant/professionals',
    method: 'POST',
    category: 'read',
    fields: {},
  },
  {
    name: 'listar_sucursales',
    description: 'Lista las sucursales configuradas manualmente.',
    target: 'server',
    endpoint: '/api/v1/assistant/branches',
    method: 'POST',
    category: 'read',
    fields: {},
  },

  // ============================
  // DISPONIBILIDAD Y CITAS (external target)
  // ============================
  {
    name: 'listar_calendarios',
    description: 'Lista los calendarios de GoHighLevel disponibles.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/ghl/calendars',
    method: 'GET',
    category: 'read',
    fields: {},
  },
  {
    name: 'buscar_disponibilidad',
    description: 'Busca slots disponibles en un calendario de GHL.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/ghl/availability',
    method: 'POST',
    category: 'read',
    fields: {
      calendarId: {
        type: 'string',
        required: true,
        description: 'ID del calendario en GHL',
      },
      startDate: {
        type: 'string',
        required: true,
        description: 'Fecha inicio (YYYY-MM-DD)',
      },
      endDate: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Fecha fin (YYYY-MM-DD). Default: +7 días.',
      },
    },
  },
  {
    name: 'crear_cita',
    description: 'Crea una cita en GoHighLevel.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/ghl/appointments',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. El calendarId debe existir. 2. La fecha/hora debe estar disponible.',
    fields: {
      calendarId: {
        type: 'string',
        required: true,
        description: 'ID del calendario',
      },
      contactId: {
        type: 'string',
        required: true,
        description: 'ID del contact en GHL',
      },
      startTime: {
        type: 'string',
        required: true,
        description: 'Fecha/hora inicio (ISO 8601)',
      },
      endTime: {
        type: 'string',
        required: true,
        description: 'Fecha/hora fin (ISO 8601)',
      },
      title: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Título de la cita',
      },
      notes: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Notas adicionales',
      },
    },
  },
];

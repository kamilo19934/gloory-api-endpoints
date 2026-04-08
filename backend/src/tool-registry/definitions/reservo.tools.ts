import { ToolSchema } from '../interfaces/tool-schema.interface';

/**
 * Definiciones de tools para la plataforma Reservo.
 *
 * Reservo usa UUIDs en lugar de IDs numéricos y tiene un concepto de "agendas"
 * (cada agenda tiene su propio profesional y puede ser presencial u online).
 */
export const RESERVO_TOOLS: ToolSchema[] = [
  // ============================
  // DATOS CURADOS (server target)
  // ============================
  {
    name: 'listar_profesionales',
    description:
      'Lista los profesionales activos del negocio que pueden recibir agendamientos IA.',
    target: 'server',
    endpoint: '/api/v1/assistant/professionals',
    method: 'POST',
    category: 'read',
    fields: {
      specialty: {
        type: 'string',
        required: false,
        description: 'Filtrar por especialidad (opcional)',
      },
    },
  },
  {
    name: 'listar_sucursales',
    description: 'Lista las sucursales activas del negocio.',
    target: 'server',
    endpoint: '/api/v1/assistant/branches',
    method: 'POST',
    category: 'read',
    fields: {},
  },
  {
    name: 'listar_especialidades',
    description: 'Lista las especialidades disponibles.',
    target: 'server',
    endpoint: '/api/v1/assistant/specialties',
    method: 'POST',
    category: 'read',
    fields: {},
  },

  // ============================
  // AGENDAS Y DISPONIBILIDAD (external target)
  // ============================
  {
    name: 'listar_agendas',
    description:
      'Obtiene las agendas configuradas del cliente en Reservo (cada una con su UUID y tipo presencial/online).',
    target: 'external',
    endpoint: '/api/clients/{clientId}/reservo/agendas',
    method: 'GET',
    category: 'read',
    fields: {},
  },
  {
    name: 'buscar_disponibilidad',
    description:
      'Busca disponibilidad en una agenda específica de Reservo en un rango de fechas.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/reservo/availability',
    method: 'POST',
    category: 'read',
    fields: {
      agenda_uuid: {
        type: 'string',
        required: true,
        description: 'UUID de la agenda a consultar',
      },
      fecha_inicio: {
        type: 'string',
        required: true,
        description: 'Fecha inicio (YYYY-MM-DD)',
      },
      fecha_fin: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Fecha fin (YYYY-MM-DD). Default: +7 días.',
      },
    },
  },

  // ============================
  // PACIENTES (external target)
  // ============================
  {
    name: 'buscar_paciente',
    description: 'Busca un paciente en Reservo por identificador (RUT, DNI, etc.).',
    target: 'external',
    endpoint: '/api/clients/{clientId}/reservo/patients/search',
    method: 'POST',
    category: 'read',
    fields: {
      identificador: {
        type: 'string',
        required: true,
        description: 'Identificador del paciente (RUT/DNI/etc.)',
      },
    },
  },
  {
    name: 'crear_paciente',
    description: 'Crea un nuevo paciente en Reservo.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/reservo/patients',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Nombre y apellido son obligatorios. 2. Identificador debe ser válido.',
    fields: {
      identificador: {
        type: 'string',
        required: true,
        description: 'Identificador del paciente',
      },
      nombre: {
        type: 'string',
        required: true,
        description: 'Nombre del paciente',
      },
      apellido: {
        type: 'string',
        required: true,
        description: 'Apellido del paciente',
      },
      telefono: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Teléfono de contacto',
      },
      email: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Correo electrónico',
      },
    },
  },

  // ============================
  // CITAS (external target)
  // ============================
  {
    name: 'crear_cita',
    description: 'Agenda una nueva cita en Reservo.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/reservo/appointments',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. La agenda_uuid debe existir. 2. La fecha/hora debe estar disponible.',
    fields: {
      agenda_uuid: {
        type: 'string',
        required: true,
        description: 'UUID de la agenda',
      },
      paciente_uuid: {
        type: 'string',
        required: true,
        description: 'UUID del paciente',
      },
      fecha: {
        type: 'string',
        required: true,
        description: 'Fecha de la cita (YYYY-MM-DD)',
      },
      hora: {
        type: 'string',
        required: true,
        description: 'Hora de inicio (HH:MM)',
      },
      comentario: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Notas adicionales',
      },
    },
  },
  {
    name: 'confirmar_cita',
    description: 'Confirma una cita de Reservo.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/reservo/appointments/confirm',
    method: 'POST',
    category: 'write',
    fields: {
      cita_uuid: {
        type: 'string',
        required: true,
        description: 'UUID de la cita a confirmar',
      },
    },
  },
  {
    name: 'cancelar_cita',
    description: 'Cancela una cita de Reservo.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/reservo/appointments/cancel',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Confirmar con el paciente antes de cancelar.',
    fields: {
      cita_uuid: {
        type: 'string',
        required: true,
        description: 'UUID de la cita a cancelar',
      },
    },
  },
];

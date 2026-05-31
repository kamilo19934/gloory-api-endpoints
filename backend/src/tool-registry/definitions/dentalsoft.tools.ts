import { ToolSchema } from '../interfaces/tool-schema.interface';

/**
 * Definiciones de tools para la plataforma Dentalsoft.
 *
 * Dentalsoft usa IDs numéricos (RUT sin dígito verificador para profesionales)
 * y autenticación OAuth client_credentials con scope = ID de clínica.
 */
export const DENTALSOFT_TOOLS: ToolSchema[] = [
  // ============================
  // DATOS CURADOS (server target)
  // ============================
  {
    name: 'listar_profesionales',
    description: 'Lista los profesionales activos del negocio que pueden recibir agendamientos IA.',
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
  // DISPONIBILIDAD (external target)
  // ============================
  {
    name: 'buscar_disponibilidad',
    description:
      'Busca horarios disponibles para uno o varios profesionales desde una fecha. Si no hay horarios en la semana de la fecha entregada, automáticamente busca en la siguiente, hasta 4 semanas. Retorna los horarios agrupados por día (máximo ~50 horarios).',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/availability/search',
    method: 'POST',
    category: 'read',
    fields: {
      id_profesional: {
        type: 'array',
        items: 'integer',
        required: true,
        description:
          'Uno o varios IDs de profesional. Cuando se entregan varios, devuelve los horarios disponibles de cualquiera de ellos (útil cuando varios profesionales atienden la misma especialidad).',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal donde se atenderá la cita.',
      },
      fecha_inicio: {
        type: 'string',
        required: true,
        description: 'Fecha desde la cual empezar a buscar, en formato YYYY-MM-DD.',
      },
      duracion_minutos: {
        type: 'integer',
        required: false,
        configurable: true,
        description:
          'Duración aproximada de la cita en minutos (ej: 30, 45, 60). Si se omite, se usa la duración mínima de la clínica.',
      },
    },
  },
  {
    name: 'disponibilidad_mensual',
    description:
      'Obtiene la disponibilidad mensual de un profesional en una sucursal de Dentalsoft.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/availability/monthly',
    method: 'POST',
    category: 'read',
    fields: {
      id_profesional: {
        type: 'integer',
        required: true,
        description: 'RUT numérico del profesional (sin dígito verificador)',
      },
      year: {
        type: 'integer',
        required: true,
        description: 'Año',
      },
      month: {
        type: 'integer',
        required: true,
        description: 'Mes (1-12)',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal',
      },
      duracion_minutos: {
        type: 'integer',
        required: false,
        configurable: true,
        description:
          'Duración aproximada de la cita en minutos (ej: 30, 45, 60). Si se omite, se usa la duración mínima de la clínica.',
      },
    },
  },
  {
    name: 'disponibilidad_diaria',
    description: 'Obtiene horarios disponibles para un día específico en Dentalsoft.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/availability/daily',
    method: 'POST',
    category: 'read',
    fields: {
      id_profesional: {
        type: 'integer',
        required: true,
        description: 'RUT numérico del profesional',
      },
      fecha: {
        type: 'string',
        required: true,
        description: 'Fecha (YYYY-MM-DD)',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal',
      },
      duracion_minutos: {
        type: 'integer',
        required: false,
        configurable: true,
        description:
          'Duración aproximada de la cita en minutos. Si se omite, se usa la duración mínima de la clínica.',
      },
    },
  },

  // ============================
  // PACIENTES (external target)
  // ============================
  {
    name: 'buscar_paciente',
    description: 'Busca un paciente en Dentalsoft por cédula (RUT o DNI).',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/patients/search',
    method: 'POST',
    category: 'read',
    fields: {
      cedula: {
        type: 'string',
        required: true,
        description: 'Cédula del paciente',
      },
      tipo_cedula_texto: {
        type: 'string',
        required: true,
        description: 'Tipo de cédula: "rut" o "dni"',
      },
    },
  },
  {
    name: 'crear_paciente',
    description: 'Crea un nuevo paciente en Dentalsoft.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/patients',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Email válido. 2. Celular en formato numérico (ej: 56977889900). 3. Cédula sin puntos ni guión.',
    fields: {
      cedula: {
        type: 'string',
        required: true,
        description: 'Cédula del paciente',
      },
      tipo_cedula_texto: {
        type: 'string',
        required: true,
        description: '"rut" o "dni"',
      },
      nombre: {
        type: 'string',
        required: true,
        description: 'Nombre del paciente',
      },
      apellido_paterno: {
        type: 'string',
        required: true,
        description: 'Apellido paterno',
      },
      apellido_materno: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Apellido materno (opcional)',
      },
      email: {
        type: 'string',
        required: true,
        description: 'Email de contacto',
      },
      celular: {
        type: 'string',
        required: true,
        description: 'Celular en formato numérico (ej: 56977889900)',
      },
    },
  },

  // ============================
  // CITAS (external target)
  // ============================
  {
    name: 'crear_cita',
    description: 'Agenda una nueva cita en Dentalsoft.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/appointments',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Validar disponibilidad antes con disponibilidad_diaria. 2. id_sala viene del slot de disponibilidad. 3. id_paciente debe existir (usa buscar_paciente o crear_paciente).',
    fields: {
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal',
      },
      id_profesional: {
        type: 'integer',
        required: true,
        description: 'RUT numérico del profesional',
      },
      id_sala: {
        type: 'integer',
        required: true,
        description: 'ID de la sala (obtenido del slot de disponibilidad)',
      },
      id_paciente: {
        type: 'integer',
        required: true,
        description: 'ID interno del paciente',
      },
      fecha: {
        type: 'string',
        required: true,
        description: 'Fecha YYYY-MM-DD',
      },
      inicio: {
        type: 'string',
        required: true,
        description: 'Hora de inicio HH:MM',
      },
      duracion_minutos: {
        type: 'integer',
        required: false,
        configurable: true,
        description:
          'Duración de la cita en minutos (ej: 30, 45, 60). Si se omite, se usa la duración mínima de la clínica.',
      },
      comentario: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Comentario o notas sobre la cita',
      },
    },
  },
  {
    name: 'confirmar_cita',
    description: 'Confirma una cita de Dentalsoft.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/appointments/confirm',
    method: 'POST',
    category: 'write',
    fields: {
      id: {
        type: 'integer',
        required: true,
        description: 'ID de la cita',
      },
    },
  },
  {
    name: 'cancelar_cita',
    description: 'Cancela una cita de Dentalsoft.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/appointments/cancel',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules: 'VALIDACIONES: 1. Confirmar con el paciente antes de cancelar.',
    fields: {
      id: {
        type: 'integer',
        required: true,
        description: 'ID de la cita',
      },
    },
  },
  {
    name: 'citas_paciente',
    description:
      'Retorna las citas del paciente como { futuras, pasadas (top 5) }. Las canceladas se excluyen. El agente solo pasa id_paciente — el rango interno lo resuelve el proxy.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/appointments/patient',
    method: 'POST',
    category: 'read',
    fields: {
      id_paciente: {
        type: 'integer',
        required: true,
        description: 'ID interno del paciente',
      },
    },
  },
  {
    name: 'obtener_cita',
    description: 'Obtiene los datos de una cita por su ID.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/dentalsoft/appointments/{id}',
    method: 'GET',
    category: 'read',
    fields: {
      id: {
        type: 'integer',
        required: true,
        description: 'ID de la cita',
      },
    },
  },
];

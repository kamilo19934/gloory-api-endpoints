import { ToolSchema } from '../interfaces/tool-schema.interface';

/**
 * Definiciones de tools para la plataforma Dentalink.
 *
 * Split de targets:
 * - `target: 'server'` → gloory-ai-server (datos curados por el cliente,
 *   respetan isActive local y customSpecialty)
 * - `target: 'external'` → gloory-api-endpoints (proxy transaccional a la API
 *   de Dentalink con el X-API-Key del cliente)
 *
 * El endpoint `{clientId}` es reemplazado por el swarm con el externalClientId
 * del negocio al momento de generar la tool.
 */
export const DENTALINK_TOOLS: ToolSchema[] = [
  // ============================
  // DATOS CURADOS (server target)
  // ============================
  {
    name: 'listar_profesionales',
    description:
      'Lista los profesionales activos del negocio que pueden recibir agendamientos IA. Devuelve nombre, especialidad, sucursales donde atiende y el id_profesional para usar al agendar.',
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
    name: 'listar_profesionales_por_sucursal',
    description:
      'Lista profesionales activos de una sucursal específica. Devuelve el id_profesional que se usa al crear citas.',
    target: 'server',
    endpoint: '/api/v1/assistant/professionals/by-branch',
    method: 'POST',
    category: 'read',
    fields: {
      branchExternalId: {
        type: 'string',
        required: true,
        description: 'ID de sucursal en Dentalink (id_sucursal)',
      },
    },
  },
  {
    name: 'listar_profesionales_por_especialidad',
    description:
      'Lista profesionales activos filtrados por especialidad. Si no se encuentra la especialidad, devuelve la lista de especialidades disponibles.',
    target: 'server',
    endpoint: '/api/v1/assistant/professionals/by-specialty',
    method: 'POST',
    category: 'read',
    fields: {
      specialty: {
        type: 'string',
        required: true,
        description: 'Nombre de la especialidad a buscar',
      },
      branchExternalId: {
        type: 'string',
        required: false,
        description: 'Filtrar también por sucursal (opcional)',
      },
    },
  },
  {
    name: 'listar_sucursales',
    description:
      'Lista las sucursales activas del negocio. Devuelve el id_sucursal que se usa en el resto de las tools.',
    target: 'server',
    endpoint: '/api/v1/assistant/branches',
    method: 'POST',
    category: 'read',
    fields: {},
  },
  {
    name: 'listar_especialidades',
    description:
      'Lista las especialidades disponibles de los profesionales activos del negocio.',
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
      'Busca disponibilidad de profesionales en fechas específicas. Requiere obtener antes los ids_profesionales con listar_profesionales.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/availability',
    method: 'POST',
    category: 'read',
    fields: {
      ids_profesionales: {
        type: 'array',
        items: 'integer',
        required: true,
        description: 'Lista de IDs de los profesionales a consultar',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal donde buscar disponibilidad',
      },
      fecha_inicio: {
        type: 'string',
        required: false,
        configurable: true,
        description:
          'Fecha de inicio de búsqueda (formato YYYY-MM-DD). Si no se proporciona, usa la fecha actual.',
      },
      tiempo_cita: {
        type: 'integer',
        required: false,
        configurable: true,
        description:
          'Duración de la cita en minutos. Si no se proporciona, usa el intervalo por defecto del profesional.',
      },
    },
  },
  {
    name: 'buscar_disponibilidad_sobrecupo',
    description:
      'Busca disponibilidad de sobrecupo (sobre-agenda) de profesionales. Solo retorna horarios donde el sobrecupo está habilitado. Útil cuando la agenda regular está llena.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/availability/sobrecupo',
    method: 'POST',
    category: 'read',
    fields: {
      ids_profesionales: {
        type: 'array',
        items: 'integer',
        required: true,
        description: 'Lista de IDs de los profesionales a consultar',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal',
      },
      fecha_inicio: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Fecha de inicio (formato YYYY-MM-DD). Default: hoy.',
      },
      tiempo_cita: {
        type: 'integer',
        required: false,
        configurable: true,
        description: 'Duración de la cita en minutos',
      },
    },
  },

  // ============================
  // PACIENTES (external target)
  // ============================
  {
    name: 'buscar_paciente',
    description: 'Busca un paciente por RUT en Dentalink.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/patients/search',
    method: 'POST',
    category: 'read',
    fields: {
      rut: {
        type: 'string',
        required: true,
        description: 'RUT del paciente (con o sin formato)',
      },
    },
  },
  {
    name: 'buscar_paciente_por_datos',
    description:
      'Busca un paciente por nombre, teléfono o correo electrónico. Al menos uno de los campos es requerido.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/patients/search-by-data',
    method: 'POST',
    category: 'read',
    fields: {
      nombre: {
        type: 'string',
        required: false,
        description: 'Nombre del paciente (búsqueda parcial)',
      },
      telefono: {
        type: 'string',
        required: false,
        description: 'Teléfono del paciente',
      },
      correo: {
        type: 'string',
        required: false,
        description: 'Correo electrónico del paciente',
      },
    },
  },
  {
    name: 'crear_paciente',
    description: 'Crea un nuevo paciente en Dentalink.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/patients',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. El nombre y apellidos son obligatorios. 2. Si se proporciona RUT debe estar en formato válido. 3. El email debe ser válido si se proporciona.',
    fields: {
      rut: {
        type: 'string',
        required: false,
        description: 'RUT del paciente (opcional)',
      },
      nombre: {
        type: 'string',
        required: true,
        description: 'Nombre del paciente',
      },
      apellidos: {
        type: 'string',
        required: true,
        description: 'Apellidos del paciente',
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
        description: 'Correo electrónico del paciente',
      },
      fecha_nacimiento: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Fecha de nacimiento (formato YYYY-MM-DD)',
      },
    },
  },
  {
    name: 'obtener_tratamientos',
    description: 'Obtiene los tratamientos de un paciente por RUT.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/patients/treatments',
    method: 'POST',
    category: 'read',
    fields: {
      rut: {
        type: 'string',
        required: true,
        description: 'RUT del paciente',
      },
    },
  },

  // ============================
  // CITAS (external target)
  // ============================
  {
    name: 'crear_cita',
    description:
      'Agenda una nueva cita en Dentalink. El paciente debe existir previamente (usar buscar_paciente o crear_paciente primero).',
    target: 'external',
    endpoint: '/api/clients/{clientId}/appointments',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. El id_profesional debe estar activo para agendamientos IA (usar listar_profesionales). 2. La fecha/hora debe estar disponible (usar buscar_disponibilidad). 3. El id_paciente debe existir.',
    fields: {
      id_paciente: {
        type: 'integer',
        required: true,
        description: 'ID del paciente en Dentalink (debe existir previamente)',
      },
      id_profesional: {
        type: 'integer',
        required: true,
        description: 'ID del profesional que atenderá',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal',
      },
      fecha: {
        type: 'string',
        required: true,
        description: 'Fecha de la cita (formato YYYY-MM-DD)',
      },
      hora_inicio: {
        type: 'string',
        required: true,
        description: 'Hora de inicio de la cita (formato HH:MM)',
      },
      tiempo_cita: {
        type: 'integer',
        required: false,
        configurable: true,
        description:
          'Duración de la cita en minutos. Default: intervalo del profesional.',
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
    name: 'crear_cita_videoconsulta',
    description:
      'Agenda una nueva cita de videoconsulta (modalidad remota) en Dentalink.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/appointments/videoconsulta',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Mismas que crear_cita. 2. Verificar que el profesional ofrezca videoconsulta.',
    fields: {
      id_paciente: {
        type: 'integer',
        required: true,
        description: 'ID del paciente en Dentalink',
      },
      id_profesional: {
        type: 'integer',
        required: true,
        description: 'ID del profesional',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal',
      },
      fecha: {
        type: 'string',
        required: true,
        description: 'Fecha de la cita (YYYY-MM-DD)',
      },
      hora_inicio: {
        type: 'string',
        required: true,
        description: 'Hora de inicio (HH:MM)',
      },
      tiempo_cita: {
        type: 'integer',
        required: false,
        configurable: true,
        description: 'Duración en minutos',
      },
      comentario: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Comentario o notas',
      },
    },
  },
  {
    name: 'crear_cita_sobrecupo',
    description:
      'Agenda una cita de sobrecupo (sobre-agenda). Usar solo para horarios obtenidos de buscar_disponibilidad_sobrecupo.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/appointments/sobrecupo',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. La fecha/hora debe provenir de buscar_disponibilidad_sobrecupo. 2. Solo usar cuando la agenda regular está llena.',
    fields: {
      id_paciente: {
        type: 'integer',
        required: true,
        description: 'ID del paciente',
      },
      id_profesional: {
        type: 'integer',
        required: true,
        description: 'ID del profesional',
      },
      id_sucursal: {
        type: 'integer',
        required: true,
        description: 'ID de la sucursal',
      },
      fecha: {
        type: 'string',
        required: true,
        description: 'Fecha de la cita (YYYY-MM-DD)',
      },
      hora_inicio: {
        type: 'string',
        required: true,
        description: 'Hora de inicio (HH:MM)',
      },
      tiempo_cita: {
        type: 'integer',
        required: false,
        configurable: true,
        description: 'Duración en minutos',
      },
      comentario: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Comentario o notas',
      },
    },
  },
  {
    name: 'confirmar_cita',
    description:
      'Confirma una cita cambiándola al estado configurado para confirmación.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/appointments/confirm',
    method: 'POST',
    category: 'write',
    fields: {
      id_cita: {
        type: 'integer',
        required: true,
        description: 'ID de la cita a confirmar',
      },
    },
  },
  {
    name: 'cancelar_cita',
    description: 'Cancela una cita por su ID.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/appointments/cancel',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Confirmar con el paciente antes de cancelar. 2. El id_cita debe existir.',
    fields: {
      id_cita: {
        type: 'integer',
        required: true,
        description: 'ID de la cita a cancelar',
      },
    },
  },
  {
    name: 'obtener_citas_futuras',
    description:
      'Obtiene todas las citas futuras y activas (no anuladas) de un paciente por RUT. Ordenadas por fecha, la más próxima primero.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/appointments/future',
    method: 'POST',
    category: 'read',
    fields: {
      rut: {
        type: 'string',
        required: true,
        description: 'RUT del paciente (el sistema formatea automáticamente)',
      },
    },
  },
];

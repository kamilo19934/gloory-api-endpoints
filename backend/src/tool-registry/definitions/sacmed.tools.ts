import { ToolSchema } from '../interfaces/tool-schema.interface';

/**
 * Definiciones de tools para la plataforma Sacmed.
 *
 * Sacmed usa IDs numéricos para servicios/especialidades/comunas y UUID para
 * profesionales (campo userId). Autenticación vía API Key (header X-ApiKey).
 * Todas las tools llegan al proxy de gloory-api-endpoints (target: 'external').
 */
export const SACMED_TOOLS: ToolSchema[] = [
  // ============================
  // CATÁLOGO (read)
  // ============================
  {
    name: 'obtener_servicios',
    description:
      'Lista los servicios de la empresa. Cada servicio incluye su modalidad (Presencial/Telemedicina) en la respuesta.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/services',
    method: 'GET',
    category: 'read',
    fields: {},
  },
  {
    name: 'obtener_especialidades',
    description: 'Lista las especialidades asociadas a un servicio.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/specialties',
    method: 'POST',
    category: 'read',
    fields: {
      id_servicio: {
        type: 'integer',
        required: true,
        description: 'ID del servicio',
      },
    },
  },
  {
    name: 'obtener_profesionales',
    description: 'Lista todos los profesionales con sus especialidades.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/practitioners',
    method: 'GET',
    category: 'read',
    fields: {},
  },
  {
    name: 'obtener_profesionales_por_servicio',
    description:
      'Lista los profesionales que atienden un servicio determinado, con sus especialidades.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/practitioners/by-service',
    method: 'POST',
    category: 'read',
    fields: {
      id_servicio: {
        type: 'integer',
        required: true,
        description: 'ID del servicio para filtrar profesionales',
      },
    },
  },
  {
    name: 'obtener_especialistas',
    description: 'Lista los especialistas vinculados a una especialidad.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/practitioners/by-specialty',
    method: 'POST',
    category: 'read',
    fields: {
      id_especialidad: {
        type: 'integer',
        required: true,
        description: 'ID de la especialidad',
      },
    },
  },
  {
    name: 'obtener_distritos',
    description: 'Lista las comunas (distritos) registradas, usadas al crear pacientes.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/districts',
    method: 'GET',
    category: 'read',
    fields: {},
  },

  // ============================
  // DISPONIBILIDAD (read)
  // ============================
  {
    name: 'obtener_disponibilidad',
    description:
      'Busca horarios disponibles por especialista desde una fecha. Si no hay horarios en la semana de la fecha entregada, busca automáticamente en las siguientes, hasta 4 semanas. Retorna los slots agrupados por profesional y día (horas "HH:MM"), con la duración del bloque en la raíz. La `fecha` de cada día viene en formato legible en español (ej: "10 de Junio 2026"); pásala tal cual a crear_cita.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/availability',
    method: 'POST',
    category: 'read',
    fields: {
      fecha: {
        type: 'string',
        required: true,
        description: 'Fecha desde la cual buscar (acepta "10 de Junio 2026", ISO8601 o YYYY-MM-DD)',
      },
      id_especialidad: {
        type: 'integer',
        required: true,
        description: 'ID de la especialidad',
      },
      id_profesionales: {
        type: 'array',
        items: 'string',
        required: true,
        description:
          'Uno o varios UUIDs de profesional. Devuelve los horarios de cualquiera de ellos.',
      },
      id_servicio: {
        type: 'integer',
        required: false,
        configurable: true,
        description: 'ID del servicio (opcional, acota la disponibilidad)',
      },
      duracion_minutos: {
        type: 'integer',
        required: false,
        description:
          'Duración custom del bloque en minutos (ej: 90 para un tratamiento definido). Si se omite, usa la duración por defecto de la especialidad. La duración efectiva vuelve en el campo "duracion_minutos" de la respuesta y se usa tal cual en crear_cita.',
      },
    },
  },

  // ============================
  // PACIENTES
  // ============================
  {
    name: 'obtener_paciente',
    description: 'Busca un paciente por su RUT/identificación.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/patients/search',
    method: 'POST',
    category: 'read',
    fields: {
      rut: {
        type: 'string',
        required: true,
        description: 'RUT u otra identificación del paciente',
      },
    },
  },
  {
    name: 'obtener_citas_paciente',
    description: 'Lista las citas futuras de un paciente por su RUT, ordenadas por fecha.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/patients/appointments',
    method: 'POST',
    category: 'read',
    fields: {
      rut: {
        type: 'string',
        required: true,
        description: 'RUT u otra identificación del paciente',
      },
    },
  },
  {
    name: 'crear_paciente',
    description: 'Crea un nuevo paciente en Sacmed.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/patients',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Email válido. 2. Para pacientes chilenos (nacionalidad = 1) el RUT debe ser válido (dígito verificador). 3. La comuna debe obtenerse con obtener_distritos.',
    fields: {
      nombre: { type: 'string', required: true, description: 'Nombre del paciente' },
      apellido_paterno: { type: 'string', required: true, description: 'Apellido paterno' },
      apellido_materno: { type: 'string', required: true, description: 'Apellido materno' },
      rut: { type: 'string', required: true, description: 'RUT u otra identificación' },
      nacionalidad: {
        type: 'integer',
        required: true,
        description: 'ID de nacionalidad (1 = Chilena)',
      },
      telefono: { type: 'string', required: true, description: 'Teléfono móvil' },
      email: { type: 'string', required: true, description: 'Email de contacto' },
      fecha_nacimiento: {
        type: 'string',
        required: true,
        description: 'Fecha de nacimiento (YYYY-MM-DD)',
      },
      comuna: {
        type: 'integer',
        required: true,
        description: 'ID de la comuna (districtId, obtenido con obtener_distritos)',
      },
      direccion: { type: 'string', required: true, description: 'Dirección (calle)' },
    },
  },

  // ============================
  // CITAS (write)
  // ============================
  {
    name: 'crear_cita',
    description:
      'Agenda una nueva cita (evento) en Sacmed. Valida disponibilidad antes con obtener_disponibilidad.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/appointments',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules:
      'VALIDACIONES: 1. Validar disponibilidad con obtener_disponibilidad. 2. fecha, hora_inicio y duracion_minutos provienen de obtener_disponibilidad (fecha del día tal cual viene —ej: "10 de Junio 2026"—, hora del slot "HH:MM", duracion_minutos de la raíz). 3. El paciente debe existir (usa obtener_paciente o crear_paciente).',
    fields: {
      id_profesional: { type: 'string', required: true, description: 'UUID del profesional' },
      fecha: {
        type: 'string',
        required: true,
        description:
          'Fecha de la cita: el día del slot elegido en disponibilidad, tal cual viene (ej: "10 de Junio 2026"). También acepta YYYY-MM-DD.',
      },
      hora_inicio: {
        type: 'string',
        required: true,
        description: 'Hora de inicio (HH:MM, el slot elegido en disponibilidad)',
      },
      duracion_minutos: {
        type: 'integer',
        required: true,
        description:
          'Duración de la cita en minutos (el campo "duracion_minutos" que devolvió obtener_disponibilidad). El sistema calcula la hora de término.',
      },
      rut_paciente: { type: 'string', required: true, description: 'RUT del paciente' },
      telefono: { type: 'string', required: true, description: 'Teléfono del paciente' },
      email: { type: 'string', required: true, description: 'Email del paciente' },
      id_servicio: { type: 'integer', required: true, description: 'ID del servicio' },
      id_especialidad: { type: 'integer', required: true, description: 'ID de la especialidad' },
      comentario: {
        type: 'string',
        required: false,
        configurable: true,
        description: 'Comentario opcional (se guarda en GHL si hay espejado)',
      },
    },
  },
  {
    name: 'confirmar_cita',
    description: 'Confirma una cita de Sacmed por su ID.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/appointments/confirm',
    method: 'POST',
    category: 'write',
    fields: {
      id_cita: { type: 'integer', required: true, description: 'ID de la cita (eventId)' },
    },
  },
  {
    name: 'cancelar_cita',
    description: 'Cancela una cita de Sacmed por su ID.',
    target: 'external',
    endpoint: '/api/clients/{clientId}/sacmed/appointments/cancel',
    method: 'POST',
    category: 'write',
    requires_validation: true,
    validation_rules: 'VALIDACIONES: 1. Confirmar con el paciente antes de cancelar.',
    fields: {
      id_cita: { type: 'integer', required: true, description: 'ID de la cita (eventId)' },
    },
  },
];

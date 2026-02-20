/**
 * Tipos compartidos para la integración con Reservo
 * Basado en la documentación oficial: https://reservo.cl/APIpublica/v2/documentacion/
 */

export interface ReservoConfig {
  apiToken: string;
  agendas: ReservoAgenda[];
  timezone?: string;
  // GHL integration
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
}

export interface ReservoAgenda {
  id: number; // ID asignado (1, 2, 3...) para uso simplificado por el agente IA
  nombre: string;
  uuid: string; // UUID real de Reservo
  tipo: 'presencial' | 'online';
}

export const RESERVO_API = {
  baseUrl: 'https://reservo.cl/APIpublica/v2',
  createAppointmentUrl: 'https://reservo.cl/makereserva/confirmApptAPI/',
};

/**
 * Resultado de operación de Reservo
 */
export interface ReservoOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Respuesta paginada estándar de Reservo
 */
export interface ReservoPaginatedResponse<T> {
  cantidad_elementos: number;
  pagina_siguiente: string | null;
  pagina_anterior: string | null;
  resultados: T[];
}

/**
 * Paciente de Reservo
 */
export interface ReservoPatient {
  uuid: string;
  identificador: string; // RUT u otro identificador
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  telefono_1?: string;
  telefono_2?: string;
  mail?: string;
  ficha?: string;
  sexo?: string;
  direccion?: {
    pais?: string;
    estado?: string;
    ciudad?: string;
    calle?: string;
  };
  prevision?: {
    nombre: string;
    codigo?: string;
  };
  ocupacion?: string;
  fecha_nacimiento?: string;
  codigo_postal?: string;
  nombre_social?: string;
  estado?: string; // "Activo", etc.
  campos_personalizados?: {
    uuid: string;
    nombre: string;
    valor: string;
  }[];
  campos_por_pais?: Record<string, string>;
  categoria?: {
    nombre: string;
    descripcion?: string;
  };
}

/**
 * Payload para crear paciente en Reservo (POST /cliente/)
 */
export interface ReservoCreatePatientPayload {
  identificador: string;
  nombre: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  telefono_1?: string;
  telefono_2?: string;
  mail?: string;
  sexo?: number; // Ver endpoint /agenda_online/sexo_paciente/
  ficha?: string;
  ocupacion?: string;
  fecha_nacimiento?: string; // YYYY-MM-DD
  codigo_postal?: string;
  nombre_social?: string;
  campos_personalizados?: {
    uuid: string;
    valor: string;
  }[];
}

/**
 * Cita de Reservo (respuesta completa de GET /citas/)
 */
export interface ReservoAppointment {
  uuid: string;
  agenda?: {
    uuid: string;
    descripcion: string;
  };
  sucursal?: {
    uuid: string;
    nombre: string;
  };
  zona_horaria: string;
  inicio: string; // ISO 8601 UTC
  fin: string; // ISO 8601 UTC
  estado: {
    codigo: string; // "NC" = No Confirmado, "C" = Confirmado, "S" = Suspendido
    descripcion: string;
  };
  estado_pago?: {
    codigo: string; // "NP" = No Pagado
    descripcion: string;
  };
  cliente?: {
    uuid: string | null;
    identificador: string;
    sexo: string | null;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    fecha_nacimiento: string;
    telefono_1: string;
    telefono_2: string;
    mail: string;
    zona_horaria: string;
    prevision?: {
      nombre: string;
      codigo: string;
    };
    direccion?: {
      pais: string;
      estado: string;
      ciudad: string;
      calle: string;
    };
  };
  comentario?: string;
  profesional?: {
    uuid: string;
    identificador: string;
    nombre: string;
    cargo: string;
    codigo_especialidad: string;
  };
  tratamientos?: {
    uuid: string;
    nombre: string;
    codigo: string;
    categoria?: {
      uuid: string;
      nombre: string;
      codigo: string;
    };
    indicacion?: string;
  }[];
  online?: boolean;
  fecha_creacion: string; // ISO 8601 UTC
  origen_creacion?: {
    descripcion: string;
  };
  simbolos?: Record<string, boolean>;
  url_pago_online?: string;
  url_videoconferencia?: string;
}

/**
 * Profesional de Reservo
 * Nota: El campo 'agenda' será deprecado, usar 'uuid' en su lugar
 */
export interface ReservoProfessional {
  uuid: string;
  agenda?: string; // DEPRECADO - usar uuid
  identificador?: string; // RUT
  nombre: string;
  cargo?: string;
  codigo_especialidad?: string;
  sucursal?: string; // UUID de la sucursal
}

/**
 * Tratamiento de Reservo
 */
export interface ReservoTreatment {
  uuid: string;
  nombre: string;
  descripcion?: string;
  categoria?: {
    uuid: string;
    nombre: string;
    codigo: string;
  };
  valor?: number;
}

/**
 * Sucursal de Reservo
 */
export interface ReservoSucursal {
  sucursal: string; // UUID
  nombre: string;
  direccion?: string;
  comuna?: string;
  region?: string;
}

/**
 * Slot de disponibilidad de Reservo
 */
export interface ReservoAvailabilitySlot {
  fecha: string;
  sucursales: {
    uuid?: string;
    nombre: string;
    direccion?: string;
    profesionales: {
      agenda: string; // UUID del profesional (campo legacy)
      nombre: string;
      horas_disponibles: string[];
    }[];
  }[];
}

/**
 * Payload para crear cita en Reservo
 */
export interface ReservoCreateAppointmentPayload {
  sucursal: string; // UUID de la sucursal (obtenido de disponibilidad o sucursales)
  url: string; // UUID de la agenda
  tratamientos_uuid: string[];
  agendas_uuid: string[]; // UUID del profesional
  calendario: {
    time_zone: string;
    date: string; // YYYY-MM-DD
    hour: string; // HH:MM
  };
  cliente: {
    uuid: string; // UUID del paciente (obtenido de buscar o crear paciente)
  };
}

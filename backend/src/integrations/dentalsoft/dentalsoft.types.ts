/**
 * Tipos compartidos para la integración con Dentalsoft.
 *
 * API OAuth Dentalsoft 10 — autenticación OAuth client_credentials.
 * Base URL: https://api.dentalsoft.cl/external
 * Docs: ver apis-en-python/documentacion-dentalsoft/openapi.json
 */

export interface DentalsoftConfig {
  clientId: string;
  clientSecret: string;
  scope: number; // ID de la clínica target
  baseUrl?: string; // Override opcional (sandbox: api-test.dentalsoft.cl, etc.)
  timezone?: string;
  // GHL integration (espejado de citas)
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
  ghlOAuthMode?: boolean;
}

export const DENTALSOFT_API = {
  defaultBaseUrl: 'https://api.dentalsoft.cl/external',
  testBaseUrl: 'https://api-test.dentalsoft.cl/external',
};

export interface DentalsoftOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DentalsoftTokenResponse {
  token_type: string;
  expires_in: string | number;
  access_token: string;
}

/**
 * Paciente — respuesta de GET /paciente/datos
 */
export interface DentalsoftPaciente {
  id: number;
  cedula: string;
  tipo_cedula: number; // 1=rut, 2=dni
  celular?: string | null;
  sexo?: string | null;
  fecha_registro: string;
  fecha_nacimiento?: string | null;
  estado: number;
  nombre: string;
  email?: string;
}

/**
 * Cita — respuesta de GET /agenda/cita/{id}
 */
export interface DentalsoftCita {
  id: number;
  fecha: string;
  id_paciente: number;
  id_sucursal: number;
  inicio: string;
  bloques: number;
  estado: number;
  estado_texto: string;
  id_sala: number;
  paciente?: DentalsoftPaciente | null;
  sala?: { id: number; nombre: string };
  notificable: boolean;
  confirmable: boolean;
  ingresable_a_en_espera: boolean;
  cancelable: boolean;
  observacion: string;
}

export interface DentalsoftSucursal {
  id: number;
  nombre: string;
  telefono?: string;
  direccion?: string;
  estado: number;
  estado_texto?: string;
}

export interface DentalsoftProfesional {
  id_profesional: number;
  nombre_completo: string;
}

/**
 * Usuario del sistema retornado por `/usuario/listado`. Incluye el array
 * `especialidades` por usuario — usado para resolver la relación profesional↔
 * especialidad (`/profesional/listado/especialidad` no está disponible en
 * todos los tenants).
 */
export interface DentalsoftUsuario {
  id_usuario: string;
  rut: string; // formato "12345678-9" (con DV)
  tipo_identificador?: string;
  identificador?: string | null;
  usuario: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  tipo_profesional: 'Usuario con agenda' | 'Usuario sin agenda';
  id_tipo_usuario?: string;
  nombre_tipo_usuario?: string;
  activo: boolean;
  fono?: string;
  mail?: string;
  sucursales?: { id: number; nombre: string }[];
  especialidades?: { id: number; nombre: string }[];
  estado_firma_electronica?: string | null;
}

/**
 * Profesional con sus especialidades — shape de respuesta del proxy
 * `/dentalsoft/professionals/by-specialty`.
 */
export interface DentalsoftProfesionalConEspecialidades {
  id_profesional: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  especialidades: { id: number; nombre: string }[];
  sucursales: { id: number; nombre: string }[];
}

export interface DentalsoftEspecialidad {
  id: number;
  nombre: string;
  abreviacion?: string | boolean;
  activo: boolean;
}

/**
 * Disponibilidad diaria normalizada por el servicio.
 *
 * La API real responde con `cod_sala`/`nom_sala` como strings (no `id_sala`/`nombre_sala`
 * integers como dice el OpenAPI). El servicio normaliza para que el contrato sea
 * consistente con `createAppointment`, que pide `sala: integer`.
 */
export interface DentalsoftDisponibilidadDiaria {
  inicio: string; // HH:MM:SS
  fin: string; // HH:MM:SS
  id_profesional: number;
  id_sala: number;
  nombre_sala: string;
}

export interface DentalsoftDisponibilidadMensual {
  fecha: string; // YYYY-MM-DD
  isodow: number; // 1=Lun ... 7=Dom
  dia: number;
  bloques_disponibles: boolean;
  mes: number;
}

/**
 * Payload — POST /agenda/cita
 */
export interface DentalsoftCreateAppointmentPayload {
  sucursal: number;
  profesional: number;
  sala: number;
  paciente: number;
  fecha: string; // YYYY-MM-DD
  inicio: string; // HH:MM
  bloques: number;
  observacion: string;
}

/**
 * Item de `/agenda/informes/horas/efectivas/{from}/{to}?id_paciente=...`.
 * El reporte tiene muchos más campos pero estos son los que usamos.
 */
export interface DentalsoftHoraEfectiva {
  id_cita: number;
  fecha_cita: string; // YYYY-MM-DD
  hora_cita: string; // HH:MM
  bloques_cita: number;
  id_sucursal: number;
  nombre_sucursal: string;
  id_estado_cita: number;
  estado_cita: string;
  id_paciente: number;
  nombre_paciente?: string | null;
  apellido_paterno_paciente?: string | null;
  identificador_numerico_profesional?: number;
  nombre_profesional?: string;
  eliminada?: boolean;
}

export interface DentalsoftHorasEfectivasResponse {
  data: DentalsoftHoraEfectiva[];
  pagination?: { siguiente?: string; por_pagina?: number; total_pagina?: number };
}

/**
 * Estados aceptados por PUT /agenda/cita/cambia_estado
 */
export type DentalsoftCitaEstado =
  | 'notificar_wspp'
  | 'confirmar'
  | 'confirmar_wspp'
  | 'cancelar'
  | 'en_espera';

/**
 * Payload — POST /paciente/nuevo
 */
export interface DentalsoftCreatePatientPayload {
  cedula: string;
  tipo_cedula_texto: 'rut' | 'dni';
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  email: string;
  celular: string; // formato numérico, ej: 56977889900
  id_referencia?: number;
}

/**
 * Tipos compartidos para registrar la ejecución paso a paso
 * de una confirmación de cita (Dentalink o Reservo) hacia GHL.
 *
 * Permite saber exactamente en qué etapa falla una confirmación
 * cuando hay errores en GHL u otra dependencia externa.
 */

export enum ExecutionStepStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  SKIPPED = 'skipped',
  WARNING = 'warning',
}

export enum ExecutionStepName {
  RESOLVE_GHL_CREDENTIALS = 'resolve_ghl_credentials',
  FIND_OR_CREATE_CONTACT = 'find_or_create_contact',
  UPDATE_CONTACT_CUSTOM_FIELDS = 'update_contact_custom_fields',
  UPDATE_PLATFORM_STATUS = 'update_platform_status',
}

export interface ExecutionStepEntry {
  attempt: number;
  step: ExecutionStepName;
  status: ExecutionStepStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  errorMessage?: string;
  httpStatus?: number;
  metadata?: Record<string, any>;
}

export type ExecutionLog = ExecutionStepEntry[];

import { Client } from '../../clients/entities/client.entity';
import { ConfirmationConfig } from '../entities/confirmation-config.entity';

/**
 * Datos normalizados de una cita, independiente de la plataforma.
 * Todos los IDs son string para uniformidad (Dentalink usa numbers, Reservo usa UUIDs).
 */
export interface NormalizedAppointmentData {
  id_paciente: string;
  nombre_paciente: string;
  nombre_social_paciente?: string;
  rut_paciente?: string;
  email_paciente?: string;
  telefono_paciente?: string;
  id_tratamiento: string;
  nombre_tratamiento: string;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string; // HH:mm:ss
  hora_fin: string;
  duracion: number;
  id_dentista: string;
  nombre_dentista: string;
  id_sucursal: string;
  nombre_sucursal: string;
  id_estado: string;
  estado_cita: string;
  motivo_atencion?: string;
  comentarios?: string;
}

/**
 * Una cita obtenida de la plataforma, lista para almacenar como PendingConfirmation.
 */
export interface FetchedAppointment {
  platformAppointmentId: string;
  appointmentData: NormalizedAppointmentData;
}

/**
 * Interfaz que cada plataforma debe implementar para el sistema de confirmaciones.
 *
 * Responsabilidades del adapter:
 * - Obtener citas de la plataforma y normalizarlas
 * - Actualizar el estado de una cita en la plataforma origen
 *
 * Lo que NO hace el adapter (lo hace el service principal):
 * - Persistencia en DB (deduplicación, PendingConfirmation)
 * - Procesamiento GHL (contactos, custom fields)
 * - Scheduling y cron jobs
 */
export interface IConfirmationAdapter {
  /**
   * Identificador de la plataforma que maneja este adapter.
   * Debe coincidir con IntegrationType: 'dentalink', 'dentalink_medilink', 'reservo'
   */
  readonly platform: string;

  /**
   * Obtiene citas de la plataforma para una fecha dada, filtradas según la configuración,
   * y las normaliza al formato compartido.
   *
   * NO persiste nada - el servicio principal se encarga de la deduplicación y storage.
   */
  fetchAppointments(
    client: Client,
    config: ConfirmationConfig,
    appointmentDate: string,
    timezone: string,
  ): Promise<FetchedAppointment[]>;

  /**
   * Actualiza el estado de una cita en la plataforma origen después de que
   * el procesamiento GHL fue exitoso.
   *
   * Es best-effort: los errores se loguean pero no fallan la confirmación.
   *
   * @param stateId - ID numérico del estado (usado por Dentalink). Opcional para plataformas
   *                  que usan códigos string (Reservo usa 'C' internamente).
   */
  confirmAppointmentOnPlatform(
    client: Client,
    platformAppointmentId: string,
    stateId?: number,
  ): Promise<void>;
}

export interface EndpointArgument {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  example?: any;
}

export interface EndpointDefinition {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  dentalinkPath: string;
  category: string;
  arguments: EndpointArgument[];
  requiresConfig?: boolean; // Indica si requiere configuración previa
  configField?: string; // Campo de configuración requerido
}

export const AVAILABLE_ENDPOINTS: EndpointDefinition[] = [
  // Availability
  {
    id: 'search-availability',
    name: 'Buscar Disponibilidad',
    description: 'Busca disponibilidad de profesionales en fechas específicas',
    method: 'POST',
    path: '/availability',
    dentalinkPath: '/horariosdisponibles',
    category: 'availability',
    arguments: [
      {
        name: 'ids_profesionales',
        type: 'array',
        description: 'Lista de IDs de los profesionales a consultar',
        required: true,
        example: [45, 43],
      },
      {
        name: 'id_sucursal',
        type: 'number',
        description: 'ID de la sucursal donde buscar disponibilidad',
        required: true,
        example: 3,
      },
      {
        name: 'fecha_inicio',
        type: 'string',
        description:
          'Fecha de inicio de búsqueda (formato YYYY-MM-DD). Si no se proporciona, se usa la fecha actual.',
        required: false,
        example: '2025-01-15',
      },
      {
        name: 'tiempo_cita',
        type: 'number',
        description:
          'Duración de la cita en minutos. Si no se proporciona, se usa el intervalo por defecto del profesional.',
        required: false,
        example: 15,
      },
    ],
  },

  // Patients
  {
    id: 'search-patient',
    name: 'Buscar Paciente',
    description: 'Busca un paciente por RUT',
    method: 'POST',
    path: '/patients/search',
    dentalinkPath: '/pacientes',
    category: 'patients',
    arguments: [
      {
        name: 'rut',
        type: 'string',
        description: 'RUT del paciente a buscar (con o sin formato)',
        required: true,
        example: '12345678-9',
      },
    ],
  },
  {
    id: 'create-patient',
    name: 'Crear Paciente',
    description: 'Crea un nuevo paciente en Dentalink',
    method: 'POST',
    path: '/patients',
    dentalinkPath: '/pacientes',
    category: 'patients',
    arguments: [
      {
        name: 'rut',
        type: 'string',
        description: 'RUT del paciente',
        required: true,
        example: '12345678-9',
      },
      {
        name: 'nombre',
        type: 'string',
        description: 'Nombre del paciente',
        required: true,
        example: 'Juan',
      },
      {
        name: 'apellidos',
        type: 'string',
        description: 'Apellidos del paciente',
        required: true,
        example: 'Pérez González',
      },
      {
        name: 'telefono',
        type: 'string',
        description: 'Teléfono de contacto',
        required: false,
        example: '+56912345678',
      },
      {
        name: 'email',
        type: 'string',
        description: 'Correo electrónico del paciente',
        required: false,
        example: 'juan.perez@email.com',
      },
      {
        name: 'fecha_nacimiento',
        type: 'string',
        description: 'Fecha de nacimiento del paciente (formato YYYY-MM-DD)',
        required: false,
        example: '1990-05-15',
      },
    ],
  },
  {
    id: 'get-patient-treatments',
    name: 'Obtener Tratamientos',
    description: 'Obtiene los tratamientos de un paciente por RUT',
    method: 'POST',
    path: '/patients/treatments',
    dentalinkPath: '/pacientes/:id/tratamientos',
    category: 'patients',
    arguments: [
      {
        name: 'rut',
        type: 'string',
        description: 'RUT del paciente',
        required: true,
        example: '12345678-9',
      },
    ],
  },

  // Appointments
  {
    id: 'create-appointment',
    name: 'Crear Cita',
    description:
      'Agenda una nueva cita en Dentalink. Si el cliente tiene GHL habilitado, también sincroniza con GoHighLevel.',
    method: 'POST',
    path: '/appointments',
    dentalinkPath: '/citas',
    category: 'appointments',
    arguments: [
      {
        name: 'id_paciente',
        type: 'number',
        description: 'ID del paciente en Dentalink/Medilink (debe existir previamente)',
        required: true,
        example: 123,
      },
      {
        name: 'id_profesional',
        type: 'number',
        description: 'ID del profesional que atenderá',
        required: true,
        example: 45,
      },
      {
        name: 'id_sucursal',
        type: 'number',
        description: 'ID de la sucursal',
        required: true,
        example: 3,
      },
      {
        name: 'fecha',
        type: 'string',
        description: 'Fecha de la cita (formato YYYY-MM-DD)',
        required: true,
        example: '2025-01-20',
      },
      {
        name: 'hora_inicio',
        type: 'string',
        description: 'Hora de inicio de la cita (formato HH:MM)',
        required: true,
        example: '10:30',
      },
      {
        name: 'tiempo_cita',
        type: 'number',
        description:
          'Duración de la cita en minutos. Si no se proporciona, se usa el intervalo del profesional',
        required: false,
        example: 30,
      },
      {
        name: 'comentario',
        type: 'string',
        description:
          'Comentario o notas adicionales sobre la cita. Si no se proporciona, se usa "Agendado por IA"',
        required: false,
        example: 'Paciente solicita limpieza dental',
      },
      {
        name: 'user_id',
        type: 'string',
        description:
          'Contact ID de GHL (opcional, solo si GHL está habilitado. Se usa para sincronizar la cita con GoHighLevel)',
        required: false,
        example: 'abc123xyz',
      },
    ],
  },
  {
    id: 'confirm-appointment',
    name: 'Confirmar Cita',
    description:
      'Confirma una cita cambiándola al estado configurado para confirmación. Requiere que el cliente tenga configurado el campo "Estado de Confirmación" en su configuración.',
    method: 'POST',
    path: '/appointments/confirm',
    dentalinkPath: '/citas/:id',
    category: 'appointments',
    requiresConfig: true,
    configField: 'confirmationStateId',
    arguments: [
      {
        name: 'id_cita',
        type: 'number',
        description: 'ID de la cita a confirmar',
        required: true,
        example: 12345,
      },
    ],
  },
  {
    id: 'cancel-appointment',
    name: 'Cancelar Cita',
    description: 'Cancela una cita por su ID',
    method: 'POST',
    path: '/appointments/cancel',
    dentalinkPath: '/citas/:id',
    category: 'appointments',
    arguments: [
      {
        name: 'id_cita',
        type: 'number',
        description: 'ID de la cita a cancelar',
        required: true,
        example: 12345,
      },
    ],
  },
  {
    id: 'get-future-appointments',
    name: 'Obtener Citas Futuras',
    description:
      'Obtiene todas las citas futuras y activas (no anuladas) de un paciente por RUT. Las citas se ordenan por fecha y hora, mostrando la más próxima primero. Funciona con Dentalink y MediLink.',
    method: 'POST',
    path: '/appointments/future',
    dentalinkPath: '/pacientes/:id/citas',
    category: 'appointments',
    arguments: [
      {
        name: 'rut',
        type: 'string',
        description:
          'RUT del paciente (formato: 12345678-9 o 12345678). El sistema formateará automáticamente el RUT.',
        required: true,
        example: '12345678-9',
      },
    ],
  },

  // Testing
  {
    id: 'test-connection',
    name: 'Probar Conexión',
    description: 'Verifica la conexión con Dentalink',
    method: 'POST',
    path: '/test-connection',
    dentalinkPath: '/dentistas',
    category: 'testing',
    arguments: [],
  },

  // Clinic - Sucursales y Profesionales (Cache)
  {
    id: 'get-branches',
    name: 'Obtener Sucursales',
    description: 'Obtiene las sucursales cacheadas del cliente (sincronizadas desde Dentalink)',
    method: 'GET',
    path: '/clinic/branches',
    dentalinkPath: '/sucursales',
    category: 'clinic',
    arguments: [],
  },
  {
    id: 'get-branch-professionals',
    name: 'Profesionales por Sucursal',
    description: 'Obtiene los profesionales asignados a una sucursal específica',
    method: 'POST',
    path: '/clinic/branches/professionals',
    dentalinkPath: '/dentistas',
    category: 'clinic',
    arguments: [
      {
        name: 'id_sucursal',
        type: 'number',
        description: 'ID de Dentalink de la sucursal',
        required: true,
        example: 1,
      },
    ],
  },
  {
    id: 'get-professionals',
    name: 'Obtener Profesionales',
    description: 'Obtiene todos los profesionales cacheados del cliente',
    method: 'GET',
    path: '/clinic/professionals',
    dentalinkPath: '/dentistas',
    category: 'clinic',
    arguments: [],
  },
  {
    id: 'get-clinic-stats',
    name: 'Estadísticas Clínica',
    description: 'Obtiene estadísticas de sucursales y profesionales sincronizados',
    method: 'GET',
    path: '/clinic/stats',
    dentalinkPath: '',
    category: 'clinic',
    arguments: [],
  },
  {
    id: 'sync-clinic',
    name: 'Sincronizar Clínica',
    description:
      'Sincroniza sucursales y profesionales desde Dentalink. Solo agrega nuevos registros.',
    method: 'POST',
    path: '/clinic/sync',
    dentalinkPath: '/sucursales + /dentistas',
    category: 'clinic',
    arguments: [
      {
        name: 'force',
        type: 'boolean',
        description: 'Si es true, elimina los datos existentes antes de sincronizar',
        required: false,
        example: false,
      },
    ],
  },
  {
    id: 'get-specialties',
    name: 'Listar Especialidades',
    description:
      'Obtiene la lista de especialidades únicas de los profesionales activos con agenda online',
    method: 'GET',
    path: '/clinic/specialties',
    dentalinkPath: '',
    category: 'clinic',
    arguments: [],
  },
  {
    id: 'get-professionals-by-specialty',
    name: 'Profesionales por Especialidad',
    description:
      'Obtiene profesionales filtrados por especialidad. Opcionalmente puede filtrarse también por sucursal.',
    method: 'POST',
    path: '/clinic/specialties/professionals',
    dentalinkPath: '',
    category: 'clinic',
    arguments: [
      {
        name: 'especialidad',
        type: 'string',
        description: 'Nombre de la especialidad a filtrar',
        required: true,
        example: 'Kinesiología',
      },
      {
        name: 'id_sucursal',
        type: 'number',
        description: 'ID de la sucursal para filtrar adicionalmente (opcional)',
        required: false,
        example: 1,
      },
    ],
  },

  // ============================
  // RESERVO ENDPOINTS
  // ============================

  // Reservo - Agendas
  {
    id: 'reservo-get-agendas',
    name: 'Obtener Agendas (Reservo)',
    description: 'Obtiene las agendas configuradas del cliente con su ID interno y nombre',
    method: 'GET',
    path: '/reservo/agendas',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [],
  },

  // Reservo - Pacientes
  {
    id: 'reservo-search-patient',
    name: 'Buscar Paciente (Reservo)',
    description: 'Busca un paciente en Reservo por su identificador',
    method: 'POST',
    path: '/reservo/patients/search',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'identificador',
        type: 'string',
        description: 'Identificador del paciente (ej: RUT, email)',
        required: true,
        example: '12345678-9',
      },
    ],
  },

  // Reservo - Crear Paciente
  {
    id: 'reservo-create-patient',
    name: 'Crear Paciente (Reservo)',
    description: 'Crea un nuevo paciente en Reservo',
    method: 'POST',
    path: '/reservo/patients',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'identificador',
        type: 'string',
        description: 'Identificador del paciente (RUT)',
        required: true,
        example: '12345678-9',
      },
      {
        name: 'nombre',
        type: 'string',
        description: 'Nombre del paciente',
        required: true,
        example: 'Juan',
      },
      {
        name: 'apellido',
        type: 'string',
        description: 'Apellido paterno del paciente',
        required: true,
        example: 'Pérez',
      },
      {
        name: 'telefono',
        type: 'string',
        description: 'Teléfono de contacto',
        required: true,
        example: '+56912345678',
      },
      {
        name: 'mail',
        type: 'string',
        description: 'Correo electrónico del paciente',
        required: false,
        example: 'juan.perez@email.com',
      },
      {
        name: 'fecha_nacimiento',
        type: 'string',
        description: 'Fecha de nacimiento (formato YYYY-MM-DD)',
        required: false,
        example: '1990-05-15',
      },
    ],
  },

  // Reservo - Disponibilidad
  {
    id: 'reservo-get-availability',
    name: 'Buscar Disponibilidad (Reservo)',
    description: 'Obtiene horarios disponibles para una agenda y tratamiento en Reservo',
    method: 'POST',
    path: '/reservo/availability',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'agenda_id',
        type: 'number',
        description:
          'ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo.',
        required: true,
        example: 1,
      },
      {
        name: 'fecha',
        type: 'string',
        description: 'Fecha de inicio de busqueda (formato YYYY-MM-DD)',
        required: true,
        example: '2025-01-15',
      },
      {
        name: 'uuid_tratamiento',
        type: 'string',
        description: 'UUID del tratamiento para consultar disponibilidad',
        required: true,
        example: 'abc123-def456',
      },
      {
        name: 'uuid_profesional',
        type: 'string',
        description: 'UUID del profesional (opcional, filtra por profesional)',
        required: false,
        example: 'xyz789-abc012',
      },
      {
        name: 'uuid_sucursal',
        type: 'string',
        description: 'UUID de la sucursal (opcional, filtra por sucursal)',
        required: false,
        example: 'abc123-sucursal',
      },
    ],
  },

  // Reservo - Profesionales
  {
    id: 'reservo-get-professionals',
    name: 'Obtener Profesionales (Reservo)',
    description: 'Obtiene los profesionales disponibles para una agenda en Reservo',
    method: 'POST',
    path: '/reservo/professionals',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'agenda_id',
        type: 'number',
        description:
          'ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo.',
        required: true,
        example: 1,
      },
      {
        name: 'uuid_tratamiento',
        type: 'string',
        description: 'UUID del tratamiento (opcional, filtra profesionales por tratamiento)',
        required: false,
        example: 'abc123-def456',
      },
    ],
  },

  // Reservo - Tratamientos
  {
    id: 'reservo-get-treatments',
    name: 'Obtener Tratamientos (Reservo)',
    description: 'Obtiene los tratamientos/servicios disponibles para una agenda en Reservo',
    method: 'POST',
    path: '/reservo/treatments',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'agenda_id',
        type: 'number',
        description:
          'ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo.',
        required: true,
        example: 1,
      },
    ],
  },

  // Reservo - Previsionales
  {
    id: 'reservo-get-prevision',
    name: 'Obtener Previsiones (Reservo)',
    description: 'Obtiene las opciones de prevision de salud disponibles en Reservo',
    method: 'POST',
    path: '/reservo/prevision',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'agenda_id',
        type: 'number',
        description:
          'ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo.',
        required: true,
        example: 1,
      },
    ],
  },

  // Reservo - Crear Cita
  {
    id: 'reservo-create-appointment',
    name: 'Crear Cita (Reservo)',
    description: 'Agenda una nueva cita en Reservo usando el UUID del paciente',
    method: 'POST',
    path: '/reservo/appointments',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'agenda_id',
        type: 'number',
        description:
          'ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo.',
        required: true,
        example: 1,
      },
      {
        name: 'id_sucursal',
        type: 'string',
        description: 'UUID de la sucursal (obtenido de disponibilidad o sucursales)',
        required: true,
        example: 'abc123-sucursal',
      },
      {
        name: 'id_tratamiento',
        type: 'string',
        description: 'UUID del tratamiento',
        required: true,
        example: 'abc123-def456',
      },
      {
        name: 'id_profesional',
        type: 'string',
        description: 'UUID del profesional',
        required: true,
        example: 'xyz789-abc012',
      },
      {
        name: 'fecha',
        type: 'string',
        description: 'Fecha de la cita (formato YYYY-MM-DD)',
        required: true,
        example: '2025-01-20',
      },
      {
        name: 'hora',
        type: 'string',
        description: 'Hora de la cita (formato HH:MM)',
        required: true,
        example: '10:30',
      },
      {
        name: 'uuid_paciente',
        type: 'string',
        description: 'UUID del paciente (obtenido de buscar o crear paciente)',
        required: true,
        example: '70f3b0f8-c12c-11ee-8da3-0242ac120005',
      },
    ],
  },

  // Reservo - Confirmar Cita
  {
    id: 'reservo-confirm-appointment',
    name: 'Confirmar Cita (Reservo)',
    description: 'Confirma una cita en Reservo por su UUID',
    method: 'POST',
    path: '/reservo/appointments/confirm',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'id_cita',
        type: 'string',
        description: 'UUID de la cita a confirmar',
        required: true,
        example: 'cita-uuid-123',
      },
    ],
  },

  // Reservo - Cancelar Cita
  {
    id: 'reservo-cancel-appointment',
    name: 'Cancelar Cita (Reservo)',
    description: 'Cancela una cita en Reservo por su UUID',
    method: 'POST',
    path: '/reservo/appointments/cancel',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'id_cita',
        type: 'string',
        description: 'UUID de la cita a cancelar',
        required: true,
        example: 'cita-uuid-123',
      },
    ],
  },

  // Reservo - Obtener Citas
  {
    id: 'reservo-get-appointments',
    name: 'Obtener Citas (Reservo)',
    description: 'Obtiene todas las citas de un paciente en Reservo',
    method: 'POST',
    path: '/reservo/appointments/search',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'id_paciente',
        type: 'string',
        description: 'UUID del paciente en Reservo',
        required: true,
        example: 'paciente-uuid-123',
      },
    ],
  },

  // Reservo - Citas Futuras
  {
    id: 'reservo-get-future-appointments',
    name: 'Citas Futuras (Reservo)',
    description: 'Obtiene las citas futuras (no confirmadas) de un paciente desde hoy en adelante',
    method: 'POST',
    path: '/reservo/appointments/future',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [
      {
        name: 'id_paciente',
        type: 'string',
        description: 'UUID del paciente en Reservo',
        required: true,
        example: 'paciente-uuid-123',
      },
    ],
  },

  // Reservo - Test de Conexion
  {
    id: 'reservo-test-connection',
    name: 'Probar Conexion (Reservo)',
    description: 'Verifica la conexion con la API de Reservo',
    method: 'POST',
    path: '/reservo/test-connection',
    dentalinkPath: '',
    category: 'reservo',
    arguments: [],
  },

  // ============================
  // GOHIGHLEVEL ENDPOINTS
  // ============================

  // GHL - Sedes y Calendarios (datos propios)
  {
    id: 'ghl-get-branches',
    name: 'Obtener Sedes (GHL)',
    description: 'Obtiene las sedes activas configuradas para este cliente en GoHighLevel',
    method: 'GET',
    path: '/ghl/branches',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [],
  },
  {
    id: 'ghl-get-branch-calendars',
    name: 'Calendarios por Sede (GHL)',
    description: 'Obtiene los calendarios asignados a una sede específica',
    method: 'POST',
    path: '/ghl/branches/calendars',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'branchId',
        type: 'number',
        description: 'ID de la sede',
        required: true,
        example: 1,
      },
    ],
  },
  {
    id: 'ghl-get-calendars',
    name: 'Obtener Calendarios (GHL)',
    description: 'Obtiene los calendarios activos sincronizados desde GoHighLevel',
    method: 'GET',
    path: '/ghl/calendars',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [],
  },
  {
    id: 'ghl-get-specialties',
    name: 'Listar Especialidades (GHL)',
    description: 'Obtiene la lista de especialidades únicas de los calendarios activos en GHL',
    method: 'GET',
    path: '/ghl/specialties',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [],
  },
  {
    id: 'ghl-get-calendars-by-specialty',
    name: 'Calendarios por Especialidad (GHL)',
    description:
      'Obtiene calendarios filtrados por especialidad. Opcionalmente filtra por sede.',
    method: 'POST',
    path: '/ghl/specialties/calendars',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'especialidad',
        type: 'string',
        description: 'Nombre de la especialidad a filtrar',
        required: true,
        example: 'Kinesiología',
      },
      {
        name: 'id_sucursal',
        type: 'number',
        description: 'ID de la sede para filtrar adicionalmente (opcional)',
        required: false,
        example: 1,
      },
    ],
  },
  {
    id: 'ghl-sync',
    name: 'Sincronizar Calendarios (GHL)',
    description:
      'Sincroniza calendarios desde la API de GoHighLevel. Solo agrega nuevos registros.',
    method: 'POST',
    path: '/ghl/sync',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'force',
        type: 'boolean',
        description: 'Si es true, elimina los datos existentes antes de sincronizar',
        required: false,
        example: false,
      },
    ],
  },
  {
    id: 'ghl-get-stats',
    name: 'Estadísticas (GHL)',
    description: 'Obtiene estadísticas de calendarios y sedes sincronizados en GHL',
    method: 'GET',
    path: '/ghl/stats',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [],
  },

  // GHL - Disponibilidad
  {
    id: 'ghl-search-availability',
    name: 'Buscar Disponibilidad (GHL)',
    description:
      'Busca horarios disponibles en los calendarios de GoHighLevel. Busca iterativamente hasta 4 semanas si no encuentra disponibilidad en la primera.',
    method: 'POST',
    path: '/ghl/availability',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'profesionales',
        type: 'array',
        description:
          'Lista de IDs de los profesionales a consultar (corresponden al orden en que aparecen los calendarios)',
        required: true,
        example: [1, 2],
      },
      {
        name: 'fecha_inicio',
        type: 'string',
        description:
          'Fecha de inicio de busqueda (formato YYYY-MM-DD). Si no se proporciona, se usa la fecha actual.',
        required: false,
        example: '2026-01-15',
      },
      {
        name: 'tiempo_cita',
        type: 'number',
        description:
          'Duracion de la cita en minutos. Si la cita requiere mas de un slot, se buscan slots consecutivos.',
        required: false,
        example: 60,
      },
    ],
  },

  // GHL - Crear Cita
  {
    id: 'ghl-create-appointment',
    name: 'Crear Cita (GHL)',
    description:
      'Crea una nueva cita en un calendario de GoHighLevel. Opcionalmente actualiza el nombre y comentario del contacto.',
    method: 'POST',
    path: '/ghl/appointments',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'user_id',
        type: 'string',
        description: 'Contact ID del contacto en GoHighLevel',
        required: true,
        example: 'abc123xyz',
      },
      {
        name: 'profesional',
        type: 'number',
        description: 'ID del profesional (calendario) que atendera',
        required: true,
        example: 1,
      },
      {
        name: 'fecha',
        type: 'string',
        description: 'Fecha de la cita (formato YYYY-MM-DD)',
        required: true,
        example: '2026-01-20',
      },
      {
        name: 'hora_inicio',
        type: 'string',
        description: 'Hora de inicio de la cita (formato HH:MM)',
        required: true,
        example: '10:30',
      },
      {
        name: 'tiempo_cita',
        type: 'number',
        description: 'Duracion de la cita en minutos',
        required: false,
        example: 30,
      },
      {
        name: 'nombre',
        type: 'string',
        description: 'Nombre del contacto (actualiza el contacto en GHL)',
        required: false,
        example: 'Juan Perez',
      },
      {
        name: 'comentario',
        type: 'string',
        description: 'Comentario o notas sobre la cita (se guarda como custom field en GHL)',
        required: false,
        example: 'Primera consulta',
      },
      {
        name: 'telefono',
        type: 'string',
        description: 'Telefono del contacto (actualiza el contacto en GHL)',
        required: false,
        example: '+56912345678',
      },
      {
        name: 'email',
        type: 'string',
        description: 'Email del contacto (actualiza el contacto en GHL)',
        required: false,
        example: 'paciente@correo.com',
      },
    ],
  },

  // GHL - Cancelar Cita
  {
    id: 'ghl-cancel-appointment',
    name: 'Cancelar Cita (GHL)',
    description: 'Elimina una cita de GoHighLevel por su ID de evento',
    method: 'POST',
    path: '/ghl/appointments/cancel',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'event_id',
        type: 'string',
        description: 'ID del evento/cita en GoHighLevel',
        required: true,
        example: 'event-uuid-123',
      },
    ],
  },

  // GHL - Actualizar Cita
  {
    id: 'ghl-update-appointment',
    name: 'Actualizar Cita (GHL)',
    description:
      'Actualiza informacion del contacto asociado a una cita en GoHighLevel (comentario, telefono)',
    method: 'POST',
    path: '/ghl/appointments/update',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'event_id',
        type: 'string',
        description: 'ID del evento/cita en GoHighLevel',
        required: true,
        example: 'event-uuid-123',
      },
      {
        name: 'user_id',
        type: 'string',
        description: 'Contact ID del contacto (requerido si se actualiza comentario o telefono)',
        required: false,
        example: 'abc123xyz',
      },
      {
        name: 'comentario',
        type: 'string',
        description: 'Nuevo comentario (se actualiza como custom field del contacto)',
        required: false,
        example: 'Paciente requiere atencion especial',
      },
      {
        name: 'telefono',
        type: 'string',
        description: 'Nuevo telefono del contacto',
        required: false,
        example: '+56912345678',
      },
    ],
  },

  // GHL - Citas de Contacto
  {
    id: 'ghl-contact-appointments',
    name: 'Citas de Contacto (GHL)',
    description: 'Obtiene todas las citas de un contacto en GoHighLevel',
    method: 'POST',
    path: '/ghl/appointments/contact',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [
      {
        name: 'user_id',
        type: 'string',
        description: 'Contact ID del contacto en GoHighLevel',
        required: true,
        example: 'abc123xyz',
      },
    ],
  },

  // GHL - Test de Conexion
  {
    id: 'ghl-test-connection',
    name: 'Probar Conexion (GHL)',
    description: 'Verifica la conexion con GoHighLevel y muestra la cantidad de calendarios encontrados',
    method: 'POST',
    path: '/ghl/test-connection',
    dentalinkPath: '',
    category: 'gohighlevel',
    arguments: [],
  },
];

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
        description: 'Fecha de inicio de búsqueda (formato YYYY-MM-DD). Si no se proporciona, se usa la fecha actual.',
        required: false,
        example: '2025-01-15',
      },
      {
        name: 'tiempo_cita',
        type: 'number',
        description: 'Duración de la cita en minutos. Si no se proporciona, se usa el intervalo por defecto del profesional.',
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
    description: 'Agenda una nueva cita en Dentalink. Si el cliente tiene GHL habilitado, también sincroniza con GoHighLevel.',
    method: 'POST',
    path: '/appointments',
    dentalinkPath: '/citas',
    category: 'appointments',
    arguments: [
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
        name: 'hora',
        type: 'string',
        description: 'Hora de inicio de la cita (formato HH:MM)',
        required: true,
        example: '10:30',
      },
      {
        name: 'duracion',
        type: 'number',
        description: 'Duración de la cita en minutos',
        required: true,
        example: 30,
      },
      {
        name: 'rut_paciente',
        type: 'string',
        description: 'RUT del paciente',
        required: true,
        example: '12345678-9',
      },
      {
        name: 'nombre_paciente',
        type: 'string',
        description: 'Nombre del paciente (para GHL)',
        required: false,
        example: 'Juan Pérez',
      },
      {
        name: 'email_paciente',
        type: 'string',
        description: 'Email del paciente (para GHL)',
        required: false,
        example: 'juan@email.com',
      },
      {
        name: 'telefono_paciente',
        type: 'string',
        description: 'Teléfono del paciente (para GHL)',
        required: false,
        example: '+56912345678',
      },
      {
        name: 'userId',
        type: 'string',
        description: 'ID de usuario de GHL (opcional, para sincronización)',
        required: false,
        example: 'abc123xyz',
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
    description: 'Sincroniza sucursales y profesionales desde Dentalink. Solo agrega nuevos registros.',
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
    description: 'Obtiene la lista de especialidades únicas de los profesionales activos con agenda online',
    method: 'GET',
    path: '/clinic/specialties',
    dentalinkPath: '',
    category: 'clinic',
    arguments: [],
  },
  {
    id: 'get-professionals-by-specialty',
    name: 'Profesionales por Especialidad',
    description: 'Obtiene profesionales filtrados por especialidad. Opcionalmente puede filtrarse también por sucursal.',
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
];

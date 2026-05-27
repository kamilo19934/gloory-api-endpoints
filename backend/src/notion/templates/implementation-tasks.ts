export interface ImplementationTask {
  name: string;
  phase: string;
  order: number;
  description: string;
}

export const IMPLEMENTATION_TASKS: ImplementationTask[] = [
  // Fase 1: Setup CRM
  {
    name: 'Crear Sub Account en CRM',
    phase: 'Setup CRM',
    order: 1,
    description: 'Crear la sub-cuenta del cliente en el CRM correspondiente',
  },
  {
    name: 'Cargar Snapshot',
    phase: 'Setup CRM',
    order: 2,
    description: 'Cargar el snapshot/template base en la sub-cuenta del CRM',
  },
  {
    name: 'Crear usuarios de CRM',
    phase: 'Setup CRM',
    order: 3,
    description:
      'Crear los usuarios necesarios dentro de la sub-cuenta (doctores, secretarias, admin)',
  },

  // Fase 2: Canales
  {
    name: 'Vincular canales de comunicación',
    phase: 'Canales',
    order: 4,
    description: 'Configurar los canales de comunicación del cliente en el CRM',
  },
  {
    name: 'WhatsApp',
    phase: 'Canales',
    order: 5,
    description: 'Conectar número de WhatsApp del cliente al CRM',
  },
  {
    name: 'Instagram',
    phase: 'Canales',
    order: 6,
    description: 'Conectar cuenta de Instagram del cliente al CRM',
  },
  {
    name: 'Facebook',
    phase: 'Canales',
    order: 7,
    description: 'Conectar página de Facebook del cliente al CRM',
  },

  // Fase 3: Calendarios
  {
    name: 'Crear calendarios necesarios',
    phase: 'Calendarios',
    order: 8,
    description: 'Crear los calendarios para cada profesional/servicio del cliente',
  },
  {
    name: 'Conectar calendario de Google de cada usuario',
    phase: 'Calendarios',
    order: 9,
    description: 'Vincular Google Calendar de cada profesional',
  },
  {
    name: 'Vincular calendario con usuario en CRM',
    phase: 'Calendarios',
    order: 10,
    description: 'Asociar cada calendario creado con su usuario correspondiente en el CRM',
  },
  {
    name: 'Establecer horarios',
    phase: 'Calendarios',
    order: 11,
    description: 'Configurar horarios de atención de cada profesional en los calendarios',
  },

  // Fase 4: Configuración Agente
  {
    name: 'Prompt',
    phase: 'Configuración Agente',
    order: 12,
    description: 'Crear y configurar el prompt del asistente IA del cliente',
  },
  {
    name: 'Instrucciones',
    phase: 'Configuración Agente',
    order: 13,
    description:
      'Documentar las instrucciones específicas del asistente (tono, restricciones, flujos)',
  },
  {
    name: 'Tools',
    phase: 'Configuración Agente',
    order: 14,
    description: 'Configurar las tools base del asistente (agendar, anular, consultar)',
  },
  {
    name: 'Tools Solicitadas',
    phase: 'Configuración Agente',
    order: 15,
    description: 'Configurar tools adicionales solicitadas por el cliente',
  },
  {
    name: 'Formato Solicitud',
    phase: 'Configuración Agente',
    order: 16,
    description: 'Definir el formato de solicitud de información al paciente',
  },
  {
    name: 'Formato Solicitud Cita',
    phase: 'Configuración Agente',
    order: 17,
    description: 'Definir el formato específico de solicitud de cita',
  },
  {
    name: 'Automatizaciones CRM',
    phase: 'Configuración Agente',
    order: 18,
    description: 'Configurar las automatizaciones necesarias en el CRM (workflows, triggers)',
  },

  // Fase 5: Testing
  {
    name: 'Probar proceso de Conversación',
    phase: 'Testing',
    order: 19,
    description: 'Test end-to-end del flujo conversacional del asistente',
  },
  {
    name: 'Probar Tools',
    phase: 'Testing',
    order: 20,
    description: 'Verificar funcionamiento de cada tool configurada',
  },
  {
    name: 'Tools Test',
    phase: 'Testing',
    order: 21,
    description: 'Pruebas adicionales de tools en escenarios edge-case',
  },
  {
    name: 'Obtener Disponibilidad',
    phase: 'Testing',
    order: 22,
    description: 'Verificar que la tool de disponibilidad retorna datos correctos',
  },
  {
    name: 'Agendar Cita',
    phase: 'Testing',
    order: 23,
    description: 'Verificar que se puede agendar una cita correctamente',
  },
  {
    name: 'Anular Cita',
    phase: 'Testing',
    order: 24,
    description: 'Verificar que se puede anular una cita correctamente',
  },
  {
    name: 'Citas de Cliente',
    phase: 'Testing',
    order: 25,
    description: 'Verificar que se pueden consultar las citas de un cliente',
  },
  {
    name: 'Verificar transferencia a humano',
    phase: 'Testing',
    order: 26,
    description:
      'Verificar que el asistente transfiere correctamente a un agente humano cuando corresponde',
  },

  // Fase 6: Entrega
  {
    name: 'Reunión Onboarding',
    phase: 'Entrega',
    order: 27,
    description: 'Reunión inicial con el cliente para presentar el sistema',
  },
  {
    name: 'Reunión de Entrega',
    phase: 'Entrega',
    order: 28,
    description: 'Reunión de entrega formal donde se muestra todo funcionando',
  },
  {
    name: '(AR) Avisar nueva Cita',
    phase: 'Entrega',
    order: 29,
    description: 'Configurar y verificar la automatización de aviso de nueva cita',
  },
];

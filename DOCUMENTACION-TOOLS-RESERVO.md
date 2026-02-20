# Endpoints para Agente IA - Reservo

Documentación de endpoints disponibles para el agente de IA (integración Reservo). Todos los endpoints requieren autenticación con API Key del cliente.

---

## Agendas

### GET /reservo/agendas
- **Nombre:** Obtener Agendas (Reservo)
- **Descripción:** Obtiene las agendas configuradas del cliente con su ID interno y nombre

**Args:** Ninguno

---

## Disponibilidad

### POST /reservo/availability
- **Nombre:** Buscar Disponibilidad (Reservo)
- **Descripción:** Obtiene horarios disponibles para una agenda y tratamiento en Reservo

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `agenda_id` | ✅ | ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo |
| `fecha` | ✅ | Fecha de inicio de búsqueda (formato YYYY-MM-DD) |
| `uuid_tratamiento` | ✅ | UUID del tratamiento para consultar disponibilidad |
| `uuid_profesional` | ❌ | UUID del profesional (filtra por profesional) |
| `uuid_sucursal` | ❌ | UUID de la sucursal (filtra por sucursal) |

---

## Pacientes

### POST /reservo/patients/search
- **Nombre:** Buscar Paciente (Reservo)
- **Descripción:** Busca un paciente en Reservo por su identificador

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `identificador` | ✅ | Identificador del paciente (ej: RUT, email) |

---

### POST /reservo/patients
- **Nombre:** Crear Paciente (Reservo)
- **Descripción:** Crea un nuevo paciente en Reservo

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `identificador` | ✅ | Identificador del paciente (RUT) |
| `nombre` | ✅ | Nombre del paciente |
| `apellido` | ✅ | Apellido paterno del paciente |
| `telefono` | ✅ | Teléfono de contacto |
| `mail` | ❌ | Correo electrónico del paciente |
| `fecha_nacimiento` | ❌ | Fecha de nacimiento (formato YYYY-MM-DD) |

---

## Citas

### POST /reservo/appointments
- **Nombre:** Crear Cita (Reservo)
- **Descripción:** Agenda una nueva cita en Reservo usando el UUID del paciente

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `agenda_id` | ✅ | ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo |
| `id_sucursal` | ✅ | UUID de la sucursal (obtenido de disponibilidad o sucursales) |
| `id_tratamiento` | ✅ | UUID del tratamiento |
| `id_profesional` | ✅ | UUID del profesional |
| `fecha` | ✅ | Fecha de la cita (formato YYYY-MM-DD) |
| `hora` | ✅ | Hora de la cita (formato HH:MM) |
| `uuid_paciente` | ✅ | UUID del paciente (obtenido de buscar o crear paciente) |

---

### POST /reservo/appointments/confirm
- **Nombre:** Confirmar Cita (Reservo)
- **Descripción:** Confirma una cita en Reservo por su UUID

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_cita` | ✅ | UUID de la cita a confirmar |

---

### POST /reservo/appointments/cancel
- **Nombre:** Cancelar Cita (Reservo)
- **Descripción:** Cancela una cita en Reservo por su UUID

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_cita` | ✅ | UUID de la cita a cancelar |

---

### POST /reservo/appointments/search
- **Nombre:** Obtener Citas (Reservo)
- **Descripción:** Obtiene todas las citas de un paciente en Reservo

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_paciente` | ✅ | UUID del paciente en Reservo |

---

### POST /reservo/appointments/future
- **Nombre:** Citas Futuras (Reservo)
- **Descripción:** Obtiene las citas futuras (no confirmadas) de un paciente desde hoy en adelante

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_paciente` | ✅ | UUID del paciente en Reservo |

---

## Clínica

### POST /reservo/professionals
- **Nombre:** Obtener Profesionales (Reservo)
- **Descripción:** Obtiene los profesionales disponibles para una agenda en Reservo

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `agenda_id` | ✅ | ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo |
| `uuid_tratamiento` | ❌ | UUID del tratamiento (filtra profesionales por tratamiento) |

---

### POST /reservo/treatments
- **Nombre:** Obtener Tratamientos (Reservo)
- **Descripción:** Obtiene los tratamientos/servicios disponibles para una agenda en Reservo

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `agenda_id` | ✅ | ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo |

---

### POST /reservo/prevision
- **Nombre:** Obtener Previsiones (Reservo)
- **Descripción:** Obtiene las opciones de previsión de salud disponibles en Reservo

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `agenda_id` | ✅ | ID asignado de la agenda (ej: 1, 2). Se configura al conectar el cliente con Reservo |

---

## Testing

### POST /reservo/test-connection
- **Nombre:** Probar Conexión (Reservo)
- **Descripción:** Verifica la conexión con la API de Reservo

**Args:** Ninguno

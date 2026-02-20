# Endpoints para Agente IA

Documentación de endpoints disponibles para el agente de IA. Todos los endpoints requieren autenticación con API Key del cliente.

---

## Disponibilidad

### POST /availability
- **Nombre:** Buscar Disponibilidad
- **Descripción:** Busca disponibilidad de profesionales en fechas específicas

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `ids_profesionales` | ✅ | Lista de IDs de los profesionales a consultar |
| `id_sucursal` | ✅ | ID de la sucursal donde buscar disponibilidad |
| `fecha_inicio` | ❌ | Fecha de inicio de búsqueda (formato YYYY-MM-DD). Si no se proporciona, se usa la fecha actual |
| `tiempo_cita` | ❌ | Duración de la cita en minutos. Si no se proporciona, se usa el intervalo por defecto del profesional |

---

## Pacientes

### POST /patients/search
- **Nombre:** Buscar Paciente
- **Descripción:** Busca un paciente por RUT

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `rut` | ✅ | RUT del paciente a buscar (con o sin formato) |

---

### POST /patients
- **Nombre:** Crear Paciente
- **Descripción:** Crea un nuevo paciente en Dentalink

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `rut` | ✅ | RUT del paciente |
| `nombre` | ✅ | Nombre del paciente |
| `apellidos` | ✅ | Apellidos del paciente |
| `telefono` | ❌ | Teléfono de contacto |
| `email` | ❌ | Correo electrónico del paciente |
| `fecha_nacimiento` | ❌ | Fecha de nacimiento del paciente (formato YYYY-MM-DD) |

---

### POST /patients/treatments
- **Nombre:** Obtener Tratamientos
- **Descripción:** Obtiene los tratamientos de un paciente por RUT

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `rut` | ✅ | RUT del paciente |

---

## Citas

### POST /appointments
- **Nombre:** Crear Cita
- **Descripción:** Agenda una nueva cita en Dentalink. Si el cliente tiene GHL habilitado, también sincroniza con GoHighLevel.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_paciente` | ✅ | ID del paciente en Dentalink/Medilink (debe existir previamente) |
| `id_profesional` | ✅ | ID del profesional que atenderá |
| `id_sucursal` | ✅ | ID de la sucursal |
| `fecha` | ✅ | Fecha de la cita (formato YYYY-MM-DD) |
| `hora_inicio` | ✅ | Hora de inicio de la cita (formato HH:MM) |
| `tiempo_cita` | ❌ | Duración de la cita en minutos. Si no se proporciona, se usa el intervalo del profesional |
| `comentario` | ❌ | Comentario o notas adicionales sobre la cita. Si no se proporciona, se usa "Agendado por IA" |
| `user_id` | ❌ | Contact ID de GHL (solo si GHL está habilitado. Se usa para sincronizar la cita con GoHighLevel) |

---

### POST /appointments/confirm
- **Nombre:** Confirmar Cita
- **Descripción:** Confirma una cita cambiándola al estado configurado para confirmación. Requiere que el cliente tenga configurado el campo "Estado de Confirmación" en su configuración.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_cita` | ✅ | ID de la cita a confirmar |

---

### POST /appointments/cancel
- **Nombre:** Cancelar Cita
- **Descripción:** Cancela una cita por su ID

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_cita` | ✅ | ID de la cita a cancelar |

---

### POST /appointments/future
- **Nombre:** Obtener Citas Futuras
- **Descripción:** Obtiene todas las citas futuras y activas (no anuladas) de un paciente por RUT. Las citas se ordenan por fecha y hora, mostrando la más próxima primero. Funciona con Dentalink y MediLink.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `rut` | ✅ | RUT del paciente (formato: 12345678-9 o 12345678). El sistema formateará automáticamente el RUT |

---

## Clínica

### GET /clinic/branches
- **Nombre:** Obtener Sucursales
- **Descripción:** Obtiene las sucursales cacheadas del cliente (sincronizadas desde Dentalink)

**Args:** Ninguno

---

### POST /clinic/branches/professionals
- **Nombre:** Profesionales por Sucursal
- **Descripción:** Obtiene los profesionales asignados a una sucursal específica

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `id_sucursal` | ✅ | ID de Dentalink de la sucursal |

---

### GET /clinic/professionals
- **Nombre:** Obtener Profesionales
- **Descripción:** Obtiene todos los profesionales cacheados del cliente

**Args:** Ninguno

---

### GET /clinic/stats
- **Nombre:** Estadísticas Clínica
- **Descripción:** Obtiene estadísticas de sucursales y profesionales sincronizados

**Args:** Ninguno

---

### POST /clinic/sync
- **Nombre:** Sincronizar Clínica
- **Descripción:** Sincroniza sucursales y profesionales desde Dentalink. Solo agrega nuevos registros.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `force` | ❌ | Si es true, elimina los datos existentes antes de sincronizar |

---

### GET /clinic/specialties
- **Nombre:** Listar Especialidades
- **Descripción:** Obtiene la lista de especialidades únicas de los profesionales activos con agenda online

**Args:** Ninguno

---

### POST /clinic/specialties/professionals
- **Nombre:** Profesionales por Especialidad
- **Descripción:** Obtiene profesionales filtrados por especialidad. Opcionalmente puede filtrarse también por sucursal.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `especialidad` | ✅ | Nombre de la especialidad a filtrar |
| `id_sucursal` | ❌ | ID de la sucursal para filtrar adicionalmente |

---

## Testing

### POST /test-connection
- **Nombre:** Probar Conexión
- **Descripción:** Verifica la conexión con Dentalink

**Args:** Ninguno

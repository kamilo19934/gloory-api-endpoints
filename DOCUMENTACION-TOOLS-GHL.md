# Endpoints para Agente IA - GoHighLevel

Documentación de endpoints disponibles para el agente de IA (integración GoHighLevel). Todos los endpoints requieren autenticación con API Key del cliente.

---

## Sedes y Calendarios

### GET /ghl/branches
- **Nombre:** Obtener Sedes (GHL)
- **Descripción:** Obtiene las sedes activas configuradas para este cliente en GoHighLevel

**Args:** Ninguno

---

### POST /ghl/branches/calendars
- **Nombre:** Calendarios por Sede (GHL)
- **Descripción:** Obtiene los calendarios asignados a una sede específica

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `branchId` | ✅ | ID de la sede |

---

### GET /ghl/calendars
- **Nombre:** Obtener Calendarios (GHL)
- **Descripción:** Obtiene los calendarios activos sincronizados desde GoHighLevel

**Args:** Ninguno

---

### GET /ghl/specialties
- **Nombre:** Listar Especialidades (GHL)
- **Descripción:** Obtiene la lista de especialidades únicas de los calendarios activos en GHL

**Args:** Ninguno

---

### POST /ghl/specialties/calendars
- **Nombre:** Calendarios por Especialidad (GHL)
- **Descripción:** Obtiene calendarios filtrados por especialidad. Opcionalmente filtra por sede.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `especialidad` | ✅ | Nombre de la especialidad a filtrar |
| `id_sucursal` | ❌ | ID de la sede para filtrar adicionalmente |

---

### POST /ghl/sync
- **Nombre:** Sincronizar Calendarios (GHL)
- **Descripción:** Sincroniza calendarios desde la API de GoHighLevel. Solo agrega nuevos registros.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `force` | ❌ | Si es true, elimina los datos existentes antes de sincronizar |

---

### GET /ghl/stats
- **Nombre:** Estadísticas (GHL)
- **Descripción:** Obtiene estadísticas de calendarios y sedes sincronizados en GHL

**Args:** Ninguno

---

## Disponibilidad

### POST /ghl/availability
- **Nombre:** Buscar Disponibilidad (GHL)
- **Descripción:** Busca horarios disponibles en los calendarios de GoHighLevel. Busca iterativamente hasta 4 semanas si no encuentra disponibilidad en la primera.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `profesionales` | ✅ | Lista de IDs de los profesionales a consultar (corresponden al orden en que aparecen los calendarios) |
| `fecha_inicio` | ❌ | Fecha de inicio de búsqueda (formato YYYY-MM-DD). Si no se proporciona, se usa la fecha actual |
| `tiempo_cita` | ❌ | Duración de la cita en minutos. Si la cita requiere más de un slot, se buscan slots consecutivos |

---

## Citas

### POST /ghl/appointments
- **Nombre:** Crear Cita (GHL)
- **Descripción:** Crea una nueva cita en un calendario de GoHighLevel. Opcionalmente actualiza el nombre y comentario del contacto.

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `user_id` | ✅ | Contact ID del contacto en GoHighLevel |
| `profesional` | ✅ | ID del profesional (calendario) que atenderá |
| `fecha` | ✅ | Fecha de la cita (formato YYYY-MM-DD) |
| `hora_inicio` | ✅ | Hora de inicio de la cita (formato HH:MM) |
| `tiempo_cita` | ❌ | Duración de la cita en minutos |
| `nombre` | ❌ | Nombre del contacto (actualiza el contacto en GHL) |
| `comentario` | ❌ | Comentario o notas sobre la cita (se guarda como custom field en GHL) |
| `telefono` | ❌ | Teléfono del contacto (actualiza el contacto en GHL) |
| `email` | ❌ | Email del contacto (actualiza el contacto en GHL) |

---

### POST /ghl/appointments/cancel
- **Nombre:** Cancelar Cita (GHL)
- **Descripción:** Elimina una cita de GoHighLevel por su ID de evento

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `event_id` | ✅ | ID del evento/cita en GoHighLevel |

---

### POST /ghl/appointments/update
- **Nombre:** Actualizar Cita (GHL)
- **Descripción:** Actualiza información del contacto asociado a una cita en GoHighLevel (comentario, teléfono)

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `event_id` | ✅ | ID del evento/cita en GoHighLevel |
| `user_id` | ❌ | Contact ID del contacto (requerido si se actualiza comentario o teléfono) |
| `comentario` | ❌ | Nuevo comentario (se actualiza como custom field del contacto) |
| `telefono` | ❌ | Nuevo teléfono del contacto |

---

### POST /ghl/appointments/contact
- **Nombre:** Citas de Contacto (GHL)
- **Descripción:** Obtiene todas las citas de un contacto en GoHighLevel

**Args:**
| Nombre | Requerido | Descripción |
|--------|-----------|-------------|
| `user_id` | ✅ | Contact ID del contacto en GoHighLevel |

---

## Testing

### POST /ghl/test-connection
- **Nombre:** Probar Conexión (GHL)
- **Descripción:** Verifica la conexión con GoHighLevel y muestra la cantidad de calendarios encontrados

**Args:** Ninguno

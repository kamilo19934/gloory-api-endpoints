# Tools para Agente IA — Clínica Dentalsoft

Catálogo de tools que el agente puede invocar para gestionar pacientes, agenda y citas en una clínica que usa la plataforma Dentalsoft.

---

## Diagnóstico

### POST /dentalsoft/test-connection

- **Nombre:** Probar Conexión
- **Descripción:** Verifica que la integración con la clínica está operativa. Retorna un resumen con la cantidad de sucursales y profesionales detectados.

**Args:** Ninguno

---

## Pacientes

### POST /dentalsoft/patients/search

- **Nombre:** Buscar Paciente
- **Descripción:** Busca un paciente previamente registrado por su cédula. Retorna sus datos completos o vacío si no existe.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `cedula` | string | ✅ | Cédula de identidad del paciente (ej: `12345678-9`). |
| `tipo_cedula_texto` | string | ❌ | Tipo de identificación. Por defecto `rut`. Usar `dni` solo si el paciente es extranjero y la clínica registra su DNI. |

---

### POST /dentalsoft/patients

- **Nombre:** Crear Paciente
- **Descripción:** Registra un paciente nuevo. Usar solo cuando `buscar_paciente` confirma que no existe. Retorna el `id_paciente` que se usa luego para agendar citas.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `cedula` | string | ✅ | Cédula de identidad del paciente. |
| `tipo_cedula_texto` | string | ✅ | `rut` para chilenos, `dni` para extranjeros. |
| `nombre` | string | ✅ | Nombre(s) del paciente. |
| `apellido_paterno` | string | ✅ | Apellido paterno. |
| `apellido_materno` | string | ❌ | Apellido materno (opcional). |
| `email` | string | ✅ | Correo electrónico de contacto. |
| `celular` | string | ✅ | Celular en formato numérico con código de país, sin signos (ej: `56977889900`). |
| `id_referencia` | integer | ❌ | ID de referencia opcional. |

---

## Profesionales y Especialidades

### GET /dentalsoft/professionals

- **Nombre:** Listar Profesionales
- **Descripción:** Lista todos los profesionales habilitados para recibir citas en la clínica. Útil cuando el paciente no especifica especialidad y quiere ver todas las opciones.

**Args:** Ninguno

---

### POST /dentalsoft/professionals/by-specialty

- **Nombre:** Listar Profesionales por Especialidad
- **Descripción:** Lista los profesionales activos que atienden una especialidad determinada. Cada profesional viene con **todas** sus especialidades, no solo la filtrada — útil para conocer su perfil completo (un profesional que hace "Ortodoncia" puede también hacer "Operatoria Dental").

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `especialidad` | string | ✅ | Nombre de la especialidad a buscar. Se acepta coincidencia parcial e ignora mayúsculas/minúsculas. |

**Respuesta sin coincidencias:** en vez de `[]` devuelve `{ "profesionales": [], "mensaje": "..." }`, donde el mensaje lista las especialidades que sí tienen profesionales activos. Esto permite al agente corregir el filtro en una sola llamada cuando el nombre registrado difiere del que usa el paciente (ej: "TTM" vs el nombre real en el sistema) en vez de reintentar con el mismo término.

---

### GET /dentalsoft/specialties

- **Nombre:** Listar Especialidades
- **Descripción:** Lista las especialidades que la clínica atiende actualmente — solo aquellas con al menos un profesional asignado. No incluye especialidades sin profesional activo.

**Args:** Ninguno

---

## Sucursales

### GET /dentalsoft/branches

- **Nombre:** Listar Sucursales
- **Descripción:** Lista las sucursales de la clínica con su dirección y teléfono.

**Args:** Ninguno

---

## Disponibilidad

### POST /dentalsoft/availability/search

- **Nombre:** Buscar Disponibilidad
- **Descripción:** Busca horarios disponibles para uno o varios profesionales a partir de una fecha.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_profesional` | integer \| integer[] | ✅ | Uno o varios IDs de profesional. Cuando se pasan varios, devuelve los horarios disponibles de cualquiera de ellos — útil para "cualquier profesional de la especialidad X". |
| `id_sucursal` | integer | ✅ | ID de la sucursal donde se atenderá la cita. |
| `fecha_inicio` | string | ✅ | Fecha desde la cual empezar a buscar, en formato `YYYY-MM-DD`. |
| `duracion_minutos` | integer | ❌ | Duración aproximada de la cita en minutos (ej: 30, 45, 60). Si se omite, se usa la duración mínima de la clínica. |

---

## Citas

### POST /dentalsoft/appointments

- **Nombre:** Crear Cita
- **Descripción:** Agenda una nueva cita para un paciente con un profesional. Antes de invocarla, usar `buscar_disponibilidad` para confirmar la hora exacta y obtener el `id_sala` correspondiente al slot.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_sucursal` | integer | ✅ | ID de la sucursal donde se atenderá la cita. |
| `id_profesional` | integer | ✅ | ID del profesional que atenderá. |
| `id_sala` | integer | ✅ | ID de la sala. Tomar el valor exacto del nivel `sala` al que pertenece el slot elegido en `buscar_disponibilidad` — no inventarlo. |
| `id_paciente` | integer | ✅ | ID del paciente (devuelto por `buscar_paciente` o `crear_paciente`). |
| `fecha` | string | ✅ | Fecha de la cita en formato `YYYY-MM-DD`. |
| `inicio` | string | ✅ | Hora de inicio en formato `HH:MM` (24h). |
| `duracion_minutos` | integer | ❌ | Duración de la cita en minutos (ej: 30, 45, 60). Si se omite, se usa la duración mínima de la clínica. |
| `comentario` | string | ❌ | Nota libre sobre la cita (motivo de consulta, indicaciones, etc.). |

---

### GET /dentalsoft/appointments/:id

- **Nombre:** Obtener Cita
- **Descripción:** Obtiene los datos detallados de una cita por su ID, incluyendo los datos del paciente asociado.

**Args (path):**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id` | integer | ✅ | ID de la cita. |

---

### POST /dentalsoft/appointments/day-branch

- **Nombre:** Citas del Día por Sucursal
- **Descripción:** Lista todas las citas agendadas en una sucursal para una fecha específica (sin incluir bloqueos). Útil para vistas tipo agenda diaria.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `fecha` | string | ✅ | Fecha en formato `YYYY-MM-DD`. |
| `id_sucursal` | integer | ✅ | ID de la sucursal. |

---

### POST /dentalsoft/appointments/patient

- **Nombre:** Citas del Paciente
- **Descripción:** Obtiene las citas activas de un paciente, agrupadas en `futuras` (ordenadas de la más próxima a la más lejana) y `pasadas` (sus últimas 5 citas, de la más reciente a la más antigua). Las citas canceladas no aparecen.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_paciente` | integer | ✅ | ID del paciente. |

---

### POST /dentalsoft/appointments/confirm

- **Nombre:** Confirmar Cita
- **Descripción:** Confirma la asistencia del paciente a una cita ya agendada. Cambia el estado de la cita de "Agendada" a "Confirmada".

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id` | integer | ✅ | ID de la cita a confirmar. |

---

### POST /dentalsoft/appointments/cancel

- **Nombre:** Cancelar Cita
- **Descripción:** Cancela una cita previamente agendada. Confirmar con el paciente antes de invocar.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id` | integer | ✅ | ID de la cita a cancelar. |

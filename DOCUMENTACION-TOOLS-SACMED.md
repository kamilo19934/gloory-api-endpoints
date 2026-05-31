# Tools para Agente IA — Centro Médico Sacmed

Catálogo de tools que el agente puede invocar para gestionar pacientes, agenda y citas en un centro médico que usa la plataforma **Sacmed** (microservicio de disponibilidad médica). La autenticación contra Sacmed es por **API Key** (`X-ApiKey`); el agente nunca la maneja — la resuelve el proxy a partir de la config del cliente.

> El agente entrega **argumentos**; nunca construye URLs ni query strings. Los argumentos viajan en el **body** de la request (las lecturas con parámetros usan `POST`); las lecturas sin parámetros usan `GET`.
>
> Notas de IDs:
> - Servicios, especialidades y comunas usan **IDs numéricos**.
> - Los profesionales usan **UUID** (`id_profesional` / `userId`).
> - Las citas (eventos) usan **IDs numéricos** (`id_cita` / `eventId`).

---

## Diagnóstico

### POST /sacmed/test-connection

- **Nombre:** Probar Conexión
- **Descripción:** Verifica que la integración con el centro médico está operativa. Retorna un resumen con la cantidad de servicios detectados.

**Args:** Ninguno

---

## Catálogo

### GET /sacmed/services — `obtener_servicios`

- **Nombre:** Obtener Servicios
- **Descripción:** Lista los servicios del centro. Cada servicio incluye su `modalidad` (Presencial/Telemedicina) en la respuesta, por lo que el agente puede filtrar por modalidad sin pedir un parámetro extra.

**Args:** Ninguno

---

### POST /sacmed/specialties — `obtener_especialidades`

- **Nombre:** Obtener Especialidades
- **Descripción:** Lista las especialidades asociadas a un servicio.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_servicio` | `integer` | ✅ | ID del servicio. |

---

### GET /sacmed/practitioners — `obtener_profesionales`

- **Nombre:** Obtener Profesionales
- **Descripción:** Lista todos los profesionales con sus especialidades.

**Args:** Ninguno

---

### POST /sacmed/practitioners/by-service — `obtener_profesionales_por_servicio`

- **Nombre:** Obtener Profesionales por Servicio
- **Descripción:** Lista los profesionales que atienden un servicio determinado, con sus especialidades.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_servicio` | `integer` | ✅ | ID del servicio para filtrar profesionales. |

---

### POST /sacmed/practitioners/by-specialty — `obtener_especialistas`

- **Nombre:** Obtener Especialistas por Especialidad
- **Descripción:** Lista los especialistas vinculados a una especialidad.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_especialidad` | `integer` | ✅ | ID de la especialidad. |

---

### GET /sacmed/districts — `obtener_distritos`

- **Nombre:** Obtener Comunas
- **Descripción:** Lista las comunas (distritos) registradas. Se usa para obtener el `id_distrito` (`districtId`) requerido al crear un paciente.

**Args:** Ninguno

---

## Disponibilidad

### POST /sacmed/availability — `obtener_disponibilidad`

- **Nombre:** Buscar Disponibilidad
- **Descripción:** Busca horarios disponibles por especialista desde una fecha. Si no hay horarios en la semana de la fecha entregada, busca automáticamente en las siguientes, hasta 4 semanas. La respuesta viene **agrupada por profesional → día → slots `"HH:MM"`**, con `duracion_minutos` y `total_slots` en la raíz.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `fecha` | `string` | ✅ | Fecha de inicio de búsqueda (ISO8601 o `YYYY-MM-DD`). |
| `id_especialidad` | `integer` | ✅ | ID de la especialidad. |
| `id_profesionales` | `array<string>` | ✅ | Array de UUIDs de profesional. Devuelve los horarios de cualquiera de ellos. |
| `id_servicio` | `integer` | ❌ | ID del servicio (opcional, acota la disponibilidad). |
| `duracion_minutos` | `integer` | ❌ | Duración custom del bloque en minutos (ej: `90` para un tratamiento definido). Si se omite, usa la duración por defecto de la especialidad. |

**Respuesta (ejemplo):**
```json
{
  "semana_desde": "2026-06-01",
  "semana_hasta": "2026-06-08",
  "id_especialidad": 2748,
  "id_servicio": 1916,
  "duracion_minutos": 20,
  "total_slots": 119,
  "profesionales": [
    {
      "id_profesional": "df848ed3-...",
      "nombre_profesional": "Claudia Castillo",
      "dias": [
        { "fecha": "2026-06-01", "slots": ["09:00", "09:20", "09:40"] }
      ]
    }
  ]
}
```
La respuesta trae todo lo necesario para `crear_cita`: de la raíz `id_especialidad`, `id_servicio` y `duracion_minutos`; del nivel profesional `id_profesional`; y del día la `fecha` + una hora de `slots`. Lo único que falta son los datos del paciente (`obtener_paciente` / `crear_paciente`). `id_servicio` solo aparece si se envió en la búsqueda.

---

## Pacientes

### POST /sacmed/patients/search — `obtener_paciente`

- **Nombre:** Buscar Paciente
- **Descripción:** Busca un paciente por su RUT/identificación. Retorna sus datos o vacío si no existe.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `rut` | `string` | ✅ | RUT u otra identificación del paciente (ej: `12345678-9`). |

---

### POST /sacmed/patients — `crear_paciente`

- **Nombre:** Crear Paciente
- **Descripción:** Registra un paciente nuevo. Usar solo cuando `obtener_paciente` confirma que no existe.
- **Validaciones:** Email válido. Para pacientes chilenos (`nacionalidad = 1`) el RUT debe ser válido (dígito verificador). La `comuna` debe obtenerse con `obtener_distritos`.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `nombre` | `string` | ✅ | Nombre(s) del paciente. |
| `apellido_paterno` | `string` | ✅ | Apellido paterno. |
| `apellido_materno` | `string` | ✅ | Apellido materno. |
| `rut` | `string` | ✅ | RUT u otra identificación. |
| `nacionalidad` | `integer` | ✅ | ID de nacionalidad (`1` = Chilena). |
| `telefono` | `string` | ✅ | Teléfono móvil. |
| `email` | `string` | ✅ | Correo electrónico de contacto. |
| `fecha_nacimiento` | `string` | ✅ | Fecha de nacimiento (`YYYY-MM-DD`). |
| `comuna` | `integer` | ✅ | ID de la comuna (`id_distrito` obtenido con `obtener_distritos`). |
| `direccion` | `string` | ✅ | Dirección (calle). |

---

### POST /sacmed/patients/appointments — `obtener_citas_paciente`

- **Nombre:** Obtener Citas del Paciente
- **Descripción:** Lista las citas **futuras** de un paciente por su RUT, ordenadas por fecha. Excluye citas pasadas.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `rut` | `string` | ✅ | RUT u otra identificación del paciente. |

---

## Citas

### POST /sacmed/appointments — `crear_cita`

- **Nombre:** Crear Cita
- **Descripción:** Agenda una nueva cita (evento). El sistema calcula la hora de término a partir de `hora_inicio` + `duracion_minutos`. Si el cliente tiene GoHighLevel configurado y se entrega `user_id`, la cita se espeja en GHL en background.
- **Validaciones:** Validar disponibilidad antes con `obtener_disponibilidad`. `fecha`, `hora_inicio` y `duracion_minutos` provienen de la disponibilidad (el día, una hora del slot, y el `duracion_minutos` de la raíz). El paciente debe existir (usa `obtener_paciente` o `crear_paciente`).

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_profesional` | `string` | ✅ | UUID del profesional. |
| `fecha` | `string` | ✅ | Fecha de la cita (`YYYY-MM-DD`, el día del slot elegido). |
| `hora_inicio` | `string` | ✅ | Hora de inicio (`HH:MM`, el slot elegido). |
| `duracion_minutos` | `integer` | ✅ | Duración en minutos (el `duracion_minutos` que devolvió la disponibilidad). |
| `rut_paciente` | `string` | ✅ | RUT del paciente. |
| `telefono` | `string` | ✅ | Teléfono del paciente. |
| `email` | `string` | ✅ | Email del paciente. |
| `id_servicio` | `integer` | ✅ | ID del servicio. |
| `id_especialidad` | `integer` | ✅ | ID de la especialidad. |
| `comentario` | `string` | ❌ | Comentario opcional (se guarda en GHL como custom field si hay espejado). |
| `user_id` | `string` | ❌ | GHL contact ID (opcional, para espejar la cita en GHL). |

---

### POST /sacmed/appointments/confirm — `confirmar_cita`

- **Nombre:** Confirmar Cita
- **Descripción:** Confirma una cita por su ID (`statusEventId = 2`).

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_cita` | `integer` | ✅ | ID de la cita (`eventId`). |

---

### POST /sacmed/appointments/cancel — `cancelar_cita`

- **Nombre:** Cancelar Cita
- **Descripción:** Cancela una cita por su ID (`statusEventId = 7`).
- **Validaciones:** Confirmar con el paciente antes de cancelar.

**Args:**

| Nombre | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `id_cita` | `integer` | ✅ | ID de la cita (`eventId`). |

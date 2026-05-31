# Solicitud de Endpoints para Integración con Sistema de Agendas

Este documento describe las **capacidades mínimas** que necesitamos exponer vía API en su sistema de agendas para poder integrarlo con nuestro agente de IA conversacional. El agente conversa con los pacientes/clientes finales por canales como WhatsApp y necesita poder consultar y operar sobre la agenda en tiempo real.

El objetivo de este documento es que ustedes diseñen la forma final de su API (verbos, rutas, payloads, formato de identificadores). Aquí solo enumeramos **qué información necesitamos** y **qué operaciones debemos poder realizar**, sin prescribir cómo se implementen.

---

## 1. Contexto de la Integración

- El agente atiende conversaciones en tiempo real y necesita respuestas **rápidas** (< 3s idealmente).
- Cada cliente suyo será un "tenant" dentro de nuestro sistema. Necesitamos **autenticación por cliente** (API Key, OAuth, JWT o similar) que aísle los datos de cada cuenta.
- El agente nunca actúa sin verificar primero el estado del paciente y la disponibilidad real. Por eso necesitamos endpoints de **lectura** además de los de escritura.
- Todas las operaciones deben ser **idempotentes** o devolver un identificador único que permita reintentar sin duplicar.

---

## 2. Capacidades Requeridas

Agrupadas por dominio. Cada capacidad puede traducirse en uno o varios endpoints según su modelo de datos.

### 2.1 Estructura de la Clínica / Negocio

Necesitamos descubrir cómo está organizado el negocio del cliente para que el agente sepa qué ofrecer.

- **Listar sucursales / sedes / locales** activos del cliente.
- **Listar profesionales / prestadores** activos, con su nombre visible y especialidad o servicio principal.
- **Listar servicios / tratamientos / motivos de cita** disponibles, idealmente con su duración por defecto.
- **Listar especialidades / categorías de servicio** disponibles.
- **Relación profesional ↔ sucursal**: saber en qué sucursales atiende cada profesional.
- **Relación profesional ↔ servicio**: saber qué servicios realiza cada profesional (o qué profesionales realizan un servicio).
- **Filtrar profesionales por especialidad y/o sucursal**.

> Si su sistema usa terminología propia (ej: "salas", "boxes", "asesores"), conserve sus términos en la API; nosotros mapeamos en nuestra capa.

### 2.2 Disponibilidad

El núcleo de la integración. El agente consulta esto muchas veces durante una conversación.

- **Consultar horarios disponibles** dados:
  - Un profesional (o lista de profesionales)
  - Una sucursal
  - Un servicio o duración de cita
  - Un rango de fechas (mínimo: fecha de inicio; ideal: rango)
- Respuesta esperada: bloques de tiempo libres con fecha + hora de inicio + duración.
- Si su sistema soporta **sobrecupos** / cupos extra / lista de espera, exponer endpoint separado o flag para incluirlos.
- Si manejan **modalidades** (presencial, videollamada, domicilio), permitir filtrar o indicar la modalidad.

### 2.3 Pacientes / Clientes

- **Buscar paciente por identificador oficial** (DNI, RUT, CURP, CPF, pasaporte, etc. — el que use su sistema).
- **Buscar paciente por datos secundarios**: nombre, teléfono o correo (búsqueda parcial / fuzzy es deseable).
- **Crear paciente** con datos mínimos: nombre, apellido, teléfono. Idealmente también: identificador oficial, email, fecha de nacimiento.
- **Actualizar paciente** existente: nombre, apellido, teléfono, email. Útil cuando el paciente corrige datos por chat.
- **Obtener ficha resumen** de un paciente: sus próximas citas activas, últimas N citas pasadas, y opcionalmente tratamientos/historial relevante. Esto se usa al inicio de cada conversación para que el agente entienda con quién habla.

### 2.4 Citas / Reservas

- **Agendar una cita** dados: paciente, profesional, sucursal, servicio, fecha, hora, duración (opcional si el servicio define la duración). Debe devolver un **ID único** de la cita.
- **Agendar una cita en modalidades alternativas**: videollamada, sobrecupo, domicilio, etc. — si su sistema las soporta.
- **Cancelar una cita** por su ID.
- **Confirmar una cita** (cambiar a estado "confirmada") por su ID. Si su sistema maneja estados configurables, exponer cómo hacer esta transición.
- **Reagendar una cita** (cambiar fecha/hora/profesional) por su ID — opcional pero muy útil.
- **Listar citas futuras de un paciente** ordenadas por fecha. Filtrable por estado (activas vs canceladas).
- **Consultar el estado actual de una cita** por su ID.
- **Notificar / sincronizar citas creadas fuera del agente** — ver sección 4.

### 2.5 Comentarios y Metadatos por Cita

- Permitir adjuntar un **comentario libre** al crear una cita (el agente registra ahí el contexto de la conversación, ej: "Agendado por IA - paciente refiere dolor en muela superior derecha").
- Idealmente, permitir un **campo de origen / canal** para identificar qué citas fueron creadas por el agente (ej: `origen=ia_whatsapp`).

---

## 3. Requisitos Transversales de la API

- **Autenticación por cliente/tenant**: API Key en header, OAuth 2.0, JWT — cualquier mecanismo estándar. Documentar cómo rotar credenciales.
- **Identificadores estables**: todos los recursos (paciente, cita, profesional, sucursal, servicio) deben tener un **ID único e inmutable**. Da igual si es entero, UUID o string; lo importante es que no cambie.
- **Formato JSON** en request y response.
- **Fechas y horas** en formato ISO 8601 (`YYYY-MM-DD` para fechas, `HH:MM` o `HH:MM:SS` para horas). Indicar si las horas son en zona local de la sucursal o en UTC.
- **Zona horaria**: documentar explícitamente. Si las sucursales pueden estar en zonas distintas, devolver la zona horaria de cada sucursal en el listado.
- **Errores estructurados**: códigos HTTP estándar (400, 401, 403, 404, 409, 422, 500) + cuerpo JSON con `code` y `message` legible. Casos críticos a distinguir: paciente no encontrado, horario ya ocupado (conflicto), profesional inactivo, sucursal cerrada en esa fecha.
- **Rate limits**: documentar el límite. Si existe, devolver headers `X-RateLimit-*` o equivalentes.
- **Paginación**: en listados largos (citas históricas, pacientes), usar paginación consistente — preferible cursor-based o `page` + `per_page` con `total`.
- **Versionado de API**: idealmente `/v1/...` en la URL o header `Accept-Version`, para que cambios futuros no nos rompan.

---

## 4. Webhooks / Notificaciones (Altamente Deseable)

Para evitar polling y mantener nuestro lado sincronizado, exponer webhooks salientes desde su sistema hacia una URL que nosotros configuremos:

- `appointment.created` — cita creada (incluyendo las creadas en su panel manualmente, no por nuestra API)
- `appointment.updated` — cambio de fecha, hora, profesional o estado
- `appointment.cancelled` — cita cancelada
- `appointment.confirmed` — cita confirmada
- `patient.created` / `patient.updated` — alta o cambio de datos del paciente

Cada webhook debe incluir:
- Tipo de evento
- Timestamp del evento
- ID del recurso afectado
- Identificación del tenant/cliente
- Firma HMAC (o equivalente) para verificar autenticidad

Si no es factible exponer webhooks, como alternativa: un endpoint `GET /changes?since=<timestamp>` que devuelva los cambios desde una fecha dada.

---

## 5. Endpoints "Nice to Have"

No son bloqueantes pero suman valor:

- **Historial / log de cambios** de una cita (auditoría).
- **Bloqueos de agenda** (vacaciones, feriados, bloques manuales del profesional) — al menos consultables, idealmente editables.
- **Búsqueda combinada** "primer hueco disponible para servicio X en sucursal Y" devolviendo directamente el siguiente slot libre.

---

## 6. Checklist Resumen

Para revisar de un vistazo qué necesitamos cubrir:

- [ ] Autenticación por tenant
- [ ] Listar sucursales
- [ ] Listar profesionales (con especialidad y sucursales donde atiende)
- [ ] Listar servicios/tratamientos
- [ ] Listar especialidades
- [ ] Buscar profesionales por especialidad y/o sucursal
- [ ] Consultar disponibilidad
- [ ] Consultar disponibilidad de sobrecupos (si aplica)
- [ ] Buscar paciente por identificador oficial
- [ ] Buscar paciente por nombre/teléfono/email
- [ ] Crear paciente
- [ ] Actualizar paciente
- [ ] Ficha resumen del paciente (próximas + últimas citas)
- [ ] Crear cita
- [ ] Crear cita en modalidades especiales (videollamada, sobrecupo, etc.)
- [ ] Cancelar cita
- [ ] Confirmar cita
- [ ] Reagendar cita (deseable)
- [ ] Listar citas futuras del paciente
- [ ] Estado de una cita por ID
- [ ] Webhooks de eventos (deseable, alternativa: endpoint de cambios)
- [ ] Documentación pública (OpenAPI / Swagger ideal)

---

## 7. Preguntas para Validar con Ustedes

Antes de cerrar el diseño, sería útil que respondan:

1. ¿Su sistema maneja **múltiples sucursales** por cliente o uno por uno?
2. ¿Soportan **sobrecupos** / cupos extra / lista de espera?
3. ¿Soportan modalidades **no presenciales** (videollamada, domicilio)?
4. ¿Las citas tienen **estados configurables por cliente**, o un set fijo?
5. ¿Qué identificador oficial usan para pacientes en su sistema? ¿Es obligatorio o puede crearse un paciente sin él?
6. ¿Pueden exponer **webhooks salientes** o solo API pull?
7. ¿Tienen un **sandbox / ambiente de pruebas** que podamos usar para integrar?
8. ¿La API estará bajo un dominio único o por tenant (`cliente.suapp.com/api`)?

---

Cualquier ajuste sobre el alcance o priorización lo conversamos. La meta es llegar a un contrato de API que les sirva a ustedes como producto base y a nosotros como punto de integración estable.

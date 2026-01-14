# Guía de Confirmaciones de Citas

## Descripción

Este módulo permite configurar hasta 3 confirmaciones automáticas de citas que se sincronizan desde Dentalink hacia GoHighLevel (GHL). El sistema obtiene las citas de Dentalink, las almacena en una base de datos local y luego las sincroniza con GHL en el horario configurado.

## Características

- ✅ Configurar hasta 3 confirmaciones automáticas por cliente
- ✅ Definir cuántos días antes de la cita enviar la confirmación
- ✅ Configurar la hora específica de envío (recomendado: primera hora de la mañana)
- ✅ Búsqueda inteligente de contactos en GHL (por email o teléfono)
- ✅ Creación automática de contactos si no existen
- ✅ Actualización de custom fields con información de la cita
- ✅ Creación de citas en calendario específico de GHL
- ✅ Sistema de reintentos automáticos (hasta 3 intentos)
- ✅ Cron job que se ejecuta cada hora para procesar confirmaciones pendientes

## Flujo de Trabajo

### 1. Configuración

Accede a la página de confirmaciones desde el detalle del cliente:
- Navega a **Clientes** → **[Tu Cliente]** → **Confirmaciones de Citas**

### 2. Crear una Configuración

Puedes crear hasta 3 configuraciones diferentes. Cada configuración incluye:

- **Nombre**: Identificador descriptivo (ej: "Confirmación 24h antes")
- **Días antes de la cita**: Cuántos días antes enviar la confirmación (0 = el mismo día)
- **Hora de envío**: Hora específica en formato 24h (ej: 09:00)
- **GHL Calendar ID**: ID del calendario de GoHighLevel donde se creará la cita
- **Estado**: Habilitar o deshabilitar la configuración

**Ejemplo de configuraciones:**
```
1. "Confirmación 2 días antes" - 2 días antes a las 09:00
2. "Confirmación 1 día antes" - 1 día antes a las 09:00
3. "Confirmación mismo día" - 0 días antes a las 08:00
```

### 3. Proceso Automático

El sistema ejecuta automáticamente estos pasos:

#### 3.1 Obtención de Citas (Cron Job cada hora)
- El sistema verifica si hay configuraciones habilitadas
- Calcula qué citas de Dentalink debe obtener según cada configuración
- Filtra solo citas en estado "Confirmado" (id_estado = 7)
- Obtiene información adicional del paciente (email, teléfono)
- Almacena las citas en la tabla `pending_confirmations`

#### 3.2 Sincronización con GHL (Cuando llega la hora programada)
Para cada cita pendiente:

1. **Buscar Contacto en GHL**:
   - Busca primero por email
   - Si no encuentra, busca por teléfono
   - Si no encuentra, crea un nuevo contacto

2. **Actualizar Custom Fields**:
   - `id_cita`: ID del paciente en Dentalink
   - `hora_inicio`: Hora de inicio de la cita
   - `fecha`: Fecha de la cita
   - `nombre_dentista`: Nombre del dentista
   - `id_sucursal`: ID de la sucursal
   - `nombre_sucursal`: Nombre de la sucursal
   - `for_confirmation`: Marcado como "true" para identificar contactos pendientes de confirmación

### 4. Ejecución Manual

Puedes ejecutar manualmente el proceso desde la UI:

- **Ejecutar Todas**: Obtiene y almacena citas para todas las configuraciones habilitadas
- **Ejecutar por Configuración**: Click en el ícono de reloj (🕐) en una configuración específica

### 5. Monitoreo

La interfaz muestra:

- **Configuraciones activas**: Lista de configuraciones con su estado
- **Citas pendientes**: Tabla con todas las citas en cola para sincronizar
- **Estados posibles**:
  - `pending`: Esperando a ser procesada
  - `processing`: Se está procesando actualmente
  - `completed`: Sincronizada exitosamente con GHL
  - `failed`: Falló después de 3 intentos

## Arquitectura Técnica

### Backend

#### Entidades

1. **ConfirmationConfig**: Almacena las configuraciones de confirmación
   - Relación: ManyToOne con Client
   - Campos clave: daysBeforeAppointment, timeToSend, ghlCalendarId

2. **PendingConfirmation**: Almacena citas pendientes de sincronizar
   - Relación: ManyToOne con Client y ConfirmationConfig
   - Incluye toda la información de la cita de Dentalink
   - Tracking de estado y reintentos

#### Servicios

**AppointmentConfirmationsService**:
- `createConfig()`: Crea una nueva configuración
- `getConfigs()`: Obtiene todas las configuraciones de un cliente
- `updateConfig()`: Actualiza una configuración
- `deleteConfig()`: Elimina una configuración
- `fetchAndStoreAppointments()`: Obtiene citas de Dentalink y las almacena
- `checkPendingConfirmations()`: Cron job que procesa confirmaciones pendientes (cada hora)
- `processConfirmation()`: Procesa una confirmación individual
- `findOrCreateContact()`: Busca o crea un contacto en GHL
- `updateContactCustomFields()`: Actualiza 7 custom fields del contacto (incluye `for_confirmation: true`)
- `processPendingConfirmationsNow()`: Procesa inmediatamente confirmaciones pendientes (para testing)

#### Endpoints API

```
Base: /clients/:clientId/appointment-confirmations

GET    /configs                    - Obtener todas las configuraciones
POST   /configs                    - Crear nueva configuración
GET    /configs/:configId          - Obtener configuración específica
PUT    /configs/:configId          - Actualizar configuración
DELETE /configs/:configId          - Eliminar configuración

POST   /trigger                    - Ejecutar manualmente (obtener y almacenar citas)
GET    /pending                    - Obtener todas las citas pendientes
GET    /pending/status/:status     - Filtrar por estado
```

### Frontend

**Página**: `/clients/[id]/confirmations`

Componentes principales:
- Formulario de crear/editar configuración
- Lista de configuraciones con acciones (editar, eliminar, ejecutar)
- Tabla de citas pendientes con estados

## Requisitos Previos

1. Cliente debe tener configurado:
   - API Key de Dentalink
   - GHL habilitado (`ghlEnabled: true`)
   - GHL Access Token (`ghlAccessToken`)
   - GHL Location ID (`ghlLocationId`)

2. En GHL deben existir los custom fields:
   - `id_cita`
   - `hora_inicio`
   - `fecha`
   - `nombre_dentista`
   - `id_sucursal`
   - `nombre_sucursal`
   - `for_confirmation`

3. ⚠️ **Nota**: El sistema NO crea citas en el calendario de GHL, solo actualiza el contacto con los custom fields. El Calendar ID se mantiene en la configuración pero no se usa actualmente.

## Instalación

### 1. Instalar Dependencias

```bash
cd backend
npm install
```

El paquete `@nestjs/schedule` ya está incluido en el package.json.

### 2. Ejecutar Migraciones

Las entidades se crearán automáticamente al iniciar el backend (TypeORM synchronize: true).

### 3. Iniciar Servicios

```bash
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

## Ejemplos de Uso

### Ejemplo 1: Confirmación 1 día antes a las 9 AM

```json
{
  "name": "Confirmación 24h antes",
  "daysBeforeAppointment": 1,
  "timeToSend": "09:00",
  "ghlCalendarId": "YOUR_CALENDAR_ID",
  "isEnabled": true,
  "order": 1
}
```

**Comportamiento**: Si hoy es 15 de enero a las 10:00, el sistema obtendrá todas las citas del 16 de enero y las programará para sincronizar mañana (16 de enero) a las 9:00 AM.

### Ejemplo 2: Confirmación mismo día temprano

```json
{
  "name": "Confirmación día de cita",
  "daysBeforeAppointment": 0,
  "timeToSend": "08:00",
  "ghlCalendarId": "YOUR_CALENDAR_ID",
  "isEnabled": true,
  "order": 2
}
```

**Comportamiento**: Obtiene las citas del día actual y las programa para sincronizar a las 8:00 AM del mismo día.

## Troubleshooting

### Las confirmaciones no se procesan

1. Verifica que el cron job está activo (se ejecuta cada hora)
2. Revisa los logs del backend para errores
3. Verifica que las configuraciones están habilitadas (`isEnabled: true`)
4. Confirma que el cliente tiene GHL configurado correctamente

### Las confirmaciones fallan al sincronizar

1. Verifica que el GHL Access Token es válido
2. Revisa que los 7 custom fields existen en GHL (incluido `for_confirmation`)
3. Chequea el campo `errorMessage` en la tabla de citas pendientes
4. Verifica que los contactos tengan email o teléfono en Dentalink

### No se encuentran contactos

El sistema intenta:
1. Buscar por email
2. Si no encuentra, buscar por teléfono
3. Si no encuentra, crear nuevo contacto

Asegúrate de que las citas de Dentalink incluyan email o teléfono del paciente.

## Notas Importantes

- **Recomendación de horarios**: Lo ideal es programar las confirmaciones a primera hora de la mañana (7:00 - 9:00 AM) para maximizar la tasa de respuesta.

- **Límite de configuraciones**: Máximo 3 configuraciones por cliente para evitar sobrecarga.

- **Reintentos**: El sistema reintenta hasta 3 veces si una confirmación falla. Después de 3 intentos, marca la confirmación como `failed`.

- **Cron job**: Se ejecuta cada hora. Si necesitas mayor frecuencia, modifica el decorador `@Cron()` en `AppointmentConfirmationsService`.

- **Zona horaria**: Todos los cálculos de fecha/hora respetan el timezone configurado en el cliente.

## API Endpoints Completos

### Crear Configuración

```bash
POST /clients/:clientId/appointment-confirmations/configs
Content-Type: application/json

{
  "name": "Confirmación 24h antes",
  "daysBeforeAppointment": 1,
  "timeToSend": "09:00",
  "ghlCalendarId": "calendar_123456",
  "isEnabled": true,
  "order": 1
}
```

### Ejecutar Manualmente

```bash
POST /clients/:clientId/appointment-confirmations/trigger
Content-Type: application/json

{
  "confirmationConfigId": "config-uuid",  // Opcional
  "targetDate": "2026-01-15"              // Opcional (para testing)
}
```

### Obtener Pendientes

```bash
GET /clients/:clientId/appointment-confirmations/pending
```

## Soporte

Para problemas o preguntas:
1. Revisa los logs del backend
2. Verifica la tabla `pending_confirmations` para ver estados y errores
3. Consulta la documentación de APIs de Dentalink y GHL

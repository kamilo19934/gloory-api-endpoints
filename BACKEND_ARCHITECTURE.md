# Backend Architecture Documentation

## Resumen General

El backend de **Gloory API Endpoints** es una API REST construida con **NestJS** que actúa como un middleware entre clínicas/consultorios médicos y sus sistemas de gestión (Dentalink, MediLink) con GoHighLevel (GHL) para automatización de confirmaciones de citas.

### Stack Tecnológico

- **Framework**: NestJS 10.x
- **Base de Datos**: PostgreSQL (producción) / SQLite (desarrollo)
- **ORM**: TypeORM 0.3.x
- **Autenticación**: JWT con Passport.js
- **HTTP Client**: Axios
- **Scheduling**: @nestjs/schedule (Cron jobs)
- **Manejo de Fechas**: Moment.js + Moment-Timezone

---

## Estructura de Módulos

```
src/
├── app.module.ts              # Módulo raíz
├── main.ts                    # Punto de entrada
├── auth/                      # Autenticación JWT
├── users/                     # Gestión de usuarios admin
├── clients/                   # Gestión de clientes (clínicas)
├── dentalink/                 # Operaciones principales con APIs médicas
├── integrations/              # Registry de integraciones disponibles
│   ├── common/               # Interfaces y tipos compartidos
│   └── healthatom/           # Servicio unificado Dentalink+MediLink
├── clinic/                    # Cache local de sucursales y profesionales
├── appointment-confirmations/ # Sistema de confirmación automática
├── endpoints/                 # Documentación de endpoints disponibles
└── utils/                     # Utilidades (RUT, fechas, timezone)
```

---

## Módulos en Detalle

### 1. Auth Module (`/src/auth/`)

**Propósito**: Autenticación y autorización de usuarios administradores.

**Componentes**:
- `auth.controller.ts`: Endpoints de login, profile, verify
- `auth.service.ts`: Lógica de autenticación
- `guards/jwt-auth.guard.ts`: Guard global de autenticación
- `decorators/public.decorator.ts`: Marca rutas como públicas
- `decorators/current-user.decorator.ts`: Obtiene usuario actual

**Endpoints**:
| Método | Ruta | Público | Descripción |
|--------|------|---------|-------------|
| POST | `/api/auth/login` | ✅ | Autenticación de usuarios |
| POST | `/api/auth/setup` | ✅ | Crear primer admin (solo si no hay usuarios) |
| GET | `/api/auth/profile` | ❌ | Obtener perfil del usuario actual |
| GET | `/api/auth/verify` | ❌ | Verificar validez del token |

**Flujo de Autenticación**:
1. Guard global `JwtAuthGuard` protege todas las rutas
2. Rutas marcadas con `@Public()` omiten autenticación
3. Token JWT se valida usando `passport-jwt`
4. Contraseñas hasheadas con bcrypt (10 rounds)

---

### 2. Users Module (`/src/users/`)

**Propósito**: CRUD de usuarios administradores del sistema.

**Entidad User**:
```typescript
{
  id: UUID,
  email: string (unique),
  password: string (hashed),
  firstName: string,
  lastName: string,
  isActive: boolean (default: true),
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Características**:
- Contraseñas hasheadas con bcrypt
- Verificación de email único
- Tracking de último login

---

### 3. Clients Module (`/src/clients/`)

**Propósito**: Gestión de clientes (clínicas/consultorios) y sus integraciones.

**Entidades**:

#### Client
```typescript
{
  id: UUID,
  name: string,
  description: string,
  isActive: boolean,
  timezone: string (default: 'America/Santiago'),
  
  // Integrations (relación OneToMany)
  integrations: ClientIntegration[],
  
  // Legacy fields (migración gradual)
  apiKey: string,          // Dentalink API key
  ghlEnabled: boolean,
  ghlAccessToken: string,
  ghlCalendarId: string,
  ghlLocationId: string,
  
  // Estados de confirmación
  confirmationStateId: number,  // ID del estado "Confirmado por Bookys"
  contactedStateId: number,     // ID del estado "Contactado por Bookys"
  
  createdAt: Date,
  updatedAt: Date
}
```

#### ClientIntegration
```typescript
{
  id: UUID,
  clientId: UUID,
  integrationType: IntegrationType, // 'dentalink' | 'medilink' | 'dentalink_medilink' | 'reservo'
  isEnabled: boolean,
  config: JSON,  // Configuración específica de cada integración
  lastSyncAt: Date,
  lastSyncStatus: string
}
```

**Endpoints**:
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clients` | Listar todos los clientes |
| GET | `/api/clients/:id` | Obtener cliente por ID |
| POST | `/api/clients` | Crear nuevo cliente |
| PATCH | `/api/clients/:id` | Actualizar cliente |
| DELETE | `/api/clients/:id` | Eliminar cliente |
| POST | `/api/clients/:id/integrations` | Agregar integración |
| PATCH | `/api/clients/:id/integrations/:type` | Actualizar integración |
| DELETE | `/api/clients/:id/integrations/:type` | Eliminar integración |

---

### 4. Dentalink Module (`/src/dentalink/`)

**Propósito**: Operaciones principales de interacción con las APIs de Dentalink y MediLink.

**Servicios**:
- `dentalink.service.ts`: Lógica de negocio principal
- `ghl.service.ts`: Integración con GoHighLevel

**Endpoints** (todos públicos, prefijo `/api/clients/:clientId`):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/endpoints` | Listar endpoints disponibles para el cliente |
| POST | `/availability` | Buscar disponibilidad de profesionales |
| POST | `/patients/search` | Buscar paciente por RUT |
| POST | `/patients` | Crear nuevo paciente |
| POST | `/patients/treatments` | Obtener tratamientos de un paciente |
| POST | `/appointments` | Agendar nueva cita |
| POST | `/appointments/confirm` | Confirmar cita |
| POST | `/appointments/cancel` | Cancelar cita |
| POST | `/appointments/future` | Obtener citas futuras de un paciente |
| POST | `/test-connection` | Probar conexión con Dentalink |

#### Lógica de Selección de API

El sistema detecta automáticamente qué API usar según la integración configurada:

```typescript
// Detección de tipo de integración
const dentalinkIntegration = client.getIntegration('dentalink');
const medilinkIntegration = client.getIntegration('medilink');
const dualIntegration = client.getIntegration('dentalink_medilink');

// URLs base
const DENTALINK_URL = 'https://api.dentalink.healthatom.com/api/v1/';
const MEDILINK_URL = 'https://api.medilink2.healthatom.com/api/v5/';
const MEDILINK_V6_URL = 'https://api.medilink2.healthatom.com/api/v6/'; // Para profesionales
```

**Modo Dual**: Intenta primero Dentalink, si falla (404 o 412), intenta MediLink.

#### Diferencias entre APIs

| Característica | Dentalink | MediLink |
|----------------|-----------|----------|
| Profesionales | `dentistas` | `profesionales` |
| Campo profesional | `id_dentista` | `id_profesional` |
| Comentarios | `comentarios` | `comentario` |
| Videoconsulta | N/A | `videoconsulta: 0` |
| Disponibilidad | GET con body | GET con query params |

#### Integración con GoHighLevel (GHL)

Cuando se agenda una cita y `ghlEnabled = true`:

1. Obtiene nombres del profesional y sucursal
2. Actualiza custom fields del contacto en GHL
3. Obtiene `assignedUserId` del calendario
4. Crea appointment en GHL

**Custom Fields actualizados**:
- `doctor`: Nombre del profesional
- `clinica`: Nombre de la sucursal
- `comentario`: Comentario de la cita (opcional)

---

### 5. Integrations Module (`/src/integrations/`)

**Propósito**: Registry central de integraciones disponibles y sus metadatos.

**IntegrationType** (enum):
```typescript
enum IntegrationType {
  DENTALINK = 'dentalink',
  MEDILINK = 'medilink',
  DENTALINK_MEDILINK = 'dentalink_medilink',
  RESERVO = 'reservo'
}
```

**IntegrationCapability** (enum):
```typescript
enum IntegrationCapability {
  AVAILABILITY = 'availability',
  PATIENTS = 'patients',
  APPOINTMENTS = 'appointments',
  CLINIC_CONFIG = 'clinic_config',
  TREATMENTS = 'treatments'
}
```

**Metadatos de cada integración**:
```typescript
{
  type: IntegrationType,
  name: string,
  description: string,
  logo: string,
  capabilities: IntegrationCapability[],
  requiredFields: FieldDefinition[],
  optionalFields: FieldDefinition[]
}
```

#### HealthAtom Service (`/src/integrations/healthatom/`)

Servicio unificado que abstrae las diferencias entre Dentalink y MediLink.

**Métodos principales**:
- `getProfessionals(config)`: Obtener profesionales de ambas APIs
- `getProfessionalById(id, config)`: Buscar profesional específico
- `getBranches(config)`: Obtener sucursales de ambas APIs
- `searchPatientByRut(rut, config)`: Buscar paciente por RUT
- `createPatient(data, config)`: Crear paciente
- `searchAvailability(params, config)`: Buscar disponibilidad
- `scheduleAppointment(params, config)`: Agendar cita
- `confirmAppointment(id, stateId, config)`: Confirmar cita
- `cancelAppointment(id, config)`: Cancelar cita
- `getFutureAppointments(rut, config)`: Obtener citas futuras

---

### 6. Clinic Module (`/src/clinic/`)

**Propósito**: Cache local de sucursales y profesionales sincronizados desde Dentalink.

**Entidades**:

#### Branch (Sucursal)
```typescript
{
  id: UUID,
  clientId: UUID,
  dentalinkId: number (unique por cliente),
  nombre: string,
  telefono: string,
  ciudad: string,
  comuna: string,
  direccion: string,
  habilitada: boolean,  // Desde Dentalink
  activa: boolean       // Toggle local (default: true)
}
```

#### Professional (Profesional)
```typescript
{
  id: UUID,
  clientId: UUID,
  dentalinkId: number (unique por cliente),
  rut: string,
  nombre: string,
  apellidos: string,
  celular: string,
  telefono: string,
  email: string,
  ciudad: string,
  comuna: string,
  direccion: string,
  idEspecialidad: number,
  especialidad: string,
  agendaOnline: boolean,
  intervalo: number,      // Minutos por bloque
  habilitado: boolean,    // Desde Dentalink
  activo: boolean,        // Toggle local (default: true)
  contratosSucursal: number[],  // IDs de sucursales con contrato
  horariosSucursal: number[]    // IDs de sucursales con horario
}
```

**Endpoints** (prefijo `/api/clients/:clientId/clinic`):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/branches` | Listar sucursales |
| GET | `/branches/all` | Listar todas (para admin) |
| GET | `/professionals` | Listar profesionales |
| GET | `/professionals/all` | Listar todos (para admin) |
| GET | `/specialties` | Listar especialidades únicas |
| POST | `/sync` | Sincronizar desde Dentalink |
| PATCH | `/branches/:dentalinkId/toggle` | Activar/desactivar sucursal |
| PATCH | `/professionals/:dentalinkId/toggle` | Activar/desactivar profesional |
| PATCH | `/professionals/:dentalinkId/specialty` | Actualizar especialidad |

**Sincronización**:
- Soporta paginación automática (máx 50 páginas)
- Bulk insert en batches de 100
- Solo agrega nuevos registros (no modifica existentes)
- Modo forzado: `?force=true` borra y resincroniza todo

---

### 7. Appointment Confirmations Module (`/src/appointment-confirmations/`)

**Propósito**: Sistema automatizado de confirmación de citas vía GoHighLevel.

**Entidades**:

#### ConfirmationConfig
```typescript
{
  id: UUID,
  clientId: UUID,
  name: string,                    // Ej: "Confirmación día anterior"
  daysBeforeAppointment: number,   // 1 = confirmar día anterior
  timeToSend: string,              // "09:00" - Hora de envío
  ghlCalendarId: string,
  appointmentStates: string,       // "7,8" - Estados a buscar (CSV)
  isEnabled: boolean,
  order: number                    // 1-3 (máximo 3 configs por cliente)
}
```

#### PendingConfirmation
```typescript
{
  id: UUID,
  clientId: UUID,
  confirmationConfigId: UUID,
  dentalinkAppointmentId: number,
  appointmentData: JSON,           // Datos completos de la cita
  scheduledFor: Date,              // Cuándo procesar
  status: ConfirmationStatus,      // pending, processing, completed, failed
  ghlContactId: string,            // ID del contacto en GHL
  attempts: number,                // Intentos realizados
  processedAt: Date,
  errorMessage: string
}
```

**ConfirmationStatus** (enum):
```typescript
enum ConfirmationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
```

**Endpoints** (prefijo `/api/clients/:clientId/confirmations`):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/configs` | Listar configuraciones |
| POST | `/configs` | Crear configuración |
| PATCH | `/configs/:id` | Actualizar configuración |
| DELETE | `/configs/:id` | Eliminar configuración |
| POST | `/fetch` | Obtener citas y almacenar pendientes |
| POST | `/process` | Procesar confirmaciones ahora |
| POST | `/process-selected` | Procesar confirmaciones seleccionadas |
| GET | `/pending` | Listar confirmaciones pendientes |
| GET | `/appointment-states` | Obtener estados de cita disponibles |
| POST | `/create-bookys-state` | Crear estados "Confirmado/Contactado por Bookys" |

**Cron Jobs**:

1. **Cada 30 minutos** (`autoFetchAndConfirmAppointments`):
   - Obtiene configuraciones activas
   - Verifica si es hora de ejecutar (según `timeToSend`)
   - Obtiene citas de Dentalink
   - Procesa confirmaciones inmediatamente

2. **Cada hora** (`checkPendingConfirmations`):
   - Backup/fallback para confirmaciones no procesadas
   - Procesa hasta 10 confirmaciones pendientes

**Flujo de Confirmación**:

```
1. Obtener citas de Dentalink (para fecha = hoy + daysBeforeAppointment)
   ↓
2. Crear registros PendingConfirmation
   ↓
3. Para cada confirmación:
   a. Buscar contacto en GHL (por email o teléfono)
   b. Si no existe, crear contacto nuevo
   c. Actualizar custom fields del contacto:
      - id_cita
      - hora_inicio
      - fecha
      - nombre_dentista
      - nombre_paciente
      - id_paciente
      - id_sucursal
      - nombre_sucursal
      - rut
      - for_confirmation: "true"
   d. (Opcional) Actualizar estado de cita a "Contactado por Bookys"
```

**Rate Limiting**:
- Delay de 600ms entre cada confirmación
- Retry con backoff exponencial para error 429 (2s, 4s, 8s)
- Máximo 3 intentos por confirmación
- Delay aleatorio 20-30 segundos antes de procesar (evitar bursts)

---

### 8. Endpoints Module (`/src/endpoints/`)

**Propósito**: Documentación y metadata de endpoints disponibles.

**EndpointDefinition**:
```typescript
{
  id: string,
  name: string,
  description: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  category: string,
  parameters?: ParameterDefinition[],
  responseExample?: any
}
```

---

### 9. Utils (`/src/utils/`)

#### `rut.util.ts`
- `formatearRut(rut)`: Formatea RUT chileno (ej: "12345678-9")

#### `date.util.ts`
- `formatearFechaEspanol(fecha)`: Convierte "2024-01-15" a "Lunes 15 de enero"
- `normalizarHora(hora)`: Convierte "09:00:00" a "09:00"

#### `timezone.util.ts`
- `obtenerHoraActual(timezone)`: Obtiene hora actual en timezone específico
- `filtrarHorariosFuturos(horarios, fecha, horaActual)`: Filtra horarios pasados
- `validarBloquesConsecutivos(horarios, tiempoCita, intervalo)`: Valida disponibilidad para citas largas
- `formatearFechaHoraGHL(fecha, hora, timezone)`: Formatea para GHL

---

## Configuración de Base de Datos

### Variables de Entorno

```bash
# Tipo de BD (postgres o sqlite)
DATABASE_TYPE=postgres

# PostgreSQL (producción)
DATABASE_URL=postgres://user:password@host:5432/database
# O configuración manual:
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=user
DATABASE_PASSWORD=password
DATABASE_NAME=gloory

# SSL para PostgreSQL en producción
DATABASE_SSL=true

# Sincronización de esquema
DB_SYNC=true  # Solo primera vez en producción

# SQLite (desarrollo)
DATABASE_PATH=./database.sqlite
```

### Conexión Dinámica

El `app.module.ts` detecta automáticamente el tipo de BD:

```typescript
const databaseType = configService.get('DATABASE_TYPE', 'postgres');

if (databaseType === 'postgres') {
  // Usa DATABASE_URL o configuración manual
  // SSL si DATABASE_SSL=true
} else {
  // SQLite para desarrollo local
}
```

---

## Autenticación y Seguridad

### JWT Configuration

```typescript
// auth.module.ts
JwtModule.registerAsync({
  useFactory: (configService) => ({
    secret: configService.get('JWT_SECRET'),
    signOptions: { expiresIn: '24h' },
  }),
})
```

### Guard Global

Todas las rutas están protegidas por `JwtAuthGuard` excepto las marcadas con `@Public()`.

```typescript
// app.module.ts
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,
}
```

### Rutas Públicas

Controladores marcados con `@Public()`:
- `DentalinkController`: Todos los endpoints de operaciones con clínicas
- `AuthController`: Login y setup inicial

---

## CORS y API

```typescript
// main.ts
app.enableCors({
  origin: true,  // Permite todos los orígenes
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
});

app.setGlobalPrefix('api');
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

---

## Variables de Entorno Requeridas

```bash
# Servidor
PORT=3001
NODE_ENV=development|production

# JWT
JWT_SECRET=your-secret-key

# Base de datos
DATABASE_TYPE=postgres|sqlite
DATABASE_URL=postgres://...
DATABASE_SSL=true|false

# Dentalink (opcional, tiene default)
DENTALINK_BASE_URL=https://api.dentalink.healthatom.com/api/v1/
```

---

## Despliegue

### Railway
- Archivo: `railway.toml`
- Build: `npm run build`
- Start: `npm run start:prod`

### Nixpacks
- Archivo: `nixpacks.toml`
- Provider: Node.js

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (API REST)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │   Auth   │  │  Users   │  │ Clients  │  │   Integrations   │ │
│  │  Module  │  │  Module  │  │  Module  │  │     Registry     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Dentalink Module                       │   │
│  │  ┌────────────────────┐  ┌────────────────────────────┐  │   │
│  │  │  DentalinkService  │  │      GHL Service           │  │   │
│  │  └────────────────────┘  └────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │    Clinic Module     │  │  Appointment Confirmations       │ │
│  │  (Cache Sucursales/  │  │         Module                   │ │
│  │   Profesionales)     │  │  (Cron Jobs + GHL Integration)   │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              HealthAtom Service (Unificado)               │   │
│  │        Abstrae diferencias Dentalink vs MediLink          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
┌─────────────────────────────┐  ┌─────────────────────────────────┐
│     HealthAtom APIs          │  │       GoHighLevel API           │
│  ┌─────────────────────────┐ │  │                                 │
│  │   Dentalink API (v1)    │ │  │  - Contacts                     │
│  │   api.dentalink...      │ │  │  - Calendars                    │
│  └─────────────────────────┘ │  │  - Appointments                 │
│  ┌─────────────────────────┐ │  │                                 │
│  │   MediLink API (v5/v6)  │ │  │  services.leadconnectorhq.com   │
│  │   api.medilink2...      │ │  │                                 │
│  └─────────────────────────┘ │  └─────────────────────────────────┘
└─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────┐
│      PostgreSQL / SQLite     │
│  - users                     │
│  - clients                   │
│  - client_integrations       │
│  - branches                  │
│  - professionals             │
│  - confirmation_configs      │
│  - pending_confirmations     │
└─────────────────────────────┘
```

---

## Flujos de Datos Principales

### 1. Agendar Cita

```
Frontend → POST /api/clients/:id/appointments
         → DentalinkService.scheduleAppointment()
         → Detectar tipo de integración (dentalink/medilink/dual)
         → Obtener intervalo del profesional
         → Crear cita en API correspondiente
         → (Si GHL enabled) GHLService.integrarCita() [background]
         → Respuesta: { id_cita, mensaje }
```

### 2. Buscar Disponibilidad

```
Frontend → POST /api/clients/:id/availability
         → DentalinkService.searchAvailability()
         → Obtener nombres de profesionales
         → Buscar disponibilidad en API(s)
         → Filtrar horarios pasados
         → Validar bloques consecutivos (si tiempo_cita > intervalo)
         → Formatear fechas en español
         → Respuesta: { disponibilidad: [...], fecha_desde, fecha_hasta }
```

### 3. Confirmación Automática de Citas

```
Cron Job (cada 30 min)
  → autoFetchAndConfirmAppointments()
  → Para cada config activa donde es hora de ejecutar:
      → fetchAndStoreAppointments()
          → Calcular fecha objetivo (hoy + daysBeforeAppointment)
          → GET /citas con filtro por fecha y estados
          → Obtener datos de cada paciente
          → Crear PendingConfirmation
      → processAllPendingConfirmationsNow()
          → Para cada pendiente:
              → Buscar/crear contacto en GHL
              → Actualizar custom fields
              → (Opcional) Actualizar estado en Dentalink
              → Marcar como completado
```

---

## Manejo de Errores

### Códigos de Error HTTP

| Código | Significado | Acción |
|--------|-------------|--------|
| 400 | Bad Request | Error de validación o negocio |
| 401 | Unauthorized | Token inválido o expirado |
| 404 | Not Found | Recurso no existe |
| 409 | Conflict | Duplicado (ej: email ya existe) |
| 412 | Precondition Failed | API incompatible (ej: sucursal de MediLink en Dentalink) |
| 429 | Too Many Requests | Rate limit de GHL |
| 503 | Service Unavailable | API externa no disponible |

### Rate Limiting de GHL

```typescript
// Límites: 100 requests / 10 segundos (~10 req/s)
// Estrategia:
// - Delay 600ms entre confirmaciones
// - Retry con backoff exponencial: 2s → 4s → 8s
// - Máximo 3 reintentos
// - Delay aleatorio 20-30s antes de procesar (anti-burst)
```

---

## Consideraciones de Desarrollo

### Agregar Nueva Integración

1. Agregar tipo en `IntegrationType` enum
2. Registrar metadata en `IntegrationRegistryService`
3. Implementar adapter en `HealthAtomService` o crear servicio nuevo
4. Actualizar `DentalinkService.getApisToUse()`

### Testing Local

```bash
cd backend
npm install
npm run start:dev
# API en http://localhost:3001/api
```

### Logs

El sistema usa `Logger` de NestJS con emojis para facilitar debugging:
- 🔍 Búsqueda/consulta
- ✅ Éxito
- ❌ Error
- ⚠️ Warning
- 🔄 Procesando
- 📤 Enviando
- 📋 Datos/lista
- ⏱️ Delay/espera

---

*Última actualización: Enero 2026*

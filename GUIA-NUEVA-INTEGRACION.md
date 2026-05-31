# Guía: Agregar una nueva integración de plataforma

Esta guía documenta **todos los archivos que se tocan** y **el orden** en que conviene hacerlo para agregar una integración nueva (ej. una plataforma X de gestión de pacientes/agenda) al sistema Gloory API Endpoints.

Se asume como ejemplo que vamos a agregar una integración llamada `nuevaplataforma`. Donde aparezca `<NP>` en código, reemplazar por el nombre real (en `PascalCase` para clases, `lowercase` para nombres de carpeta/IntegrationType, `kebab-case` para archivos cuando aplique).

---

## 1. Capas del sistema y qué hace cada una

Antes de tocar nada conviene entender por qué hay tantas piezas, para no duplicarlas mal:

| Capa | Carpeta | Rol |
|------|---------|-----|
| **Registry de integraciones** | [backend/src/integrations/](backend/src/integrations/) | Define qué integraciones existen, sus campos de config y capacidades. Es el "catálogo" que ve el frontend. |
| **Servicio de integración** | [backend/src/integrations/<np>/](backend/src/integrations/) | Cliente HTTP puro hacia la API externa (sin acoplamiento a cliente/DB). Singleton global. |
| **Proxy controller + service** | [backend/src/<np>/](backend/src/) | Expone rutas `/clients/:clientId/<np>/*` al exterior. Lee config del cliente, llama al servicio de integración, **opcionalmente espeja en GHL**. |
| **Endpoint catalog** | [backend/src/endpoints/endpoint-config.ts](backend/src/endpoints/endpoint-config.ts) | Lista los endpoints que ve el cliente final en el UI (la página `/clients/[id]`). |
| **Tool Registry** | [backend/src/tool-registry/](backend/src/tool-registry/) | Schemas de tools consumidos por `gloory-ai-server` (paralelo a endpoint-config, **no es lo mismo**). |
| **Internal provisioning** | [backend/src/internal/](backend/src/internal/) | Endpoints server-to-server llamados por `gloory-ai-server` para crear el cliente y probar credenciales. |
| **Clinic cache** | [backend/src/clinic/](backend/src/clinic/) | Cache local opcional de sucursales/profesionales de la plataforma. |
| **Confirmation system** | [backend/src/<np>-confirmations/](backend/src/) | Módulo independiente que sincroniza citas → GHL vía cron. Solo si la plataforma lo necesita. |
| **Frontend types & UI** | [frontend/src/lib/api.ts](frontend/src/lib/api.ts) y [frontend/src/components/IntegrationSelector.tsx](frontend/src/components/IntegrationSelector.tsx) | Tipos espejados del backend + UI de configuración. |

---

## 2. Checklist completo (en orden)

Cada bullet apunta al archivo real. Marca el checklist a medida que avanzas; los pasos marcados con **(opcional)** dependen de las capacidades de la plataforma.

### A. Backend — núcleo de la integración

- [ ] **Añadir el tipo al enum**: agregar `NUEVA_PLATAFORMA = 'nuevaplataforma'` en [backend/src/integrations/common/interfaces/integration.interface.ts](backend/src/integrations/common/interfaces/integration.interface.ts) (enum `IntegrationType`).
- [ ] **Crear tipos de la integración**: `backend/src/integrations/<np>/<np>.types.ts` con:
  - `<NP>Config` (la forma del JSON que guarda el cliente: tokens, URLs, IDs, flags de GHL)
  - Constantes de URL base / endpoints externos
  - Tipos del payload/response de la API externa
  - `<NP>OperationResult<T>` (estándar `{success, data?, error?}`)
- [ ] **Crear el servicio**: `backend/src/integrations/<np>/<np>.service.ts`. Reglas:
  - Recibe `config: <NP>Config` en cada método (no inyecta `ClientsService`).
  - Usa `axios` directo. Headers en helper privado `createHeaders(config)`.
  - Logger de Nest. Try/catch que retorna `<NP>OperationResult` en vez de throw.
  - Métodos típicos: `searchPatient`, `createPatient`, `getAppointments*`, `createAppointment`, `confirmAppointment`, `cancelAppointment`, `getAvailability`, `getProfessionals`, `getBranches`, `testConnection`.
  - Paginación: bucle con `safety limit = 50 páginas` (ver [backend/src/integrations/reservo/reservo.service.ts:175](backend/src/integrations/reservo/reservo.service.ts#L175)).
- [ ] **Crear el módulo Global**: `backend/src/integrations/<np>/<np>.module.ts` con `@Global()` y exportando el servicio (ver [backend/src/integrations/reservo/reservo.module.ts](backend/src/integrations/reservo/reservo.module.ts)).
- [ ] **Registrar la metadata** en [backend/src/integrations/integration-registry.service.ts](backend/src/integrations/integration-registry.service.ts) dentro de `registerDefaultIntegrations()`:
  - `type`, `name`, `description`, `logo` (`/integrations/<np>.png`)
  - `capabilities` (subset de `AVAILABILITY | PATIENTS | APPOINTMENTS | CLINIC_CONFIG | TREATMENTS`)
  - `requiredFields` + `optionalFields` siguiendo `IntegrationFieldDefinition`
  - **Si soporta sincronización con GHL**, incluir en `optionalFields`: `ghlEnabled`, `ghlAccessToken`, `ghlCalendarId`, `ghlLocationId`, `ghlOAuthMode` (ver Reservo como referencia, [integration-registry.service.ts:219-287](backend/src/integrations/integration-registry.service.ts#L219-L287)).
- [ ] **Importar el módulo en [backend/src/app.module.ts](backend/src/app.module.ts)** (sección "Application modules"). Va junto a `HealthAtomModule`/`ReservoModule`.

### B. Backend — capa de proxy (endpoints expuestos al cliente)

- [ ] **Crear DTOs** en `backend/src/<np>/dto/` (uno por endpoint público). Usar `class-validator` (`@IsString`, `@IsNotEmpty`, `@IsOptional`...). Patrón en [backend/src/reservo/dto/](backend/src/reservo/dto/).
- [ ] **Crear el proxy service**: `backend/src/<np>/<np>-proxy.service.ts`. Inyecta:
  - `ClientsService` → para leer la config: `client.getIntegration('<np>')`
  - `<NP>Service` → el servicio puro
  - `GHLService` y `GoHighLevelService` (opcional, si esta integración debe espejar citas en GHL)
  - Patrón canónico: cada método obtiene config con un helper privado `get<NP>Config(clientId)`, llama al servicio, transforma el resultado.
  - **Si tu plataforma debe espejar citas en GHL** (ver commit `662d6a5`): copia el helper `resolveGhlConfig(client)` de [backend/src/reservo/reservo-proxy.service.ts:54-73](backend/src/reservo/reservo-proxy.service.ts#L54-L73). Resuelve GHL primero desde la integration `gohighlevel`, después desde campos `ghl*` embebidos en la config de tu plataforma.
- [ ] **Crear el controller**: `backend/src/<np>/<np>.controller.ts`.
  - `@Public()` + `@Controller('clients/:clientId/<np>')` (los endpoints externos son públicos al JWT global porque están protegidos por API key del cliente vía el `ClientLoggingInterceptor`).
  - Una ruta por método del proxy service. Usa `@HttpCode(HttpStatus.OK)` para POST que retornan, no crean.
- [ ] **Crear el módulo proxy**: `backend/src/<np>/<np>-proxy.module.ts`. Importa `ClientsModule` y (si haces mirror GHL) `DentalinkModule` (ahí vive `GHLService`).
- [ ] **Importar el proxy module en [backend/src/app.module.ts](backend/src/app.module.ts)** (sección "Proxy Controllers").

### C. Backend — catálogo de endpoints UI

- [ ] **Agregar entradas a [backend/src/endpoints/endpoint-config.ts](backend/src/endpoints/endpoint-config.ts)** en el array `AVAILABLE_ENDPOINTS`. Un objeto `EndpointDefinition` por endpoint que el usuario verá en `/clients/[id]`:
  - `id` único (kebab-case con prefijo `<np>-`)
  - `name`, `description` en español (se renderiza en UI)
  - `method`, `path` (relativo a `/clients/:clientId/`)
  - `category: '<np>'` — esto agrupa los endpoints en la UI
  - `arguments[]` con `name/type/description/required/example`
  - `requiresConfig` + `configField` si depende de un campo del cliente que puede no estar configurado
- [ ] **Crear `DOCUMENTACION-TOOLS-<NP>.md`** en la raíz del repo con las nuevas tools (un archivo por plataforma — `DOCUMENTACION-TOOLS.md` es solo de Dentalink, [DOCUMENTACION-TOOLS-DENTALSOFT.md](DOCUMENTACION-TOOLS-DENTALSOFT.md) sirve como plantilla). La memoria del proyecto manda hacerlo junto con el tool-registry — ver `feedback_new_tool_workflow`.

### D. Backend — Tool Registry (consumido por gloory-ai-server)

- [ ] **Crear las definiciones**: `backend/src/tool-registry/definitions/<np>.tools.ts` exportando `<NP>_TOOLS: ToolSchema[]`. Schema en [backend/src/tool-registry/interfaces/tool-schema.interface.ts](backend/src/tool-registry/interfaces/tool-schema.interface.ts). Atención a:
  - `target: 'external'` → llama a `gloory-api-endpoints` (los endpoints que acabas de crear en C)
  - `target: 'server'` → llama a `gloory-ai-server` (para datos curados por cliente — listar profesionales, sucursales, especialidades)
  - `endpoint` puede tener `{clientId}` como placeholder
  - `category: 'read' | 'write'`
  - `fields` con `configurable: true` para los que el cliente puede deshabilitar
- [ ] **Registrar en [backend/src/tool-registry/tool-registry.service.ts](backend/src/tool-registry/tool-registry.service.ts)**: añadir `[IntegrationType.NUEVA_PLATAFORMA]: NUEVA_PLATAFORMA_TOOLS` al `registry` y la versión correspondiente.

### E. Backend — internal provisioning & test-connection

- [ ] **Agregar caso en `testConnection`** de [backend/src/internal/internal.service.ts](backend/src/internal/internal.service.ts) (`switch (dto.platform)`). Implementar `testNuevaPlataformaConnection(credentials)` siguiendo el patrón de `testReservoConnection` (`internal.service.ts:288`). Debe:
  - Validar que vengan las credenciales mínimas
  - Llamar a `<NP>Service.testConnection(config)`
  - Devolver `{ok: true, preview: {...stats útiles para el preview de onboarding}}`
- [ ] **Inyectar el `<NP>Service`** en el constructor de `InternalService`.
- [ ] **Verificar que `provisionClient` funcione**: no hay que cambiar nada — el servicio delega en `ClientsService.addIntegration`, que valida contra el registry. Si registraste bien en el paso A, el provisioning ya soporta la nueva plataforma.

### F. Backend — clinic cache (opcional)

Solo si tu plataforma tiene sucursales/profesionales que conviene cachear localmente (para no pegarle a la API externa en cada búsqueda):

- [ ] Agregar un `syncFrom<NP>(clientId)` en [backend/src/clinic/clinic.service.ts](backend/src/clinic/clinic.service.ts) que normalice y bulk-inserte (100 por batch). Modelo: `syncFromDentalink()` ya existente.
- [ ] Si tu plataforma usa UUIDs (no IDs numéricos como Dentalink), usar el campo `externalId` que ya existe en [backend/src/clinic/entities/branch.entity.ts:30](backend/src/clinic/entities/branch.entity.ts#L30) y en `Professional`.
- [ ] Inyectar `<NP>Service` en `ClinicService`.

### G. Backend — confirmation system (opcional)

Solo si necesitas un cron que tome citas nuevas y las espeje/recordatorios en GHL. Cuesta crear módulo completo — no lo hagas si no es necesario.

- [ ] Crear `backend/src/<np>-confirmations/` calcado de [backend/src/reservo-confirmations/](backend/src/reservo-confirmations/):
  - 2 entities: `<np>-confirmation-config.entity.ts` (config por cliente) + `<np>-pending-confirmation.entity.ts` (cola con estado + execution log)
  - `<np>-confirmations.service.ts` con dos crons (`@Cron`): uno horario para fetch nuevas, uno cada 30 min para procesar pendientes
  - `<np>-ghl-setup.service.ts` para crear/actualizar contacto en GHL
  - DTOs CRUD del config
  - Controller con endpoints `/clients/:clientId/<np>-confirmations/*`
- [ ] **Reusar `ExecutionStepEntry` / `ExecutionStepName`** de [backend/src/appointment-confirmations/types/execution-log.type.ts](backend/src/appointment-confirmations/types/execution-log.type.ts) — no inventar otro formato.
- [ ] **Resolver auth de GHL** con el helper `resolveGHLAuthParams` del [backend/src/reservo-confirmations/reservo-confirmations.service.ts:52](backend/src/reservo-confirmations/reservo-confirmations.service.ts#L52): primero la integration `gohighlevel`, después campos `ghl*` embebidos en la config de tu plataforma. Soporta OAuth + PIT.
- [ ] Importar el módulo en [backend/src/app.module.ts](backend/src/app.module.ts).

### H. Backend — migraciones

- [ ] **Si agregaste entities nuevas** (clinic, confirmations) o **campos a entities existentes** (`Client`, `ClientIntegration`), generar migración:
  ```bash
  cd backend
  npm run migration:generate -- src/migrations/Add<NP>Integration
  ```
- [ ] Revisar el SQL generado contra el esquema actual antes de correr `npm run migration:run` en prod.
- [ ] Si solo agregaste código (registry, services, controllers) **sin tocar entidades**, no necesitas migración.

### I. Frontend — tipos y helpers

- [ ] **Espejar el enum** en [frontend/src/lib/api.ts](frontend/src/lib/api.ts): `IntegrationType.NUEVA_PLATAFORMA = 'nuevaplataforma'`.
- [ ] **Agregar display name** en `getIntegrationDisplayName()` de [frontend/src/lib/api.ts:604](frontend/src/lib/api.ts#L604).
- [ ] **Agregar color** en `getIntegrationColor()` de [frontend/src/lib/api.ts:618](frontend/src/lib/api.ts#L618) (clase Tailwind, ej. `bg-pink-500`).
- [ ] **Crear el API client tipado** `<np>Api = {...}` con métodos para todas las rutas del proxy. Modelo: el patrón de `ghlApi` (línea 485) o `integrationsApi` (línea 163).

### J. Frontend — UI

- [ ] **IntegrationSelector se actualiza solo**: lee `/integrations` (registry) en `loadIntegrations()` y renderiza los campos según `requiredFields`/`optionalFields`. Para integraciones simples **no hace falta tocar este archivo**.
- [ ] **Si tu plataforma es mutuamente excluyente con otras** (caso HealthAtom), agregar el tipo al array `HEALTHATOM_INTEGRATIONS` (u otro nuevo si es un grupo distinto) en [frontend/src/components/IntegrationSelector.tsx:28](frontend/src/components/IntegrationSelector.tsx#L28) y actualizar `TRANSFERABLE_FIELDS` si los campos se comparten.
- [ ] **Página de configuración avanzada** (opcional, si la integración tiene UI específica que no cabe en el selector — caso `ghl-config`, `confirmations`): crear `frontend/src/app/clients/[id]/<np>-config/page.tsx`.
- [ ] **Página de confirmaciones** (solo si hiciste el paso G): crear `frontend/src/app/clients/[id]/<np>-confirmations/page.tsx` con CRUD del config y vista de la cola.

### K. Documentación

- [ ] **Actualizar [CLAUDE.md](CLAUDE.md)**: agregar tu plataforma a la lista de integraciones (sección "Technology Stack" y "Integration Registry Pattern").
- [ ] **Crear `DOCUMENTACION-TOOLS-<NP>.md`** con las tools que registraste en D (ya cubierto en C — recordatorio).
- [ ] **Subir logo** a [frontend/public/integrations/<np>.png](frontend/public/integrations/) si lo referenciaste en la metadata.

---

## 3. Diagrama del flujo end-to-end

```
                  gloory-ai-server                    Frontend (admin UI)
                       │                                    │
                       │ POST /internal/clients/provision   │ GET /api/integrations
                       │ (X-Gloory-Internal-Token)          │ → registry (catálogo)
                       ▼                                    │
              ┌──────────────────┐                          │
              │ InternalService  │                          │
              │  .provisionClient│                          │
              └────────┬─────────┘                          │
                       │                                    │
                       ▼                                    ▼
              ┌──────────────────────────────────────────────────┐
              │  ClientsService.addIntegration                   │
              │   ↳ valida config contra IntegrationRegistry     │
              │   ↳ persiste ClientIntegration (JSON config)     │
              └──────────────────────────────────────────────────┘
                       │
                       ▼ (luego, en runtime)
        ┌──────────────────────────────────────┐
        │  Cliente final hace request a        │
        │  /api/clients/:id/<np>/...           │
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────────┐
        │  <NP>Controller (@Public)            │
        │  → <NP>ProxyService                  │
        │     ├─ client.getIntegration('<np>') │
        │     ├─ <NP>Service.fooBar(config)    │
        │     └─ opcional: GHLService.mirror() │ ← solo si la integración espeja en GHL
        └──────────────────────────────────────┘
                         │
                         ▼
                    API externa
                    (plataforma)
```

```
                                          ┌─ endpoint-config.ts ─→ Frontend UI (/clients/[id])
                                          │
Una "tool nueva" se define en 3 lugares ──┼─ tool-registry/definitions/<np>.tools.ts ─→ gloory-ai-server
                                          │
                                          └─ DOCUMENTACION-TOOLS-<NP>.md (doc humana, 1 archivo por plataforma)
```

---

## 4. Detalles importantes (no obvios)

### 4.1 `IntegrationsModule` es `@Global()`

El registry y los servicios de integración (`HealthAtomModule`, `ReservoModule`, `GoHighLevelModule`, etc.) son **módulos globales** — no necesitas importarlos en cada módulo que los use. Sigue el mismo patrón con tu `<NP>Module`.

### 4.2 La config se guarda como JSON

`ClientIntegration.config` es una columna `simple-json` (ver [backend/src/clients/entities/client-integration.entity.ts:41](backend/src/clients/entities/client-integration.entity.ts#L41)). El schema **NO está validado por TypeORM** — solo por `IntegrationRegistryService.validateConfig` cuando se crea/actualiza. Tu `<NP>Config` interface es contractual pero no es enforce de runtime.

### 4.3 Mutual exclusivity solo se aplica en el frontend

Si dos integraciones no deben coexistir, **la regla vive en `IntegrationSelector.tsx`** (`HEALTHATOM_INTEGRATIONS`). El backend permite cualquier combinación. No es una limitación filosófica — es para no romper a clientes con configs heredadas.

### 4.4 Los IDs externos no son índices

Cuando expongas IDs al agente IA (en `endpoint-config.ts` o `tool-registry`), asegúrate de que **los resuelves por ID real de DB, no por posición en un array**. Bug ya cazado en GHL (ver memoria `MEMORY.md` → "GHL Professional ID Bug Fix"). Si tu plataforma usa UUIDs largos, considera mapear a IDs simples (1, 2, 3) como hace Reservo (ver [reservo.types.ts:18](backend/src/integrations/reservo/reservo.types.ts#L18) — `ReservoAgenda.id` vs `uuid`).

### 4.5 Espejado en GHL: dos lugares posibles para la config

Si la integración debe espejar citas en GHL, el cliente puede tener la config de GHL en **dos lugares**:
1. En la integration `gohighlevel` propia (recomendado para clientes nuevos)
2. **Embebida** en la config de tu plataforma (`ghlEnabled`, `ghlAccessToken`, `ghlLocationId`, `ghlOAuthMode`) — para compatibilidad con clientes que vinieron del flow antiguo

Tu `resolveGhlConfig(client)` debe probar ambos, en ese orden. Patrón en [backend/src/reservo/reservo-proxy.service.ts:54](backend/src/reservo/reservo-proxy.service.ts#L54).

### 4.6 OAuth GHL vs PIT

GHL tiene dos modos de auth:
- **PIT** (Private Integration Token): token estático en `ghlAccessToken`
- **OAuth Marketplace**: el token vive en `GHLOAuthLocation`/`GHLOAuthCompany`, se refresca cada hora via cron, y se resuelve por `ghlLocationId` cuando el flag `ghlOAuthMode = true`

Si llamas a GHL desde tu proxy, **usa el wrapper `GHLApiClient`**: `request(locationId, config)` para OAuth y `requestWithToken(pit, config)` para PIT (ver [backend/src/reservo-confirmations/reservo-confirmations.service.ts:83](backend/src/reservo-confirmations/reservo-confirmations.service.ts#L83)).

### 4.7 Endpoints públicos vs JWT

- **Endpoints del cliente final** (`/clients/:clientId/<np>/*`): `@Public()` — los pega el agente IA. Quedan logueados por `ClientLoggingInterceptor`.
- **Endpoints administrativos** (CRUD de config, sync manual): JWT por defecto, sin `@Public()`.
- **Endpoints server-to-server** (provisioning, test-connection desde `gloory-ai-server`): `@Public()` + `@UseGuards(InternalTokenGuard)`.

### 4.8 IntegrationSelector hace batch updates

Si más adelante creas una UI custom que escribe múltiples campos a la vez, llama a `onConfigChange(changes)` **con todos los keys en un solo objeto** — si haces múltiples llamadas separadas, React pierde estado intermedio. Ver [CLAUDE.md](CLAUDE.md) → "React Batching".

### 4.9 Postgres vs SQLite

Si agregas migraciones manuales o usas raw SQL (`LOWER()`, `ILIKE`...), valida que funcione en ambas DBs. Específico: `Like()` de TypeORM es case-sensitive en SQLite para acentos; usar QueryBuilder con `LOWER()` (ver memoria `MEMORY.md` → "GHL Case-Insensitive Specialty Search Fix").

---

## 5. Cuándo NO crear un módulo completo

Si la "integración" que vas a agregar es realmente:

- **Una variante de una API existente** (otro endpoint del mismo proveedor que ya conectas) → solo agrega entradas a `endpoint-config.ts` + tools al registry, no crees todo el módulo.
- **Una herramienta interna server-only** (datos curados, no API externa) → ponla en `gloory-ai-server`, no aquí. En el tool-registry usa `target: 'server'`.
- **Un campo extra de un cliente** (notas, custom tags) → agrega columna al `Client` con migración, no inventes una integración.

---

## 6. Plantilla mínima de archivos

Para una integración básica sin confirmations ni clinic cache, los archivos a crear/modificar quedan así:

```
backend/src/
├── integrations/
│   ├── common/interfaces/integration.interface.ts        [MOD]   ← enum
│   ├── integration-registry.service.ts                   [MOD]   ← registerDefault
│   └── <np>/
│       ├── <np>.types.ts                                 [NEW]
│       ├── <np>.service.ts                               [NEW]
│       └── <np>.module.ts                                [NEW]
├── <np>/
│   ├── dto/                                              [NEW]   ← uno por endpoint
│   ├── <np>-proxy.service.ts                             [NEW]
│   ├── <np>.controller.ts                                [NEW]
│   └── <np>-proxy.module.ts                              [NEW]
├── endpoints/endpoint-config.ts                          [MOD]   ← AVAILABLE_ENDPOINTS
├── tool-registry/
│   ├── definitions/<np>.tools.ts                         [NEW]
│   └── tool-registry.service.ts                          [MOD]   ← registry map
├── internal/internal.service.ts                          [MOD]   ← testConnection switch
└── app.module.ts                                         [MOD]   ← importar ambos módulos

frontend/src/lib/api.ts                                   [MOD]   ← enum + display + color + <np>Api

CLAUDE.md                                                 [MOD]
DOCUMENTACION-TOOLS-<NP>.md                               [NEW]   ← 1 archivo por plataforma
```

Eso son **~10 archivos nuevos + ~7 modificados** para el caso base.

---

## 7. Cómo verificar que quedó bien

1. **Reinicia el backend** (`npm run start:dev` en `/backend`). Confirma en logs:
   - `📦 Registradas 6 integraciones disponibles` (5 → 6)
   - `✅ Integración registrada: <Nombre>` aparece en startup
2. **GET `/api/integrations`** debe listar tu plataforma con todos los campos.
3. **POST `/api/internal/test-connection`** con `X-Gloory-Internal-Token` y credenciales reales — confirma que devuelve `ok: true` con preview.
4. **POST `/api/internal/clients/provision`** con la integration adentro — confirma que crea cliente + integration en una sola llamada (idempotente).
5. **Frontend `/clients/new`** debe mostrar tu plataforma en el selector. Crear cliente con la integración y verificar que la config se persistió.
6. **Tools registry**: `GET /api/tool-registry?platform=<np>` (con `X-Gloory-Internal-Token`) debe devolver tu array.
7. **Llamar un endpoint del proxy** con un `clientId` real — verificar logs en `/clients/[id]/logs`.

Si los 7 pasos pasan, la integración está completa.

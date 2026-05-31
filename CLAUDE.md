# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gloory API Endpoints** is a multi-tenant API proxy system for healthcare integrations. It manages multiple clients, each with their own API keys, and proxies requests to Dentalink, MediLink, Reservo, Dentalsoft, Sacmed, and GoHighLevel. The system includes JWT authentication, API logging, clinic data caching, appointment confirmation workflows, and GHL OAuth Marketplace support.

## Technology Stack

- **Backend**: NestJS 10, TypeORM (with migrations), PostgreSQL (prod) / SQLite (dev), JWT Auth, `@nestjs/schedule` for cron, Baileys (`@whiskeysockets/baileys`) for WhatsApp
- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS, axios, react-hot-toast
- **Languages**: TypeScript throughout
- **No MongoDB** — purely SQL-based with TypeORM
- **Sibling service**: `gloory-ai-server` consumes the `/internal/*` and `/tool-registry` endpoints via the `X-Gloory-Internal-Token` shared secret

## Project Structure

```
gloory-api-endpoints/
├── backend/                              # NestJS Backend (port 3001)
│   ├── src/
│   │   ├── main.ts                       # Entry point
│   │   ├── app.module.ts                 # Main module (global guards & interceptors)
│   │   │
│   │   ├── auth/                         # JWT Auth (Passport, bcrypt)
│   │   │   ├── guards/                   # JwtAuthGuard (global)
│   │   │   ├── decorators/               # @Public() decorator
│   │   │   ├── strategies/               # Passport JWT strategy
│   │   │   └── dto/
│   │   │
│   │   ├── users/                        # User management
│   │   │   ├── entities/
│   │   │   └── dto/
│   │   │
│   │   ├── clients/                      # Multi-tenant client management
│   │   │   ├── entities/client.entity.ts # Client with integrations JSON
│   │   │   └── dto/
│   │   │
│   │   ├── integrations/                 # Integration registry system
│   │   │   ├── integration-registry.service.ts  # Central registry (5 types)
│   │   │   ├── common/interfaces/        # Integration types & capabilities
│   │   │   ├── healthatom/               # Dentalink + MediLink dual-mode handler
│   │   │   ├── gohighlevel/              # GHL types & service
│   │   │   └── reservo/                  # Reservo types & service
│   │   │
│   │   ├── endpoints/                    # Endpoint definitions
│   │   │   └── endpoint-config.ts        # ⭐ All endpoint definitions (single source of truth)
│   │   │
│   │   ├── dentalink/                    # Dentalink proxy (legacy)
│   │   │   └── dto/
│   │   │
│   │   ├── gohighlevel/                  # GHL proxy & OAuth
│   │   │   ├── gohighlevel-proxy.service.ts  # Calendars, appointments, availability
│   │   │   ├── gohighlevel.controller.ts     # Public REST endpoints
│   │   │   ├── entities/                 # GHLCalendar, GHLBranch (local cache)
│   │   │   └── oauth/                    # GHL Marketplace OAuth flow
│   │   │       ├── ghl-oauth.service.ts  # Token lifecycle + hourly refresh cron
│   │   │       └── entities/             # GHLOAuthCompany, GHLOAuthLocation
│   │   │
│   │   ├── reservo/                      # Reservo proxy
│   │   │   ├── reservo-proxy.service.ts  # Agendas, patients, appointments
│   │   │   └── dto/
│   │   │
│   │   ├── dentalsoft/                   # Dentalsoft proxy
│   │   │   ├── dentalsoft-proxy.service.ts  # Patients, appointments, availability
│   │   │   ├── dentalsoft.controller.ts
│   │   │   └── dto/
│   │   │
│   │   ├── clinic/                       # Clinic data caching
│   │   │   └── entities/                 # Branch, Professional (synced from APIs)
│   │   │
│   │   ├── appointment-confirmations/    # Dentalink → GHL appointment sync
│   │   │   ├── adapters/
│   │   │   ├── entities/
│   │   │   └── dto/
│   │   │
│   │   ├── reservo-confirmations/        # Reservo → GHL appointment sync (independent)
│   │   │   ├── reservo-confirmations.service.ts
│   │   │   ├── reservo-ghl-setup.service.ts
│   │   │   ├── entities/                 # ReservoConfirmationConfig, ReservoPendingConfirmation
│   │   │   └── dto/
│   │   │
│   │   ├── client-api-logs/              # API request logging
│   │   │   ├── interceptors/             # ClientLoggingInterceptor (global)
│   │   │   ├── entities/
│   │   │   └── dto/
│   │   │
│   │   ├── dashboard/                    # Engineering monitoring stats
│   │   │
│   │   ├── internal/                     # Server-to-server endpoints (gloory-ai-server)
│   │   │   ├── guards/                   # InternalTokenGuard (X-Gloory-Internal-Token)
│   │   │   ├── internal.controller.ts    # Provisioning, credential updates
│   │   │   └── dto/
│   │   │
│   │   ├── tool-registry/                # Static tool schemas per platform
│   │   │   ├── definitions/              # dentalink/medilink/reservo/ghl tools
│   │   │   ├── interfaces/
│   │   │   └── tool-registry.controller.ts
│   │   │
│   │   ├── notion/                       # Notion onboarding (client + 29 tasks)
│   │   │   ├── notion.service.ts
│   │   │   └── templates/                # implementation-tasks.ts (29 task templates)
│   │   │
│   │   ├── whatsapp/                     # WhatsApp Baileys integration
│   │   │   ├── whatsapp-connection.service.ts  # QR pairing, SSE for QR stream
│   │   │   ├── whatsapp-group.service.ts        # Group management
│   │   │   ├── whatsapp-message.service.ts      # Message handling
│   │   │   ├── helpers/                  # Webhook idempotency, etc.
│   │   │   ├── entities/
│   │   │   └── dto/
│   │   │
│   │   ├── migrations/                   # TypeORM migrations (production)
│   │   ├── data-source.ts                # CLI DataSource (migrations only — NOT app runtime)
│   │   │
│   │   └── utils/                        # Phone formatting, helpers
│   │
│   ├── .env                              # Environment variables
│   └── package.json
│
├── frontend/                             # Next.js Frontend (port 3000)
│   ├── src/
│   │   ├── app/                          # App Router
│   │   │   ├── page.tsx                  # Home
│   │   │   ├── layout.tsx                # Root layout (AuthProvider)
│   │   │   ├── middleware.ts
│   │   │   ├── login/page.tsx            # Login
│   │   │   ├── settings/
│   │   │   │   └── ghl-oauth/page.tsx    # GHL OAuth connection management
│   │   │   └── clients/
│   │   │       ├── page.tsx              # Client list
│   │   │       ├── new/page.tsx          # Create client
│   │   │       └── [id]/
│   │   │           ├── page.tsx          # Client dashboard
│   │   │           ├── edit/page.tsx     # Edit client + IntegrationSelector
│   │   │           ├── clinic/page.tsx   # Branches/professionals management
│   │   │           ├── ghl-config/page.tsx         # GHL configuration
│   │   │           ├── logs/page.tsx               # API request logs viewer
│   │   │           ├── confirmations/page.tsx      # Dentalink confirmations
│   │   │           └── reservo-confirmations/page.tsx  # Reservo confirmations
│   │   │
│   │   ├── components/
│   │   │   ├── IntegrationSelector.tsx   # ⭐ Multi-integration config (656 lines)
│   │   │   ├── GHLLocationSelector.tsx   # OAuth/PIT location selector + calendar preview
│   │   │   ├── GHLIntegrationSection.tsx # Legacy GHL config UI
│   │   │   ├── IntegrationBadges.tsx     # Integration status badges
│   │   │   ├── ExecutionLogDetails.tsx   # Confirmation execution log viewer
│   │   │   ├── AuthProvider.tsx          # Auth context + axios interceptor
│   │   │   ├── Navbar.tsx
│   │   │   ├── ClientCard.tsx
│   │   │   └── EndpointCard.tsx
│   │   │
│   │   └── lib/
│   │       ├── api.ts                    # ⭐ Typed API client (~1200 lines)
│   │       ├── auth.ts                   # Token management, login/logout
│   │       └── timezones.ts              # Timezone list for client config
│   │
│   ├── .env.local
│   └── package.json
│
├── apis-en-python/                       # Python API scripts
├── package.json                          # Monorepo scripts
├── install.sh                            # Installation script
├── start-dev.sh                          # Development startup
└── vercel.json                           # Vercel deployment config
```

## Development Commands

### Backend (`cd backend`)
```bash
npm run start:dev        # Development with hot-reload (port 3001)
npm run build            # Build for production
npm run start:prod       # Run production build
npm run lint             # ESLint
npm run format           # Prettier
npm run test             # Jest tests
npm run test -- file.spec.ts  # Run single test
npm run test:cov         # Coverage

# TypeORM migrations (production — env vars must be set in shell)
npm run migration:generate -- src/migrations/NameOfMigration
npm run migration:run
npm run migration:revert
npm run migration:show
```

### Frontend (`cd frontend`)
```bash
npm run dev              # Development server (port 3000)
npm run build            # Build for production
npm run lint             # ESLint
```

### Monorepo (from root)
```bash
npm run install:all      # Install all dependencies
npm run dev:backend      # Start backend dev
npm run dev:frontend     # Start frontend dev
```

## Architecture & Key Concepts

### Backend Module Structure

The backend follows NestJS modular architecture. Key modules loaded in `app.module.ts`:

**Global Singletons** (shared services):
- `IntegrationsModule` — Registry of all integration types (Dentalink, MediLink, dual, Reservo, Dentalsoft, GHL)
- `HealthAtomModule` — Unified Dentalink + MediLink API handler with dual-mode fallback
- `ReservoModule` — Reservo reservation system API handler
- `DentalsoftModule` — Dentalsoft OAuth client_credentials API handler (token cache in-memory)
- `SacmedModule` — Sacmed availability-microservice API handler (API Key via `X-ApiKey`)
- `GoHighLevelModule` — GHL API handler
- `GHLOAuthModule` — GHL Marketplace OAuth token lifecycle

**Proxy Controllers** (route handlers for external APIs):
- `GoHighLevelProxyModule` — GHL calendars, appointments, branches, availability, sync
- `ReservoProxyModule` — Reservo agendas, patients, appointments, availability
- `DentalsoftProxyModule` — Dentalsoft patients, appointments, availability, professionals, specialties, branches
- `SacmedProxyModule` — Sacmed services, specialties, practitioners, districts, availability, patients, appointments

**Core Modules**:
- `ClientsModule` — Multi-tenant client management with JSON integration configs
- `EndpointsModule` — Centralized endpoint definitions in `endpoint-config.ts`
- `DentalinkModule` — Legacy Dentalink proxy
- `ClinicModule` — Local cache of branches/professionals with sync & pagination
- `AppointmentConfirmationsModule` — Dentalink → GHL appointment sync
- `ReservoConfirmationsModule` — Reservo → GHL appointment sync (independent from above)
- `SacmedConfirmationsModule` — Sacmed → GHL appointment sync (independent; per-practitioner fan-out)
- `ClientApiLogsModule` — Global request logging interceptor + cron cleanup
- `DashboardModule` — Engineering monitoring stats endpoint

**Sibling-service & onboarding modules**:
- `InternalModule` — Server-to-server endpoints called by `gloory-ai-server` (provisioning, credential test/update). Public to the JWT guard but locked behind `InternalTokenGuard` checking `X-Gloory-Internal-Token`
- `ToolRegistryModule` — Returns static tool schemas per platform from `tool-registry/definitions/` (Dentalink, MediLink, dual, Reservo, Dentalsoft, Sacmed, GHL). Consumed by `gloory-ai-server`; same `InternalTokenGuard` protection
- `NotionModule` — Triggered after onboarding to create the Notion client page + 29 implementation tasks (fire-and-forget); state tracked via `notionOnboardingStatus` on `Client`
- `WhatsAppModule` — Baileys-based WhatsApp connection (QR pairing via SSE), group/message management, and webhook with response-ID idempotency cache (5 min TTL)

**Auth**:
- `AuthModule` / `UsersModule` — JWT + Passport, bcrypt passwords

**Global Guards & Interceptors** (in `app.module.ts`):
- `APP_GUARD: JwtAuthGuard` — All routes require JWT by default
- `APP_INTERCEPTOR: ClientLoggingInterceptor` — Logs all API requests

### Integration Registry Pattern

`IntegrationRegistryService` defines 7 integration types: `DENTALINK`, `MEDILINK`, `DENTALINK_MEDILINK` (dual mode), `RESERVO`, `DENTALSOFT`, `SACMED`, `GOHIGHLEVEL`. Each has required/optional fields and capability flags. Clients store integration configs as JSON, accessed via `client.getIntegration('type')`.

### Dual-Mode HealthAtom

`HealthAtomService` handles both Dentalink and MediLink. For dual-mode clients (`dentalink_medilink`), it tries Dentalink first and falls back to MediLink. Field normalization happens here (`apellidos` vs `apellido`).

### GoHighLevel Integration

Two authentication modes:
1. **PIT Mode** (Private Integration Token) — Direct token in client config
2. **OAuth Marketplace Mode** — Tokens stored in `GHLOAuthCompany`/`GHLOAuthLocation` entities, refreshed hourly via cron

`GoHighLevelProxyService` caches calendars and branches locally in TypeORM entities (`GHLCalendar`, `GHLBranch`). All GHL proxy endpoints are `@Public()` (no JWT required).

**Critical**: Professional/calendar IDs are resolved by actual database `id` field, not array index position.

### Reservo Integration

`ReservoProxyService` maps simple numeric agenda IDs (1, 2, 3) to Reservo UUIDs stored in client config. Handles phone normalization via `formatearTelefono()` utility.

### Dentalsoft Integration

`DentalsoftService` authenticates via OAuth `client_credentials` (`client_id` + `client_secret` + `scope` = clinic ID). Access tokens are cached in-memory per `(clientId|scope)` with a 60s refresh margin — no DB persistence, no cron. The block length (5 or 15 min) is also cached in-memory, used to translate `bloques → minutos` when mirroring an appointment to GHL. The proxy uses the same `resolveGhlConfig()` pattern as Reservo to find the GHL config either in the standalone `gohighlevel` integration or embedded in the Dentalsoft config (`ghl*` fields).

### Sacmed Integration

`SacmedService` authenticates via a static **API Key** sent in the `X-ApiKey` header (≠ Reservo's `Authorization: Token`). The base URL is configurable (`baseUrl`, default production `availability-ms-prod-...`; a TEST URL exists). IDs: services/specialties/districts are numeric, professionals use UUIDs (`userId`), events (appointments) use numeric IDs. The business logic ported from the original AWS Lambdas lives in `SacmedProxyService`: `serviceTypeId → modalidad` mapping (1=Presencial, 2=Telemedicina), availability search with multi-week retry (up to 4 weeks) + field renaming, Chilean RUT validation (reuses `utils/rut.util.ts`), future-appointment filtering with timezone formatting, and appointment payload mapping. GHL mirroring uses the same `resolveGhlConfig()` pattern as Reservo (standalone `gohighlevel` integration or embedded `ghl*` fields).

### Confirmation Systems (Three Independent Implementations)

1. **AppointmentConfirmationsModule** — Syncs Dentalink appointments → GHL
2. **ReservoConfirmationsModule** — Syncs Reservo appointments → GHL
3. **SacmedConfirmationsModule** — Syncs Sacmed appointments → GHL

All use scheduled cron jobs but have completely separate entities, logic, and configuration. Each normalizes appointments to a common format, creates/updates GHL contacts, and schedules GHL calendar appointments. **Sacmed-specific**: since Sacmed has no "list all events by date range" endpoint, the auto-fetch fans out — it lists practitioners, then fetches each one's events for the target day via `events/by-practitioner/.../fechas/{from}/{to}`.

### Clinic Data Synchronization

`ClinicService.syncFromDentalink()` fetches branches/professionals from Dentalink/MediLink with automatic pagination (50-page safety limit), bulk inserts (100/batch), and dual-mode support. Use `force=true` to reset and resync.

### Scheduled Tasks (Cron Jobs)

| Module | Schedule | Purpose |
|--------|----------|---------|
| `ClientApiLogsService` | 3 AM daily | Delete old API logs |
| `GHLOAuthService` | Every hour | Refresh OAuth tokens |
| `AppointmentConfirmationsService` | Every hour | Process Dentalink confirmations |
| `AppointmentConfirmationsService` | Every 30 min | Send appointment reminders |
| `ReservoConfirmationsService` | Every hour | Fetch new Reservo appointments |
| `ReservoConfirmationsService` | Every 30 min | Process pending Reservo confirmations |
| `SacmedConfirmationsService` | Every hour | Process pending Sacmed confirmations |
| `SacmedConfirmationsService` | Every 30 min | Fetch new Sacmed appointments (per-practitioner fan-out) |

### Database Configuration

TypeORM with dual DB support. The runtime default in `app.module.ts` is **postgres** — switch to SQLite for dev with `DATABASE_TYPE=sqlite`.
- **Dev**: SQLite (`DATABASE_TYPE=sqlite`, `DATABASE_PATH=./database.sqlite`) — `synchronize: true`
- **Prod**: PostgreSQL (`DATABASE_TYPE=postgres`, `DATABASE_URL` or individual vars) — `synchronize: false` unless `DB_SYNC=true` is set for a one-shot bootstrap
- Postgres pool is tuned in code (`max: 20`, statement timeout 60s) — don't override at the connection-string level

### Migrations

Migrations live in `backend/src/migrations/` and are run via `data-source.ts` (a CLI-only DataSource — **separate from the runtime config in `app.module.ts`**, and always `synchronize: false`). Use migration commands for any prod schema change; do **not** rely on `synchronize` in production. Env vars (`DATABASE_URL` or `DATABASE_HOST` set, plus `DATABASE_SSL=true` if the DB needs it) must be exported in the shell when running migration commands.

### Authentication

All routes require JWT by default. Use `@Public()` decorator to skip auth:
```typescript
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Get('endpoint')
async handler() {}
```

Login via `POST /api/auth/login` returns JWT token. Frontend stores in localStorage with auto-logout on 401 via axios interceptor.

### Adding New Endpoints

Edit `backend/src/endpoints/endpoint-config.ts` → add to `AVAILABLE_ENDPOINTS` array. Endpoint automatically appears in frontend and API. If custom logic needed, add handler in `dentalink.controller.ts`.

### Adding New Tools (gloory-ai-server registry)

When adding a tool to `backend/src/tool-registry/definitions/<platform>.tools.ts`, also:
1. Add the matching entry to `backend/src/endpoints/endpoint-config.ts` so the client UI shows it
2. Update `DOCUMENTACION-TOOLS.md` at the repo root
3. For GHL tools, use the contact's `user_id` field as the contact ID

Tool schemas are static (defined in code) — clients can't toggle them. Adding a tool requires redeploying this service so `gloory-ai-server` can re-sync.

### Internal Server-to-Server Authentication

Routes under `/internal/*` and `/tool-registry` are marked `@Public()` (bypass the global `JwtAuthGuard`) but protected by `InternalTokenGuard` (in `backend/src/internal/guards/`), which requires the `X-Gloory-Internal-Token` header to match a shared secret. These are **not** for browser clients — only `gloory-ai-server` should call them. When adding new server-to-server routes, follow the same `@Public()` + `@UseGuards(InternalTokenGuard)` combo.

### Frontend Structure

**Pages** (Next.js App Router):
- `/` — Home
- `/login` — Login
- `/settings/ghl-oauth` — GHL OAuth connection management
- `/clients` — Client list
- `/clients/new` — Create client
- `/clients/[id]` — Client dashboard
- `/clients/[id]/edit` — Edit client with IntegrationSelector
- `/clients/[id]/clinic` — Branches/professionals management
- `/clients/[id]/ghl-config` — GHL configuration
- `/clients/[id]/logs` — API request logs viewer
- `/clients/[id]/confirmations` — Dentalink confirmation config & queue
- `/clients/[id]/reservo-confirmations` — Reservo confirmation config & queue
- `/clients/[id]/sacmed-confirmations` — Sacmed confirmation config & queue

**Key Components**:
- `IntegrationSelector` (656 lines) — Complex multi-integration config with mutual exclusivity for HealthAtom types, dynamic field rendering, config caching on toggle, and batch updates
- `GHLLocationSelector` — Dual-mode OAuth/PIT location selector with calendar preview
- `AuthProvider` — Client-side auth context with axios interceptor setup

**API Client** (`frontend/src/lib/api.ts`, ~1200 lines) — Comprehensive typed API abstractions for all backend endpoints organized by domain (clients, clinic, ghl, confirmations, reservo, dashboard, oauth, logs).

## Key Gotchas

- **Global Auth**: All routes require JWT — use `@Public()` for exceptions. GHL proxy is fully public.
- **Dual Mode**: Some clients use both Dentalink + MediLink — check `client.getIntegration('dentalink_medilink')`
- **Three Confirmation Systems**: Dentalink, Reservo, and Sacmed confirmations are completely independent modules with separate entities and cron jobs
- **Sacmed has no global event list**: confirmation fetch fans out per-practitioner (`events/by-practitioner/.../fechas/{from}/{to}`) — there's no "all events by date range" endpoint
- **Sacmed auth differs**: Sacmed uses an API Key in the `X-ApiKey` header, not `Authorization: Token` like Reservo
- **GHL ID Resolution**: Calendar/professional IDs are actual database IDs, not positional indices — never use array index
- **Case-Insensitive Search**: Specialty search uses `LOWER()` in QueryBuilder to handle Spanish accents in both PostgreSQL and SQLite
- **API Field Differences**: Dentalink `apellidos` vs MediLink `apellido` — normalize in service layer
- **React Batching**: IntegrationSelector uses batch `onConfigChange(changes)` with multiple keys in a single call to avoid state loss
- **Pagination**: Clinic sync handles pagination automatically with safety limits — don't fetch all at once
- **Endpoint Config**: Changes to `endpoint-config.ts` immediately affect both backend routes and frontend UI
- **Tool Registry vs Endpoint Config**: They're parallel registries — `endpoint-config.ts` drives the client-facing API/UI, `tool-registry/definitions/` drives the tools `gloory-ai-server` advertises to its agents. Adding a tool usually means editing both (plus `DOCUMENTACION-TOOLS.md`).
- **Internal token guard**: Routes for `gloory-ai-server` are `@Public()` (to skip JWT) but locked by `InternalTokenGuard` — don't drop one without the other or you expose internal endpoints
- **Data source duality**: `app.module.ts` (runtime) and `data-source.ts` (CLI migrations) are independent — don't try to share config between them; the CLI always uses `synchronize: false` even in dev
- **Appointment mirroring**: Appointments created via the normal client endpoints (Dentalink/MediLink/Reservo) are automatically mirrored into GHL when the client has an active GHL integration — don't add a second sync path

## Environment Variables

### Backend `.env`
```bash
PORT=3001
NODE_ENV=development
DATABASE_TYPE=sqlite          # or 'postgres' (default if unset)
DATABASE_PATH=./database.sqlite
# DATABASE_URL=postgresql://user:pass@host:5432/db
# DATABASE_SSL=true            # Required for Railway/Render
# DB_SYNC=true                 # One-shot bootstrap in prod (then remove)
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-secret

# Internal server-to-server (gloory-ai-server)
GLOORY_INTERNAL_TOKEN=shared-secret

# Notion onboarding (optional — endpoint 400s without these)
NOTION_API_KEY=
NOTION_CLIENTS_DB_ID=
NOTION_TASKS_DB_ID=

# GHL OAuth Marketplace (optional)
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_REDIRECT_URI=
```

### Frontend `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

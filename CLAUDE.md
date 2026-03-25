# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gloory API Endpoints** is a multi-tenant API proxy system for healthcare integrations. It manages multiple clients, each with their own API keys, and proxies requests to Dentalink, MediLink, Reservo, and GoHighLevel. The system includes JWT authentication, API logging, clinic data caching, appointment confirmation workflows, and GHL OAuth Marketplace support.

## Technology Stack

- **Backend**: NestJS 10, TypeORM, PostgreSQL (prod) / SQLite (dev), JWT Auth, `@nestjs/schedule` for cron
- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS, axios, react-hot-toast
- **Languages**: TypeScript throughout
- **No MongoDB** — purely SQL-based with TypeORM

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
- `IntegrationsModule` — Registry of all integration types (Dentalink, MediLink, dual, Reservo, GHL)
- `HealthAtomModule` — Unified Dentalink + MediLink API handler with dual-mode fallback
- `ReservoModule` — Reservo reservation system API handler
- `GoHighLevelModule` — GHL API handler
- `GHLOAuthModule` — GHL Marketplace OAuth token lifecycle

**Proxy Controllers** (route handlers for external APIs):
- `GoHighLevelProxyModule` — GHL calendars, appointments, branches, availability, sync
- `ReservoProxyModule` — Reservo agendas, patients, appointments, availability

**Core Modules**:
- `ClientsModule` — Multi-tenant client management with JSON integration configs
- `EndpointsModule` — Centralized endpoint definitions in `endpoint-config.ts`
- `DentalinkModule` — Legacy Dentalink proxy
- `ClinicModule` — Local cache of branches/professionals with sync & pagination
- `AppointmentConfirmationsModule` — Dentalink → GHL appointment sync
- `ReservoConfirmationsModule` — Reservo → GHL appointment sync (independent from above)
- `ClientApiLogsModule` — Global request logging interceptor + cron cleanup
- `DashboardModule` — Engineering monitoring stats endpoint

**Auth**:
- `AuthModule` / `UsersModule` — JWT + Passport, bcrypt passwords

**Global Guards & Interceptors** (in `app.module.ts`):
- `APP_GUARD: JwtAuthGuard` — All routes require JWT by default
- `APP_INTERCEPTOR: ClientLoggingInterceptor` — Logs all API requests

### Integration Registry Pattern

`IntegrationRegistryService` defines 5 integration types: `DENTALINK`, `MEDILINK`, `DENTALINK_MEDILINK` (dual mode), `RESERVO`, `GOHIGHLEVEL`. Each has required/optional fields and capability flags. Clients store integration configs as JSON, accessed via `client.getIntegration('type')`.

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

### Confirmation Systems (Two Independent Implementations)

1. **AppointmentConfirmationsModule** — Syncs Dentalink appointments → GHL
2. **ReservoConfirmationsModule** — Syncs Reservo appointments → GHL

Both use scheduled cron jobs but have completely separate entities, logic, and configuration. Each normalizes appointments to a common format, creates/updates GHL contacts, and schedules GHL calendar appointments.

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

### Database Configuration

TypeORM with dual DB support:
- **Dev**: SQLite (`DATABASE_TYPE=sqlite`, `DATABASE_PATH=./database.sqlite`)
- **Prod**: PostgreSQL (`DATABASE_TYPE=postgres`, `DATABASE_URL` or individual vars)
- Auto-sync in dev, disabled in prod (use `DB_SYNC=true` for initial setup only)

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

**Key Components**:
- `IntegrationSelector` (656 lines) — Complex multi-integration config with mutual exclusivity for HealthAtom types, dynamic field rendering, config caching on toggle, and batch updates
- `GHLLocationSelector` — Dual-mode OAuth/PIT location selector with calendar preview
- `AuthProvider` — Client-side auth context with axios interceptor setup

**API Client** (`frontend/src/lib/api.ts`, ~1200 lines) — Comprehensive typed API abstractions for all backend endpoints organized by domain (clients, clinic, ghl, confirmations, reservo, dashboard, oauth, logs).

## Key Gotchas

- **Global Auth**: All routes require JWT — use `@Public()` for exceptions. GHL proxy is fully public.
- **Dual Mode**: Some clients use both Dentalink + MediLink — check `client.getIntegration('dentalink_medilink')`
- **Two Confirmation Systems**: Dentalink and Reservo confirmations are completely independent modules with separate entities and cron jobs
- **GHL ID Resolution**: Calendar/professional IDs are actual database IDs, not positional indices — never use array index
- **Case-Insensitive Search**: Specialty search uses `LOWER()` in QueryBuilder to handle Spanish accents in both PostgreSQL and SQLite
- **API Field Differences**: Dentalink `apellidos` vs MediLink `apellido` — normalize in service layer
- **React Batching**: IntegrationSelector uses batch `onConfigChange(changes)` with multiple keys in a single call to avoid state loss
- **Pagination**: Clinic sync handles pagination automatically with safety limits — don't fetch all at once
- **Endpoint Config**: Changes to `endpoint-config.ts` immediately affect both backend routes and frontend UI

## Environment Variables

### Backend `.env`
```bash
PORT=3001
NODE_ENV=development
DATABASE_TYPE=sqlite          # or 'postgres'
DATABASE_PATH=./database.sqlite
# DATABASE_URL=postgresql://user:pass@host:5432/db
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-secret
```

### Frontend `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gloory API Endpoints** is a multi-tenant API proxy system for healthcare integrations. It manages multiple clients, each with their own API keys, and proxies requests to Dentalink, MediLink, or both. The system includes authentication, API logging, clinic data caching, and optional GoHighLevel synchronization.

## Technology Stack

- **Backend**: NestJS 10, TypeORM, PostgreSQL/SQLite, JWT Auth
- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS
- **Languages**: TypeScript throughout

## Project Structure

```
gloory-api-endpoints/
├── backend/                          # NestJS Backend
│   ├── src/
│   │   ├── main.ts                   # Entry point
│   │   ├── app.module.ts             # Main module (global guards & interceptors)
│   │   │
│   │   ├── auth/                     # JWT Authentication
│   │   │   ├── guards/jwt-auth.guard.ts       # Global JWT guard
│   │   │   ├── decorators/public.decorator.ts # @Public() decorator
│   │   │   └── strategies/            # Passport strategies
│   │   │
│   │   ├── users/                    # User management
│   │   │   └── entities/user.entity.ts
│   │   │
│   │   ├── clients/                  # Multi-tenant client management
│   │   │   ├── entities/client.entity.ts      # Client with integrations JSON
│   │   │   ├── dto/                  # Create/Update DTOs
│   │   │   ├── clients.service.ts
│   │   │   └── clients.controller.ts
│   │   │
│   │   ├── integrations/             # Integration registry system
│   │   │   ├── integration-registry.service.ts  # Central registry
│   │   │   ├── common/interfaces.ts  # Integration types & capabilities
│   │   │   └── healthatom/           # HealthAtom integration (Dentalink + MediLink)
│   │   │       └── healthatom.service.ts       # Dual-mode API handler
│   │   │
│   │   ├── endpoints/                # Endpoint definitions
│   │   │   ├── endpoint-config.ts    # ⭐ All endpoint definitions
│   │   │   ├── endpoints.service.ts
│   │   │   └── endpoints.controller.ts
│   │   │
│   │   ├── dentalink/                # Dentalink proxy (legacy)
│   │   │   ├── dentalink.service.ts
│   │   │   └── dentalink.controller.ts
│   │   │
│   │   ├── clinic/                   # Clinic data caching
│   │   │   ├── entities/
│   │   │   │   ├── branch.entity.ts  # Cached branches
│   │   │   │   └── professional.entity.ts  # Cached professionals
│   │   │   ├── clinic.service.ts     # Sync with pagination & bulk insert
│   │   │   └── clinic.controller.ts
│   │   │
│   │   ├── appointment-confirmations/  # Appointment confirmation logic
│   │   │   └── appointment-confirmations.service.ts
│   │   │
│   │   └── client-api-logs/          # API request logging
│   │       ├── entities/client-api-log.entity.ts
│   │       ├── interceptors/client-logging.interceptor.ts  # Global interceptor
│   │       └── client-api-logs.service.ts  # Includes cron cleanup
│   │
│   ├── .env                          # Environment variables
│   ├── .env.example                  # Template
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
│
├── frontend/                         # Next.js Frontend
│   ├── src/
│   │   ├── app/                      # App Router
│   │   │   ├── page.tsx              # Home page
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── globals.css
│   │   │   │
│   │   │   └── clients/              # Client routes
│   │   │       ├── page.tsx          # Client list
│   │   │       ├── new/page.tsx      # Create client
│   │   │       └── [id]/
│   │   │           └── page.tsx      # Client dashboard with endpoints
│   │   │
│   │   ├── components/               # React components
│   │   │   ├── Navbar.tsx
│   │   │   ├── ClientCard.tsx
│   │   │   └── EndpointCard.tsx
│   │   │
│   │   └── lib/
│   │       └── api.ts                # API client helpers
│   │
│   ├── .env.local                    # Frontend environment variables
│   ├── .env.local.example
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── package.json                      # Monorepo scripts
├── install.sh                        # Installation script
├── start-dev.sh                      # Development startup script
│
└── Documentation/
    ├── CLAUDE.md                     # This file
    ├── PROJECT_SUMMARY.md            # Project overview
    ├── QUICKSTART.md                 # 5-minute setup guide
    ├── INSTALL.md                    # Detailed installation
    ├── API_EXAMPLES.md               # API usage examples
    ├── CONTRIBUTING.md               # Contribution guide
    └── CHANGELOG.md                  # Version history
```

### Key Directory Notes

- **`backend/src/endpoints/endpoint-config.ts`**: Single source of truth for all API endpoints. Edit this file to add new endpoints.
- **`backend/src/integrations/`**: Registry pattern for extensible integrations. Add new integration types here.
- **`backend/src/clinic/`**: Local cache of Dentalink/MediLink data with sync capabilities.
- **`backend/src/client-api-logs/`**: Request logging with automatic cleanup via cron.
- **`frontend/src/app/clients/[id]/`**: Dynamic route for client-specific dashboards.

## Development Commands

### Backend (NestJS)
```bash
cd backend
npm run start:dev    # Development with hot-reload
npm run build        # Build for production
npm run start:prod   # Run production build
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:cov     # Run tests with coverage
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev          # Development server
npm run build        # Build for production
npm run start        # Run production build
npm run lint         # Run ESLint
```

### Monorepo Scripts (from root)
```bash
npm run install:all       # Install all dependencies
npm run dev:backend       # Start backend dev
npm run dev:frontend      # Start frontend dev
npm run build:backend     # Build backend
npm run build:frontend    # Build frontend
```

## Architecture & Key Concepts

### Module Structure

The backend follows NestJS modular architecture with these core modules:

1. **IntegrationsModule** (Global): Registry-based system that defines available integrations (Dentalink, MediLink, dual mode, Reservo). All integration metadata, required fields, and capabilities are centralized in `IntegrationRegistryService`.

2. **HealthAtomModule**: Unified service that handles both Dentalink and MediLink APIs. Uses dual-mode fallback: tries Dentalink first, falls back to MediLink if it fails. This is key for clients with both dental and medical services.

3. **ClientsModule**: Manages multi-tenant clients. Each client has:
   - One or more integration configurations (stored as JSON)
   - API keys and settings per integration
   - Methods like `client.getIntegration('dentalink')` to access integration config
   - Helper methods: `client.apiKey` (gets first integration's API key)

4. **EndpointsModule**: Centralized endpoint definitions in `endpoint-config.ts`. Each endpoint definition includes:
   - HTTP method, path, Dentalink path mapping
   - Arguments with types and validation
   - Category and description
   - Optional `requiresConfig` flag (e.g., confirmation state ID)

5. **ClinicModule**: Caches branches and professionals from Dentalink/Medilink:
   - Handles pagination automatically (multi-page API responses)
   - Bulk insert optimization (100 records per batch)
   - Supports dual-mode sync (Dentalink + MediLink)
   - Local activation/deactivation (doesn't affect upstream API)
   - Specialty filtering

6. **AuthModule**: JWT-based authentication with Passport:
   - Global `JwtAuthGuard` applied to all routes
   - Use `@Public()` decorator to skip authentication
   - User entity with bcrypt password hashing

7. **ClientApiLogsModule**: Logs all client API requests with:
   - Global interceptor (`ClientLoggingInterceptor`)
   - Automatic cleanup via cron job
   - Stores request/response data, timing, status

### Database Configuration

TypeORM with dual database support:
- **Development**: SQLite (`DATABASE_TYPE=sqlite`)
- **Production**: PostgreSQL (`DATABASE_TYPE=postgres`)
- Environment variables support both individual settings and `DATABASE_URL`
- Auto-sync enabled in development, disabled in production (use `DB_SYNC=true` for initial prod setup)

### Integration Registry Pattern

The system uses a registry pattern for extensibility:
- `IntegrationRegistryService` stores metadata for all integrations
- Each integration defines: type, name, capabilities, required/optional fields
- Clients store integration configs as JSON with dynamic fields
- New integrations can be added by registering in the service

### Clinic Data Synchronization

`ClinicService.syncFromDentalink()` is a critical method:
- Fetches all branches and professionals from Dentalink/MediLink APIs
- Handles pagination automatically (up to 50 pages with safety limit)
- Uses bulk inserts (100 records per batch) for performance
- Only adds new records by default; use `force=true` to reset
- Supports dual-mode: syncs from both Dentalink and MediLink if configured
- Normalizes data (e.g., `apellidos` vs `apellido` field differences)

### Authentication Flow

All routes require JWT authentication by default:
1. Global `JwtAuthGuard` applied in `app.module.ts`
2. Login via `/api/auth/login` returns JWT token
3. Frontend stores token and includes in `Authorization: Bearer <token>`
4. Public endpoints must use `@Public()` decorator

### Adding New Endpoints

To add a new endpoint to the proxy:

1. Edit `backend/src/endpoints/endpoint-config.ts`
2. Add to `AVAILABLE_ENDPOINTS` array:
```typescript
{
  id: 'unique-id',
  name: 'Display Name',
  description: 'What it does',
  method: 'POST',
  path: '/your-path',
  dentalinkPath: '/dentalink-api-path',
  category: 'category-name',
  arguments: [
    {
      name: 'param_name',
      type: 'string',
      description: 'Parameter description',
      required: true,
      example: 'example-value'
    }
  ],
  requiresConfig: false, // Set true if needs client configuration
  configField: 'fieldName', // If requiresConfig is true
}
```
3. Endpoint automatically appears in frontend and API
4. If custom logic needed, add handler in `dentalink.controller.ts`

## Important Files & Locations

### Backend
- `src/app.module.ts` - Main module with global guards and interceptors
- `src/endpoints/endpoint-config.ts` - **All endpoint definitions** (edit this to add endpoints)
- `src/integrations/integration-registry.service.ts` - Integration type definitions
- `src/integrations/healthatom/healthatom.service.ts` - Dual-mode Dentalink/MediLink handler
- `src/clinic/clinic.service.ts` - Clinic data sync with pagination and bulk insert
- `src/clients/entities/client.entity.ts` - Client model with integration helpers
- `src/auth/guards/jwt-auth.guard.ts` - Global auth guard
- `src/client-api-logs/interceptors/client-logging.interceptor.ts` - Request logging

### Frontend
- `src/app/page.tsx` - Home page
- `src/app/clients/page.tsx` - Client list
- `src/app/clients/[id]/page.tsx` - Client dashboard with endpoints
- `src/lib/api.ts` - API client helper

## Environment Variables

### Backend `.env`
```bash
PORT=3001
NODE_ENV=development

# Database - Use SQLite for dev, PostgreSQL for prod
DATABASE_TYPE=sqlite  # or 'postgres'
DATABASE_PATH=./database.sqlite

# For PostgreSQL:
# DATABASE_TYPE=postgres
# DATABASE_URL=postgresql://user:pass@host:5432/db
# Or individual settings:
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_USERNAME=postgres
# DATABASE_PASSWORD=password
# DATABASE_NAME=gloory_db
# DATABASE_SSL=false  # true for Railway/Render

CORS_ORIGIN=http://localhost:3000
```

### Frontend `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Common Development Patterns

### Testing Integration Changes

When modifying integration logic:
1. Check `IntegrationRegistryService` for metadata
2. Update field definitions if adding new config options
3. Test with both single and dual-mode integrations
4. Verify frontend form reflects new fields

### Working with Clinic Sync

The sync process handles large datasets efficiently:
- Uses `fetchAllPaginated()` helper for multi-page responses
- Implements safety limits (50 pages max)
- Only inserts new records to avoid duplicates
- Use `force=true` parameter to reset and resync all data

### Accessing Client Integration Config

```typescript
const client = await this.clientsService.findOne(clientId);
const dentalinkConfig = client.getIntegration('dentalink');
const apiKey = dentalinkConfig.config.apiKey;

// Or use helper for primary API key
const apiKey = client.apiKey;
```

### Making Endpoints Public

```typescript
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Get('public-endpoint')
async publicRoute() {
  // This endpoint skips JWT authentication
}
```

## Testing Strategy

- Unit tests: `*.spec.ts` files next to source
- E2E tests: `test/` directory
- Run specific test: `npm test -- filename.spec.ts`
- Coverage: `npm run test:cov`

## Deployment Notes

1. Backend runs on port 3001, frontend on 3000
2. Production uses PostgreSQL (set `DATABASE_TYPE=postgres`)
3. First production deploy: set `DB_SYNC=true` to create tables, then remove
4. CORS origin must match frontend URL
5. JWT secret should be set via environment variable in production

## Key Gotchas

- **Global Auth**: All routes require JWT by default - use `@Public()` decorator for exceptions
- **Dual Mode**: Some clients use both Dentalink and MediLink - check `client.getIntegration('dentalink_medilink')`
- **Pagination**: Clinic sync handles pagination automatically - don't try to fetch all at once
- **Bulk Inserts**: Large datasets use batches of 100 - don't modify batch size without testing
- **API Field Differences**: Dentalink uses `apellidos`, MediLink uses `apellido` - normalize in service layer
- **Local vs Remote State**: Branches/professionals can be disabled locally without affecting Dentalink
- **Endpoint Config**: Changes to `endpoint-config.ts` immediately affect both backend routes and frontend UI

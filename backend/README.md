# Backend - Gloory API

Backend API construido con NestJS para gestionar integraciones con Dentalink.

## Características

- ✅ Gestión completa de clientes con CRUD
- ✅ Sistema de endpoints configurables
- ✅ Proxy transparente a la API de Dentalink
- ✅ Validación de datos con class-validator
- ✅ Base de datos SQLite (fácil de cambiar a PostgreSQL)
- ✅ Sistema extensible para agregar nuevos endpoints
- ✅ Logs y manejo de errores robusto

## Instalación Rápida

```bash
npm install
npm run start:dev
```

El servidor estará en `http://localhost:3001`

## API Endpoints

### Clientes

- `GET /api/clients` - Lista todos los clientes
- `GET /api/clients/:id` - Obtiene un cliente específico
- `POST /api/clients` - Crea un nuevo cliente
- `PATCH /api/clients/:id` - Actualiza un cliente
- `DELETE /api/clients/:id` - Elimina un cliente

### Endpoints Disponibles

- `GET /api/endpoints` - Lista todos los endpoints disponibles
- `GET /api/endpoints/categories` - Lista las categorías
- `GET /api/endpoints/:id` - Obtiene un endpoint específico

### Dentalink Proxy (por cliente)

- `POST /api/clients/:clientId/appointments` - Crear cita
- `GET /api/clients/:clientId/appointments` - Listar citas
- `GET /api/clients/:clientId/appointments/:appointmentId` - Obtener cita
- `PUT /api/clients/:clientId/appointments/:appointmentId/confirm` - Confirmar cita
- `DELETE /api/clients/:clientId/appointments/:appointmentId` - Cancelar cita
- `GET /api/clients/:clientId/availability` - Ver disponibilidad
- `POST /api/clients/:clientId/test-connection` - Probar conexión

## Estructura del Código

```
src/
├── clients/              # Módulo de clientes
│   ├── entities/        # Entidad Client
│   ├── dto/            # DTOs para validación
│   ├── clients.service.ts
│   ├── clients.controller.ts
│   └── clients.module.ts
│
├── endpoints/           # Módulo de endpoints
│   ├── endpoint-config.ts  # Configuración de endpoints
│   ├── endpoints.service.ts
│   ├── endpoints.controller.ts
│   └── endpoints.module.ts
│
├── dentalink/          # Módulo de integración Dentalink
│   ├── dentalink.service.ts  # Lógica de proxy
│   ├── dentalink.controller.ts
│   └── dentalink.module.ts
│
├── app.module.ts       # Módulo principal
└── main.ts            # Punto de entrada
```

## Configuración

Edita el archivo `.env`:

```env
PORT=3001
NODE_ENV=development
DATABASE_PATH=./database.sqlite
CORS_ORIGIN=http://localhost:3000
DENTALINK_BASE_URL=https://api.dentalink.com/v1
```

## Agregar Nuevos Endpoints

1. Edita `src/endpoints/endpoint-config.ts`
2. Agrega al array `AVAILABLE_ENDPOINTS`:

```typescript
{
  id: 'mi-nuevo-endpoint',
  name: 'Mi Nuevo Endpoint',
  description: 'Descripción',
  method: 'POST',
  path: '/mi-ruta',
  dentalinkPath: '/dentalink-ruta',
  category: 'mi-categoria',
}
```

3. (Opcional) Agrega lógica específica en `src/dentalink/dentalink.controller.ts`

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

```bash
npm run build
npm run start:prod
```

## Tecnologías

- NestJS 10
- TypeORM
- SQLite3 / PostgreSQL
- Class Validator
- Axios


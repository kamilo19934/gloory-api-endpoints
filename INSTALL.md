# Guía de Instalación

Esta guía te ayudará a configurar y ejecutar el proyecto completo.

## Requisitos Previos

- Node.js 18+ instalado
- npm o yarn
- Git (opcional)

## Instalación del Backend (NestJS)

1. Navega al directorio del backend:
```bash
cd backend
```

2. Instala las dependencias:
```bash
npm install
```

3. El archivo `.env` ya está configurado con valores por defecto. Si necesitas cambiar algo, edita este archivo.

4. Inicia el servidor de desarrollo:
```bash
npm run start:dev
```

El backend estará corriendo en `http://localhost:3001`

### Comandos Disponibles del Backend

- `npm run start:dev` - Inicia el servidor en modo desarrollo con hot-reload
- `npm run build` - Compila el proyecto para producción
- `npm run start:prod` - Inicia el servidor en modo producción
- `npm run lint` - Ejecuta el linter

## Instalación del Frontend (Next.js)

1. Abre una nueva terminal y navega al directorio del frontend:
```bash
cd frontend
```

2. Instala las dependencias:
```bash
npm install
```

3. El archivo `.env.local` ya está configurado. Verifica que apunte a tu backend:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

El frontend estará corriendo en `http://localhost:3000`

### Comandos Disponibles del Frontend

- `npm run dev` - Inicia el servidor en modo desarrollo
- `npm run build` - Compila el proyecto para producción
- `npm run start` - Inicia el servidor en modo producción
- `npm run lint` - Ejecuta el linter

## Uso del Sistema

### 1. Crear un Cliente

1. Abre tu navegador en `http://localhost:3000`
2. Haz clic en "Crear Nueva Conexión" o navega a "Clientes" → "Nuevo Cliente"
3. Completa el formulario:
   - **Nombre**: Un nombre descriptivo para tu cliente
   - **API Key**: La API key proporcionada por Dentalink
   - **Descripción** (opcional): Información adicional sobre este cliente

### 2. Ver Endpoints Disponibles

1. Desde la lista de clientes, haz clic en "Ver Endpoints" en cualquier cliente
2. Verás todos los endpoints disponibles con sus URLs completas
3. Cada endpoint muestra:
   - Método HTTP (GET, POST, PUT, DELETE)
   - Descripción
   - Path relativo
   - URL completa lista para usar

### 3. Usar los Endpoints

Las URLs generadas son únicas por cliente y pueden ser usadas directamente en tus aplicaciones:

```bash
# Ejemplo: Crear una cita
curl -X POST http://localhost:3001/api/clients/{clientId}/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "123",
    "date": "2024-01-15",
    "time": "10:00"
  }'

# Ejemplo: Ver disponibilidad
curl http://localhost:3001/api/clients/{clientId}/availability?date=2024-01-15
```

### 4. Probar la Conexión

Desde la página de detalles del cliente, puedes usar el botón "Probar Conexión" para verificar que la API key es válida y que el sistema puede conectarse con Dentalink.

## Estructura del Proyecto

```
gloory-api-endpoints/
├── backend/                    # Backend NestJS
│   ├── src/
│   │   ├── clients/           # Módulo de gestión de clientes
│   │   ├── endpoints/         # Módulo de definición de endpoints
│   │   ├── dentalink/         # Módulo de integración con Dentalink
│   │   ├── app.module.ts      # Módulo principal
│   │   └── main.ts            # Punto de entrada
│   ├── .env                   # Variables de entorno
│   └── package.json
│
└── frontend/                   # Frontend Next.js
    ├── src/
    │   ├── app/               # Páginas de Next.js 14
    │   ├── components/        # Componentes reutilizables
    │   └── lib/              # Utilidades y configuración API
    ├── .env.local            # Variables de entorno
    └── package.json
```

## Agregar Nuevos Endpoints

Para agregar nuevos endpoints al sistema:

1. Abre `backend/src/endpoints/endpoint-config.ts`
2. Agrega una nueva entrada al array `AVAILABLE_ENDPOINTS`:

```typescript
{
  id: 'nuevo-endpoint',
  name: 'Nombre del Endpoint',
  description: 'Descripción de lo que hace',
  method: 'GET', // o POST, PUT, DELETE, PATCH
  path: '/ruta/del/endpoint',
  dentalinkPath: '/ruta/en/dentalink',
  category: 'categoria',
}
```

3. Si necesitas lógica especial, agrega un nuevo método en `backend/src/dentalink/dentalink.controller.ts`

4. Los endpoints se mostrarán automáticamente en el frontend

## Base de Datos

El proyecto usa SQLite por defecto para simplicidad. La base de datos se crea automáticamente en `backend/database.sqlite`.

### Cambiar a PostgreSQL (Producción)

Para usar PostgreSQL en producción:

1. Instala el driver de PostgreSQL:
```bash
cd backend
npm install pg
```

2. Actualiza el archivo `backend/.env`:
```env
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=tu_usuario
DATABASE_PASSWORD=tu_password
DATABASE_NAME=gloory_api
```

3. Actualiza `backend/src/app.module.ts` para usar las variables de entorno de PostgreSQL.

## Solución de Problemas

### El backend no inicia

- Verifica que el puerto 3001 no esté en uso
- Asegúrate de que todas las dependencias estén instaladas (`npm install`)
- Revisa los logs de error en la consola

### El frontend no se conecta al backend

- Verifica que el backend esté corriendo
- Confirma que la URL en `frontend/.env.local` sea correcta
- Revisa la consola del navegador para errores de CORS

### Error al crear un cliente

- Verifica que la API key no esté duplicada
- Asegúrate de completar todos los campos obligatorios

## Producción

### Backend

```bash
cd backend
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend
npm run build
npm run start
```

Considera usar PM2 o Docker para gestionar los procesos en producción.

## Soporte

Para reportar problemas o hacer preguntas, contacta al equipo de desarrollo.


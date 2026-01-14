# Frontend - Gloory API

Interfaz de usuario construida con Next.js 14 para gestionar integraciones con Dentalink.

## Características

- ✅ Dashboard moderno y responsivo
- ✅ Gestión completa de clientes
- ✅ Visualización de endpoints disponibles
- ✅ Copia rápida de URLs
- ✅ Prueba de conexión con Dentalink
- ✅ Notificaciones con toast
- ✅ Diseño con TailwindCSS
- ✅ TypeScript para type safety

## Instalación Rápida

```bash
npm install
npm run dev
```

La aplicación estará en `http://localhost:3000`

## Páginas

- `/` - Página de inicio con información del sistema
- `/clients` - Lista de todos los clientes
- `/clients/new` - Formulario para crear nuevo cliente
- `/clients/[id]` - Detalle del cliente y sus endpoints
- `/clients/[id]/edit` - Editar información del cliente (pendiente)

## Componentes

### Navbar
Barra de navegación principal con links a las secciones principales.

### ClientCard
Tarjeta que muestra información resumida de un cliente con acciones rápidas.

### EndpointCard
Tarjeta que muestra información de un endpoint con opción de copiar URL.

## Configuración

Edita el archivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## API Client

La capa de API se encuentra en `src/lib/api.ts` y proporciona:

- `clientsApi.getAll()` - Obtener todos los clientes
- `clientsApi.getById(id)` - Obtener un cliente
- `clientsApi.create(data)` - Crear cliente
- `clientsApi.update(id, data)` - Actualizar cliente
- `clientsApi.delete(id)` - Eliminar cliente
- `clientsApi.getEndpoints(clientId)` - Obtener endpoints del cliente
- `clientsApi.testConnection(clientId)` - Probar conexión

## Personalización

### Colores

Los colores principales se configuran en `tailwind.config.ts`:

```typescript
colors: {
  primary: {
    // Personaliza los colores aquí
  },
}
```

### Estilos Globales

Los estilos globales están en `src/app/globals.css`.

## Build para Producción

```bash
npm run build
npm run start
```

## Estructura de Archivos

```
src/
├── app/                    # App Router de Next.js 14
│   ├── page.tsx           # Página de inicio
│   ├── layout.tsx         # Layout principal
│   ├── globals.css        # Estilos globales
│   └── clients/           # Rutas de clientes
│       ├── page.tsx       # Lista de clientes
│       ├── new/
│       │   └── page.tsx   # Crear cliente
│       └── [id]/
│           └── page.tsx   # Detalle del cliente
│
├── components/            # Componentes reutilizables
│   ├── Navbar.tsx
│   ├── ClientCard.tsx
│   └── EndpointCard.tsx
│
└── lib/                   # Utilidades
    └── api.ts            # Cliente de API
```

## Tecnologías

- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- Axios
- React Hot Toast
- React Icons


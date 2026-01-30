# Documentación del Frontend - Gloory API

## Resumen General

El frontend de **Gloory API** es una aplicación **Next.js 14** con **TypeScript** que proporciona una interfaz de administración para gestionar integraciones con sistemas de agenda de clínicas dentales/médicas (Dentalink, MediLink, Reservo) y sincronización con GoHighLevel (GHL).

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Next.js** | 14.0.4 | Framework React con App Router |
| **React** | ^18.2.0 | Biblioteca UI |
| **TypeScript** | ^5 | Tipado estático |
| **Tailwind CSS** | ^3.3.0 | Estilos utilitarios |
| **Axios** | ^1.6.0 | Cliente HTTP |
| **react-icons** | ^4.12.0 | Iconografía (Feather Icons) |
| **react-hot-toast** | ^2.4.1 | Notificaciones |

---

## Estructura de Archivos

```
frontend/
├── src/
│   ├── app/                          # App Router (páginas)
│   │   ├── layout.tsx               # Layout raíz
│   │   ├── page.tsx                 # Home page
│   │   ├── globals.css              # Estilos globales
│   │   ├── login/
│   │   │   └── page.tsx             # Página de login
│   │   └── clients/
│   │       ├── page.tsx             # Lista de clientes
│   │       ├── new/
│   │       │   └── page.tsx         # Crear cliente
│   │       └── [id]/
│   │           ├── page.tsx         # Detalle de cliente
│   │           ├── edit/
│   │           │   └── page.tsx     # Editar cliente
│   │           ├── clinic/
│   │           │   └── page.tsx     # Config clínica
│   │           └── confirmations/
│   │               └── page.tsx     # Confirmaciones de citas
│   ├── components/                   # Componentes reutilizables
│   │   ├── AuthProvider.tsx         # Proveedor de autenticación
│   │   ├── Navbar.tsx               # Barra de navegación
│   │   ├── ClientCard.tsx           # Tarjeta de cliente
│   │   ├── EndpointCard.tsx         # Tarjeta de endpoint
│   │   ├── IntegrationSelector.tsx  # Selector de integraciones
│   │   ├── IntegrationBadges.tsx    # Badges de integraciones
│   │   └── GHLIntegrationSection.tsx # Sección GHL (legacy)
│   ├── lib/                          # Utilidades y API
│   │   ├── api.ts                   # Cliente API y tipos
│   │   ├── auth.ts                  # Autenticación
│   │   └── timezones.ts             # Lista de timezones
│   └── middleware.ts                 # Middleware Next.js
├── tailwind.config.ts               # Config Tailwind
├── next.config.js                   # Config Next.js
└── package.json                     # Dependencias
```

---

## Configuración

### Variables de Entorno

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api  # URL del backend
```

### Tema de Colores (Tailwind)

El proyecto usa una paleta de colores `primary` personalizada basada en tonos de azul:

```typescript
// tailwind.config.ts
colors: {
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',  // Color principal
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
}
```

---

## Sistema de Autenticación

### Flujo de Autenticación

1. **Verificación inicial**: `AuthProvider` verifica el token en localStorage
2. **Login**: Credenciales → JWT token → localStorage
3. **Protección de rutas**: Rutas privadas redirigen a `/login`
4. **Logout**: Limpia localStorage y redirige

### Archivos Relevantes

#### `lib/auth.ts`

```typescript
// Funciones principales
getToken(): string | null           // Obtener token
setToken(token: string): void       // Guardar token
isAuthenticated(): boolean          // Verificar autenticación
initAuth(): void                    // Configurar interceptor axios

// API de autenticación
authApi.login(credentials)          // Login
authApi.logout()                    // Logout
authApi.verify()                    // Verificar token
authApi.setup(credentials)          // Setup inicial (primer admin)
authApi.getProfile()                // Obtener perfil
```

#### `components/AuthProvider.tsx`

- Envuelve toda la app
- Verifica autenticación en cada navegación
- Proporciona `useAuth()` hook

```typescript
// Hook useAuth
const { user, isAuthenticated, logout } = useAuth();
```

### Rutas Públicas

```typescript
const publicPaths = ['/login'];
```

---

## Sistema de Rutas

### Páginas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `app/page.tsx` | Home - Dashboard principal |
| `/login` | `app/login/page.tsx` | Login / Setup inicial |
| `/clients` | `app/clients/page.tsx` | Lista de clientes |
| `/clients/new` | `app/clients/new/page.tsx` | Crear nuevo cliente |
| `/clients/[id]` | `app/clients/[id]/page.tsx` | Detalle de cliente |
| `/clients/[id]/edit` | `app/clients/[id]/edit/page.tsx` | Editar cliente |
| `/clients/[id]/clinic` | `app/clients/[id]/clinic/page.tsx` | Configuración clínica |
| `/clients/[id]/confirmations` | `app/clients/[id]/confirmations/page.tsx` | Confirmaciones de citas |

---

## Componentes Principales

### 1. `Navbar.tsx`

Barra de navegación superior con:
- Logo "Gloory API"
- Links: Inicio, Clientes
- Info de usuario autenticado
- Botón de logout

Se oculta en `/login`.

### 2. `ClientCard.tsx`

Tarjeta que muestra información de un cliente:
- Nombre y descripción
- Timezone
- Estado (Activo/Inactivo)
- Integraciones habilitadas (badges)
- API Key (truncada)
- Fecha de creación
- Botones: Ver detalles, Editar, Eliminar

### 3. `EndpointCard.tsx`

Muestra un endpoint de la API:
- Método HTTP (GET, POST, PUT, DELETE) con colores
- Nombre y descripción
- Path del endpoint
- URL completa (con botón copiar)
- Categoría
- Lista de argumentos expandible
- Ejemplo de request body JSON
- Advertencia si requiere configuración

### 4. `IntegrationSelector.tsx`

Selector de integraciones con:
- Lista de integraciones disponibles (cargadas del backend)
- Integraciones HealthAtom (Dentalink, MediLink, Dentalink+MediLink) son **mutuamente excluyentes**
- Formularios dinámicos según campos requeridos/opcionales
- Caché de configuraciones al deseleccionar
- Transferencia de datos comunes entre integraciones HealthAtom

```typescript
// Integraciones mutuamente excluyentes
const HEALTHATOM_INTEGRATIONS = [
  IntegrationType.DENTALINK,
  IntegrationType.MEDILINK,
  IntegrationType.DENTALINK_MEDILINK,
];
```

### 5. `IntegrationBadges.tsx`

Muestra badges de integraciones activas con colores personalizados:
- Dentalink: Azul
- MediLink: Verde
- Dentalink + MediLink: Gradiente azul-verde
- Reservo: Púrpura

### 6. `GHLIntegrationSection.tsx` (Legacy)

Sección de configuración GoHighLevel para formularios legacy:
- Toggle para habilitar/deshabilitar
- Campos: Access Token, Calendar ID, Location ID

---

## API Client (`lib/api.ts`)

### Tipos Principales

```typescript
// Tipos de Integración
enum IntegrationType {
  DENTALINK = 'dentalink',
  MEDILINK = 'medilink',
  DENTALINK_MEDILINK = 'dentalink_medilink',
  RESERVO = 'reservo',
}

// Cliente
interface Client {
  id: string;
  name: string;
  isActive: boolean;
  description?: string;
  timezone: string;
  integrations?: ClientIntegration[];
  // Legacy fields
  apiKey?: string;
  ghlEnabled?: boolean;
  ghlAccessToken?: string;
  ghlCalendarId?: string;
  ghlLocationId?: string;
  confirmationStateId?: number | null;
  contactedStateId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// Endpoint
interface EndpointDefinition {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  dentalinkPath: string;
  category: string;
  clientUrl?: string;
  arguments?: EndpointArgument[];
  requiresConfig?: boolean;
  configField?: string;
}
```

### APIs Disponibles

```typescript
// Integraciones
integrationsApi.getAll()                    // Lista todas las integraciones
integrationsApi.getByType(type)             // Obtener por tipo
integrationsApi.getByCapability(capability) // Por capacidad

// Clientes
clientsApi.getAll()                         // Lista todos
clientsApi.getById(id)                      // Obtener por ID
clientsApi.create(data)                     // Crear
clientsApi.update(id, data)                 // Actualizar
clientsApi.delete(id)                       // Eliminar
clientsApi.getEndpoints(clientId)           // Endpoints del cliente
clientsApi.testConnection(clientId)         // Probar conexión
clientsApi.getIntegrations(clientId)        // Integraciones del cliente
clientsApi.addIntegration(clientId, data)   // Agregar integración
clientsApi.updateIntegration(...)           // Actualizar integración
clientsApi.removeIntegration(...)           // Eliminar integración

// Endpoints
endpointsApi.getAll()                       // Lista todos
endpointsApi.getById(id)                    // Por ID
endpointsApi.getCategories()                // Categorías
endpointsApi.getByCategory(category)        // Por categoría

// Clínica
clinicApi.getBranches(clientId)             // Sucursales
clinicApi.getAllBranches(clientId)          // Todas las sucursales
clinicApi.toggleBranch(...)                 // Activar/desactivar
clinicApi.getProfessionals(clientId)        // Profesionales
clinicApi.toggleProfessional(...)           // Activar/desactivar
clinicApi.updateProfessionalSpecialty(...)  // Actualizar especialidad
clinicApi.getStats(clientId)                // Estadísticas
clinicApi.sync(clientId)                    // Sincronizar con Dentalink

// Confirmaciones de Citas
appointmentConfirmationsApi.getConfigs(clientId)           // Configuraciones
appointmentConfirmationsApi.createConfig(clientId, data)   // Crear config
appointmentConfirmationsApi.updateConfig(...)              // Actualizar
appointmentConfirmationsApi.deleteConfig(...)              // Eliminar
appointmentConfirmationsApi.trigger(clientId, params)      // Disparar
appointmentConfirmationsApi.process(clientId)              // Procesar todas
appointmentConfirmationsApi.processSelected(clientId, ids) // Procesar seleccionadas
appointmentConfirmationsApi.setupGHL(clientId)             // Setup GHL
appointmentConfirmationsApi.validateGHL(clientId)          // Validar GHL
appointmentConfirmationsApi.getPending(clientId)           // Pendientes
appointmentConfirmationsApi.getAppointmentStates(clientId) // Estados de cita
appointmentConfirmationsApi.createBookysConfirmationState(clientId) // Crear estado Bookys
```

---

## Páginas Detalladas

### Home (`/`)

Dashboard principal con:
- Título y descripción
- Botón "Crear Nueva Conexión"
- 3 cards informativos:
  - Gestión de Clientes
  - Endpoints Unificados
  - Seguro y Extensible
- Lista de endpoints disponibles (métodos)
- Link a "Ver todos los clientes"

### Login (`/login`)

Página de login con diseño moderno:
- Fondo con gradiente oscuro
- Card con efecto glassmorphism
- Modo dual: Login / Setup inicial
- Campos: Email, Password (+ Nombre, Apellido en setup)
- Validación de credenciales
- Redirección automática si ya autenticado

### Lista de Clientes (`/clients`)

- Grid de ClientCards
- Botón "Nuevo Cliente"
- Estado vacío con CTA
- Eliminación con confirmación

### Crear Cliente (`/clients/new`)

Formulario en secciones:
1. **Información del Cliente**
   - Nombre (requerido)
   - Descripción (opcional)
   - Zona horaria (select con TIMEZONES)

2. **Selector de Integraciones**
   - IntegrationSelector component
   - Mínimo 1 integración requerida
   - Validación de campos obligatorios

### Detalle de Cliente (`/clients/[id]`)

Vista detallada:
- Info del cliente (nombre, descripción, timezone)
- Estado (activo/inactivo)
- Badge GHL si está integrado
- API Key (truncada)
- Fecha de creación
- Botones:
  - Probar Conexión
  - Configuración Clínica
  - Confirmaciones de Citas
- Grid de EndpointCards con URLs específicas del cliente

### Editar Cliente (`/clients/[id]/edit`)

Similar a crear, pero:
- Pre-carga datos existentes
- Checkbox de estado activo
- Sección de Estados de Cita (confirmationStateId, contactedStateId)
- Advertencia de integraciones a eliminar

### Configuración Clínica (`/clients/[id]/clinic`)

Panel de administración de sucursales y profesionales:
- **Estadísticas**: 6 cards con totales
- **Botón "Actualizar desde Dentalink"**: Sincroniza datos
- **Lista de Sucursales**:
  - Expandible con click
  - Toggle activar/desactivar
  - Profesionales por sucursal
- **Lista de Profesionales**:
  - Cards con info
  - Edición inline de especialidad
  - Toggle activar/desactivar

### Confirmaciones de Citas (`/clients/[id]/confirmations`)

Panel completo de gestión:
1. **Header** con info y recomendaciones
2. **Configuración GHL**: Validar/Configurar custom fields
3. **Estado de Confirmación de Citas**:
   - Select de estado de confirmación
   - Botón "Crear Estado Bookys"
   - Estado de contactado (opcional)
4. **Configuraciones** (máx. 3):
   - Form de creación/edición
   - Lista de configs existentes
   - Campos: nombre, días antes, hora, calendar ID, estados
5. **Citas Pendientes**:
   - Tabla con checkbox de selección
   - Filtros por estado, fecha, status
   - Botones: Obtener Citas, Procesar Seleccionadas
   - Info del paciente, cita, dentista

---

## Utilidades

### Timezones (`lib/timezones.ts`)

Lista predefinida de zonas horarias con:
- value (ej: 'America/Santiago')
- label (ej: '🇨🇱 Santiago (Chile)')
- offset (ej: 'GMT-3/-4')

Default: America/Santiago

### Funciones Helper

```typescript
// En api.ts
getIntegrationDisplayName(type)  // Nombre legible
getIntegrationColor(type)        // Color de badge

// En confirmations/page.tsx
hexToRgb(hex)                    // Convertir hex a RGB
darkenColor(hex, factor)         // Oscurecer color
getContrastTextColor(hex)        // Texto con contraste
getImprovedColors(originalColor) // Colores mejorados para badges
```

---

## Patrones de Código

### Carga de Datos

```typescript
const loadData = useCallback(async () => {
  try {
    setLoading(true);
    const data = await api.getResource();
    setData(data);
  } catch (error) {
    toast.error('Error al cargar los datos');
    console.error(error);
  } finally {
    setLoading(false);
  }
}, [dependency]);

useEffect(() => {
  loadData();
}, [loadData]);
```

### Formularios

```typescript
const [formData, setFormData] = useState({ field: '' });

const handleChange = (e) => {
  setFormData({
    ...formData,
    [e.target.name]: e.target.value,
  });
};

const handleSubmit = async (e) => {
  e.preventDefault();
  // Validación
  // API call
  // Redirección
};
```

### Estados de Loading

```typescript
{loading ? (
  <div className="flex justify-center items-center py-12">
    <FiLoader className="animate-spin text-4xl text-primary-600" />
  </div>
) : (
  // Contenido
)}
```

---

## Estilos y Diseño

### Convenciones de Clases

- Cards: `bg-white rounded-lg shadow-md p-6`
- Botones primarios: `bg-primary-600 hover:bg-primary-700 text-white`
- Botones secundarios: `border border-gray-300 text-gray-700 bg-white hover:bg-gray-50`
- Inputs: `border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200`
- Badges: `px-3 py-1 rounded-full text-xs font-semibold`

### Colores de Métodos HTTP

```typescript
const methodColors = {
  GET: 'bg-blue-100 text-blue-800',
  POST: 'bg-green-100 text-green-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-purple-100 text-purple-800',
};
```

### Colores de Estado

```typescript
const statusColors = {
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
};
```

---

## Notas Importantes

### Compatibilidad Legacy

El sistema mantiene compatibilidad con campos legacy de clientes:
- `apiKey` (ahora en integrations.config)
- `ghlEnabled`, `ghlAccessToken`, `ghlCalendarId`, `ghlLocationId`

Al crear/actualizar clientes con integraciones Dentalink, también se actualizan los campos legacy.

### Integraciones HealthAtom

Las integraciones de sistemas de agenda (Dentalink, MediLink, Dentalink+MediLink) son mutuamente excluyentes. Solo puedes tener una activa a la vez. Al cambiar entre ellas, los datos comunes se transfieren automáticamente.

### Custom Fields GHL

El sistema de confirmaciones requiere 10 custom fields en GoHighLevel:
- `bookys_id_cita`
- `bookys_fecha_cita`
- `bookys_hora_cita`
- `bookys_duracion_cita`
- `bookys_tratamiento`
- `bookys_dentista`
- `bookys_sucursal`
- `bookys_estado_cita`
- `bookys_motivo`
- `bookys_comentarios`

Se pueden crear automáticamente con el botón "Configurar" en la página de confirmaciones.

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev          # Puerto 3000

# Build
npm run build

# Producción
npm run start

# Lint
npm run lint
```

---

## Última actualización

Documentación generada el: **30 de enero de 2026**

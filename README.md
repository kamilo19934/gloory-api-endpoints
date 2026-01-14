# Gloory API Endpoints

Sistema de gestión de integraciones con Dentalink que permite crear clientes con sus propias API keys y gestionar endpoints unificados.

## 🎯 Características Principales

- **Gestión Multi-Cliente**: Crea y gestiona múltiples clientes, cada uno con su propia API key de Dentalink
- **Endpoints Unificados**: Todos los clientes acceden a los mismos endpoints, pero con URLs únicas
- **Proxy Transparente**: El sistema actúa como proxy entre tu aplicación y Dentalink
- **Extensible**: Agregar nuevos endpoints es tan simple como actualizar una configuración
- **Seguro**: Las API keys se mantienen seguras en el backend, nunca expuestas al cliente
- **UI Moderna**: Interfaz intuitiva para gestionar todas las integraciones

## 🏗️ Arquitectura

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │
│   Port: 3000    │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│   Backend       │
│   (NestJS)      │
│   Port: 3001    │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌──────────────┐
│ SQLite │ │  Dentalink   │
│   DB   │ │     API      │
└────────┘ └──────────────┘
```

## 📁 Estructura del Proyecto

```
gloory-api-endpoints/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── clients/     # CRUD de clientes
│   │   ├── endpoints/   # Configuración de endpoints
│   │   ├── dentalink/   # Proxy a Dentalink
│   │   └── ...
│   └── database.sqlite  # Base de datos (generada automáticamente)
│
├── frontend/             # Next.js Application
│   ├── src/
│   │   ├── app/         # Páginas (App Router)
│   │   ├── components/  # Componentes React
│   │   └── lib/         # Cliente API
│   └── ...
│
├── INSTALL.md           # Guía detallada de instalación
├── install.sh           # Script de instalación automática
└── start-dev.sh         # Script para iniciar en desarrollo
```

## 🚀 Instalación Rápida

### Opción 1: Script Automático (Recomendado)

```bash
# Hacer el script ejecutable
chmod +x install.sh

# Ejecutar instalación
./install.sh
```

### Opción 2: Instalación Manual

#### Backend (NestJS)

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

El backend correrá en `http://localhost:3001`

#### Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

El frontend correrá en `http://localhost:3000`

### Opción 3: Usar NPM Scripts desde la raíz

```bash
# Instalar todas las dependencias
npm run install:all

# En terminal 1: Iniciar backend
npm run dev:backend

# En terminal 2: Iniciar frontend
npm run dev:frontend
```

## Flujo de Uso

1. **Crear Cliente**: Crear una nueva integración con:
   - Nombre y API key de Dentalink
   - Timezone personalizado (ej: America/Santiago, America/New_York)
   - Integración opcional con GoHighLevel (GHL)
2. **Ver Dashboard**: Acceder al cliente para ver todos los endpoints disponibles
3. **Usar Endpoints**: Cada cliente tiene URLs únicas que internamente usan su API key
4. **Integración GHL**: Si está habilitada, al crear citas se sincroniza automáticamente con GHL
5. **Agregar Endpoints**: Sistema extensible para agregar nuevos endpoints fácilmente

## Endpoints Disponibles

### Disponibilidad
- **Buscar Disponibilidad**: POST `/api/clients/:clientId/availability`

### Pacientes
- **Buscar Paciente**: POST `/api/clients/:clientId/patients/search`
- **Crear Paciente**: POST `/api/clients/:clientId/patients`
- **Obtener Tratamientos**: POST `/api/clients/:clientId/patients/:rut/treatments`

### Citas
- **Crear Cita**: POST `/api/clients/:clientId/appointments`
- **Cancelar Cita**: POST `/api/clients/:clientId/appointments/cancel`

### Testing
- **Probar Conexión**: POST `/api/clients/:clientId/test-connection`

## 💻 Tecnologías

### Backend
- **Framework**: NestJS 10
- **ORM**: TypeORM
- **Base de Datos**: SQLite (desarrollo) / PostgreSQL (producción)
- **Validación**: Class Validator & Class Transformer
- **HTTP Client**: Axios
- **Lenguaje**: TypeScript

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Estilos**: TailwindCSS
- **HTTP Client**: Axios
- **Notificaciones**: React Hot Toast
- **Iconos**: React Icons
- **Lenguaje**: TypeScript

## 🔧 Características Técnicas

### Backend

#### Gestión de Clientes
- CRUD completo de clientes
- Validación de API keys únicas
- Soft delete opcional
- Timestamps automáticos

#### Sistema de Endpoints
- Configuración centralizada en un archivo
- Soporte para GET, POST, PUT, DELETE, PATCH
- Categorización de endpoints
- URLs dinámicas por cliente

#### Proxy a Dentalink
- Manejo automático de autenticación
- Reenvío de headers
- Manejo de errores robusto
- Logging de requests

### Frontend

#### UI/UX
- Diseño responsive (móvil, tablet, desktop)
- Tema moderno con gradientes
- Feedback visual con toasts
- Loading states
- Confirmaciones de acciones destructivas

#### Gestión de Estado
- useState para estado local
- useEffect para side effects
- React Hot Toast para notificaciones

#### Funcionalidades
- Listar clientes con filtros visuales
- Crear/editar/eliminar clientes
- Ver endpoints disponibles por cliente
- Copiar URLs al clipboard
- Probar conexión con Dentalink
- Navegación intuitiva

## 🎨 Flujo de Datos

```
1. Usuario crea un cliente en el Frontend
   ↓
2. Frontend envía POST /api/clients con nombre y API key
   ↓
3. Backend valida y guarda en la base de datos
   ↓
4. Backend retorna el cliente creado
   ↓
5. Frontend muestra el nuevo cliente
   ↓
6. Usuario accede al dashboard del cliente
   ↓
7. Frontend obtiene endpoints disponibles
   ↓
8. Usuario puede copiar URLs y usarlas
   ↓
9. Cuando se hace una llamada a un endpoint de cliente:
   - Request → Backend
   - Backend obtiene API key del cliente
   - Backend reenvía request a Dentalink con la API key
   - Dentalink procesa y responde
   - Backend reenvía respuesta al cliente
```

## 📚 Documentación Adicional

- [Guía de Instalación Completa](INSTALL.md)
- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)

## 🔐 Seguridad

- Las API keys se almacenan en el backend y nunca se exponen al cliente
- Validación de datos en todos los endpoints
- CORS configurado para permitir solo el frontend
- Uso de variables de entorno para configuración sensible

## 🧪 Testing

```bash
# Backend tests
cd backend
npm run test
npm run test:e2e

# Frontend (agregar tests según necesidad)
cd frontend
npm run test
```

## 📦 Deployment

Ver [INSTALL.md](INSTALL.md) para instrucciones detalladas de deployment en producción.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add some amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.


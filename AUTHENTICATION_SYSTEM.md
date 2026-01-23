# 🔐 Sistema de Autenticación - Gloory API

Este documento describe el sistema de autenticación implementado para proteger la aplicación Gloory API.

## 📋 Índice

- [Resumen](#resumen)
- [Arquitectura](#arquitectura)
- [Backend](#backend)
  - [Estructura de Archivos](#estructura-de-archivos-backend)
  - [Endpoints de Autenticación](#endpoints-de-autenticación)
  - [Modelo de Usuario](#modelo-de-usuario)
  - [Protección de Rutas](#protección-de-rutas)
- [Frontend](#frontend)
  - [Estructura de Archivos](#estructura-de-archivos-frontend)
  - [Flujo de Autenticación](#flujo-de-autenticación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Seguridad](#seguridad)

---

## Resumen

El sistema implementa autenticación basada en **JWT (JSON Web Tokens)** con las siguientes características:

- ✅ Login con email y password
- ✅ Tokens JWT con expiración configurable (default: 7 días)
- ✅ Contraseñas hasheadas con bcrypt
- ✅ Protección global de todas las rutas
- ✅ Setup inicial para crear el primer admin
- ✅ Almacenamiento de token en localStorage
- ✅ Interceptor automático en axios
- ✅ Redirección automática al login

---

## Arquitectura

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────┐
│    Frontend     │         │     Backend     │         │   Database   │
│    (Next.js)    │         │    (NestJS)     │         │  (SQLite/PG) │
└────────┬────────┘         └────────┬────────┘         └──────┬───────┘
         │                           │                         │
         │  POST /api/auth/login     │                         │
         ├──────────────────────────>│  Validate credentials   │
         │  {email, password}        ├────────────────────────>│
         │                           │  <──────────────────────┤
         │  <────────────────────────┤  User found + valid     │
         │  {accessToken, user}      │                         │
         │                           │                         │
         │  Store token in           │                         │
         │  localStorage             │                         │
         │                           │                         │
         │  GET /api/clients         │                         │
         ├──────────────────────────>│  Verify JWT             │
         │  Authorization: Bearer    │  ────────────────────>  │
         │  <────────────────────────┤  Return protected data  │
         │                           │                         │
```

---

## Backend

### Estructura de Archivos Backend

```
backend/src/
├── auth/
│   ├── auth.module.ts              # Módulo principal de autenticación
│   ├── auth.controller.ts          # Controlador con endpoints
│   ├── auth.service.ts             # Lógica de negocio
│   ├── strategies/
│   │   └── jwt.strategy.ts         # Estrategia JWT de Passport
│   ├── guards/
│   │   └── jwt-auth.guard.ts       # Guard para proteger rutas
│   ├── decorators/
│   │   ├── public.decorator.ts     # Decorador @Public()
│   │   └── current-user.decorator.ts # Decorador @CurrentUser()
│   └── dto/
│       └── login.dto.ts            # DTO de login
│
└── users/
    ├── users.module.ts             # Módulo de usuarios
    ├── users.controller.ts         # CRUD de usuarios
    ├── users.service.ts            # Lógica de usuarios
    ├── entities/
    │   └── user.entity.ts          # Entidad User
    └── dto/
        ├── create-user.dto.ts
        └── update-user.dto.ts
```

### Endpoints de Autenticación

| Método | Endpoint | Descripción | Público | Body |
|--------|----------|-------------|---------|------|
| `POST` | `/api/auth/login` | Iniciar sesión | ✅ Sí | `{email, password}` |
| `POST` | `/api/auth/setup` | Crear primer admin | ✅ Sí | `{email, password, firstName, lastName}` |
| `GET` | `/api/auth/profile` | Obtener perfil actual | ❌ No | - |
| `GET` | `/api/auth/verify` | Verificar token válido | ❌ No | - |

#### Ejemplos de Uso

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@gloory.com", "password": "admin123"}'
```

**Respuesta exitosa:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "admin@gloory.com",
    "firstName": "Admin",
    "lastName": "Gloory"
  }
}
```

**Usar token en requests:**
```bash
curl -X GET http://localhost:3001/api/clients \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Modelo de Usuario

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;  // Hasheado con bcrypt

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLogin: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Protección de Rutas

El sistema utiliza un **Guard Global** que protege TODAS las rutas automáticamente.

#### Rutas Públicas

Para hacer una ruta pública, usa el decorador `@Public()`:

```typescript
import { Public } from '../auth/decorators/public.decorator';

@Controller('example')
export class ExampleController {
  
  @Public()  // Esta ruta NO requiere autenticación
  @Get('public-endpoint')
  publicMethod() {
    return 'Accesible sin token';
  }

  @Get('protected-endpoint')  // Requiere token
  protectedMethod() {
    return 'Solo usuarios autenticados';
  }
}
```

#### Obtener Usuario Actual

Usa el decorador `@CurrentUser()` para acceder al usuario autenticado:

```typescript
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('example')
export class ExampleController {
  
  @Get('my-data')
  getMyData(@CurrentUser() user: User) {
    return {
      message: `Hola ${user.firstName}`,
      userId: user.id,
    };
  }
}
```

---

## Frontend

### Estructura de Archivos Frontend

```
frontend/src/
├── lib/
│   └── auth.ts                    # Funciones de autenticación
├── app/
│   ├── login/
│   │   └── page.tsx               # Página de login
│   └── layout.tsx                 # Layout con AuthProvider
├── components/
│   ├── AuthProvider.tsx           # Provider de autenticación
│   └── Navbar.tsx                 # Navbar con usuario y logout
└── middleware.ts                  # Middleware de Next.js
```

### Flujo de Autenticación

```
┌─────────────────────────────────────────────────────────────┐
│                        INICIO                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              ¿Hay token en localStorage?                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼ NO                        ▼ SÍ
┌───────────────────────┐   ┌───────────────────────────────┐
│  Redirigir a /login   │   │  Verificar token con backend  │
└───────────────────────┘   └───────────────┬───────────────┘
                                            │
                              ┌─────────────┴─────────────┐
                              │                           │
                              ▼ INVÁLIDO                  ▼ VÁLIDO
                  ┌───────────────────────┐   ┌───────────────────┐
                  │  Limpiar token        │   │  Mostrar app      │
                  │  Redirigir a /login   │   │  Usuario en navbar│
                  └───────────────────────┘   └───────────────────┘
```

### Funciones Disponibles (auth.ts)

```typescript
// Verificar si hay sesión activa
isAuthenticated(): boolean

// Obtener token almacenado
getToken(): string | null

// Obtener usuario almacenado
getStoredUser(): User | null

// API de autenticación
authApi.login(credentials)    // Login
authApi.logout()              // Logout
authApi.getProfile()          // Obtener perfil
authApi.verify()              // Verificar token
authApi.setup(credentials)    // Setup inicial
```

### Hook useAuth

```typescript
import { useAuth } from '@/components/AuthProvider';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();
  
  return (
    <div>
      {isAuthenticated && (
        <>
          <p>Hola {user.firstName}!</p>
          <button onClick={logout}>Cerrar sesión</button>
        </>
      )}
    </div>
  );
}
```

---

## Configuración

### Variables de Entorno - Backend

Crear archivo `.env` en `/backend`:

```env
# JWT Configuration
JWT_SECRET=tu-secreto-super-seguro-cambiar-en-produccion
JWT_EXPIRES_IN=7d

# Database (ya existente)
DATABASE_TYPE=sqlite
DATABASE_PATH=./database.sqlite
```

> ⚠️ **IMPORTANTE**: En producción, cambia `JWT_SECRET` por un valor seguro y único.

### Dependencias Instaladas

**Backend:**
```json
{
  "@nestjs/jwt": "^10.x",
  "@nestjs/passport": "^10.x",
  "passport": "^0.7.x",
  "passport-jwt": "^4.x",
  "passport-local": "^1.x",
  "bcrypt": "^5.x"
}
```

---

## Uso

### Primera Vez (Setup Inicial)

1. Navega a `http://localhost:3000`
2. Serás redirigido a `/login`
3. Click en **"¿Primera vez? Configura el admin inicial"**
4. Completa el formulario con tus datos
5. El admin se crea y automáticamente inicias sesión

### Login Normal

1. Navega a `http://localhost:3000/login`
2. Ingresa email y contraseña
3. Click en **"Iniciar Sesión"**
4. Serás redirigido al dashboard

### Crear Más Usuarios

Solo admins autenticados pueden crear usuarios:

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "email": "nuevo@usuario.com",
    "password": "password123",
    "firstName": "Nuevo",
    "lastName": "Usuario"
  }'
```

---

## Seguridad

### Medidas Implementadas

| Medida | Descripción |
|--------|-------------|
| **Bcrypt** | Contraseñas hasheadas con salt de 10 rounds |
| **JWT** | Tokens firmados con secreto configurable |
| **Expiración** | Tokens expiran después de 7 días (configurable) |
| **Guard Global** | Todas las rutas protegidas por defecto |
| **Validación** | DTOs con class-validator |
| **CORS** | Configurado para orígenes específicos |

### Recomendaciones para Producción

1. **Cambiar JWT_SECRET**: Usar un valor aleatorio de al menos 32 caracteres
2. **HTTPS**: Siempre usar HTTPS en producción
3. **Expiración más corta**: Considerar tokens de 1-24 horas
4. **Rate Limiting**: Agregar límite de intentos de login
5. **Logs de auditoría**: Registrar accesos y cambios

---

## Credenciales de Prueba

```
Email:     admin@gloory.com
Password:  admin123
```

> ⚠️ Cambiar estas credenciales en producción.

---

## Troubleshooting

### "No autorizado" en todas las rutas

- Verificar que el token se está enviando en el header `Authorization: Bearer TOKEN`
- Verificar que el token no ha expirado
- Verificar que `JWT_SECRET` es el mismo en todas las instancias

### "Ya existe al menos un usuario"

- El endpoint `/api/auth/setup` solo funciona cuando no hay usuarios
- Usar login normal o crear usuarios desde `/api/users`

### Token no persiste después de refresh

- Verificar que `localStorage` está habilitado en el navegador
- Verificar que no hay errores en la consola del navegador

---

*Documentación generada el 22 de enero de 2026*

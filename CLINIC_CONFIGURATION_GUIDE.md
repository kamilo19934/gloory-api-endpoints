# Guía de Configuración de Clínica

Este documento explica en detalle el funcionamiento del módulo de configuración de clínica, tanto en el backend como en el frontend.

## 📋 Índice

1. [Visión General](#visión-general)
2. [Modelo de Datos](#modelo-de-datos)
3. [Backend](#backend)
4. [Frontend](#frontend)
5. [Sincronización con Dentalink](#sincronización-con-dentalink)
6. [Sistema de Estados](#sistema-de-estados)
7. [API Endpoints](#api-endpoints)
8. [Flujo de Uso](#flujo-de-uso)

---

## Visión General

El módulo de configuración de clínica permite gestionar **sucursales** y **profesionales** (dentistas) de una clínica dental. Los datos se sincronizan desde Dentalink y se almacenan localmente en caché para:

- **Mejorar el rendimiento**: Evitar llamadas constantes a la API de Dentalink
- **Permitir personalización local**: Activar/desactivar sucursales y profesionales sin afectar Dentalink
- **Facilitar la gestión**: Editar especialidades y controlar qué elementos están disponibles para los agentes IA

### Arquitectura del Sistema

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   Dentalink     │
│   (Next.js)     │◀────│   (NestJS)      │◀────│   (API)         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Base de Datos │
                        │   (SQLite/PG)   │
                        └─────────────────┘
```

---

## Modelo de Datos

### Entidad: Branch (Sucursal)

Ubicación: `backend/src/clinic/entities/branch.entity.ts`

```typescript
@Entity('branches')
@Index(['clientId', 'dentalinkId'], { unique: true })
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;                    // ID interno UUID

  @Column()
  clientId: string;              // Referencia al cliente

  @Column()
  dentalinkId: number;           // ID de Dentalink (original)

  @Column()
  nombre: string;                // Nombre de la sucursal

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  ciudad: string;

  @Column({ nullable: true })
  comuna: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ default: true })
  habilitada: boolean;           // Estado en Dentalink

  @Column({ default: true })
  activa: boolean;               // Estado local (toggle del usuario)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Campos clave:**
- `dentalinkId`: ID original de Dentalink para mantener la referencia
- `habilitada`: Estado sincronizado desde Dentalink (no modificable localmente)
- `activa`: Estado controlado por el usuario para mostrar/ocultar en búsquedas

### Entidad: Professional (Profesional)

Ubicación: `backend/src/clinic/entities/professional.entity.ts`

```typescript
@Entity('professionals')
@Index(['clientId', 'dentalinkId'], { unique: true })
export class Professional {
  @PrimaryGeneratedColumn('uuid')
  id: string;                    // ID interno UUID

  @Column()
  clientId: string;              // Referencia al cliente

  @Column()
  dentalinkId: number;           // ID de Dentalink (original)

  @Column({ nullable: true })
  rut: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  apellidos: string;

  @Column({ nullable: true })
  celular: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  ciudad: string;

  @Column({ nullable: true })
  comuna: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  idEspecialidad: number;

  @Column({ nullable: true })
  especialidad: string;          // Editable localmente

  @Column({ default: false })
  agendaOnline: boolean;         // Si tiene agenda online activa

  @Column({ nullable: true })
  intervalo: number;             // Minutos entre citas

  @Column({ default: true })
  habilitado: boolean;           // Estado en Dentalink

  @Column({ default: true })
  activo: boolean;               // Estado local (toggle del usuario)

  @Column({ type: 'simple-json', nullable: true })
  contratosSucursal: number[];   // IDs de sucursales con contrato

  @Column({ type: 'simple-json', nullable: true })
  horariosSucursal: number[];    // IDs de sucursales con horario
}
```

**Campos clave:**
- `agendaOnline`: Solo los profesionales con agenda online son visibles en el panel
- `contratosSucursal` y `horariosSucursal`: Arrays que determinan en qué sucursales trabaja
- `especialidad`: Puede ser editada localmente para personalizar
- `activo`: Toggle local para mostrar/ocultar en búsquedas

---

## Backend

### Módulo de Clínica

Ubicación: `backend/src/clinic/clinic.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, Professional]),
    ClientsModule,
  ],
  controllers: [ClinicController],
  providers: [ClinicService],
  exports: [ClinicService],
})
export class ClinicModule {}
```

### Servicio (ClinicService)

Ubicación: `backend/src/clinic/clinic.service.ts`

El servicio contiene toda la lógica de negocio:

#### Métodos de Consulta

| Método | Descripción |
|--------|-------------|
| `getBranches(clientId)` | Obtiene todas las sucursales de un cliente |
| `getActiveBranches(clientId)` | Solo sucursales habilitadas Y activas |
| `getAllBranches(clientId)` | Todas las sucursales habilitadas (para admin) |
| `getProfessionals(clientId)` | Obtiene todos los profesionales |
| `getActiveProfessionals(clientId)` | Solo profesionales habilitados Y activos |
| `getAllProfessionals(clientId)` | Todos los profesionales con agenda online (para admin) |
| `getProfessionalsByBranch(clientId, branchId)` | Profesionales de una sucursal específica |
| `getProfessionalsBySpecialty(clientId, especialidad)` | Filtrado por especialidad |

#### Métodos de Modificación Local

| Método | Descripción |
|--------|-------------|
| `toggleBranch(clientId, branchId, activa)` | Activa/desactiva una sucursal localmente |
| `toggleProfessional(clientId, professionalId, activo)` | Activa/desactiva un profesional localmente |
| `updateProfessionalSpecialty(clientId, professionalId, especialidad)` | Actualiza la especialidad |

#### Métodos de Sincronización

| Método | Descripción |
|--------|-------------|
| `syncFromDentalink(clientId, force)` | Sincroniza datos desde Dentalink |
| `clearClinicData(clientId)` | Elimina todos los datos del cliente |
| `hasSyncedData(clientId)` | Verifica si hay datos sincronizados |
| `getSyncStats(clientId)` | Obtiene estadísticas de sincronización |

### Controlador (ClinicController)

Ubicación: `backend/src/clinic/clinic.controller.ts`

El controlador expone los endpoints REST y transforma los datos a formatos limpios.

#### Transformación de Datos

El controlador incluye métodos privados para transformar entidades a respuestas limpias:

```typescript
// Transforma sucursal para respuesta
private transformBranch(branch: Branch, includeStatus = false): BranchResponse

// Transforma profesional para respuesta
private transformProfessional(prof: Professional, includeStatus = false): ProfessionalResponse
```

**Importante:** El parámetro `includeStatus` controla si se incluyen los campos `habilitada/activa` y `habilitado/activo` en la respuesta:

- **Para agentes IA**: `includeStatus = false` (datos limpios, sin estados)
- **Para panel admin**: `includeStatus = true` (incluye estados para gestión)

---

## Frontend

### Página de Configuración de Clínica

Ubicación: `frontend/src/app/clients/[id]/clinic/page.tsx`

Esta página permite gestionar sucursales y profesionales de un cliente.

#### Estado del Componente

```typescript
const [client, setClient] = useState<Client | null>(null);
const [branches, setBranches] = useState<Branch[]>([]);
const [professionals, setProfessionals] = useState<Professional[]>([]);
const [stats, setStats] = useState<ClinicStats | null>(null);
const [loading, setLoading] = useState(true);
const [syncing, setSyncing] = useState(false);
const [expandedBranch, setExpandedBranch] = useState<number | null>(null);
const [branchProfessionals, setBranchProfessionals] = useState<{ [key: number]: Professional[] }>({});
const [loadingBranch, setLoadingBranch] = useState<number | null>(null);
```

#### Funcionalidades Principales

1. **Carga de Datos**
   ```typescript
   const loadData = useCallback(async () => {
     const [clientData, branchesData, professionalsData, statsData] = await Promise.all([
       clientsApi.getById(clientId),
       clinicApi.getAllBranches(clientId),      // Incluye desactivadas
       clinicApi.getAllProfessionals(clientId), // Incluye desactivados
       clinicApi.getStats(clientId),
     ]);
     // ...
   }, [clientId]);
   ```

2. **Sincronización con Dentalink**
   ```typescript
   const handleSync = async () => {
     const result = await clinicApi.sync(clientId);
     toast.success(result.mensaje);
     await loadData();
   };
   ```

3. **Toggle de Sucursal**
   ```typescript
   const handleToggleBranch = async (branch: Branch) => {
     const newStatus = !(branch.activa ?? true);
     await clinicApi.toggleBranch(clientId, branch.id, newStatus);
     // Actualizar estado local y recargar stats
   };
   ```

4. **Toggle de Profesional**
   ```typescript
   const handleToggleProfessional = async (professional: Professional) => {
     const newStatus = !(professional.activo ?? true);
     await clinicApi.toggleProfessional(clientId, professional.id, newStatus);
     // Actualizar en lista principal y listas por sucursal
   };
   ```

5. **Edición de Especialidad**
   ```typescript
   const handleSpecialtyUpdate = async (professional: Professional, newSpecialty: string) => {
     await clinicApi.updateProfessionalSpecialty(clientId, professional.id.toString(), newSpecialty);
     // Actualizar en todas las listas
   };
   ```

#### Componente ProfessionalCard

Componente reutilizable para mostrar información de un profesional:

```typescript
function ProfessionalCard({
  professional,
  showBranches = false,
  onUpdateSpecialty,
  onToggle,
}: {
  professional: Professional;
  showBranches?: boolean;
  onUpdateSpecialty: (professional: Professional, newSpecialty: string) => Promise<void>;
  onToggle: (professional: Professional) => Promise<void>;
})
```

**Características:**
- Muestra nombre, especialidad e intervalo
- Permite edición inline de especialidad
- Toggle de activación/desactivación
- Opcionalmente muestra las sucursales donde trabaja
- Indicador visual de estado (opacidad reducida si desactivado)

### API del Frontend

Ubicación: `frontend/src/lib/api.ts`

#### Tipos de Datos

```typescript
export interface Branch {
  id: number;
  nombre: string;
  telefono?: string;
  ciudad?: string;
  comuna?: string;
  direccion?: string;
  habilitada?: boolean;  // Solo presente en panel admin
  activa?: boolean;      // Solo presente en panel admin
}

export interface Professional {
  id: number;
  rut?: string;
  nombre: string;
  apellidos?: string;
  especialidad?: string;
  intervalo?: number;
  sucursales: number[];
  habilitado?: boolean;  // Solo presente en panel admin
  activo?: boolean;      // Solo presente en panel admin
}

export interface ClinicStats {
  totalSucursales: number;
  totalProfesionales: number;
  sucursalesHabilitadas: number;
  profesionalesHabilitados: number;
  sucursalesActivas: number;
  profesionalesActivos: number;
}
```

#### Funciones de la API

```typescript
export const clinicApi = {
  // Sucursales
  getBranches: async (clientId, includeInactive = false),
  getAllBranches: async (clientId),
  getBranchById: async (clientId, branchId),
  toggleBranch: async (clientId, branchDentalinkId, activa),

  // Profesionales
  getProfessionals: async (clientId, includeInactive = false),
  getAllProfessionals: async (clientId),
  getProfessionalById: async (clientId, professionalId),
  toggleProfessional: async (clientId, professionalDentalinkId, activo),
  getProfessionalsByBranch: async (clientId, branchDentalinkId, includeInactive = false),
  updateProfessionalSpecialty: async (clientId, professionalDentalinkId, especialidad),

  // Especialidades
  getSpecialties: async (clientId),
  getProfessionalsBySpecialty: async (clientId, especialidad, id_sucursal?),

  // Estadísticas y sincronización
  getStats: async (clientId),
  sync: async (clientId, force?),
};
```

---

## Sincronización con Dentalink

### Proceso de Sincronización

El método `syncFromDentalink` realiza los siguientes pasos:

```
1. Verificar si es sincronización forzada
   └── Si force=true, eliminar datos existentes

2. Obtener API Key del cliente

3. Sincronizar Sucursales (con paginación)
   ├── GET /sucursales/ desde Dentalink
   ├── Manejar paginación automáticamente
   ├── Para cada sucursal:
   │   ├── Verificar si ya existe (por clientId + dentalinkId)
   │   └── Si no existe, crear nueva
   └── Registrar sucursales nuevas

4. Sincronizar Profesionales (con paginación)
   ├── GET /dentistas/ desde Dentalink
   ├── Manejar paginación automáticamente (hasta 50 páginas)
   ├── Para cada dentista:
   │   ├── Verificar si ya existe
   │   ├── Parsear arrays de sucursales (contratos/horarios)
   │   └── Si no existe, crear nuevo
   └── Registrar profesionales nuevos

5. Retornar resultado con totales de la API
   └── { sucursalesNuevas, profesionalesNuevos, totalSucursalesAPI, totalProfesionalesAPI, mensaje }
```

### Manejo de Paginación

El sistema maneja automáticamente la paginación de la API de Dentalink para clientes con muchos profesionales:

```typescript
// Método auxiliar para paginación
private async fetchAllPaginated<T>(
  baseUrl: string,
  headers: Record<string, string>,
  entityName: string,
): Promise<T[]>
```

**Características de la paginación:**
- Detecta automáticamente el link `next` en la respuesta
- Soporta dos formatos de paginación:
  - Array de links: `[{ rel: 'next', href: '...' }]`
  - Objeto de links: `{ next: '...' }`
- Límite de seguridad: máximo 50 páginas para evitar loops infinitos
- Logging detallado de cada página obtenida

### Optimización: Bulk Insert

Para clientes con muchos profesionales (500+), el sistema usa **bulk insert optimizado**:

```
ANTES (lento):
  Para cada dentista:
    1. SELECT si existe     → 500+ queries
    2. INSERT si es nuevo   → 500+ queries
  Total: ~1,000+ queries = 30-60 segundos

AHORA (rápido):
  1. SELECT todos los IDs existentes → 1 query
  2. Filtrar nuevos en memoria (JavaScript)
  3. BULK INSERT en lotes de 100 → 5-10 queries
  Total: ~10 queries = 1-3 segundos
```

**Características del bulk insert:**
- Tamaño de lote: 100 registros por insert
- Verificación de existentes en una sola query
- Filtrado en memoria (muy rápido)
- Preserva datos locales (especialidades editadas, estados de activación)
- Logging del progreso por lotes

### Comportamiento de Sincronización

| Escenario | Comportamiento |
|-----------|---------------|
| **Sincronización normal** | Solo agrega nuevos registros, no modifica existentes |
| **Sincronización forzada** | Elimina todos los datos y sincroniza desde cero |
| **Datos duplicados** | Se ignoran (verificación por `clientId + dentalinkId`) |
| **Muchos profesionales** | Se manejan automáticamente con paginación |

### Ejemplo de Datos Sincronizados

```json
// Respuesta de sincronización
{
  "sucursalesNuevas": 3,
  "profesionalesNuevos": 45,
  "totalSucursalesAPI": 5,
  "totalProfesionalesAPI": 120,
  "mensaje": "Sincronización completada: 3 sucursales y 45 profesionales nuevos (de 5 sucursales y 120 profesionales en API)"
}
```

### Logs de Sincronización

Durante la sincronización, el sistema genera logs detallados:

```
🔄 Iniciando sincronización para cliente abc123
📍 Obteniendo sucursales de Dentalink (con paginación)...
📄 Sucursales: Obteniendo página 1...
📄 Sucursales: Página 1 tiene 5 registros
✅ Sucursales: Total obtenido: 5 registros en 1 página(s)
👨‍⚕️ Obteniendo profesionales de Dentalink (con paginación)...
📄 Profesionales: Obteniendo página 1...
📄 Profesionales: Página 1 tiene 50 registros
📄 Profesionales: Obteniendo página 2...
📄 Profesionales: Página 2 tiene 50 registros
📄 Profesionales: Obteniendo página 3...
📄 Profesionales: Página 3 tiene 20 registros
✅ Profesionales: Total obtenido: 120 registros en 3 página(s)
```

---

## Sistema de Estados

### Doble Sistema de Estados

Cada entidad tiene dos tipos de estados:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE ESTADOS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ESTADO DENTALINK           ESTADO LOCAL                       │
│  ───────────────            ────────────                       │
│  • habilitada/habilitado    • activa/activo                    │
│  • Sincronizado desde API   • Controlado por usuario           │
│  • NO modificable           • Modificable via toggle           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Lógica de Visibilidad

**Para Agentes IA** (endpoints sin `/all`):
- Sucursales: `habilitada = true AND activa = true`
- Profesionales: `habilitado = true AND agendaOnline = true AND activo = true`

**Para Panel Admin** (endpoints con `/all`):
- Sucursales: `habilitada = true` (todas las habilitadas en Dentalink)
- Profesionales: `habilitado = true AND agendaOnline = true` (todos con agenda online)

### Estadísticas de Estados

```typescript
interface ClinicStats {
  totalSucursales: number;        // Todas las sincronizadas
  totalProfesionales: number;     // Todos los sincronizados
  sucursalesHabilitadas: number;  // habilitada = true
  profesionalesHabilitados: number; // habilitado = true AND agendaOnline = true
  sucursalesActivas: number;      // habilitada = true AND activa = true
  profesionalesActivos: number;   // habilitado = true AND agendaOnline = true AND activo = true
}
```

---

## API Endpoints

### Ruta Base

```
/clients/:clientId/clinic
```

### Endpoints de Sucursales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/branches` | Sucursales activas (para agentes IA) |
| `GET` | `/branches/all` | Todas las sucursales habilitadas (para admin) |
| `GET` | `/branches/:branchId` | Una sucursal específica |
| `PATCH` | `/branches/:branchId/toggle` | Activar/desactivar sucursal |
| `POST` | `/branches/professionals` | Profesionales de una sucursal |

### Endpoints de Profesionales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/professionals` | Profesionales activos (para agentes IA) |
| `GET` | `/professionals/all` | Todos los profesionales (para admin) |
| `GET` | `/professionals/:professionalId` | Un profesional específico |
| `PATCH` | `/professionals/:professionalId` | Actualizar especialidad |
| `PATCH` | `/professionals/:professionalId/toggle` | Activar/desactivar profesional |

### Endpoints de Especialidades

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/specialties` | Lista de especialidades únicas |
| `POST` | `/specialties/professionals` | Profesionales por especialidad |

### Endpoints de Sincronización

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/stats` | Estadísticas de sincronización |
| `POST` | `/sync` | Sincronizar desde Dentalink |

### Ejemplos de Uso

#### Obtener todas las sucursales (para admin)
```bash
GET /clients/abc123/clinic/branches/all

# Respuesta
[
  {
    "id": 1,
    "nombre": "Sucursal Centro",
    "direccion": "Calle Principal 123",
    "ciudad": "Santiago",
    "habilitada": true,
    "activa": true
  },
  {
    "id": 2,
    "nombre": "Sucursal Norte",
    "direccion": "Av. Norte 456",
    "habilitada": true,
    "activa": false  // Desactivada por el usuario
  }
]
```

#### Desactivar una sucursal
```bash
PATCH /clients/abc123/clinic/branches/1/toggle
Content-Type: application/json

{ "activa": false }

# Respuesta
{
  "id": 1,
  "nombre": "Sucursal Centro",
  "habilitada": true,
  "activa": false
}
```

#### Obtener profesionales de una sucursal
```bash
POST /clients/abc123/clinic/branches/professionals
Content-Type: application/json

{
  "id_sucursal": 1,
  "includeInactive": true
}

# Respuesta
[
  {
    "id": 10,
    "nombre": "Dr. Juan",
    "apellidos": "Pérez",
    "especialidad": "Ortodoncia",
    "sucursales": [1, 2],
    "habilitado": true,
    "activo": true
  }
]
```

#### Sincronizar desde Dentalink
```bash
POST /clients/abc123/clinic/sync
Content-Type: application/json

{ "force": false }

# Respuesta
{
  "sucursalesNuevas": 0,
  "profesionalesNuevos": 2,
  "mensaje": "Sincronización completada: 0 sucursales y 2 profesionales nuevos"
}
```

---

## Flujo de Uso

### Configuración Inicial

```
1. Usuario crea un nuevo cliente con API Key de Dentalink

2. Usuario accede a "Configuración Clínica"
   └── Sistema detecta que no hay datos sincronizados

3. Usuario hace clic en "Actualizar desde Dentalink"
   └── Sistema sincroniza sucursales y profesionales

4. Usuario ve el panel con:
   ├── Estadísticas (totales, habilitados, activos)
   ├── Lista de sucursales con toggle
   └── Lista de profesionales con toggle y edición de especialidad
```

### Gestión Diaria

```
1. Administrador accede al panel de clínica

2. Para desactivar una sucursal temporalmente:
   └── Click en toggle de la sucursal → pasa a desactivada

3. Para desactivar un profesional:
   └── Click en toggle del profesional → pasa a desactivado

4. Para editar especialidad:
   └── Click en ícono de edición → escribir nueva especialidad → guardar

5. Los agentes IA solo ven elementos activos
```

### Actualización de Datos

```
1. Usuario detecta que hay nuevos profesionales en Dentalink

2. Click en "Actualizar desde Dentalink"
   └── Solo se agregan nuevos registros, no se modifican existentes

3. Para resincronizar completamente:
   └── Usar sincronización forzada (elimina y vuelve a cargar todo)
   └── NOTA: Se perderán los estados locales (activa/activo)
```

---

## Consideraciones Técnicas

### Índices de Base de Datos

Cada entidad tiene un índice único compuesto:

```typescript
@Index(['clientId', 'dentalinkId'], { unique: true })
```

Esto garantiza que no existan duplicados para un mismo cliente.

### Relación con Clientes

Las entidades usan `onDelete: 'CASCADE'`, lo que significa que al eliminar un cliente, se eliminan automáticamente sus sucursales y profesionales.

### Manejo de Nulls

El controlador filtra campos null en las respuestas para mantenerlas limpias:

```typescript
if (branch.telefono) response.telefono = branch.telefono;
if (branch.ciudad) response.ciudad = branch.ciudad;
// ... solo se agregan si tienen valor
```

### Filtrado de Profesionales por Sucursal

La relación profesional-sucursal se determina por dos arrays:

```typescript
// Un profesional trabaja en una sucursal si:
const tieneContrato = prof.contratosSucursal?.includes(branchDentalinkId);
const tieneHorario = prof.horariosSucursal?.includes(branchDentalinkId);
return tieneContrato || tieneHorario;
```

---

## Troubleshooting

### Problema: No aparecen profesionales

**Causas posibles:**
1. El profesional no tiene `agendaOnline = true` en Dentalink
2. El profesional está desactivado localmente (`activo = false`)
3. La sucursal donde trabaja está desactivada

**Solución:**
- Verificar en el panel admin (endpoint `/all`)
- Activar el profesional con el toggle

### Problema: La sincronización no trae nuevos datos

**Causas posibles:**
1. Los datos ya existen (sincronización solo agrega nuevos)
2. Error de conexión con Dentalink

**Solución:**
- Usar sincronización forzada para resincronizar todo
- Verificar la API Key del cliente

### Problema: No se cargan todos los profesionales

**Causas posibles:**
1. La API de Dentalink devuelve datos paginados
2. Anteriormente el sistema no manejaba paginación

**Solución:**
- El sistema ahora maneja paginación automáticamente
- Realizar una sincronización forzada para obtener todos los profesionales
- Verificar en los logs que se están obteniendo múltiples páginas
- Comparar `totalProfesionalesAPI` en la respuesta con lo que muestra el panel

**Verificación:**
```bash
# La respuesta ahora incluye totales de la API
{
  "totalProfesionalesAPI": 120,  // Total en Dentalink
  "profesionalesNuevos": 45      // Nuevos sincronizados
}
```

### Problema: Especialidades vacías

**Causa:** Dentalink no tiene configuradas las especialidades

**Solución:**
- Editar manualmente la especialidad desde el panel
- La especialidad se guarda localmente

### Problema: Sincronización muy lenta

**Causa anterior:** El sistema hacía queries individuales para cada profesional

**Solución implementada:**
- Ahora usa **bulk insert** optimizado
- Verifica existentes en una sola query
- Inserta en lotes de 100 registros
- 500 profesionales ahora toman ~1-3 segundos en lugar de 30-60 segundos

**Logs de ejemplo con bulk insert:**
```
👨‍⚕️ Total de profesionales obtenidos de Dentalink: 523
👨‍⚕️ Profesionales existentes en BD: 0
👨‍⚕️ Profesionales nuevos a insertar: 523
👨‍⚕️ Insertados 100/523 profesionales
👨‍⚕️ Insertados 200/523 profesionales
👨‍⚕️ Insertados 300/523 profesionales
👨‍⚕️ Insertados 400/523 profesionales
👨‍⚕️ Insertados 500/523 profesionales
👨‍⚕️ Insertados 523/523 profesionales
✅ 523 profesionales nuevos agregados
```

---

## Resumen

El módulo de configuración de clínica proporciona:

✅ **Sincronización** automática desde Dentalink  
✅ **Caché local** para mejor rendimiento  
✅ **Control granular** de visibilidad (toggles)  
✅ **Edición** de especialidades sin afectar Dentalink  
✅ **Estadísticas** detalladas de estados  
✅ **API dual**: endpoints para agentes IA y panel admin  
✅ **Relaciones** profesional-sucursal automáticas

# 🐘 Migración de SQLite a PostgreSQL

## ¿Por qué PostgreSQL en Producción?

### ❌ Problemas de SQLite en Producción

1. **Pérdida de Datos en la Nube**
   - SQLite guarda datos en un archivo local (`database.sqlite`)
   - En Railway/Render, cuando el contenedor se reinicia, **pierdes todos los datos**
   - No hay persistencia entre despliegues

2. **Concurrencia Limitada**
   - SQLite bloquea toda la base de datos al escribir
   - Con múltiples usuarios simultáneos, se generan errores de "database is locked"
   - No es adecuado para aplicaciones con tráfico

3. **Sin Escalabilidad**
   - No puedes tener múltiples instancias del backend
   - No soporta réplicas ni alta disponibilidad

4. **Sin Backups Automáticos**
   - Tienes que hacer backups manuales del archivo
   - Si el servidor falla, pierdes todo

### ✅ Ventajas de PostgreSQL

1. **Persistencia Garantizada**
   - Los datos se guardan en un servicio separado
   - Sobrevive a reinicios y despliegues
   - Backups automáticos en Railway/Render

2. **Alta Concurrencia**
   - Soporta miles de conexiones simultáneas
   - Transacciones ACID completas
   - Perfecto para producción

3. **Escalable**
   - Puedes tener múltiples instancias del backend
   - Soporta réplicas de lectura
   - Alta disponibilidad

4. **Características Avanzadas**
   - Índices avanzados
   - Full-text search
   - JSON nativo
   - Funciones personalizadas

---

## 🚀 Migración en Railway

### Paso 1: Agregar PostgreSQL en Railway

1. En tu proyecto de Railway, click en **"+ New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway creará automáticamente las variables de entorno:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

### Paso 2: Actualizar Variables de Entorno

En tu servicio del backend, actualiza:

```env
# Cambiar de SQLite a PostgreSQL
DATABASE_TYPE=postgres
DATABASE_HOST=${PGHOST}
DATABASE_PORT=${PGPORT}
DATABASE_USERNAME=${PGUSER}
DATABASE_PASSWORD=${PGPASSWORD}
DATABASE_NAME=${PGDATABASE}

# O usar la URL completa (Railway la genera automáticamente)
DATABASE_URL=${DATABASE_URL}
```

### Paso 3: Actualizar Código del Backend

El código ya está preparado para PostgreSQL. Solo necesitas actualizar `app.module.ts`:

```typescript
TypeOrmModule.forRoot({
  type: process.env.DATABASE_TYPE === 'postgres' ? 'postgres' : 'sqlite',
  ...(process.env.DATABASE_TYPE === 'postgres'
    ? {
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        // O usar DATABASE_URL directamente:
        // url: process.env.DATABASE_URL,
      }
    : {
        database: process.env.DATABASE_PATH || './database.sqlite',
      }),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production', // false en producción
  logging: false,
}),
```

---

## 🚀 Migración en Render

### Paso 1: Crear Base de Datos PostgreSQL

1. En Render Dashboard, click en **"New"** → **"PostgreSQL"**
2. Configura:
   - **Name**: `gloory-db`
   - **Database**: `gloory_db`
   - **User**: `gloory_user`
   - **Region**: Elige la más cercana
3. Render te dará una **Internal Database URL** y una **External Database URL**

### Paso 2: Configurar Variables de Entorno

En tu servicio del backend, agrega:

```env
DATABASE_TYPE=postgres
DATABASE_URL=${DATABASE_URL}  # Render la genera automáticamente
```

O manualmente:

```env
DATABASE_TYPE=postgres
DATABASE_HOST=tu-host.render.com
DATABASE_PORT=5432
DATABASE_USERNAME=gloory_user
DATABASE_PASSWORD=tu-password
DATABASE_NAME=gloory_db
```

---

## 📝 Actualizar app.module.ts

Aquí está el código actualizado que soporta ambos:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// ... otros imports

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: (process.env.DATABASE_TYPE || 'sqlite') as any,
      ...(process.env.DATABASE_TYPE === 'postgres'
        ? {
            // PostgreSQL configuration
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            username: process.env.DATABASE_USERNAME,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            // O usar DATABASE_URL si está disponible
            ...(process.env.DATABASE_URL && {
              url: process.env.DATABASE_URL,
            }),
          }
        : {
            // SQLite configuration (desarrollo)
            database: process.env.DATABASE_PATH || './database.sqlite',
          }),
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production', // ⚠️ false en producción
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    // ... otros módulos
  ],
})
export class AppModule {}
```

---

## ⚠️ Importante: Migración de Datos

Si ya tienes datos en SQLite y quieres migrarlos:

### Opción 1: Empezar desde Cero (Recomendado para desarrollo)
- Simplemente crea nuevos clientes en PostgreSQL
- Los datos de desarrollo no son críticos

### Opción 2: Migración Manual
1. Exporta datos de SQLite:
   ```bash
   sqlite3 database.sqlite .dump > backup.sql
   ```
2. Convierte el SQL a formato PostgreSQL
3. Importa en PostgreSQL

### Opción 3: Usar TypeORM Migrations
```bash
# Generar migración
npm run typeorm migration:generate -- -n InitialMigration

# Ejecutar migración
npm run typeorm migration:run
```

---

## ✅ Checklist de Migración

- [ ] PostgreSQL creado en Railway/Render
- [ ] Variables de entorno configuradas
- [ ] `app.module.ts` actualizado
- [ ] Probar conexión localmente
- [ ] Desplegar a producción
- [ ] Verificar que los datos persisten después de reinicio
- [ ] Configurar backups automáticos (Railway/Render lo hace automáticamente)

---

## 🎯 Resumen

**SQLite** = ✅ Perfecto para desarrollo local  
**PostgreSQL** = ✅ Necesario para producción en la nube

La migración es simple porque TypeORM ya soporta ambos. Solo cambia las variables de entorno y el código detectará automáticamente qué usar.

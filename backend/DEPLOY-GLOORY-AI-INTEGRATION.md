# Deploy: Integración con gloory-ai-server

Este documento describe los cambios introducidos por la integración con
`gloory-ai-server` (producto Gloory AI) y cómo desplegarlos de forma segura
sin afectar los 50 clientes actuales del MVP.

## Resumen de cambios

1. **Nueva columna en la tabla `clients`**: `gloory_business_id` (varchar, nullable, unique)
2. **Nuevo módulo `internal/`**: endpoints server-to-server con shared secret
3. **Nuevo módulo `tool-registry/`**: schemas de tools por plataforma
4. **Infraestructura de migrations TypeORM**: nueva (antes no existía)

**Impacto en endpoints existentes**: CERO. No se modificó ningún endpoint público existente. Los 50 clientes actuales no sufren cambios de comportamiento.

---

## Variables de entorno nuevas

Antes de desplegar, configura en producción:

```env
# Shared secret para endpoints internos (server-to-server con gloory-ai-server).
# DEBE coincidir con el mismo valor en gloory-ai-server.
# Generar con: openssl rand -hex 32
GLOORY_INTERNAL_TOKEN=<token-aleatorio-largo>
```

**Si no configuras esta variable**:
- Los nuevos endpoints `/api/internal/*` y `/api/tool-registry` fallan con 401 Unauthorized
- El resto del servicio sigue funcionando normal (los 50 clientes no notan nada)

---

## Schema change: aplicar migration

### Paso 1: Hacer backup de la DB de producción

```bash
# Railway
railway run pg_dump $DATABASE_URL > backup-pre-gloory-integration-$(date +%Y%m%d).sql

# Render / directo
pg_dump $DATABASE_URL > backup-pre-gloory-integration-$(date +%Y%m%d).sql
```

### Paso 2: Revisar qué va a correr

```bash
# Desde el directorio backend/
cd backend

# Usar el DATABASE_URL de producción (configurado en tu env)
DATABASE_URL=<prod-url> npm run migration:show
```

Deberías ver algo como:
```
[ ] AddGlooryBusinessIdToClients1712000000000
```

El `[ ]` significa que está pendiente.

### Paso 3: Correr la migration

```bash
DATABASE_URL=<prod-url> npm run migration:run
```

Output esperado:
```
Migration AddGlooryBusinessIdToClients1712000000000 has been executed successfully.
```

Esto ejecuta un simple `ALTER TABLE clients ADD COLUMN gloory_business_id VARCHAR UNIQUE`. En PostgreSQL:
- La operación es rápida con 50 registros
- Los 50 clientes existentes quedan con `gloory_business_id = NULL`
- Los NULLs NO violan el unique constraint (comportamiento estándar SQL)
- No hay lock prolongado de la tabla

### Paso 4: Verificar

```sql
-- Conectarse a prod con psql y verificar
\d clients
-- Debería aparecer: gloory_business_id | character varying | ... | nullable

SELECT COUNT(*) FROM clients WHERE gloory_business_id IS NULL;
-- Debería ser 50 (todos los clientes existentes)
```

### Paso 5: Desplegar el código

Ahora sí puedes desplegar el código (git push / Railway / Render). El orden es crítico:

1. ✅ Backup
2. ✅ Migration aplicada
3. ⏭️ Deploy del código

**Si inviertes el orden** (deploy sin migration), el servidor arranca OK pero el endpoint `/api/internal/clients/provision` fallará con error de PostgreSQL porque la columna no existe.

---

## Rollback

Si algo sale mal después del deploy:

```bash
# Revertir la migration (drop column)
DATABASE_URL=<prod-url> npm run migration:revert

# Rollback del código (git revert o despliegue del commit previo)
```

La migration es reversible con `down()` — hace `DROP COLUMN gloory_business_id`.

---

## synchronize sigue siendo FALSE en producción

El `app.module.ts` tiene esta lógica (sin cambios):

```typescript
const shouldSync =
  configService.get('DB_SYNC') === 'true' ||
  configService.get('NODE_ENV') !== 'production';
```

**En producción `NODE_ENV=production` y `DB_SYNC` no está seteado**, por lo que `synchronize: false` y TypeORM no toca el schema automáticamente. Toda modificación al schema debe pasar por migrations explícitas de aquí en adelante.

**No actives `DB_SYNC=true` en producción** — `synchronize` de TypeORM puede hacer cambios destructivos si detecta cualquier diferencia entre entities y DB.

---

## Testing local antes del deploy

```bash
# 1. Levantar una DB postgres local
docker run -d --name gloory-test-db \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=gloory_test \
  -p 5433:5432 postgres:15

# 2. Importar el backup de prod a la DB local (dry-run)
psql postgres://postgres:test@localhost:5433/gloory_test < backup-pre-gloory-integration-YYYYMMDD.sql

# 3. Correr la migration contra la DB local
DATABASE_URL=postgres://postgres:test@localhost:5433/gloory_test npm run migration:run

# 4. Verificar que nada se rompió
psql postgres://postgres:test@localhost:5433/gloory_test -c "\d clients"
psql postgres://postgres:test@localhost:5433/gloory_test -c "SELECT COUNT(*) FROM clients;"

# 5. Si todo OK, ya sabes que en prod también funcionará
docker stop gloory-test-db && docker rm gloory-test-db
```

---

## Checklist de deploy

- [ ] Backup de DB de producción hecho y guardado
- [ ] Migration probada contra copia local del backup
- [ ] `GLOORY_INTERNAL_TOKEN` configurado en env vars de producción
- [ ] `npm run migration:show` muestra `[ ] AddGlooryBusinessIdToClients...` (pendiente)
- [ ] `npm run migration:run` ejecutado con éxito en producción
- [ ] Verificación manual en `\d clients` que la columna existe
- [ ] Deploy del código nuevo
- [ ] Smoke test: los 50 clientes existentes siguen funcionando (`GET /api/clients/:id/availability` responde normal)
- [ ] Smoke test: `POST /api/internal/clients/provision` con el token funciona (probar con un businessId dummy)

# 🚂 Deployment del Backend en Railway

## ✅ Archivos Creados

Se han creado los siguientes archivos para configurar Railway:

1. **`backend/nixpacks.toml`** - Configuración de build para Railway
2. **`backend/.env.production`** - Template de variables de producción
3. **`backend/RAILWAY_SETUP.md`** - Guía detallada de configuración
4. **`backend/package.json`** - Actualizado con driver PostgreSQL (`pg`)

## 🚀 Pasos para Deploy

### Paso 1: Hacer Commit y Push

Primero, sube los nuevos archivos a tu repositorio:

```bash
cd backend
git add .
git commit -m "Add Railway configuration files and PostgreSQL driver"
git push
```

### Paso 2: Configurar Variables en Railway

1. Ve a tu proyecto en Railway
2. Click en tu servicio **Backend**
3. Ve a la pestaña **Variables**
4. Agrega las siguientes variables (copia y pega exactamente):

```
DATABASE_TYPE=postgres
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://tu-frontend.vercel.app
```

**⚠️ IMPORTANTE**: 
- Reemplaza `https://tu-frontend.vercel.app` con la URL real de tu frontend en Vercel
- Asegúrate de usar `${{Postgres.DATABASE_URL}}` exactamente así (Railway lo reemplazará automáticamente)

### Paso 3: Verificar Root Directory

1. En tu servicio Backend, ve a **Settings → General**
2. Asegúrate de que **Root Directory** esté configurado como: `backend`
3. Si no está configurado, agrégalo y guarda

### Paso 4: Redeploy

1. Railway debería hacer deploy automáticamente después del push
2. Si no, haz click en **Deploy** manualmente
3. Observa los logs en la pestaña **Logs**

## ✅ Qué Esperar

### Durante el Build (2-3 minutos)

```
[Region: us-east4]
╭─────────────────╮
│ Railpack 0.15.4 │
╰─────────────────╯

↳ Detected Node
↳ Using npm package manager

Packages
──────────
node  │  22.22.0  │  railpack default (22)

Steps
──────────
▸ install
  $ npm ci

▸ build
  $ npm run build

Deploy
──────────
  $ npm run start:prod

✓ Build complete
```

### Durante el Deploy

Deberías ver en los logs:

```
🚀 Backend running on http://localhost:3001
📚 API available at http://localhost:3001/api
TypeORM connection established
```

## 🔍 Verificar que Funciona

### 1. Obtener la URL Pública

Railway te asignará una URL pública como:
```
https://backend-production-xxxx.up.railway.app
```

Puedes encontrarla en:
- Pestaña **Settings → Networking → Public Networking**

### 2. Probar el API

Abre en tu navegador o usa `curl`:

```bash
curl https://tu-backend.railway.app/api
```

Deberías recibir una respuesta del servidor.

### 3. Verificar PostgreSQL

Verifica en los logs que TypeORM se conectó exitosamente:

```
✅ Busca: "TypeORM connection established"
✅ Busca: "Backend running"
❌ NO debería aparecer: "Connection refused", "ECONNREFUSED", "secret not found"
```

## 🐛 Solución de Problemas

### Error: "secret DATABASE_TYPE not found"

**Causa**: Railway está buscando la variable durante el build

**Solución**: El archivo `nixpacks.toml` debe solucionar esto. Asegúrate de:
1. ✅ Hacer commit y push del archivo `backend/nixpacks.toml`
2. ✅ Hacer redeploy en Railway

### Error: "Connection refused" o "ECONNREFUSED"

**Causa**: Las variables de entorno no están configuradas correctamente

**Solución**:
1. Ve a Variables en Railway
2. Verifica que `DATABASE_URL=${{Postgres.DATABASE_URL}}` esté exactamente así
3. Verifica que tu servicio PostgreSQL se llame "Postgres" (con P mayúscula)
4. Si tiene otro nombre, usa `${{NombreDelServicio.DATABASE_URL}}`

### Error: "Module not found: pg"

**Causa**: El driver de PostgreSQL no está instalado

**Solución**:
1. Verifica que el `package.json` tenga: `"pg": "^8.11.0"`
2. Haz commit y push
3. Redeploy en Railway

### Tablas no se crean automáticamente

**Solución temporal**:
1. En Variables de Railway, temporalmente cambia: `NODE_ENV=development`
2. Espera a que se complete el deploy (las tablas se crearán)
3. Vuelve a cambiar: `NODE_ENV=production`
4. Redeploy

**Explicación**: En producción, TypeORM no sincroniza automáticamente para evitar pérdida de datos accidental.

## 📦 Instalar Dependencias Localmente (Opcional)

Si quieres probar localmente con PostgreSQL:

```bash
cd backend
npm install
```

Esto instalará el driver `pg` que agregamos al `package.json`.

## 🔗 Conectar con Frontend en Vercel

Una vez que el backend esté funcionando en Railway:

1. Copia la URL pública de Railway (ejemplo: `https://backend-production-xxxx.up.railway.app`)
2. Ve a tu proyecto en Vercel
3. Ve a **Settings → Environment Variables**
4. Agrega:
   ```
   NEXT_PUBLIC_API_URL=https://tu-backend.railway.app/api
   ```
5. Redeploy el frontend en Vercel

## 📊 Checklist Completo

- [ ] Archivos creados en `backend/`:
  - [ ] `nixpacks.toml`
  - [ ] `.env.production`
  - [ ] `RAILWAY_SETUP.md`
  - [ ] `package.json` actualizado con `pg`
  
- [ ] Git:
  - [ ] Commit de los nuevos archivos
  - [ ] Push al repositorio
  
- [ ] Railway - Servicio Backend:
  - [ ] Variables configuradas
  - [ ] Root Directory = `backend`
  - [ ] Deploy exitoso
  - [ ] Logs muestran conexión exitosa
  
- [ ] PostgreSQL:
  - [ ] Servicio "Postgres" creado
  - [ ] Variables generadas automáticamente
  - [ ] Tablas creadas (visible en logs)
  
- [ ] Testing:
  - [ ] URL pública funciona
  - [ ] API responde correctamente
  - [ ] Frontend puede conectarse

## 🎯 Siguiente Paso

Después de hacer el deploy exitoso en Railway, necesitarás actualizar el frontend en Vercel con la URL del backend. Consulta `VERCEL_DEPLOYMENT.md` para más información sobre el frontend.

---

**¿Necesitas ayuda?** Revisa los logs en Railway y busca los mensajes de error específicos. La mayoría de los problemas se solucionan verificando que las variables de entorno estén correctamente configuradas.

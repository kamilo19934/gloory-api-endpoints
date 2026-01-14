# 🚀 Guía de Despliegue en Vercel

Esta guía te ayudará a desplegar tu proyecto en Vercel. El proyecto tiene dos componentes principales:

1. **Frontend (Next.js)** → Se despliega en Vercel ✅
2. **Backend (NestJS)** → Necesita otra plataforma (Railway, Render, etc.) ⚠️

---

## 📋 Requisitos Previos

1. Cuenta en [Vercel](https://vercel.com)
2. Cuenta en una plataforma para el backend (recomendado: [Railway](https://railway.app) o [Render](https://render.com))
3. Git configurado y repositorio en GitHub

---

## 🎯 Paso 1: Desplegar el Backend

El backend NestJS necesita un servidor Node.js completo, por lo que Vercel no es la mejor opción. Recomendamos usar:

### Opción A: Railway (Recomendado)

1. **Crear cuenta en Railway**
   - Ve a [railway.app](https://railway.app)
   - Conecta tu cuenta de GitHub

2. **Crear nuevo proyecto**
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Elige tu repositorio `gloory-api-endpoints`

3. **Agregar PostgreSQL (IMPORTANTE)**
   - ⚠️ **SQLite NO funciona en producción** - los datos se pierden al reiniciar
   - En tu proyecto, click en **"+ New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway creará automáticamente las variables de entorno:
     - `DATABASE_URL` (URL completa de conexión)
     - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
   - **Guarda estas variables**, las necesitarás

4. **Configurar el servicio del backend**
   - Click en **"+ New"** → **"GitHub Repo"** (o usa el servicio que ya creaste)
   - Railway detectará automáticamente el proyecto
   - En **"Settings"** → **"Root Directory"**, establece: `backend`
   - En **"Settings"** → **"Start Command"**, establece: `npm run start:prod`

5. **Configurar variables de entorno del backend**
   - Ve a **"Variables"** en el servicio del backend y agrega:
   ```
   PORT=3001
   NODE_ENV=production
   DATABASE_TYPE=postgres
   DATABASE_URL=${DATABASE_URL}
   CORS_ORIGIN=https://tu-frontend.vercel.app
   DENTALINK_BASE_URL=https://api.dentalink.com/v1
   ```
   ⚠️ **Nota**: `DATABASE_URL` se referencia automáticamente desde el servicio PostgreSQL de Railway

6. **Obtener la URL del backend**
   - Railway te dará una URL como: `https://tu-backend.railway.app`
   - **Guarda esta URL**, la necesitarás para el frontend

### Opción B: Render

1. **Crear cuenta en Render**
   - Ve a [render.com](https://render.com)
   - Conecta tu cuenta de GitHub

2. **Crear PostgreSQL Database (IMPORTANTE)**
   - ⚠️ **SQLite NO funciona en producción** - los datos se pierden al reiniciar
   - Click en **"New"** → **"PostgreSQL"**
   - Configura:
     - **Name**: `gloory-db`
     - **Database**: `gloory_db`
     - **User**: `gloory_user`
     - **Region**: Elige la más cercana
   - Render te dará una **Internal Database URL** (úsala en el backend)
   - **Guarda esta URL**, la necesitarás

3. **Crear nuevo Web Service para el backend**
   - Click en **"New"** → **"Web Service"**
   - Conecta tu repositorio
   - Configura:
     - **Name**: `gloory-api-backend`
     - **Root Directory**: `backend`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm run start:prod`
     - **Environment**: `Node`

4. **Configurar variables de entorno**
   - En **"Environment"** agrega:
   ```
   PORT=3001
   NODE_ENV=production
   DATABASE_TYPE=postgres
   DATABASE_URL=<Internal Database URL de Render>
   CORS_ORIGIN=https://tu-frontend.vercel.app
   DENTALINK_BASE_URL=https://api.dentalink.com/v1
   ```
   ⚠️ **Nota**: Usa la **Internal Database URL** que Render te dio (no la External)

5. **Obtener la URL del backend**
   - Render te dará una URL como: `https://tu-backend.onrender.com`

---

## 🎯 Paso 2: Desplegar el Frontend en Vercel

### Método 1: Desde el Dashboard de Vercel (Recomendado)

1. **Conectar repositorio**
   - Ve a [vercel.com](https://vercel.com)
   - Click en "Add New Project"
   - Importa tu repositorio de GitHub

2. **Configurar el proyecto**
   - **Framework Preset**: Next.js (se detecta automáticamente)
   - ⚠️ **Root Directory**: `frontend` (⚠️ **MUY IMPORTANTE** - sin esto tendrás error 404)
   - **Build Command**: ⚠️ **DÉJALO VACÍO** (Vercel lo detecta automáticamente para Next.js)
   - **Output Directory**: ⚠️ **DÉJALO VACÍO** (Vercel lo detecta automáticamente para Next.js)
   - **Install Command**: ⚠️ **DÉJALO VACÍO** (Vercel lo detecta automáticamente)
   
   💡 **Nota**: Si no ves la opción "Root Directory" en la configuración inicial:
   - Haz el deploy primero
   - Luego ve a **Settings** → **General** → **Root Directory**
   - Cambia a `frontend` y guarda
   - Se hará un nuevo deploy automáticamente
   
   ⚠️ **IMPORTANTE**: Si configuras manualmente Build/Output/Install commands, puedes causar el error "No Output Directory named 'public' found". Déjalos vacíos y deja que Vercel detecte Next.js automáticamente.

3. **Configurar variables de entorno**
   - En "Environment Variables", agrega:
   ```
   NEXT_PUBLIC_API_URL=https://tu-backend.railway.app/api
   ```
   ⚠️ **Importante**: Reemplaza `https://tu-backend.railway.app` con la URL real de tu backend

4. **Desplegar**
   - Click en "Deploy"
   - Espera a que termine el build
   - Vercel te dará una URL como: `https://tu-proyecto.vercel.app`

### Método 2: Usando Vercel CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desde la raíz del proyecto
cd /Users/camiloreyes/Documents/gloory-api-endpoints

# Iniciar despliegue
vercel

# Seguir las instrucciones:
# - ¿Set up and deploy? Y
# - ¿Which scope? (tu cuenta)
# - ¿Link to existing project? N
# - ¿What's your project's name? gloory-api-endpoints
# - ¿In which directory is your code located? ./frontend
# - ¿Want to override the settings? N

# Configurar variables de entorno
vercel env add NEXT_PUBLIC_API_URL production
# Ingresa: https://tu-backend.railway.app/api

# Desplegar a producción
vercel --prod
```

---

## 🔧 Configuración Adicional

### Actualizar CORS en el Backend

Una vez que tengas la URL de tu frontend en Vercel, actualiza la variable `CORS_ORIGIN` en tu backend:

```
CORS_ORIGIN=https://tu-proyecto.vercel.app
```

Si tienes múltiples orígenes (desarrollo y producción):

```
CORS_ORIGIN=http://localhost:3000,https://tu-proyecto.vercel.app
```

### ¿Por qué PostgreSQL en Producción?

⚠️ **SQLite NO funciona en producción en la nube**. Los datos se pierden al reiniciar el contenedor.

**Ventajas de PostgreSQL:**
- ✅ **Persistencia garantizada**: Los datos sobreviven a reinicios y despliegues
- ✅ **Backups automáticos**: Railway/Render los gestionan automáticamente
- ✅ **Alta concurrencia**: Soporta múltiples usuarios simultáneos
- ✅ **Escalable**: Permite múltiples instancias del backend

**El código ya está preparado** - `app.module.ts` detecta automáticamente PostgreSQL según `DATABASE_TYPE`.

📚 **Guía completa de migración**: Ver [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md)

---

## 📝 Checklist de Despliegue

### Backend
- [ ] Backend desplegado en Railway/Render
- [ ] **PostgreSQL creado y configurado** (⚠️ NO usar SQLite en producción)
- [ ] Variables de entorno configuradas (incluyendo `DATABASE_TYPE=postgres`)
- [ ] URL del backend obtenida
- [ ] CORS configurado con la URL del frontend
- [ ] Base de datos conectada y funcionando

### Frontend
- [ ] Frontend desplegado en Vercel
- [ ] Variable `NEXT_PUBLIC_API_URL` configurada con la URL del backend
- [ ] Build exitoso sin errores
- [ ] Frontend accesible en la URL de Vercel

### Verificación
- [ ] Abrir el frontend en Vercel
- [ ] Verificar que carga correctamente
- [ ] Probar crear un cliente
- [ ] Verificar que los endpoints funcionan

---

## 🔍 Troubleshooting

### Error: "API request failed"
- Verifica que `NEXT_PUBLIC_API_URL` esté correctamente configurada
- Verifica que el backend esté corriendo
- Verifica que CORS esté configurado correctamente

### Error: "CORS policy"
- Asegúrate de que `CORS_ORIGIN` en el backend incluya la URL de Vercel
- Verifica que no haya espacios en la variable de entorno

### Error: "Database connection failed"
- Verifica que `DATABASE_TYPE=postgres` esté configurado
- Verifica que `DATABASE_URL` esté correctamente configurada
- En Railway: Asegúrate de que el servicio PostgreSQL esté corriendo
- En Render: Usa la **Internal Database URL**, no la External
- Verifica que el servicio PostgreSQL no esté en pausa (Render pausa servicios gratuitos)

### Build falla en Vercel
- Verifica que `Root Directory` esté configurado como `frontend`
- Verifica que todas las dependencias estén en `package.json`
- Revisa los logs de build en Vercel

### Error 404 en Vercel
- ⚠️ **Problema más común**: `Root Directory` no está configurado como `frontend`
- **Solución**: Ve a **Settings** → **General** → **Root Directory** → Cambia a `frontend`
- Verifica que el archivo `vercel.json` esté en la raíz del repositorio
- Si sigue sin funcionar, ver: [VERCEL_404_FIX.md](./VERCEL_404_FIX.md)

### Error: "No Output Directory named 'public' found"
- ⚠️ **Causa**: Build/Output/Install commands configurados incorrectamente
- **Solución**: Ve a **Settings** → **General** y **BORRA** los valores de:
  - Build Command (déjalo vacío)
  - Output Directory (déjalo vacío)
  - Install Command (déjalo vacío)
- Vercel detectará automáticamente Next.js y usará la configuración correcta
- Ver: [VERCEL_404_FIX.md](./VERCEL_404_FIX.md) para más detalles

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu aplicación estará desplegada:

- **Frontend**: `https://tu-proyecto.vercel.app`
- **Backend**: `https://tu-backend.railway.app` (o Render)

### URLs de Ejemplo

```
Frontend: https://gloory-api.vercel.app
Backend:  https://gloory-api-backend.railway.app
```

---

## 📚 Recursos Adicionales

- [Documentación de Vercel](https://vercel.com/docs)
- [Documentación de Railway](https://docs.railway.app)
- [Documentación de Render](https://render.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## 🔄 Actualizaciones Futuras

Cada vez que hagas `git push` a la rama `main`:

- **Vercel** desplegará automáticamente el frontend
- **Railway/Render** desplegará automáticamente el backend

¡No necesitas hacer nada más! 🚀

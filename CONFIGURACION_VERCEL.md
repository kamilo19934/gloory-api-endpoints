# ⚡ Configuración Rápida para Vercel

## 🎯 Resumen

Tu proyecto tiene **2 partes**:
- **Frontend (Next.js)** → Vercel ✅
- **Backend (NestJS)** → Railway/Render ⚠️

---

## 📝 Variables de Entorno Necesarias

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL=https://tu-backend.railway.app/api
```

### Backend (Railway/Render)
```
PORT=3001
NODE_ENV=production
DATABASE_TYPE=postgres
DATABASE_URL=${DATABASE_URL}  # Railway/Render lo genera automáticamente
CORS_ORIGIN=https://tu-frontend.vercel.app
DENTALINK_BASE_URL=https://api.dentalink.com/v1
```

⚠️ **IMPORTANTE**: Usa PostgreSQL, NO SQLite. SQLite pierde datos al reiniciar.

---

## 🚀 Pasos Rápidos

### 1. Backend en Railway (5 minutos)

1. Ve a [railway.app](https://railway.app) y conecta GitHub
2. "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repo `gloory-api-endpoints`
4. **Crear PostgreSQL** (⚠️ IMPORTANTE):
   - Click en **"+ New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway generará automáticamente `DATABASE_URL`
5. **Crear servicio del backend**:
   - Click en **"+ New"** → **"GitHub Repo"** (o usa el servicio existente)
   - En Settings:
     - **Root Directory**: `backend`
     - **Start Command**: `npm run start:prod`
6. Agrega las variables de entorno (arriba)
   - `DATABASE_URL` se referencia automáticamente desde PostgreSQL
7. **Copia la URL** que te da Railway (ej: `https://xxx.railway.app`)

### 2. Frontend en Vercel (3 minutos)

1. Ve a [vercel.com](https://vercel.com) y conecta GitHub
2. "Add New Project" → Importa tu repo
3. Configura:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js (auto-detectado)
4. Agrega variable de entorno:
   - `NEXT_PUBLIC_API_URL` = `https://xxx.railway.app/api` (la URL de Railway)
5. Click "Deploy"

### 3. Actualizar CORS del Backend

En Railway, actualiza la variable:
```
CORS_ORIGIN=https://tu-proyecto.vercel.app
```
(Reemplaza con la URL real que te da Vercel)

---

## ✅ Verificación

1. Abre tu frontend en Vercel
2. Debería cargar sin errores
3. Prueba crear un cliente

---

## 📚 Documentación Completa

Para más detalles, ver: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

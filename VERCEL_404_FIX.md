# 🔧 Solución: Error 404 en Vercel

## Problema
Vercel muestra error 404 porque no encuentra el directorio `frontend` correctamente.

## ✅ Solución Rápida

### Opción 1: Configurar en el Dashboard de Vercel (Recomendado)

1. Ve a tu proyecto en [vercel.com](https://vercel.com)
2. Click en **"Settings"** → **"General"**
3. Busca la sección **"Root Directory"**
4. Click en **"Edit"**
5. Escribe: `frontend`
6. Click en **"Save"**
7. Ve a **"Deployments"** y haz un nuevo deploy (o espera a que se redespiegue automáticamente)

### Opción 2: Usar vercel.json (Ya está configurado)

El archivo `vercel.json` ya tiene la configuración correcta. Si aún así no funciona:

1. Verifica que el archivo `vercel.json` esté en la **raíz del repositorio** (no en `frontend/`)
2. El contenido debe ser:
```json
{
  "buildCommand": "npm install && npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "rootDirectory": "frontend"
}
```

3. Haz commit y push:
```bash
git add vercel.json
git commit -m "Fix Vercel configuration"
git push
```

### Opción 3: Verificar Configuración del Proyecto

1. En Vercel Dashboard → **Settings** → **General**
2. Verifica:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: (debe estar vacío o `npm run build`)
   - **Output Directory**: (debe estar vacío o `.next`)
   - **Install Command**: (debe estar vacío o `npm install`)

## 🔍 Verificación

Después de aplicar la solución:

1. Espera a que termine el build (puede tardar 1-2 minutos)
2. Abre la URL de tu proyecto en Vercel
3. Deberías ver la página principal, no un 404

### Error: "No Output Directory named 'public' found"

Este error ocurre cuando Vercel no detecta correctamente Next.js. **Solución**:

1. **Elimina el `vercel.json` temporalmente** (o simplifícalo):
   ```json
   {
     "framework": "nextjs",
     "rootDirectory": "frontend"
   }
   ```

2. **En el Dashboard de Vercel**:
   - Ve a **Settings** → **General**
   - **Framework Preset**: Debe ser `Next.js`
   - **Root Directory**: Debe ser `frontend`
   - **Build Command**: Déjalo VACÍO (Vercel lo detecta)
   - **Output Directory**: Déjalo VACÍO (Vercel lo detecta)
   - **Install Command**: Déjalo VACÍO (Vercel lo detecta)

3. **Haz un nuevo deploy**

## ⚠️ Si Sigue Sin Funcionar

1. **Verifica los logs de build**:
   - Ve a **Deployments** → Click en el último deployment
   - Revisa los logs para ver errores

2. **Verifica la estructura del proyecto**:
   - Asegúrate de que `frontend/package.json` existe
   - Asegúrate de que `frontend/src/app/page.tsx` existe

3. **Revisa las variables de entorno**:
   - Ve a **Settings** → **Environment Variables**
   - Verifica que `NEXT_PUBLIC_API_URL` esté configurada

4. **Elimina y recrea el proyecto** (último recurso):
   - Elimina el proyecto en Vercel
   - Vuelve a importarlo desde GitHub
   - Configura `Root Directory: frontend` desde el inicio
   - **NO configures Build/Output/Install commands** - déjalos vacíos

## 📝 Notas Importantes

- El `rootDirectory` debe configurarse **ANTES** del primer deploy
- Si cambias el `rootDirectory` después, necesitas hacer un nuevo deploy
- Vercel detecta automáticamente Next.js, pero necesita saber dónde está el código

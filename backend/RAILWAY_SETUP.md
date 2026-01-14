# 🚂 Configuración de Railway para Backend

## 📋 Variables de Entorno Requeridas

Ve a tu servicio **Backend** en Railway → pestaña **Variables** y agrega:

```env
DATABASE_TYPE=postgres
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://tu-frontend.vercel.app
```

### Explicación de Variables

- `DATABASE_TYPE=postgres` - Le dice a TypeORM que use PostgreSQL
- `DATABASE_URL=${{Postgres.DATABASE_URL}}` - Referencia al servicio PostgreSQL (Railway lo reemplaza automáticamente)
- `NODE_ENV=production` - Modo producción
- `PORT=3001` - Puerto del servidor
- `CORS_ORIGIN` - URL de tu frontend en Vercel (actualiza con tu URL real)

## 🔧 Configuración del Servicio

### 1. Root Directory
En **Settings → General**:
- **Root Directory**: `backend`

### 2. Build & Deploy
En **Settings → Deploy** (debería detectarse automáticamente):
- **Build Command**: `npm run build`
- **Start Command**: `npm run start:prod`

### 3. Conectar con PostgreSQL
En **Settings → Service Variables**:
- Asegúrate de que el servicio PostgreSQL esté visible
- Railway debería mostrar `${{Postgres.DATABASE_URL}}` como referencia válida

## 🗄️ Base de Datos PostgreSQL

Tu servicio PostgreSQL debe tener estas variables (creadas automáticamente):
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `DATABASE_URL` (URL completa de conexión)

## ✅ Verificar Deploy

Después de configurar:

1. **Redeploy** el servicio backend
2. Verifica los logs:
   - ✅ Debe conectarse a PostgreSQL
   - ✅ TypeORM debe crear las tablas automáticamente
   - ✅ Debe iniciar en el puerto 3001

### Comando para ver logs:
En Railway → tu servicio Backend → pestaña **Logs**

Deberías ver:
```
🚀 Backend running on http://localhost:3001
📚 API available at http://localhost:3001/api
```

## 🐛 Troubleshooting

### Error: "secret DATABASE_TYPE not found"
- ✅ **Solución**: El archivo `nixpacks.toml` lo soluciona
- Asegúrate de hacer commit y push de este archivo

### Error: "Connection refused" o "ECONNREFUSED"
- ❌ Las variables de entorno no están configuradas correctamente
- Verifica que `DATABASE_URL=${{Postgres.DATABASE_URL}}` use el nombre correcto del servicio

### Tablas no se crean automáticamente
- Temporalmente cambia `NODE_ENV=development` para el primer deploy
- Después del primer deploy exitoso, vuelve a `NODE_ENV=production`

## 🔗 URLs

Después del deploy, Railway te dará una URL pública:
```
https://tu-backend.railway.app
```

Actualiza esta URL en tu frontend (Vercel) como:
```env
NEXT_PUBLIC_API_URL=https://tu-backend.railway.app/api
```

## 📦 Archivos Importantes

- `nixpacks.toml` - Configuración de build para Railway
- `.env.production` - Template de variables de producción
- `package.json` - Scripts de build y start

## 🚀 Siguiente Paso

Una vez que el backend esté funcionando en Railway:
1. Copia la URL pública del backend
2. Actualiza el frontend en Vercel con esa URL
3. Prueba la integración completa

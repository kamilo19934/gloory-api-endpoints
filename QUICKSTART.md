# 🚀 Quickstart Guide

Guía rápida de 5 minutos para tener Gloory API funcionando.

## Prerrequisitos

- Node.js 18 o superior
- npm (viene con Node.js)

Verifica que los tengas instalados:
```bash
node --version
npm --version
```

## Instalación en 3 Pasos

### 1. Instalar Dependencias

```bash
# Opción A: Script automático (recomendado)
chmod +x install.sh
./install.sh

# Opción B: Manual
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Iniciar Backend

Abre una terminal:
```bash
cd backend
npm run start:dev
```

Espera a ver: `🚀 Backend running on http://localhost:3001`

### 3. Iniciar Frontend

Abre OTRA terminal (deja la anterior corriendo):
```bash
cd frontend
npm run dev
```

Espera a ver: `✓ Ready on http://localhost:3000`

## ✅ ¡Listo!

Abre tu navegador en: **http://localhost:3000**

## Próximos Pasos

### 1. Crear tu Primer Cliente

1. Haz clic en **"Crear Nueva Conexión"**
2. Completa el formulario:
   - **Nombre**: "Mi Clínica de Prueba"
   - **API Key**: Tu API key de Dentalink (o una de prueba)
   - **Descripción**: "Cliente de prueba"
3. Haz clic en **"Crear Cliente"**

### 2. Ver los Endpoints

1. En la lista de clientes, haz clic en **"Ver Endpoints"**
2. Verás todos los endpoints disponibles con sus URLs completas
3. Haz clic en el ícono de copiar para copiar cualquier URL

### 3. Usar la API

Ejemplo básico con curl:

```bash
# Reemplaza {CLIENT_ID} con el ID de tu cliente
CLIENT_ID="tu-client-id-aqui"

# Obtener disponibilidad
curl "http://localhost:3001/api/clients/${CLIENT_ID}/availability?date=2024-01-20"

# Crear una cita
curl -X POST "http://localhost:3001/api/clients/${CLIENT_ID}/appointments" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "12345",
    "date": "2024-01-20",
    "time": "10:00"
  }'
```

## 🎯 Comandos Útiles

```bash
# Ver logs del backend
cd backend
npm run start:dev

# Ver logs del frontend
cd frontend
npm run dev

# Formatear código
cd backend && npm run format
cd frontend && npm run format

# Ejecutar linters
cd backend && npm run lint
cd frontend && npm run lint

# Build para producción
cd backend && npm run build
cd frontend && npm run build
```

## 🔧 Configuración Rápida

### Backend (.env)

El archivo `backend/.env` ya está configurado con valores por defecto:
```env
PORT=3001
DENTALINK_BASE_URL=https://api.dentalink.com/v1
```

### Frontend (.env.local)

El archivo `frontend/.env.local` apunta al backend local:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## ❓ Problemas Comunes

### Puerto 3001 o 3000 en uso

```bash
# macOS/Linux
lsof -ti:3001 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Error al instalar dependencias

```bash
# Limpiar cache de npm
npm cache clean --force

# Reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Backend no inicia

1. Verifica que Node.js sea 18+: `node --version`
2. Elimina `node_modules` y reinstala: `rm -rf node_modules && npm install`
3. Verifica que el puerto 3001 esté libre

### Frontend no se conecta al backend

1. Verifica que el backend esté corriendo en el puerto 3001
2. Revisa que `frontend/.env.local` tenga la URL correcta
3. Abre la consola del navegador (F12) para ver errores

## 📚 Más Información

- [README.md](README.md) - Información completa del proyecto
- [INSTALL.md](INSTALL.md) - Guía detallada de instalación
- [API_EXAMPLES.md](API_EXAMPLES.md) - Ejemplos de uso de la API
- [CONTRIBUTING.md](CONTRIBUTING.md) - Cómo contribuir

## 🎉 ¡Todo Listo!

Ya tienes Gloory API funcionando. Ahora puedes:

- ✅ Crear clientes
- ✅ Ver endpoints disponibles
- ✅ Hacer llamadas a Dentalink
- ✅ Gestionar múltiples integraciones

¿Necesitas ayuda? Revisa la documentación o crea un issue en el repositorio.


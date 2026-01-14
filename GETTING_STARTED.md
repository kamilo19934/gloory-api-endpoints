# 🚀 Getting Started - Guía Rápida

## ✅ Implementación Completada

Tu proyecto está 100% funcional con todas las funciones de Dentalink migradas desde Python a TypeScript.

---

## 🎯 Inicio Rápido en 3 Pasos

### Paso 1: Iniciar Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

✅ Backend: http://localhost:3001  
✅ Frontend: http://localhost:3000

---

### Paso 2: Crear tu Primer Cliente

1. Abre http://localhost:3000
2. Clic en **"Crear Nueva Conexión"**
3. Completa:

```
Nombre: Mi Clínica Dental
API Key: [Tu API key de Dentalink]
Descripción: Clínica principal
Timezone: 🇨🇱 Santiago (Chile)

Integración GoHighLevel:
├─ Toggle: ON (solo si usas GHL)
├─ GHL Access Token: pit-xxxxx...
├─ GHL Calendar ID: 7U0Cv0cyOIB...
└─ GHL Location ID: Y6SfrX5Wf5M...
```

4. Clic en **"Crear Cliente"**

---

### Paso 3: Usar los Endpoints

1. En la lista de clientes, clic en **"Ver Endpoints"**
2. Verás 7 endpoints disponibles:

```
✅ Buscar Disponibilidad
✅ Buscar Paciente
✅ Crear Paciente
✅ Obtener Tratamientos
✅ Crear Cita
✅ Cancelar Cita
✅ Probar Conexión
```

3. Copia la URL de cualquier endpoint y úsala en tu aplicación

---

## 📖 Ejemplos Rápidos

### Ejemplo 1: Buscar Disponibilidad

```bash
curl -X POST http://localhost:3001/api/clients/{clientId}/availability \
  -H "Content-Type: application/json" \
  -d '{
    "ids_profesionales": [45, 67],
    "id_sucursal": 1,
    "tiempo_cita": 30
  }'
```

### Ejemplo 2: Crear Paciente

```bash
curl -X POST http://localhost:3001/api/clients/{clientId}/patients \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan",
    "apellidos": "Pérez",
    "rut": "12345678-9",
    "telefono": "+56912345678",
    "email": "juan@example.com"
  }'
```

### Ejemplo 3: Agendar Cita (con GHL opcional)

```bash
curl -X POST http://localhost:3001/api/clients/{clientId}/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "id_paciente": 123,
    "id_profesional": 45,
    "id_sucursal": 1,
    "fecha": "2024-01-20",
    "hora_inicio": "10:00",
    "tiempo_cita": 30,
    "comentario": "Primera consulta",
    "userId": "ghl_contact_12345"
  }'
```

**Nota**: `userId` solo es necesario si tienes GHL habilitado.

---

## 🎨 Características Principales

### ✅ Multi-Timezone
Cada cliente puede estar en un timezone diferente:
- 🇨🇱 Chile: `America/Santiago`
- 🇺🇸 New York: `America/New_York`
- 🇪🇸 Madrid: `Europe/Madrid`
- ... y 18 más

### ✅ Integración GHL Opcional
- Solo se usa al crear citas
- Se ejecuta en background
- Si falla, la cita igual se crea en Dentalink

### ✅ Validación Inteligente
- Bloques consecutivos para citas largas
- Filtrado de horarios futuros
- Formato automático de RUT chileno
- Fechas en español

---

## 📚 Documentación Completa

| Documento | ¿Qué contiene? |
|-----------|----------------|
| `DENTALINK_FUNCTIONS.md` | **Detalles de cada función** ⭐ |
| `API_EXAMPLES.md` | Ejemplos en JS, Python |
| `IMPLEMENTATION_COMPLETE.md` | Resumen técnico completo |
| `INSTALL.md` | Instalación detallada |

---

## 🔍 Endpoints Disponibles

### 1. Buscar Disponibilidad
```
POST /api/clients/:clientId/availability
```
Busca horarios disponibles con validación de bloques consecutivos.

### 2. Buscar Paciente
```
POST /api/clients/:clientId/patients/search
```
Busca un paciente por RUT.

### 3. Crear Paciente
```
POST /api/clients/:clientId/patients
```
Crea un nuevo paciente (o retorna existente).

### 4. Obtener Tratamientos
```
POST /api/clients/:clientId/patients/:rut/treatments
```
Obtiene todos los tratamientos de un paciente.

### 5. Crear Cita
```
POST /api/clients/:clientId/appointments
```
Agenda una cita (con GHL opcional).

### 6. Cancelar Cita
```
POST /api/clients/:clientId/appointments/cancel
```
Cancela por ID o por RUT (cancela la próxima futura).

### 7. Probar Conexión
```
POST /api/clients/:clientId/test-connection
```
Verifica que la API key sea válida.

---

## 🎯 Casos de Uso Comunes

### Caso 1: Agendar una Cita Completa

```javascript
// 1. Buscar disponibilidad
const disponibilidad = await fetch(`${API}/clients/${clientId}/availability`, {
  method: 'POST',
  body: JSON.stringify({
    ids_profesionales: [45],
    id_sucursal: 1,
    tiempo_cita: 30
  })
});

// 2. Buscar o crear paciente
const paciente = await fetch(`${API}/clients/${clientId}/patients`, {
  method: 'POST',
  body: JSON.stringify({
    nombre: "Juan",
    apellidos: "Pérez",
    rut: "12345678-9"
  })
});

// 3. Agendar cita
const cita = await fetch(`${API}/clients/${clientId}/appointments`, {
  method: 'POST',
  body: JSON.stringify({
    id_paciente: paciente.id_paciente,
    id_profesional: 45,
    id_sucursal: 1,
    fecha: "2024-01-20",
    hora_inicio: "10:00"
  })
});
```

### Caso 2: Verificar Tratamientos de un Paciente

```javascript
const tratamientos = await fetch(
  `${API}/clients/${clientId}/patients/12345678-9/treatments`,
  { method: 'POST' }
);
```

---

## ⚠️ Notas Importantes

### RUT Chileno
Siempre se formatea automáticamente:
```
"12.345.678-9" → "12345678-9"
"123456789"    → "12345678-9"
```

### Timezone
Afecta los horarios mostrados en disponibilidad y determina qué citas son "futuras".

### GHL Integration
- Solo necesario si usas GoHighLevel
- Solo se activa en "Crear Cita"
- Requiere campos: `ghlAccessToken`, `ghlCalendarId`, `ghlLocationId`

### Validación de Bloques
Si una cita requiere 60 minutos y el profesional tiene intervalo de 30 minutos, el sistema solo muestra horarios donde hay 2 bloques consecutivos disponibles.

---

## 🆘 Troubleshooting Rápido

### "Backend no responde"
```bash
# Verificar que esté corriendo
lsof -ti:3001

# Si no está, iniciar
cd backend && npm run start:dev
```

### "No encuentra disponibilidad"
- Verificar que los IDs de profesional y sucursal sean correctos
- Confirmar que hay horarios configurados en Dentalink
- Probar con fecha_inicio más lejana

### "Paciente no encontrado"
- Verificar formato del RUT: debe ser `12345678-9`
- Confirmar que existe en Dentalink

### "GHL no sincroniza"
- Verificar que `ghlEnabled: true` en el cliente
- Proporcionar `userId` en el request
- Revisar tokens de GHL

---

## 🎓 Siguientes Pasos

1. ✅ Crea tu primer cliente
2. ✅ Prueba los endpoints en Postman/Insomnia
3. ✅ Integra con tu aplicación
4. ✅ Lee `DENTALINK_FUNCTIONS.md` para detalles técnicos
5. ✅ Revisa `API_EXAMPLES.md` para más ejemplos

---

## 📞 ¿Necesitas Ayuda?

1. **Documentación Técnica**: `DENTALINK_FUNCTIONS.md`
2. **Ejemplos de Código**: `API_EXAMPLES.md`
3. **Instalación**: `INSTALL.md`
4. **Resumen Técnico**: `IMPLEMENTATION_COMPLETE.md`

---

## 🏆 ¡Listo para Producción!

Tu proyecto está completo y funcional. Todas las funciones del código Python original están migradas y mejoradas en TypeScript.

**¡Feliz desarrollo! 🚀**


# Setup Automático de Custom Fields en GoHighLevel

## 🎯 Descripción

Sistema automático que verifica y crea los 7 custom fields necesarios en GoHighLevel cuando se configura un cliente. Esto elimina la necesidad de crear manualmente los custom fields en GHL.

## ✨ Funcionalidades

### 1. Verificación Automática
- Verifica si los custom fields existen en GHL
- Identifica cuáles faltan

### 2. Creación Automática
- Crea los custom fields faltantes automáticamente
- Usa la API de GHL para la creación
- Maneja errores individualmente por campo

### 3. Validación
- Valida que todos los campos requeridos existan
- Retorna lista de campos faltantes

## 📋 Custom Fields Creados

El sistema crea automáticamente estos 7 custom fields en GoHighLevel:

```javascript
1. id_cita           - ID de la cita en Dentalink
2. hora_inicio       - Hora de inicio (HH:mm:ss)
3. fecha             - Fecha de la cita (YYYY-MM-DD)
4. nombre_dentista   - Nombre del dentista
5. id_sucursal       - ID de la sucursal
6. nombre_sucursal   - Nombre de la sucursal
7. for_confirmation  - Marcado para confirmación (true/false)
```

**Configuración de cada campo**:
- **Tipo**: TEXT
- **Modelo**: contact
- **Placeholder**: Descripción del campo

## 🔧 Implementación Técnica

### Backend

#### Nuevo Servicio: `GHLSetupService`

**Ubicación**: `backend/src/appointment-confirmations/ghl-setup.service.ts`

**Métodos principales**:

1. **`ensureCustomFields()`**
   - Verifica custom fields existentes
   - Crea los que faltan
   - Retorna resumen con created, existing y errors

2. **`validateCustomFields()`**
   - Valida que todos existan
   - Retorna boolean + lista de faltantes

3. **`createCustomField()`** (privado)
   - Crea un custom field individual
   - Usa POST /locations/:locationId/customFields

#### Endpoints Nuevos

```
POST /clients/:clientId/appointment-confirmations/setup-ghl
  → Ejecuta el setup (verifica y crea)
  → Retorna: created[], existing[], errors[]

GET /clients/:clientId/appointment-confirmations/validate-ghl
  → Valida que todos existan
  → Retorna: valid, missing[]
```

### Frontend

#### Funciones API

**En `frontend/src/lib/api.ts`**:

```typescript
appointmentConfirmationsApi.setupGHL(clientId)
  → Ejecuta el setup

appointmentConfirmationsApi.validateGHL(clientId)
  → Valida los campos
```

#### UI en la Página de Confirmaciones

**Nueva sección** (solo se muestra si GHL está habilitado):

```
┌─────────────────────────────────────────────────┐
│ ⚙️ Configuración de GoHighLevel                 │
│                                                  │
│ Asegúrate de que los 7 custom fields necesarios │
│ estén configurados en GHL...                    │
│                                                  │
│              [✓ Validar] [⚙️ Configurar]         │
└─────────────────────────────────────────────────┘
```

**Botones**:

1. **"Validar"** (morado claro)
   - Verifica si los campos existen
   - Muestra toast con resultado
   - No hace cambios

2. **"Configurar"** (morado oscuro)
   - Pide confirmación
   - Crea los campos faltantes
   - Muestra resumen con: creados, existentes, errores

## 🚀 Cómo Usar

### Opción 1: Desde la UI (Recomendado)

1. **Navega** a la página de confirmaciones:
   ```
   Clientes → [Tu Cliente] → Confirmaciones de Citas
   ```

2. **Si GHL está habilitado**, verás la sección de configuración

3. **Validar primero** (opcional):
   ```
   Click en "Validar"
   → Ver qué campos faltan
   ```

4. **Configurar automáticamente**:
   ```
   Click en "Configurar"
   → Confirmar acción
   → Ver resumen de campos creados
   ```

### Opción 2: Desde la API

#### Ejecutar Setup

```bash
POST /clients/:clientId/appointment-confirmations/setup-ghl

Response:
{
  "success": true,
  "message": "Setup completado",
  "created": ["id_cita", "for_confirmation"],      // Creados
  "existing": ["fecha", "hora_inicio", ...],       // Ya existían
  "errors": [],                                     // Errores
  "totalRequired": 7,
  "totalExisting": 5,
  "totalCreated": 2
}
```

#### Validar

```bash
GET /clients/:clientId/appointment-confirmations/validate-ghl

Response:
{
  "valid": false,
  "message": "Faltan 2 custom fields",
  "missing": ["id_cita", "for_confirmation"],
  "required": ["id_cita", "hora_inicio", "fecha", ...]
}
```

## 📊 Flujo Completo

```
1. Usuario configura GHL en el cliente
   (ghlEnabled, ghlAccessToken, ghlLocationId)
   ↓
2. Va a página de Confirmaciones
   ↓
3. Ve la sección "Configuración de GoHighLevel"
   ↓
4. Click en "Validar" (opcional)
   → Ver qué campos faltan
   ↓
5. Click en "Configurar"
   → Confirmar
   ↓
6. Sistema verifica custom fields en GHL
   ↓
7. Crea los que faltan automáticamente
   ↓
8. Muestra resumen:
   ✅ "Creados: 2 | Existentes: 5"
   ↓
9. Listo para usar confirmaciones
```

## ⚙️ Configuración de GHL

### API de GoHighLevel

**Endpoints utilizados**:

```
GET /locations/:locationId/customFields?model=contact
  → Obtener custom fields existentes

POST /locations/:locationId/customFields
  → Crear nuevo custom field
```

**Headers requeridos**:
```javascript
{
  "Authorization": "Bearer {ghlAccessToken}",
  "Content-Type": "application/json",
  "Version": "2021-07-28"
}
```

**Payload para crear**:
```javascript
{
  "name": "id_cita",
  "dataType": "TEXT",
  "model": "contact",
  "placeholder": "ID de la cita en Dentalink",
  "position": 0
}
```

## 🔍 Manejo de Errores

### Si falta configuración de GHL

```javascript
Response:
{
  "success": false,
  "message": "El cliente no tiene GoHighLevel configurado correctamente"
}
```

### Si falla la creación de un campo

El sistema:
- ✅ Continúa con los demás campos
- ✅ Registra el error en el array `errors`
- ✅ No detiene todo el proceso

```javascript
Response:
{
  "success": true,
  "created": ["id_cita", "fecha"],
  "existing": ["hora_inicio"],
  "errors": ["Error creando 'for_confirmation': Invalid token"],
  "totalCreated": 2
}
```

## 💡 Ventajas

### ✅ Automatización
- No requiere configuración manual en GHL
- Ahorra tiempo de setup
- Reduce errores humanos

### ✅ Validación
- Verifica antes de usar
- Identifica problemas temprano
- Feedback claro

### ✅ Idempotencia
- Puede ejecutarse múltiples veces
- No duplica campos existentes
- Seguro de re-ejecutar

### ✅ Manejo de Errores
- Errores individuales no detienen el proceso
- Feedback detallado por campo
- Logs claros

## 🧪 Testing

### Test 1: Validar sin campos

```bash
# 1. Asegurarse de que NO existen los campos en GHL
# 2. Llamar a validate
GET /clients/:clientId/appointment-confirmations/validate-ghl

# Expected:
{
  "valid": false,
  "missing": [todos los 7 campos]
}
```

### Test 2: Crear todos los campos

```bash
# 1. Llamar a setup
POST /clients/:clientId/appointment-confirmations/setup-ghl

# Expected:
{
  "success": true,
  "totalCreated": 7,
  "totalExisting": 0,
  "errors": []
}

# 2. Verificar en GHL que existen los 7 campos
```

### Test 3: Re-ejecutar setup (idempotencia)

```bash
# 1. Ejecutar setup nuevamente
POST /clients/:clientId/appointment-confirmations/setup-ghl

# Expected:
{
  "success": true,
  "totalCreated": 0,      ← No crea duplicados
  "totalExisting": 7,     ← Todos ya existen
  "errors": []
}
```

### Test 4: Validar después del setup

```bash
# 1. Después del setup exitoso
GET /clients/:clientId/appointment-confirmations/validate-ghl

# Expected:
{
  "valid": true,
  "missing": []
}
```

## 📝 Notas Importantes

1. **Permisos en GHL**: El Access Token debe tener el scope `locations/customFields.write`

2. **Model**: Los campos se crean con `model: "contact"` (no opportunity)

3. **Nombres**: Los nombres son case-insensitive en la verificación pero se crean exactamente como están definidos

4. **Position**: Todos se crean con `position: 0` (GHL los ordena automáticamente)

5. **Placeholder**: Es opcional pero útil para documentación

## 🎉 Resultado Final

Después del setup exitoso:

✅ **En GHL**:
- 7 custom fields creados en la Location
- Visibles en Settings → Custom Fields
- Listos para usar con contactos

✅ **En el Sistema**:
- Validación exitosa
- Confirmaciones pueden procesar citas
- Custom fields se llenan automáticamente

---

**Fecha de Implementación**: Enero 2026
**Versión**: 1.2.0

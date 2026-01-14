# Fix: Error 429 - Rate Limiting de GoHighLevel API

## 🐛 Problema Reportado

**Usuario**: "Estoy obteniendo error 429. Al parecer es por exceder la API"

### Límites de GHL API v2 OAuth
- **Burst limit**: 100 requests cada 10 segundos
- **Problema**: Se estaban procesando 50 confirmaciones simultáneamente
- **Resultado**: Hasta 200 requests en ~5 segundos → **Error 429**

### Cálculo del Problema

Por cada confirmación se hacen **hasta 4 requests**:
1. Buscar contacto por email (POST /contacts/search)
2. Buscar contacto por teléfono (POST /contacts/search)
3. Crear contacto si no existe (POST /contacts/)
4. Actualizar custom fields (PUT /contacts/:id)

**Antes**:
- 50 confirmaciones simultáneas × 4 requests = **200 requests**
- Tiempo: ~5 segundos
- Rate: **40 requests/segundo** → ❌ Excede límite

## ✅ Soluciones Implementadas

### 1. **Reducción de Batch Size**

```typescript
// ❌ ANTES
take: 50, // Procesar 50 a la vez

// ✅ AHORA
take: 10, // Procesar 10 a la vez para respetar rate limit de GHL
```

**Impacto**:
- 10 confirmaciones × 4 requests = 40 requests
- Mucho más seguro y dentro del límite

### 2. **Delays Entre Procesamientos**

```typescript
for (const confirmation of pending) {
  await this.processConfirmation(confirmation);
  
  // ✅ NUEVO: Delay de 1.5s entre cada procesamiento
  if (pending.indexOf(confirmation) < pending.length - 1) {
    this.logger.log('⏱️ Esperando 1.5s antes de procesar siguiente (rate limit GHL)...');
    await this.sleep(1500);
  }
}
```

**Función Helper**:
```typescript
private async sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Cálculo Nuevo**:
- 10 confirmaciones × 1.5s delay = 15 segundos totales
- 40 requests en 15 segundos = **2.67 requests/segundo** ✅
- **Muy dentro del límite** de 10 requests/segundo

### 3. **Manejo Específico del Error 429**

```typescript
catch (error) {
  const statusCode = error.response?.status;
  
  // ✅ NUEVO: Manejo especial para 429
  if (statusCode === 429) {
    this.logger.warn(`⚠️ Rate limit excedido (429) - Se reintentará automáticamente`);
    confirmation.status = ConfirmationStatus.PENDING;
    confirmation.errorMessage = 'Rate limit excedido - reintentando';
    // No aumentar attempts para rate limit
    confirmation.attempts = Math.max(0, confirmation.attempts - 1);
  } else {
    // Otros errores se manejan normalmente
    confirmation.status = ConfirmationStatus.FAILED;
    confirmation.errorMessage = errorMessage;
  }
}
```

**Beneficios**:
- ✅ Error 429 **no cuenta** como intento fallido
- ✅ Se reintenta automáticamente en el siguiente cron
- ✅ No se pierde la confirmación

### 4. **Retry Automático con Exponential Backoff**

```typescript
private async makeGHLRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      const statusCode = error.response?.status;
      
      // Solo reintentar en caso de 429 (Rate Limit)
      if (statusCode === 429 && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        this.logger.warn(`⚠️ Rate limit (429) - Reintentando en ${waitTime}ms (intento ${attempt + 1}/${maxRetries})`);
        await this.sleep(waitTime);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
```

**Tiempos de Retry**:
- Intento 1: falla → espera **2 segundos**
- Intento 2: falla → espera **4 segundos**
- Intento 3: falla → espera **8 segundos**
- Total: 3 intentos con 14 segundos de espera

### 5. **Envolver Todas las Llamadas a GHL**

Todas las llamadas HTTP a GHL ahora usan `makeGHLRequest`:

```typescript
// ❌ ANTES
const searchResp = await axios.post(searchUrl, searchPayload, { headers });

// ✅ AHORA
const searchResp = await this.makeGHLRequest(() => 
  axios.post(searchUrl, searchPayload, { headers })
);
```

**Aplicado a**:
1. ✅ Búsqueda por email
2. ✅ Búsqueda por teléfono
3. ✅ Crear contacto
4. ✅ Actualizar custom fields

## 📊 Comparación Antes vs Después

### Escenario: 20 Confirmaciones Pendientes

| Métrica | Antes | Después |
|---------|-------|---------|
| **Confirmaciones procesadas por lote** | 50 | 10 |
| **Requests por lote** | ~200 | ~40 |
| **Tiempo de procesamiento** | ~5s | ~15s |
| **Requests por segundo** | 40/s ❌ | 2.67/s ✅ |
| **Excede límite (10 req/s)** | Sí | No |
| **Probabilidad de 429** | Alta | Muy baja |
| **Retry automático en 429** | No | Sí |
| **Pérdida de confirmaciones** | Posible | No |

### Flujo Completo Ahora

```
1. Cron job se ejecuta cada hora
   ↓
2. Busca 10 confirmaciones pendientes (LIMIT 10)
   ↓
3. Por cada confirmación:
   a. Procesar (4 requests a GHL con retry automático)
   b. Esperar 1.5 segundos ⏱️
   c. Siguiente confirmación
   ↓
4. Si quedan más pendientes, el siguiente cron las procesará
```

## 🎯 Beneficios de las Mejoras

### 1. **Respeto del Rate Limit**
- ✅ 2.67 requests/segundo vs límite de 10/segundo
- ✅ Margen de seguridad del **73%**

### 2. **Resiliencia**
- ✅ Retry automático con exponential backoff
- ✅ Error 429 no cuenta como fallo
- ✅ Se reintenta hasta 3 veces con esperas crecientes

### 3. **Sin Pérdida de Datos**
- ✅ Confirmaciones no se pierden
- ✅ Se reencolan automáticamente
- ✅ El siguiente cron las procesa

### 4. **Logging Mejorado**
- ✅ Muestra delays entre procesamientos
- ✅ Identifica específicamente errores 429
- ✅ Muestra intentos de retry

### 5. **Escalabilidad**
- ✅ Procesa 10 por lote = 240 confirmaciones/hora
- ✅ Si necesitas más, aumentar frecuencia del cron
- ✅ O ejecutar manualmente lotes adicionales

## 🔢 Cálculos de Capacidad

### Por Hora (Cron Automático)

- **Cron**: 1 vez por hora
- **Por ejecución**: 10 confirmaciones
- **Por hora**: 10 confirmaciones
- **Por día**: 240 confirmaciones (24 horas)

### Manual (Botón "Procesar Pendientes")

- **Por click**: 10 confirmaciones
- **Tiempo**: ~15 segundos
- **Por minuto**: 40 confirmaciones (4 clicks)
- **Por hora** (manual continuo): 2,400 confirmaciones

### Rate Limit Safety

```
Límite GHL: 100 requests / 10 segundos

Escenario normal (10 confirmaciones):
- Requests: 40
- Tiempo: 15 segundos  
- Rate: 40 req / 15s = 2.67 req/s
- En 10 segundos: 26.7 requests ✅ (73% bajo el límite)

Escenario máximo (si se reduce delay):
- Delay mínimo seguro: 0.5s
- 10 confirmaciones × 0.5s = 5 segundos
- 40 requests / 5s = 8 req/s
- En 10 segundos: 80 requests ✅ (20% bajo el límite)
```

## 🚨 Recomendaciones de Uso

### Para Carga Normal (< 100 confirmaciones/día)

```typescript
take: 10,        // Batch size
delay: 1500ms,   // 1.5 segundos
```
✅ **Uso actual** - Muy seguro

### Para Carga Media (100-500 confirmaciones/día)

```typescript
take: 15,        // Batch size
delay: 1000ms,   // 1 segundo
cron: '*/30 * * * *'  // Cada 30 minutos
```
✅ Seguro - 360 confirmaciones/hora

### Para Carga Alta (> 500 confirmaciones/día)

```typescript
take: 20,        // Batch size
delay: 800ms,    // 0.8 segundos
cron: '*/15 * * * *'  // Cada 15 minutos
```
⚠️ Requiere monitoreo - 960 confirmaciones/hora

### Para Emergencias (Backlog Grande)

Ejecutar manualmente múltiples veces con el botón "Procesar Pendientes":
- Click → Espera 15s → Click → Espera 15s → ...
- 40 confirmaciones por minuto
- Monitorear logs por errores 429

## 📝 Logs Mejorados

### Antes (Sin Rate Limiting)

```
📋 Encontradas 50 confirmaciones pendientes
📤 Procesando confirmación abc-123
📤 Procesando confirmación abc-124
❌ Error 429: Rate limit exceeded
❌ Error 429: Rate limit exceeded
...
```

### Ahora (Con Rate Limiting)

```
📋 Encontradas 10 confirmaciones pendientes para procesar
📤 Procesando confirmación abc-123
✅ Confirmación abc-123 procesada exitosamente
⏱️ Esperando 1.5s antes de procesar siguiente (rate limit GHL)...
📤 Procesando confirmación abc-124
⚠️ Rate limit (429) - Reintentando en 2000ms (intento 1/3)
✅ Confirmación abc-124 procesada exitosamente
⏱️ Esperando 1.5s antes de procesar siguiente (rate limit GHL)...
...
✅ Procesamiento completo: 10 exitosas, 0 fallidas de 10 totales
```

## 🧪 Testing Recomendado

### Test 1: Procesar 10 Confirmaciones

1. Tener 10+ confirmaciones pendientes
2. Click en "Procesar Pendientes"
3. **Verificar logs**:
   - ✅ Delays de 1.5s entre cada una
   - ✅ No errores 429
   - ✅ Todas completadas
4. **Tiempo esperado**: ~15 segundos

### Test 2: Procesar 50 Confirmaciones

1. Tener 50+ confirmaciones pendientes
2. Click 5 veces en "Procesar Pendientes" (10 cada vez)
3. Esperar 15s entre cada click
4. **Verificar logs**:
   - ✅ 50 confirmaciones procesadas
   - ✅ Sin errores 429
5. **Tiempo total**: ~75 segundos (5 × 15s)

### Test 3: Simular Error 429

1. Reducir delay a 0ms temporalmente
2. Procesar confirmaciones
3. **Verificar**:
   - ✅ Se detecta el 429
   - ✅ Se reintenta automáticamente
   - ✅ Logs muestran reintentos
   - ✅ Eventualmente completa

### Test 4: Cron Automático

1. Dejar correr el cron cada hora
2. Monitorear logs durante 24 horas
3. **Verificar**:
   - ✅ Se procesan automáticamente
   - ✅ No errores 429
   - ✅ Todas completadas

## 🎓 Mejores Prácticas Implementadas

### 1. **Rate Limiting Proactivo**
No esperar a que falle, prevenir desde el inicio con delays.

### 2. **Exponential Backoff**
Aumentar tiempos de espera progresivamente en cada retry.

### 3. **Distinción de Errores**
Error 429 (temporal) se trata diferente a errores reales.

### 4. **Idempotencia**
Las confirmaciones pueden reprocesarse sin duplicados.

### 5. **Logging Transparente**
Usuario siempre sabe qué está pasando y por qué.

### 6. **Configurabilidad**
Fácil ajustar batch size y delays según necesidad.

## 🔄 Posibles Mejoras Futuras

### 1. **Token Bucket Algorithm**

```typescript
class TokenBucket {
  private tokens = 100;
  private lastRefill = Date.now();
  
  async consume(n: number): Promise<void> {
    this.refill();
    while (this.tokens < n) {
      await this.sleep(100);
      this.refill();
    }
    this.tokens -= n;
  }
  
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / 100); // 10 por segundo
    this.tokens = Math.min(100, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

### 2. **Rate Limit Headers**

Leer headers de respuesta de GHL para ajustar dinámicamente:
```typescript
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642089600
```

### 3. **Cola Distribuida**

Para múltiples instancias del backend, usar Redis o similar.

### 4. **Dashboard de Monitoreo**

Mostrar en UI:
- Requests por segundo actual
- Confirmaciones en cola
- ETA de procesamiento completo

## ✅ Checklist de Implementación

- [x] Reducir batch size de 50 a 10
- [x] Implementar helper `sleep()`
- [x] Agregar delays de 1.5s entre procesamientos
- [x] Manejo específico de error 429
- [x] Implementar `makeGHLRequest()` con retry
- [x] Envolver todas las llamadas a GHL
- [x] Exponential backoff (2s, 4s, 8s)
- [x] Logging mejorado
- [x] Compilar sin errores
- [x] Documentar completamente
- [ ] Testing manual (usuario debe verificar)
- [ ] Monitoreo en producción 24h

## 🎉 Resultado Final

### Antes
```
❌ Error 429: Rate limit exceeded
❌ 40 requests/segundo
❌ Confirmaciones fallidas
❌ Sin retry automático
```

### Ahora
```
✅ 2.67 requests/segundo
✅ Dentro del límite (73% de margen)
✅ Retry automático con backoff
✅ Sin pérdida de confirmaciones
✅ Logs claros y transparentes
```

## 🚀 Próximos Pasos

1. **Reinicia el backend** para aplicar cambios
2. **Prueba** con el botón "Procesar Pendientes"
3. **Verifica logs** para confirmar delays y sin 429
4. **Monitorea** durante 24h para confirmar estabilidad

---

**Estado**: ✅ Implementado y Compilado  
**Archivos modificados**: `backend/src/appointment-confirmations/appointment-confirmations.service.ts`  
**Líneas agregadas**: ~50 líneas  
**Testing**: Requiere verificación con datos reales en producción  
**Fecha**: 13 de enero 2026

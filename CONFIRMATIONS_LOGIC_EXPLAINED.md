# Explicación de la Lógica de Confirmaciones de Citas

## 🧮 Cálculo de Días

### Concepto Base

Cuando configuras **"X días antes"**, significa:
- **HOY** obtienes las citas que son **en X días**
- Las programas para confirmar **HOY** (o a la hora configurada)

## 📅 Ejemplos Prácticos

### Ejemplo 1: "1 día antes a las 9 AM"

**Hoy es**: Lunes 15 de enero, 10:00 AM

**Configuración**:
```
daysBeforeAppointment: 1
timeToSend: "09:00"
```

**Lo que hace el sistema**:

1. **Obtiene citas**:
   - Fecha base (hoy): 15 de enero
   - Fecha de citas a obtener: 15 + 1 = **16 de enero (Martes)**
   - Busca en Dentalink: citas con `fecha = 2026-01-16`

2. **Programa el envío**:
   - Fecha de la cita: 16 de enero
   - Días antes: 1
   - Enviar el: 16 - 1 = **15 de enero a las 9:00 AM**
   
3. **Resultado**:
   - ✅ Obtiene citas del **MARTES 16** (mañana)
   - ✅ Las programa para confirmar el **LUNES 15 a las 9 AM** (hoy en la mañana)
   - ✅ La confirmación se envía **1 día antes** de la cita

### Ejemplo 2: "2 días antes a las 9 AM"

**Hoy es**: Lunes 15 de enero, 10:00 AM

**Configuración**:
```
daysBeforeAppointment: 2
timeToSend: "09:00"
```

**Lo que hace el sistema**:

1. **Obtiene citas**:
   - Fecha base (hoy): 15 de enero
   - Fecha de citas a obtener: 15 + 2 = **17 de enero (Miércoles)**
   - Busca en Dentalink: citas con `fecha = 2026-01-17`

2. **Programa el envío**:
   - Fecha de la cita: 17 de enero
   - Días antes: 2
   - Enviar el: 17 - 2 = **15 de enero a las 9:00 AM**
   
3. **Resultado**:
   - ✅ Obtiene citas del **MIÉRCOLES 17** (pasado mañana)
   - ✅ Las programa para confirmar el **LUNES 15 a las 9 AM** (hoy en la mañana)
   - ✅ La confirmación se envía **2 días antes** de la cita

### Ejemplo 3: "0 días antes a las 8 AM" (mismo día)

**Hoy es**: Lunes 15 de enero, 10:00 AM

**Configuración**:
```
daysBeforeAppointment: 0
timeToSend: "08:00"
```

**Lo que hace el sistema**:

1. **Obtiene citas**:
   - Fecha base (hoy): 15 de enero
   - Fecha de citas a obtener: 15 + 0 = **15 de enero (Hoy)**
   - Busca en Dentalink: citas con `fecha = 2026-01-15`

2. **Programa el envío**:
   - Fecha de la cita: 15 de enero
   - Días antes: 0
   - Enviar el: 15 - 0 = **15 de enero a las 8:00 AM**
   
3. **Resultado**:
   - ✅ Obtiene citas del **LUNES 15** (hoy)
   - ✅ Las programa para confirmar el **LUNES 15 a las 8 AM** (hoy en la mañana)
   - ✅ La confirmación se envía **el mismo día** de la cita

## 🔄 Flujo Completo

```
1. Usuario configura: "1 día antes a las 9 AM"
   ↓
2. Sistema ejecuta (HOY = 15 de enero):
   - Calcula: appointmentDate = HOY + 1 = 16 de enero
   - Obtiene de Dentalink: citas con fecha = 16 de enero
   ↓
3. Para cada cita encontrada (ej: cita a las 14:00):
   - appointmentDate = 16 de enero, 14:00
   - scheduledFor = 16 - 1 días = 15 de enero, 9:00 AM
   - Almacena en BD con status = "pending"
   ↓
4. Cron Job (cada hora) verifica:
   - Hora actual: 15 de enero, 11:00 AM
   - scheduledFor: 15 de enero, 9:00 AM
   - ¿Ya pasó? SÍ → Procesa la confirmación
   ↓
5. Procesamiento:
   - Busca/crea contacto en GHL
   - Actualiza custom fields (incluye for_confirmation: true)
   - Marca como "completed"
```

## 📐 Fórmula de Cálculo

### Para Obtener Citas:
```
appointmentDate = HOY + daysBeforeAppointment
```

### Para Programar Envío:
```
scheduledFor = appointmentDate - daysBeforeAppointment + hora configurada
```

**Simplificado**:
```
scheduledFor = HOY + hora configurada
```

## 🧪 Testing con Fecha Específica

Puedes probar con una fecha específica usando el parámetro `targetDate`:

```bash
POST /clients/:clientId/appointment-confirmations/trigger
{
  "targetDate": "2026-01-20"
}
```

**Ejemplo**: Si configuras "1 día antes" y usas `targetDate: "2026-01-20"`:
- Sistema usa 20 de enero como "hoy"
- appointmentDate = 20 + 1 = **21 de enero**
- Obtiene citas del **21 de enero**
- Las programa para confirmar el **20 de enero** a la hora configurada

## ⚠️ Casos Especiales

### Si ejecutas después de la hora configurada

**Escenario**:
- Configuración: "1 día antes a las 9 AM"
- Hora actual: 15 de enero, 15:00 (3 PM)
- Ejecutas "Obtener Citas"

**Resultado**:
- Obtiene citas del 16 de enero
- scheduledFor = 15 de enero, 9:00 AM (ya pasó)
- El cron job las procesará en la próxima ejecución (inmediatamente)

### Si ejecutas antes de la hora configurada

**Escenario**:
- Configuración: "1 día antes a las 9 AM"
- Hora actual: 15 de enero, 7:00 AM
- Ejecutas "Obtener Citas"

**Resultado**:
- Obtiene citas del 16 de enero
- scheduledFor = 15 de enero, 9:00 AM (en 2 horas)
- El cron job esperará hasta las 9 AM para procesarlas

## 📊 Resumen Visual

| Configuración | Hoy es 15 Ene | Obtiene citas de | Confirma el | Descripción |
|--------------|---------------|------------------|-------------|-------------|
| 0 días antes | 15 Ene        | 15 Ene (hoy)     | 15 Ene      | Mismo día |
| 1 día antes  | 15 Ene        | 16 Ene (mañana)  | 15 Ene      | Un día antes |
| 2 días antes | 15 Ene        | 17 Ene (pasado)  | 15 Ene      | Dos días antes |
| 3 días antes | 15 Ene        | 18 Ene           | 15 Ene      | Tres días antes |

## 🔍 Verificación en Logs

Cuando ejecutas "Obtener Citas", busca en los logs:

```
🔍 [Confirmación 24h antes] Obteniendo citas para 2026-01-16 (en 1 días desde 2026-01-15)
✅ Obtenidas 5 citas de Dentalink
✅ Cita 123 almacenada para confirmación
```

El log muestra claramente:
- Fecha desde la que calcula (HOY)
- Días que suma
- Fecha final de las citas que obtiene

## 💡 Aclaración Importante

**"X días antes"** NO significa:
- ❌ Obtener citas de hace X días
- ❌ Obtener citas del pasado

**"X días antes"** SÍ significa:
- ✅ Obtener citas que son en X días (futuro)
- ✅ Para confirmarlas hoy (X días antes de la cita)
- ✅ Anticipación de X días

## 🎯 Caso de Uso Real

**Quieres**: Confirmar citas con 24 horas de anticipación

**Configuras**: "1 día antes a las 9 AM"

**Todos los días a las 9 AM el sistema**:
1. Obtiene las citas de MAÑANA
2. Las procesa inmediatamente
3. Actualiza los contactos en GHL
4. Los marca con `for_confirmation: true`

**Resultado**: Los pacientes quedan marcados en GHL 24 horas antes de su cita, permitiéndote enviar workflows, mensajes, etc.

---

**¿Aún confuso?** Si ves un comportamiento diferente al descrito aquí, por favor provee:
1. La configuración exacta (daysBeforeAppointment, timeToSend)
2. La fecha/hora cuando ejecutaste "Obtener Citas"
3. Las fechas de las citas que obtuviste
4. Los logs del backend

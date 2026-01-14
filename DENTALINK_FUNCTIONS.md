# Funciones de Dentalink - Documentación Completa

Este documento describe las 6 funciones principales implementadas para la integración con Dentalink.

## 📋 Índice

1. [Buscar Disponibilidad](#1-buscar-disponibilidad)
2. [Buscar Paciente](#2-buscar-paciente)
3. [Crear Paciente](#3-crear-paciente)
4. [Agendar Cita](#4-agendar-cita)
5. [Cancelar Cita](#5-cancelar-cita)
6. [Obtener Tratamientos](#6-obtener-tratamientos)

---

## 1. Buscar Disponibilidad

**Endpoint**: `POST /api/clients/:clientId/availability`

**Descripción**: Busca disponibilidad de profesionales en fechas específicas, con búsqueda iterativa hasta 4 semanas si no encuentra disponibilidad inmediata.

### Características Especiales

- ✅ Búsqueda iterativa de 4 semanas
- ✅ Filtra horarios futuros según timezone del cliente
- ✅ Valida bloques consecutivos para citas largas
- ✅ Obtiene nombres e intervalos de profesionales
- ✅ Formatea fechas en español

### Request Body

```json
{
  "ids_profesionales": [45, 67],
  "id_sucursal": 1,
  "fecha_inicio": "2024-01-20",  // Opcional, default: hoy
  "tiempo_cita": 30  // Opcional, en minutos
}
```

### Response

```json
{
  "disponibilidad": [
    {
      "id_profesional": 45,
      "nombre_profesional": "Dr. Juan Pérez",
      "fechas": {
        "Lunes 22 de Enero 2024": ["09:00", "09:30", "10:00"],
        "Martes 23 de Enero 2024": ["14:00", "14:30", "15:00"]
      }
    }
  ],
  "fecha_desde": "2024-01-20",
  "fecha_hasta": "2024-01-26"
}
```

### Validación de Bloques Consecutivos

Si especificas `tiempo_cita: 60` y el profesional tiene intervalo de 30 minutos, el sistema valida que existan 2 bloques consecutivos disponibles. Solo muestra horarios donde hay espacio suficiente.

---

## 2. Buscar Paciente

**Endpoint**: `POST /api/clients/:clientId/patients/search`

**Descripción**: Busca un paciente por RUT en Dentalink.

### Request Body

```json
{
  "rut": "12345678-9"
}
```

### Response

```json
{
  "paciente": {
    "id": 123,
    "nombre": "Juan",
    "apellidos": "Pérez González",
    "rut": "12345678-9",
    "celular": "+56912345678",
    "email": "juan@example.com",
    "fecha_nacimiento": "1990-01-15"
  }
}
```

### Características

- ✅ Formatea automáticamente el RUT (elimina puntos, mantiene guión)
- ✅ Búsqueda case-insensitive

---

## 3. Crear Paciente

**Endpoint**: `POST /api/clients/:clientId/patients`

**Descripción**: Crea un nuevo paciente en Dentalink. Si ya existe, retorna el existente.

### Request Body

```json
{
  "nombre": "Juan",
  "apellidos": "Pérez González",
  "rut": "12345678-9",
  "telefono": "+56912345678",  // Opcional
  "email": "juan@example.com",  // Opcional
  "fecha_nacimiento": "1990-01-15"  // Opcional, formato YYYY-MM-DD
}
```

### Response

```json
{
  "id_paciente": 123,
  "mensaje": "Paciente creado exitosamente"
}
```

### Características

- ✅ Verifica si el paciente ya existe antes de crear
- ✅ Si existe, retorna el ID del existente
- ✅ Formatea RUT automáticamente

---

## 4. Agendar Cita

**Endpoint**: `POST /api/clients/:clientId/appointments`

**Descripción**: Agenda una cita en Dentalink y opcionalmente la sincroniza con GoHighLevel.

### Request Body

```json
{
  "id_paciente": 123,
  "id_profesional": 45,
  "id_sucursal": 1,
  "fecha": "2024-01-20",
  "hora_inicio": "10:00",
  "tiempo_cita": 30,  // Opcional, en minutos
  "comentario": "Primera consulta",  // Opcional
  "userId": "ghl_contact_12345"  // Opcional, para integración GHL
}
```

### Response

```json
{
  "id_cita": 789,
  "mensaje": "Cita agendada exitosamente"
}
```

### Integración con GHL

Si el cliente tiene `ghlEnabled: true` y se proporciona `userId`:

1. ✅ Actualiza contacto en GHL con doctor, clínica y comentario
2. ✅ Obtiene assignedUserId del calendario
3. ✅ Crea appointment en calendario de GHL
4. ✅ Se ejecuta en background (no bloquea respuesta)
5. ✅ Si falla GHL, la cita igual se crea en Dentalink

### Características

- ✅ Obtiene automáticamente el intervalo del profesional si no se especifica duración
- ✅ Usa timezone del cliente para cálculos de fecha/hora
- ✅ Estado de cita: 7 (confirmado)

---

## 5. Cancelar Cita

**Endpoint**: `POST /api/clients/:clientId/appointments/cancel`

**Descripción**: Cancela una cita. Puede cancelar por ID específico o por RUT (cancela la próxima futura).

### Opción A: Cancelar por ID

```json
{
  "id_cita": 789
}
```

### Opción B: Cancelar por RUT (próxima futura)

```json
{
  "rut": "12345678-9"
}
```

### Response

```json
{
  "mensaje": "Cita cancelada exitosamente",
  "id_cita": 789,
  "fecha": "2024-01-20",
  "hora_inicio": "10:00"
}
```

### Características

- ✅ Si cancelas por RUT, busca automáticamente la próxima cita futura activa
- ✅ Filtra citas ya anuladas
- ✅ Ordena por fecha/hora para cancelar la más próxima
- ✅ Usa timezone del cliente para determinar "futuras"

---

## 6. Obtener Tratamientos

**Endpoint**: `POST /api/clients/:clientId/patients/:rut/treatments`

**Descripción**: Obtiene todos los tratamientos de un paciente por RUT.

### Request

URL: `/api/clients/:clientId/patients/12345678-9/treatments`

### Response

```json
{
  "paciente": {
    "id": 123,
    "nombre": "Juan Pérez González",
    "rut": "12345678-9"
  },
  "tratamientos": [
    {
      "id": 456,
      "fecha": "2023-12-15",
      "id_dentista": 45,
      "nombre_dentista": "Dr. Juan Pérez",
      "id_sucursal": 1,
      "nombre_sucursal": "Clínica Central",
      "finalizado": true
    }
  ],
  "total_tratamientos": 1
}
```

### Características

- ✅ Filtra campos relevantes de tratamientos
- ✅ Incluye información del dentista y sucursal
- ✅ Indica si está finalizado

---

## 🌍 Timezone por Cliente

Todas las funciones que manejan fechas/horarios usan el timezone configurado en el cliente:

- `search_availability`: Para filtrar horarios futuros
- `schedule_appointment`: Para crear la cita con la hora correcta
- `cancel_appointment`: Para determinar qué citas son futuras

**Ejemplo**: Si tu cliente está en Chile (`America/Santiago`) y son las 14:00, solo mostrará horarios después de las 14:00 hora Chile, incluso si hay disponibilidad a las 13:00.

---

## 🔗 Integración GoHighLevel (GHL)

La integración GHL está disponible **solo en `schedule_appointment`** y requiere:

### Configuración del Cliente

```json
{
  "ghlEnabled": true,
  "ghlAccessToken": "pit-xxxxx...",
  "ghlCalendarId": "7U0Cv0cyOIBktrn4qihl",
  "ghlLocationId": "Y6SfrX5Wf5M9eaz8LSq4"
}
```

### Al Crear Cita

Si proporcionas `userId` en el request, el sistema:

1. Crea la cita en Dentalink
2. En background (sin bloquear):
   - Actualiza contacto en GHL
   - Crea appointment en calendario GHL
3. Retorna respuesta inmediatamente

### Campos Custom en GHL

- `doctor`: Nombre del profesional
- `clinica`: Nombre de la sucursal
- `comentario`: Comentario de la cita (si existe)

---

## 🛠️ Utilidades Implementadas

### Formato de RUT

```typescript
formatearRut("12.345.678-9") → "12345678-9"
formatearRut("123456789") → "12345678-9"
```

### Formato de Fechas

```typescript
formatearFechaEspanol("2024-01-20") → "Sábado 20 de Enero 2024"
```

### Validación de Bloques Consecutivos

Verifica que existan suficientes bloques horarios consecutivos para una cita larga.

```typescript
// Cita de 60 min, intervalo de 30 min = necesita 2 bloques
validarBloquesConsecutivos(
  ["09:00", "09:30", "10:30"],  // Horarios disponibles
  60,   // Tiempo cita
  30    // Intervalo profesional
)
// Retorna: ["09:00"] (solo este tiene 2 bloques consecutivos)
```

---

## 📝 Notas Importantes

1. **API Keys**: Cada cliente usa su propia API key de Dentalink
2. **Timezone**: Crucial para el manejo correcto de fechas y horarios
3. **GHL**: Opcional y solo para schedule_appointment
4. **RUT**: Siempre se formatea automáticamente
5. **Errores**: Si Dentalink falla, se propaga el error con detalles

---

## 🔍 Testing

```bash
# Test de conexión
POST /api/clients/:clientId/test-connection
```

Verifica que la API key del cliente sea válida y que pueda conectarse a Dentalink.

---

## 💡 Ejemplos de Uso

Ver [API_EXAMPLES.md](API_EXAMPLES.md) para ejemplos completos en:
- cURL
- JavaScript/TypeScript
- Python

---

## 🆘 Troubleshooting

### Error: "No se encontró disponibilidad en las próximas 4 semanas"
- Verifica que los profesionales tengan horarios configurados en Dentalink
- Confirma que los IDs de profesional y sucursal sean correctos

### Error: "Paciente con RUT X no encontrado"
- Verifica el formato del RUT (debe ser 12345678-9)
- Confirma que el paciente existe en Dentalink

### Error: "No se pudo determinar la duración de la cita"
- Especifica `tiempo_cita` en minutos, o
- Asegúrate de que el profesional tenga intervalo configurado en Dentalink

### GHL no sincroniza
- Verifica que `ghlEnabled: true` en el cliente
- Confirma que los tokens de GHL sean válidos
- Proporciona `userId` en el request de crear cita
- Revisa los logs del backend para más detalles



# Funcionalidad: Selección de Estados de Cita

## ✅ Cambios Implementados (Backend)

### 1. Base de Datos

**Entidad `ConfirmationConfig`**:
- ✅ Agregado campo `appointmentStates` (TEXT)
- Almacena IDs de estados separados por coma (ej: "7,3,5")
- Valor por defecto: "7" (Confirmado)

**Entidad `PendingConfirmation`**:
- ✅ Agregado `id_estado` y `estado_cita` en appointmentData
- Permite saber qué estado tenía la cita cuando se almacenó

### 2. DTOs

**CreateConfirmationConfigDto**:
```typescript
appointmentStates?: number[];  // Opcional, array de IDs
```

**UpdateConfirmationConfigDto**:
```typescript
appointmentStates?: number[];  // Opcional, array de IDs
```

### 3. Servicio

**Nuevo método**: `getAppointmentStates(clientId)`
- Obtiene estados de Dentalink
- Filtra solo estados habilitados y no de uso interno
- Endpoint: GET `/citas/estados`

**Modificado**: `fetchAndStoreAppointments()`
- Usa los estados configurados en lugar del hardcoded "7"
- Soporta múltiples estados con operador `in`
- Log mejorado muestra estados usados

**Modificado**: `createConfig()` y `updateConfig()`
- Convierte array de estados a string separado por comas
- Valida y almacena correctamente

### 4. Controlador

**Nuevo endpoint**:
```
GET /clients/:clientId/appointment-confirmations/appointment-states
→ Retorna lista de estados disponibles en Dentalink
```

### 5. Lógica de Filtrado

**Antes**:
```javascript
filtro = {
  fecha: { eq: appointmentDate },
  id_estado: { eq: 7 }  // Hardcoded
}
```

**Ahora**:
```javascript
const stateIds = config.appointmentStates.split(',').map(id => parseInt(id));

filtro = {
  fecha: { eq: appointmentDate },
  id_estado: stateIds.length === 1 
    ? { eq: stateIds[0] } 
    : { in: stateIds }  // Múltiples estados
}
```

## 🎯 Estructura de Estados de Dentalink

```javascript
{
  id: 3,
  nombre: "Confirmado por teléfono",
  color: "#87bce4",
  reservado: 1,      // 1 = estado por defecto
  anulacion: 0,      // 1 = es anulación
  uso_interno: 0,    // 1 = no seleccionable manualmente
  habilitado: 1      // 1 = habilitado
}
```

**Estados filtrados**: Solo se muestran si `habilitado = 1` y `uso_interno = 0`

## 📊 Estados Comunes

| ID | Nombre | Tipo |
|----|--------|------|
| 1 | Anulado | Anulación |
| 2 | Atendido | Atendido |
| 3 | Confirmado por teléfono | Confirmación |
| 7 | No confirmado | Pendiente |

*Nota: Los IDs pueden variar según la configuración de cada clínica*

## 🎨 Frontend (Pendiente de Implementación)

### Lo que se necesita agregar:

#### 1. Carga de Estados

```typescript
const [appointmentStates, setAppointmentStates] = useState<AppointmentState[]>([]);

useEffect(() => {
  loadAppointmentStates();
}, []);

const loadAppointmentStates = async () => {
  const states = await appointmentConfirmationsApi.getAppointmentStates(clientId);
  setAppointmentStates(states);
};
```

#### 2. Selector de Estados Múltiples

En el formulario de crear/editar configuración:

```typescript
<div>
  <label>Estados de Cita a Confirmar</label>
  <select 
    multiple 
    value={formData.appointmentStates || [7]}
    onChange={(e) => {
      const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
      setFormData({ ...formData, appointmentStates: selected });
    }}
  >
    {appointmentStates.map(state => (
      <option key={state.id} value={state.id}>
        {state.nombre}
      </option>
    ))}
  </select>
  <p className="text-xs text-gray-500">
    Mantén presionado Ctrl/Cmd para seleccionar múltiples
  </p>
</div>
```

#### 3. Mostrar Estados Seleccionados

En la lista de configuraciones:

```typescript
{config.appointmentStates.split(',').map(id => {
  const state = appointmentStates.find(s => s.id === parseInt(id));
  return state ? (
    <span 
      key={id}
      className="px-2 py-0.5 rounded text-xs"
      style={{ backgroundColor: state.color, color: '#fff' }}
    >
      {state.nombre}
    </span>
  ) : null;
})}
```

#### 4. Tabla Mejorada de Citas Pendientes

```typescript
<table>
  <thead>
    <tr>
      <th>Paciente</th>
      <th>Teléfono</th>
      <th>Email</th>
      <th>ID Cita</th>
      <th>Fecha Cita</th>
      <th>Hora</th>
      <th>Estado</th>
      <th>Dentista</th>
      <th>Envío</th>
      <th>Estado Proceso</th>
    </tr>
  </thead>
  <tbody>
    {filteredPending.map(item => (
      <tr key={item.id}>
        <td>{item.appointmentData.nombre_paciente}</td>
        <td>{item.appointmentData.telefono_paciente || '-'}</td>
        <td>{item.appointmentData.email_paciente || '-'}</td>
        <td>{item.appointmentData.id_paciente}</td>
        <td>{new Date(item.appointmentData.fecha).toLocaleDateString()}</td>
        <td>{item.appointmentData.hora_inicio}</td>
        <td>
          <span style={{ 
            backgroundColor: getStateColor(item.appointmentData.id_estado),
            padding: '2px 8px',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '12px'
          }}>
            {item.appointmentData.estado_cita}
          </span>
        </td>
        <td>{item.appointmentData.nombre_dentista}</td>
        <td>{new Date(item.scheduledFor).toLocaleString()}</td>
        <td>{getStatusBadge(item.status)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

#### 5. Filtros

```typescript
const [filters, setFilters] = useState({
  estado: 'all',
  fecha: '',
  status: 'all',
});

const filteredPending = pending.filter(item => {
  if (filters.estado !== 'all' && item.appointmentData.id_estado !== parseInt(filters.estado)) {
    return false;
  }
  if (filters.fecha && item.appointmentData.fecha !== filters.fecha) {
    return false;
  }
  if (filters.status !== 'all' && item.status !== filters.status) {
    return false;
  }
  return true;
});

// UI de filtros
<div className="filters">
  <select 
    value={filters.estado}
    onChange={(e) => setFilters({...filters, estado: e.target.value})}
  >
    <option value="all">Todos los estados</option>
    {appointmentStates.map(state => (
      <option key={state.id} value={state.id}>{state.nombre}</option>
    ))}
  </select>

  <input 
    type="date"
    value={filters.fecha}
    onChange={(e) => setFilters({...filters, fecha: e.target.value})}
  />

  <select 
    value={filters.status}
    onChange={(e) => setFilters({...filters, status: e.target.value})}
  >
    <option value="all">Todos los procesos</option>
    <option value="pending">Pendiente</option>
    <option value="processing">Procesando</option>
    <option value="completed">Completado</option>
    <option value="failed">Fallido</option>
  </select>
</div>
```

## 🧪 Ejemplo de Uso

### Configuración con Múltiples Estados

```javascript
{
  name: "Confirmación múltiple",
  daysBeforeAppointment: 1,
  timeToSend: "09:00",
  ghlCalendarId: "cal_123",
  appointmentStates: [7, 3, 5],  // No confirmado, Confirmado por teléfono, Otro
  isEnabled: true,
  order: 1
}
```

### Resultado al Ejecutar

El sistema obtendrá citas de Dentalink con cualquiera de estos estados:
- id_estado = 7 (No confirmado)
- id_estado = 3 (Confirmado por teléfono)
- id_estado = 5 (Otro estado configurado)

## 📝 Cambios en Base de Datos

### Migración Necesaria

Si ya tienes configuraciones existentes, tienen `appointmentStates = "7"` por defecto.

No se requiere migración manual, las configuraciones existentes seguirán funcionando con el estado 7.

## 🎯 Beneficios

1. **Flexibilidad**: Cada cliente puede elegir qué estados confirmar
2. **Múltiples estados**: No limitado a un solo estado
3. **Información completa**: Tabla muestra todos los datos relevantes
4. **Filtros avanzados**: Búsqueda rápida por estado, fecha o status
5. **Visual**: Estados con colores de Dentalink

## ⚠️ Consideraciones

1. **Estados de Anulación**: Si incluyes estados con `anulacion = 1`, confirmarás citas anuladas (probablemente no quieras esto)

2. **Estados Internos**: El sistema filtra automáticamente estados con `uso_interno = 1`

3. **Estados Deshabilitados**: Solo se muestran estados con `habilitado = 1`

4. **Validación**: El frontend debe validar que al menos un estado esté seleccionado

## 🚀 Próximos Pasos

Para completar la funcionalidad en el frontend:

1. Agregar carga de estados en `useEffect`
2. Implementar selector múltiple en el formulario
3. Mostrar chips de estados seleccionados en la lista
4. Mejorar tabla de citas pendientes con nuevas columnas
5. Agregar componente de filtros
6. Estilizar estados con los colores de Dentalink

---

**Estado**: Backend completo ✅ | Frontend pendiente ⏳
**Versión**: 1.3.0

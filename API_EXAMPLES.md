# Ejemplos de Uso de la API

Esta guía muestra cómo usar los endpoints de la API una vez que hayas creado un cliente.

## Crear un Cliente

Primero, necesitas crear un cliente usando la interfaz web o directamente con la API:

```bash
curl -X POST http://localhost:3001/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clínica Dental ABC",
    "apiKey": "tu-api-key-de-dentalink",
    "description": "Integración para clínica principal"
  }'
```

Respuesta:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Clínica Dental ABC",
  "apiKey": "tu-api-key-de-dentalink",
  "description": "Integración para clínica principal",
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

Guarda el `id` del cliente, lo necesitarás para las siguientes llamadas.

## Obtener Endpoints Disponibles

Para ver todos los endpoints disponibles para un cliente:

```bash
curl http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/endpoints
```

## Ejemplos de Endpoints de Dentalink

### 1. Crear una Cita

```bash
curl -X POST http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "12345",
    "doctorId": "67890",
    "date": "2024-01-20",
    "time": "10:00",
    "duration": 30,
    "reason": "Consulta general"
  }'
```

### 2. Ver Disponibilidad

```bash
curl "http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/availability?date=2024-01-20&doctorId=67890"
```

### 3. Listar Citas

```bash
# Todas las citas
curl http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/appointments

# Con filtros
curl "http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/appointments?date=2024-01-20&status=pending"
```

### 4. Obtener una Cita Específica

```bash
curl http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/appointments/apt-12345
```

### 5. Confirmar una Cita

```bash
curl -X PUT http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/appointments/apt-12345/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "confirmedBy": "patient",
    "confirmationMethod": "phone"
  }'
```

### 6. Cancelar una Cita

```bash
curl -X DELETE http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/appointments/apt-12345 \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Paciente no puede asistir",
    "cancelledBy": "patient"
  }'
```

## Ejemplo con JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440000';

// Cliente Axios configurado
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Crear una cita
async function createAppointment() {
  try {
    const response = await api.post(
      `/clients/${CLIENT_ID}/appointments`,
      {
        patientId: '12345',
        doctorId: '67890',
        date: '2024-01-20',
        time: '10:00',
        duration: 30,
        reason: 'Consulta general',
      }
    );
    
    console.log('Cita creada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al crear cita:', error.response?.data || error.message);
    throw error;
  }
}

// Ver disponibilidad
async function checkAvailability(date: string, doctorId: string) {
  try {
    const response = await api.get(
      `/clients/${CLIENT_ID}/availability`,
      {
        params: { date, doctorId }
      }
    );
    
    console.log('Disponibilidad:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error.response?.data || error.message);
    throw error;
  }
}

// Listar citas
async function listAppointments(filters?: { date?: string; status?: string }) {
  try {
    const response = await api.get(
      `/clients/${CLIENT_ID}/appointments`,
      { params: filters }
    );
    
    console.log('Citas:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al listar citas:', error.response?.data || error.message);
    throw error;
  }
}

// Confirmar cita
async function confirmAppointment(appointmentId: string) {
  try {
    const response = await api.put(
      `/clients/${CLIENT_ID}/appointments/${appointmentId}/confirm`,
      {
        confirmedBy: 'patient',
        confirmationMethod: 'phone',
      }
    );
    
    console.log('Cita confirmada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al confirmar cita:', error.response?.data || error.message);
    throw error;
  }
}

// Cancelar cita
async function cancelAppointment(appointmentId: string, reason: string) {
  try {
    const response = await api.delete(
      `/clients/${CLIENT_ID}/appointments/${appointmentId}`,
      {
        data: {
          reason,
          cancelledBy: 'patient',
        }
      }
    );
    
    console.log('Cita cancelada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al cancelar cita:', error.response?.data || error.message);
    throw error;
  }
}

// Uso
async function main() {
  // Verificar disponibilidad
  await checkAvailability('2024-01-20', '67890');
  
  // Crear una cita
  const appointment = await createAppointment();
  
  // Listar todas las citas
  await listAppointments();
  
  // Confirmar la cita
  await confirmAppointment(appointment.id);
  
  // Si es necesario, cancelar
  // await cancelAppointment(appointment.id, 'Paciente no puede asistir');
}
```

## Ejemplo con Python

```python
import requests
import json

API_URL = "http://localhost:3001/api"
CLIENT_ID = "550e8400-e29b-41d4-a716-446655440000"

class DentalinkClient:
    def __init__(self, api_url: str, client_id: str):
        self.api_url = api_url
        self.client_id = client_id
        self.base_path = f"{api_url}/clients/{client_id}"
    
    def create_appointment(self, data: dict):
        """Crear una nueva cita"""
        url = f"{self.base_path}/appointments"
        response = requests.post(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def get_availability(self, date: str, doctor_id: str):
        """Consultar disponibilidad"""
        url = f"{self.base_path}/availability"
        params = {"date": date, "doctorId": doctor_id}
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    def list_appointments(self, filters: dict = None):
        """Listar citas"""
        url = f"{self.base_path}/appointments"
        response = requests.get(url, params=filters or {})
        response.raise_for_status()
        return response.json()
    
    def get_appointment(self, appointment_id: str):
        """Obtener detalles de una cita"""
        url = f"{self.base_path}/appointments/{appointment_id}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    
    def confirm_appointment(self, appointment_id: str, data: dict):
        """Confirmar una cita"""
        url = f"{self.base_path}/appointments/{appointment_id}/confirm"
        response = requests.put(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def cancel_appointment(self, appointment_id: str, reason: str):
        """Cancelar una cita"""
        url = f"{self.base_path}/appointments/{appointment_id}"
        data = {"reason": reason, "cancelledBy": "patient"}
        response = requests.delete(url, json=data)
        response.raise_for_status()
        return response.json()

# Uso
if __name__ == "__main__":
    client = DentalinkClient(API_URL, CLIENT_ID)
    
    # Verificar disponibilidad
    availability = client.get_availability("2024-01-20", "67890")
    print("Disponibilidad:", availability)
    
    # Crear una cita
    appointment_data = {
        "patientId": "12345",
        "doctorId": "67890",
        "date": "2024-01-20",
        "time": "10:00",
        "duration": 30,
        "reason": "Consulta general"
    }
    appointment = client.create_appointment(appointment_data)
    print("Cita creada:", appointment)
    
    # Listar citas
    appointments = client.list_appointments({"date": "2024-01-20"})
    print("Citas del día:", appointments)
    
    # Confirmar cita
    confirmation = client.confirm_appointment(
        appointment["id"],
        {"confirmedBy": "patient", "confirmationMethod": "phone"}
    )
    print("Cita confirmada:", confirmation)
```

## Manejo de Errores

El API retorna errores en formato JSON con la siguiente estructura:

```json
{
  "statusCode": 400,
  "message": "Mensaje de error descriptivo",
  "error": "Bad Request"
}
```

Códigos de estado comunes:
- `200 OK` - Solicitud exitosa
- `201 Created` - Recurso creado exitosamente
- `204 No Content` - Solicitud exitosa sin contenido de respuesta
- `400 Bad Request` - Datos inválidos
- `404 Not Found` - Recurso no encontrado
- `409 Conflict` - Conflicto (ej: API key duplicada)
- `502 Bad Gateway` - Error al comunicarse con Dentalink

## Probar la Conexión

Antes de usar los endpoints, puedes probar la conexión:

```bash
curl -X POST http://localhost:3001/api/clients/550e8400-e29b-41d4-a716-446655440000/test-connection
```

Respuesta:
```json
{
  "connected": true,
  "message": "Connection successful"
}
```

## Notas Importantes

1. **Reemplaza el CLIENT_ID**: Usa el ID real del cliente que creaste
2. **Formato de Datos**: Los formatos exactos de fecha, hora y otros campos dependen de la API de Dentalink
3. **Rate Limiting**: Ten en cuenta los límites de Dentalink para las llamadas a su API
4. **API Key**: Nunca expongas la API key en el cliente, siempre usa el proxy del backend

## Soporte

Si encuentras problemas con los endpoints, verifica:
1. Que el backend esté corriendo
2. Que el cliente exista y esté activo
3. Que la API key sea válida
4. Los logs del backend para más detalles


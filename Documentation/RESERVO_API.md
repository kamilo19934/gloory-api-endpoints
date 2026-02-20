# API de Reservo - Documentacion

## Informacion General

**Base URL**: `https://reservo.cl/APIpublica/v2`

**Version**: v2

**Documentacion Oficial**: https://reservo.cl/APIpublica/v2/documentacion/

Reservo es un sistema de gestion de citas medicas que permite agendar, confirmar, cancelar y consultar citas a traves de su API REST.

## Autenticacion

Todos los endpoints requieren un token de autenticacion en el header `Authorization`.

```http
Authorization: TU_API_TOKEN
```

Errores de autenticacion retornan status `401`:
```json
{
  "errores": {
    "autenticacion_fallida": ["Token invalido."]
  }
}
```

## Respuestas Paginadas

La mayoria de los endpoints GET retornan respuestas paginadas:

```json
{
  "cantidad_elementos": 123,
  "pagina_siguiente": "http://api.example.org/accounts/?pagina=4",
  "pagina_anterior": "http://api.example.org/accounts/?pagina=2",
  "resultados": [...]
}
```

Para navegar entre paginas, usar el parametro `pagina` en la query string.

## Conceptos Clave

### Agendas
Las agendas son contenedores que organizan las citas. Pueden ser presenciales u online. Cada agenda tiene un UUID unico.

### Sucursales
Las sucursales son ubicaciones fisicas. Una agenda puede tener multiples sucursales. El UUID de la sucursal se obtiene de la respuesta de disponibilidad o del endpoint de sucursales, **no se configura manualmente**.

### Estados de Cita
| Codigo | Descripcion |
|--------|-------------|
| `NC` | No Confirmado (cita activa pendiente) |
| `C` | Confirmado |
| `S` | Suspendido/Cancelado |

### Condiciones para cambio de estado (PUT /citas/)
- Citas **eliminadas** NO se pueden modificar
- Citas **suspendidas** NO se pueden confirmar
- Citas en **lista de espera** NO se pueden confirmar ni suspender
- Solo se puede cambiar a `C` (confirmar) o `S` (suspender)

### Consideraciones importantes sobre citas
- Las citas en estado **lista de espera** NO se deben modificar ni notificar al cliente
- Una cita puede NO tener profesional asignado
- Una cita puede NO tener datos de cliente
- Una cita puede NO tener tratamientos asignados
- Las citas pueden ser online o presenciales

---

## Endpoints Disponibles

### 1. Obtener Sucursales de una Agenda

**Endpoint**: `GET /agenda_online/{uuid_agenda}/sucursales/`

**Parametros**:
- `uuid_agenda` (path, requerido): UUID de la agenda
- `pagina` (query, opcional): Numero de pagina
- `search_text` (query, opcional): Busqueda por coincidencia
- `uuid_profesional` (query, opcional): Filtro por profesional
- `uuid_sucursal` (query, opcional): Filtro por sucursal
- `uuid_tratamiento` (query, opcional): Filtro por tratamiento

**Response** (200):
```json
{
  "cantidad_elementos": 2,
  "pagina_siguiente": null,
  "pagina_anterior": null,
  "resultados": [
    {
      "sucursal": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "direccion": "Av. Vitacura 123",
      "comuna": "Las Condes",
      "region": "Region Metropolitana",
      "nombre": "Clinica x"
    }
  ]
}
```

---

### 2. Obtener Profesionales

**Endpoint**: `GET /agenda_online/{uuid_agenda}/profesionales/`

> **Nota**: El campo `agenda` sera deprecado. Usar `uuid` en su lugar.

**Parametros**:
- `uuid_agenda` (path, requerido): UUID de la agenda
- `pagina` (query, opcional): Numero de pagina
- `search_text` (query, opcional): Busqueda por nombre
- `uuid_profesional` (query, opcional): Filtro por profesional
- `uuid_sucursal` (query, opcional): Filtro por sucursal
- `uuid_tratamiento` (query, opcional): Filtro por tratamiento

**Response** (200):
```json
{
  "cantidad_elementos": 5,
  "pagina_siguiente": null,
  "pagina_anterior": null,
  "resultados": [
    {
      "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "identificador": "11111111-1",
      "nombre": "Dr. Pedro",
      "cargo": "Kinesiologia",
      "codigo_especialidad": "K",
      "sucursal": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    }
  ]
}
```

---

### 3. Obtener Tratamientos

**Endpoint**: `GET /agenda_online/{uuid_agenda}/tratamientos/`

**Parametros**: Mismos que profesionales.

**Response** (200):
```json
{
  "cantidad_elementos": 10,
  "pagina_siguiente": null,
  "pagina_anterior": null,
  "resultados": [
    {
      "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Examen de sangre",
      "descripcion": "Examen de sangre para alergias",
      "categoria": {
        "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "nombre": "Examenes",
        "codigo": "E"
      },
      "valor": 5000
    }
  ]
}
```

---

### 4. Obtener Disponibilidad

**Endpoint**: `GET /agenda_online/{uuid_agenda}/horarios_disponibles/`

Busqueda semanal (Lunes a Domingo). No retorna bloques anteriores al momento de la consulta.

**Parametros**:
- `uuid_agenda` (path, requerido): UUID de la agenda
- `uuid_tratamiento` (query, **requerido**): UUID del tratamiento
- `fecha` (query, opcional): Fecha de partida (YYYY-MM-DD)
- `uuid_profesional` (query, opcional): Filtro por profesional
- `uuid_sucursal` (query, opcional): Filtro por sucursal

**Response** (200):
```json
[
  {
    "fecha": "2023-12-15",
    "sucursales": [
      {
        "nombre": "Clinica x",
        "direccion": "Av. Vitacura 123",
        "profesionales": [
          {
            "agenda": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "nombre": "Dr. Pedro",
            "horas_disponibles": [
              "2023-12-15T09:00:00-03:00",
              "2023-12-15T09:30:00-03:00",
              "2023-12-15T10:00:00-03:00"
            ]
          }
        ]
      }
    ]
  }
]
```

**Nota**: La sucursal viene en la respuesta - este es el valor que se usa al crear la cita.

**Error 422**: Cliente no tiene configurada su zona horaria.

---

### 5. Buscar Paciente

**Endpoint**: `GET /cliente/`

**Parametros**:
- `identificador` (query): RUT u otro identificador
- `mail` (query): Email del paciente
- `uuid` (query): UUID del paciente
- `pagina` (query): Numero de pagina

**Response** (200): Respuesta paginada con lista de pacientes.

---

### 6. Obtener Detalle de Paciente

**Endpoint**: `GET /cliente/{uuid}/`

**Parametros**:
- `uuid` (path, requerido): UUID del paciente

**Response** (200):
```json
{
  "uuid": "9462b4fc-c12d-11ee-8720-0242ac120005",
  "identificador": "2233-6",
  "nombre": "Luis",
  "apellido_paterno": "Gonzalez",
  "apellido_materno": "Gonzalez",
  "telefono_1": "+5625235",
  "telefono_2": "+5624353253",
  "mail": "lgonza@gmol.cl",
  "ficha": "A110067",
  "sexo": "Masculino",
  "direccion": {
    "pais": "Chile",
    "estado": "",
    "ciudad": "",
    "calle": ""
  },
  "prevision": {
    "nombre": "Banmedica",
    "codigo": null
  },
  "ocupacion": "abogado",
  "fecha_nacimiento": "1970-05-19",
  "estado": "Activo",
  "campos_personalizados": [],
  "categoria": {
    "nombre": "Premium",
    "descripcion": "Clientes que llevan mas de 3 anos"
  }
}
```

---

### 7. Crear Paciente

**Endpoint**: `POST /cliente/`

**Body** (array):
```json
[
  {
    "identificador": "11111111",
    "nombre": "Luis",
    "apellido_paterno": "Gonzalez",
    "apellido_materno": "Gonzalez",
    "telefono_1": "+5225235",
    "mail": "example@example.com",
    "sexo": 1,
    "fecha_nacimiento": "1990-01-01",
    "campos_personalizados": [
      {
        "uuid": "2766ce34-99cc-4936-825c-f4a6781d3f71",
        "valor": "ejemplo"
      }
    ]
  }
]
```

**Nota**: El body es un **array** de pacientes. Para `sexo`, consultar `/agenda_online/sexo_paciente/`.

**Response** (201): Paciente creado.

---

### 8. Obtener Citas

**Endpoint**: `GET /citas/`

Permite obtener citas dentro de un rango de hasta **31 dias**.

**Parametros**:
- `fecha_inicial` (query): Fecha inicio (YYYY-MM-DD)
- `fecha_final` (query): Fecha fin (YYYY-MM-DD)
- `uuid_cliente` (query): Filtro por paciente
- `uuid` (query): UUID de una cita especifica
- `pagina` (query): Numero de pagina

**Response** (200):
```json
{
  "cantidad_elementos": 1,
  "pagina_siguiente": null,
  "pagina_anterior": null,
  "resultados": [
    {
      "uuid": "4488166370087689...",
      "agenda": {
        "uuid": "97754d14-...",
        "descripcion": "Agenda Doctor Mario"
      },
      "sucursal": {
        "uuid": "76c095c2...",
        "nombre": "Centro Medico Doctor Mario"
      },
      "zona_horaria": "America/Santiago",
      "inicio": "2022-10-27T11:30:00Z",
      "fin": "2022-10-27T12:45:00Z",
      "estado": {
        "codigo": "NC",
        "descripcion": "No Confirmado"
      },
      "estado_pago": {
        "codigo": "NP",
        "descripcion": "No Pagado"
      },
      "cliente": {
        "uuid": "...",
        "identificador": "12345678-9",
        "nombre": "Juan",
        "apellido_paterno": "Perez",
        "apellido_materno": "Soto",
        "telefono_1": "+56912345678",
        "mail": "juan@example.com",
        "prevision": { "nombre": "Fonasa", "codigo": "" }
      },
      "profesional": {
        "uuid": "73004a79-...",
        "identificador": "14442542-4",
        "nombre": "Dra. Mirelly",
        "cargo": "Doctora",
        "codigo_especialidad": "12345"
      },
      "tratamientos": [
        {
          "uuid": "42f329c2-...",
          "nombre": "Agendamiento Demo",
          "codigo": "T-DEMO",
          "categoria": {
            "uuid": "63ce753c-...",
            "nombre": "Tratamientos",
            "codigo": "T"
          },
          "indicacion": "Indicacion del tratamiento"
        }
      ],
      "online": true,
      "fecha_creacion": "2022-09-20T19:07:57Z",
      "origen_creacion": { "descripcion": "Backoffice Reservo" },
      "url_pago_online": "https//reservo.cl/example_pago_online/",
      "url_videoconferencia": "https//reservo.cl/example_videoconferencia/"
    }
  ]
}
```

---

### 9. Confirmar/Cancelar Cita

**Endpoint**: `PUT /citas/`

**Body**:
```json
{
  "uuid": "876876dsad868868d67a8f86f8ao",
  "estado_codigo": "C"
}
```

- `estado_codigo: "C"` = Confirmar
- `estado_codigo: "S"` = Suspender/Cancelar

**Response** (200):
```json
{
  "uuid": "876876dsad868868d67a8f86f8ao",
  "estado_codigo": "C"
}
```

**Errores posibles** (400):
```json
{
  "errores": {
    "estado_codigo": ["La cita se encuentra en lista de espera, no es posible hacer modificaciones"]
  }
}
```

---

### 10. Crear Cita

**Endpoint**: `POST /makereserva/confirmApptAPI/`

**Base URL**: `https://reservo.cl` (sin `/APIpublica/v2`)

**Body**:
```json
{
  "sucursal": "f25a0d04-c549-11eb-b181-0242c0a80002",
  "url": "R046YRy070yZCa112n548wD3q7X0Gt",
  "tratamientos_uuid": ["xyz789..."],
  "agendas_uuid": ["prof456..."],
  "calendario": {
    "time_zone": "America/Santiago",
    "date": "2026-02-20",
    "hour": "09:00"
  },
  "cliente": {
    "rut": "12345678-9",
    "nombre": "Maria",
    "apellido_paterno": "Gonzalez",
    "apellido_materno": "Silva",
    "email": "maria@example.com",
    "telefono": "+56912345678",
    "prevision": "Fonasa"
  }
}
```

**Campos**:
- `sucursal`: UUID de la sucursal (obtenido de disponibilidad o `/sucursales/`)
- `url`: UUID de la agenda
- `tratamientos_uuid`: Array con UUIDs de tratamientos
- `agendas_uuid`: Array con UUIDs de profesionales
- `calendario.time_zone`: Zona horaria
- `calendario.date`: Fecha YYYY-MM-DD
- `calendario.hour`: Hora HH:MM

---

### 11. Obtener Previsiones

**Endpoint**: `GET /agenda_online/{uuid_agenda}/form/`

Obtiene las opciones previsionales del formulario de la agenda. Se extrae el campo "prevision" con sus opciones.

---

## Flujo de Trabajo: Agendar una Cita

```
1. GET /agenda_online/{uuid}/tratamientos/     -> Lista de tratamientos
2. GET /agenda_online/{uuid}/profesionales/    -> Lista de profesionales
3. GET /agenda_online/{uuid}/horarios_disponibles/?fecha=...&uuid_tratamiento=...
   -> Disponibilidad (incluye sucursales con UUID)
4. GET /cliente/?identificador=RUT             -> Buscar paciente existente
5. POST /makereserva/confirmApptAPI/           -> Crear la cita
   (usar sucursal UUID del paso 3)
```

## Flujo: Sistema de Confirmacion de Citas

```
1. GET /citas/?fecha_inicial=YYYY-MM-DD&fecha_final=YYYY-MM-DD
   -> Obtener citas por rango de fecha
2. Filtrar citas con estado.codigo == "NC"
   (Ignorar citas en lista de espera)
3. Extraer datos del cliente inline de cada cita
4. Crear/buscar contacto en GHL
5. PUT /citas/ con estado_codigo "C" -> Confirmar
```

---

## Codigos de Estado HTTP

| Codigo | Descripcion |
|--------|-------------|
| `200` | Operacion exitosa |
| `201` | Recurso creado (POST /cliente/) |
| `400` | Error en la solicitud |
| `401` | Token invalido o no autorizado |
| `422` | Error de validacion (ej: zona horaria no configurada) |

## Formato de Errores

```json
{
  "errores": {
    "campo_ejemplo": ["Este campo es requerido"]
  }
}
```

O como string simple:
```json
{
  "errores": "Cliente no tiene configurada su zona horaria."
}
```

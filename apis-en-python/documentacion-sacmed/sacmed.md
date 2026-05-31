# Codigos SACMED desde Lambda AWS

SACMED es un Software para centros medicos, este documento expone funciones lambda en AWS que trabajan con su API.

## función lambda: sacmed_reconoserte_crear_cita


### Variables de entorno
```
GHL_API_TOKEN=pit-1ab473eb-dbfb-4378-b8b2-49225d230e6d
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import re
import json
import requests
from datetime import datetime

SACMED_BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
SACMED_API_TOKEN = os.environ["SACMED_API_TOKEN"]

GHL_BASE_URL = "https://services.leadconnectorhq.com"
GHL_API_TOKEN = os.environ["GHL_API_TOKEN"]
GHL_CALENDAR_ID = "h7Xjzgm0aarFobyGXkVa"
GHL_LOCATION_ID = "fW20OB0rXIFvv9TOteC0"

def lambda_handler(event, context):
  try:
    # Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    id_professional = body.get("id_profesional")
    date_from = body.get("fecha_desde")
    date_to = body.get("fecha_hasta")
    id_pacient = body.get("rut_paciente")
    phone = body.get("telefono")
    email = body.get("email")
    id_service = body.get("id_servicio")
    id_specialty = body.get("id_especialidad")
    comentario = body.get("comentario")

    if id_professional is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_profesional es requerido"
      })
    if id_professional == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_profesional no puede estar vacío"
      })
    if not isinstance(id_professional, str):
      return _response(400, {
        "status": 400,
        "message": "El campo id_profesional debe ser un string"
      })

    if date_from is None:
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_desde es requerido"
      })
    if date_from == "":
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_desde no puede estar vacío"
      })
    if not isinstance(date_from, str):
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_desde debe ser un string"
      })
    try:
      date_from_dt = _parse_iso(date_from)
    except Exception:
      return _response(400, {
        "status": 400,
        "message": "El formato del campo fecha_desde es inválido, debe ser ISO8601"
      })

    if date_to is None:
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_hasta es requerido"
      })
    if date_to == "":
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_hasta no puede estar vacío"
      })
    if not isinstance(date_to, str):
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_hasta debe ser un string"
      })
    try:
      date_to_dt = _parse_iso(date_to)
    except Exception:
      return _response(400, {
        "status": 400,
        "message": "El formato del campo fecha_hasta es inválido, debe ser ISO8601"
      })
    
    if id_pacient is None:
      return _response(400, {
        "status": 400,
        "message": "El campo rut_paciente es requerido"
      })
    if id_pacient == "":
      return _response(400, {
        "status": 400,
        "message": "El campo rut_paciente no puede estar vacío"
      })
    if not isinstance(id_pacient, str):
      return _response(400, {
        "status": 400,
        "message": "El campo rut_paciente debe ser un string"
      })

    if phone is None:
      return _response(400, {
        "status": 400,
        "message": "El campo telefono es requerido"
      })
    if phone == "":
      return _response(400, {
        "status": 400,
        "message": "El campo telefono no puede estar vacío"
      })
    if not isinstance(phone, str):
      return _response(400, {
        "status": 400,
        "message": "El campo telefono debe ser un string"
      })

    if email is None:
      return _response(400, {
        "status": 400,
        "message": "El campo email es requerido"
      })
    if email == "":
      return _response(400, {
        "status": 400,
        "message": "El campo email no puede estar vacío"
      })
    if not isinstance(email, str):
      return _response(400, {
        "status": 400,
        "message": "El campo email debe ser un string"
      })

    if id_service is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio es requerido"
      })
    if id_service == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio no puede estar vacío"
      })
    if not isinstance(id_service, int):
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio debe ser un integer"
      })

    if id_specialty is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_especialidad es requerido"
      })
    if id_specialty == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_especialidad no puede estar vacío"
      })
    if not isinstance(id_specialty, int):
      return _response(400, {
        "status": 400,
        "message": "El campo id_especialidad debe ser un integer"
      })
    
    payload = {
      "userId": id_professional,
      "start": date_from,
      "end": date_to,
      "patientIdentification": id_pacient,
      "phone": phone,
      "email": email,
      "serviceId": id_service,
      "specialtyId": id_specialty
    }

    response = requests.post(f"{SACMED_BASE_URL}/events",
      headers={
        "accept": "application/json",
        "X-ApiKey": SACMED_API_TOKEN
      },
      json=payload,
      timeout=30
    )

    if response.status_code == 422:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "El horario ya no está disponible, intenta en otro horario"
      })

    if response.status_code != 201:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "No fue posible realizar la creación de la cita"
      })

    data = response.json()

    ghl_response = None
    ghl_error = None
    
    if GHL_API_TOKEN and GHL_CALENDAR_ID and GHL_LOCATION_ID:
      try:
        user_id = body.get("user_id")
        if user_id:
          # Armar el título usando la información de la respuesta de SACMED
          title = "Cita Médica"
          if isinstance(data, dict):
            service_provider = data.get("service_provider", "")
            service = data.get("service", "")
            if service_provider and service:
              title = f"{service} - {service_provider}"
            elif service_provider:
              title = f"Cita - {service_provider}"
            elif service:
              title = service
          
          ghl_response = _create_ghl_appointment(
            contact_id=user_id,
            start_time=date_from,
            end_time=date_to,
            title=title,
            appointment_status="confirmed"
          )
          
          # Si hay comentario, actualizar el contacto en GHL
          if comentario:
            _update_ghl_contact(
              contact_id=user_id,
              comentario=comentario
            )
      except Exception as e:
        ghl_error = str(e)

    # Respuesta con data de SACMED y estado simplificado de GHL
    response_data = {
      "status": 201,
      "message": "La cita fue creada exitosamente",
      "data": {
        "id_cita": data.get("eventId")
      }
    }
    
    # Si hubo error con GHL, incluirlo en la respuesta
    if ghl_error:
      response_data["ghl_error"] = ghl_error

    return _response(201, response_data)
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _create_ghl_appointment(contact_id, start_time, end_time, title="Cita Médica", appointment_status="confirmed"):
  """
  Crea una cita en GHL (GoHighLevel)
  """
  # Agregar timezone de Chile si no está presente
  # Chile usa -03:00 (verano) o -04:00 (invierno)
  # Simplificado: usar -03:00 para horario de verano (sep-abr) 
  if start_time and not ('+' in start_time or start_time.endswith('Z') or start_time.count('-') > 2):
    start_time = start_time + "-03:00"
  
  if end_time and not ('+' in end_time or end_time.endswith('Z') or end_time.count('-') > 2):
    end_time = end_time + "-03:00"
  
  payload = {
    "calendarId": GHL_CALENDAR_ID,
    "locationId": GHL_LOCATION_ID,
    "contactId": contact_id,
    "startTime": start_time,
    "endTime": end_time,
    "title": title,
    "appointmentStatus": appointment_status,
    "assignedUserId": "t5vXRH9Zfzcd5iFqqO3Q",
    "ignoreDateRange": True,
    "toNotify": True,
    "ignoreFreeSlotValidation": True
  }
  
  response = requests.post(
    f"{GHL_BASE_URL}/calendars/events/appointments",
    headers={
      "Accept": "application/json",
      "Authorization": f"Bearer {GHL_API_TOKEN}",
      "Content-Type": "application/json",
      "Version": "2021-04-15"
    },
    json=payload,
    timeout=30
  )
  
  # Si hay error, incluir detalles del payload en el mensaje
  if response.status_code >= 400:
    error_detail = {
      "status_code": response.status_code,
      "response": response.text,
      "payload_sent": payload
    }
    raise Exception(f"GHL API Error: {response.status_code} - {response.text} | Payload: {json.dumps(payload)}")
  
  return response.json()

def _update_ghl_contact(contact_id, comentario):
  """
  Actualiza el custom field 'comentario' de un contacto en GHL
  """
  payload = {
    "customFields": [
      {
        "key": "comentario",
        "field_value": comentario
      }
    ]
  }
  
  response = requests.put(
    f"{GHL_BASE_URL}/contacts/{contact_id}",
    headers={
      "Accept": "application/json",
      "Authorization": f"Bearer {GHL_API_TOKEN}",
      "Content-Type": "application/json",
      "Version": "2021-07-28"
    },
    json=payload,
    timeout=30
  )
  
  if response.status_code >= 400:
    raise Exception(f"GHL Update Contact Error: {response.status_code} - {response.text}")
  
  return response.json()

def _parse_iso(dt: str) -> datetime:
  try:
    return datetime.fromisoformat(dt)
  except Exception:
    if dt.endswith("Z"):  # Soporte 'Z' (UTC) -> '+00:00'
      return datetime.fromisoformat(dt.replace("Z", "+00:00"))
    raise

def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'application/json'},
    "body": json.dumps(body_obj, ensure_ascii=False)
  }
```

----

## función lambda: sacmed_reconoserte_obtener_disponibilidad


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import requests
from datetime import datetime, timedelta
from collections import defaultdict

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    # Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    # Inputs
    date_str             = body.get("fecha")
    id_specialty      = body.get("id_especialidad")
    id_professionals  = body.get("id_profesionales")
    id_service        = body.get("id_servicio")

    # Validations
    if date_str is None:
      return _response(400, {
        "status": 400,
        "message": "El campo fecha es requerido"
        })
    if date_str == "":
      return _response(400, {
        "status": 400,
        "message": "El campo fecha no puede estar vacío"
      })
    if not isinstance(date_str, str):
      return _response(400, {
        "status": 400,
        "message": "El campo fecha debe ser un string"
        })
    try:
      date_dt = _parse_iso(date_str)
    except Exception:
      return _response(400, {
        "status": 400,
        "message": "El formato del campo fecha es inválido, debe ser ISO8601"
      })
    
    if id_specialty is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_especialidad es requerido"
      })
    if id_specialty == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_especialidad no puede estar vacío"
      })
    if not isinstance(id_specialty, int):
      return _response(400, {
        "status": 400,
        "message": "El campo id_especialidad debe ser un integer"
        })
    if id_professionals is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_profesionales es requerido"
      })
    if id_professionals == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_profesionales no puede estar vacío"
      })
    if not isinstance(id_professionals, list):
      return _response(400, {
        "status": 400,
        "message": "El campo id_profesionales debe ser un array"
      })

    # Intentar búsqueda para la semana solicitada y hasta 3 semanas posteriores (4 intentos en total)
    MAX_WEEKS = 4
    current_date = date_dt
    
    for week_offset in range(MAX_WEEKS):
      date_from = current_date.isoformat()
      date_to   = (current_date + timedelta(days=7)).isoformat()

      payload = {
        "from": date_from,
        "to": date_to,
        "specialtyId": id_specialty,
        "userIds": id_professionals
      }
      if id_service is not None:
        payload["serviceId"] = int(id_service)

      response = requests.post(
        f"{BASE_URL}/availability/by-practitioner",
        headers={
          "accept": "application/json",
          "X-ApiKey": API_TOKEN
        },
        json=payload,
        timeout=60
      )

      if response.status_code == 200:
        data = response.json()
        
        _strip_duration_in_slots(data)
        disponibilidad_raw = data if isinstance(data, list) else data.get("message", [])
        
        # Verificar si hay disponibilidad real (slots no vacíos)
        has_availability = False
        if isinstance(disponibilidad_raw, list):
          for item in disponibilidad_raw:
            if isinstance(item, dict) and item.get("slots") and len(item["slots"]) > 0:
              has_availability = True
              break
        
        if has_availability:
          disponibilidad_transformed = _transform_field_names(disponibilidad_raw)
          
          message = "Horarios disponibles obtenidos exitosamente"
          if week_offset > 0:
            message += f" (encontrados en la semana {week_offset + 1})"
          
          return _response(200, {
            "status": 200,
            "message": message,
            "data": {
              "fecha_busqueda_desde": _format_date_spanish(current_date),
              "fecha_busqueda_hasta": _format_date_spanish(current_date + timedelta(days=7)),
              "disponibilidad": disponibilidad_transformed
            }
          })
      
      # Si no hay disponibilidad, avanzar una semana
      current_date = current_date + timedelta(days=7)
    
    # Si después de 4 intentos no se encontró disponibilidad
    return _response(404, {
      "status": 404,
      "message": f"No se encontraron horarios disponibles en las próximas {MAX_WEEKS} semanas"
    })

  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _parse_iso(dt: str) -> datetime:
  try:
    return datetime.fromisoformat(dt)
  except Exception:
    if dt.endswith("Z"):  # Soporte 'Z' (UTC) -> '+00:00'
      return datetime.fromisoformat(dt.replace("Z", "+00:00"))
    raise

def _strip_duration_in_slots(data):
  if isinstance(data, dict) and isinstance(data.get("message"), list):
    items = data["message"]
    for item in items:
      _remove_duration_from_item(item)
    return

  if isinstance(data, list):
    for item in data:
      _remove_duration_from_item(item)

def _remove_duration_from_item(item):
  if not isinstance(item, dict):
    return
  slots = item.get("slots")
  if isinstance(slots, list):
    for s in slots:
      if isinstance(s, dict):
        s.pop("duration", None)

def _transform_field_names(data):
  if not isinstance(data, list):
    return data
  
  transformed = []
  for item in data:
    if not isinstance(item, dict):
      continue
    
    new_item = {}
    
    # Transformar campos del profesional
    if "userId" in item:
      new_item["id_profesional"] = item["userId"]
    if "fullName" in item:
      new_item["nombre_profesional"] = item["fullName"]
    
    # Extraer dirección del primer slot (ya que es repetitiva)
    direccion = None
    if "slots" in item and isinstance(item["slots"], list) and len(item["slots"]) > 0:
      first_slot = item["slots"][0]
      if isinstance(first_slot, dict) and "address" in first_slot:
        direccion = first_slot["address"]
    
    if direccion:
      new_item["direccion"] = direccion
    
    # Transformar slots (sin address)
    if "slots" in item and isinstance(item["slots"], list):
      new_slots = []
      for slot in item["slots"]:
        if isinstance(slot, dict):
          new_slot = {}
          if "start" in slot:
            new_slot["inicio"] = slot["start"]
          if "end" in slot:
            new_slot["termino"] = slot["end"]
          # No incluimos address aquí
          new_slots.append(new_slot)
      new_item["slots"] = new_slots
    
    transformed.append(new_item)
  
  return transformed

DAYS_ES = {
  "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
  "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"
}
MONTHS_ES = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
  7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

def _format_date_spanish(dt: datetime) -> str:
  day_name = DAYS_ES.get(dt.strftime("%A"), dt.strftime("%A"))
  month_name = MONTHS_ES.get(dt.month, str(dt.month))
  return f"{day_name} {dt.day} {month_name} {dt.year}"

def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'application/json'},
    "body": json.dumps(body_obj, ensure_ascii=False)
  }
```

----

## función lambda: sacmed_reconoserte_obtener_servicios


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    # Normalizar body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    # Obtener y normalizar el parámetro modalidad (opcional)
    modalidad = body.get("modalidad", "").strip().lower()
    modalidad_normalizada = modalidad.capitalize() if modalidad else None

    response = requests.get(f"{BASE_URL}/service/by-company",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      }
    )

    if response.status_code != 200:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "Hubo un problema al intentar obtener los servicios"
      })

    data = response.json()
    transformed_data = _transform_services(data)
    
    # Filtrar por modalidad si se proporcionó
    if modalidad_normalizada:
      filtered_data = [
        servicio for servicio in transformed_data 
        if servicio["modalidad"] == modalidad_normalizada
      ]
      message = f"Servicios obtenidos exitosamente para modalidad {modalidad_normalizada}"
    else:
      filtered_data = transformed_data
      message = "Servicios obtenidos exitosamente"

    return _response(200, {
      "status": 200,
      "message": message,
      "data": {
        "servicios": filtered_data
      }
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _transform_services(services):
  modalidad_map = {
    1: "Presencial",
    2: "Telemedicina"
  }
  
  return [
    {
      "id_servicio": service["serviceId"],
      "nombre_servicio": service["name"],
      "modalidad": modalidad_map.get(service["serviceTypeId"], "Desconocido")
    }
    for service in services
  ]

def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {"Content-Type": "text/plain"},
    "body": encode(body_obj)
  }
```

----

## función lambda: sacmed_reconoserte_crear_paciente


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import re
import json
import requests
from datetime import datetime
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    # Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event


    # Inputs
    firstName = body.get("nombre")
    paternalLastName = body.get("apellido_paterno")
    maternalLastName = body.get("apellido_materno")
    identification = body.get("rut")
    nationalityId = body.get("nacionalidad")
    phone = body.get("telefono")
    email = body.get("email")
    birth_day = body.get("fecha_nacimiento")
    city = body.get("comuna")
    address = body.get("direccion")

    # Validations
    if firstName is None:
      return _response(400, {
        "status": 400,
        "message": "El campo nombre es requerido"
      })
    if firstName == "":
      return _response(400, {
        "status": 400,
        "message": "El campo nombre no puede estar vacío"
      })
    if not isinstance(firstName, str):
      return _response(400, {
        "status": 400,
        "message": "El campo nombre debe ser un string"
      })

    if paternalLastName is None:
      return _response(400, {
        "status": 400,
        "message": "El campo apellido_paterno es requerido"
      })
    if paternalLastName == "":
      return _response(400, {
        "status": 400,
        "message": "El campo apellido_paterno no puede estar vacío"
      })
    if not isinstance(paternalLastName, str):
      return _response(400, {
        "status": 400,
        "message": "El campo apellido_paterno debe ser un string"
      })

    if maternalLastName is None:
      return _response(400, {
        "status": 400,
        "message": "El campo apellido_materno es requerido"
      })
    if maternalLastName == "":
      return _response(400, {
        "status": 400,
        "message": "El campo apellido_materno no puede estar vacío"
      })
    if not isinstance(maternalLastName, str):
      return _response(400, {
        "status": 400,
        "message": "El campo apellido_materno debe ser un string"
      })

    if identification is None:
      return _response(400, {
        "status": 400,
        "message": "El campo rut es requerido"
      })
    if identification == "":
      return _response(400, {
        "status": 400,
        "message": "El campo rut no puede estar vacío"
      })
    if not isinstance(identification, str):
      return _response(400, {
        "status": 400,
        "message": "El campo rut debe ser un string"
      })

    if nationalityId is None:
      return _response(400, {
        "status": 400,
        "message": "El campo nacionalidad es requerido"
      })
    if nationalityId == "":
      return _response(400, {
        "status": 400,
        "message": "El campo nacionalidad no puede estar vacío"
      })
    if not isinstance(nationalityId, int):
      return _response(400, {
        "status": 400,
        "message": "El campo nacionalidad debe ser un integer"
      })

    if phone is None:
      return _response(400, {
        "status": 400,
        "message": "El campo telefono es requerido"
      })
    if phone == "":
      return _response(400, {
        "status": 400,
        "message": "El campo telefono no puede estar vacío"
      })
    if not isinstance(phone, str):
      return _response(400, {
        "status": 400,
        "message": "El campo telefono debe ser un string"
      })
      
    if email is None:
      return _response(400, {
        "status": 400,
        "message": "El campo email es requerido"
      })
    if email == "":
      return _response(400, {
        "status": 400,
        "message": "El campo email no puede estar vacío"
      })
    if not isinstance(email, str):
      return _response(400, {
        "status": 400,
        "message": "El campo email debe ser un string"
      })

    if birth_day is None:
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_nacimiento es requerido"
      })
    if birth_day == "":
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_nacimiento no puede estar vacío"
      })
    if not isinstance(birth_day, str):
      return _response(400, {
        "status": 400,
        "message": "El campo fecha_nacimiento debe ser un string"
      })
    try:
      birth_day_dt = _parse_iso(birth_day)
    except Exception:
      return _response(400, {
        "status": 400,
        "message": "El formato del campo fecha_nacimiento es inválido, debe ser ISO8601"
      })

    if city is None:
      return _response(400, {
        "status": 400,
        "message": "El campo comuna es requerido"
      })
    if city == "":
      return _response(400, {
        "status": 400,
        "message": "El campo comuna no puede estar vacío"
      })
    if not isinstance(city, int):
      return _response(400, {
        "status": 400,
        "message": "El campo comuna debe ser un integer"
      })

    if address is None:
      return _response(400, {
        "status": 400,
        "message": "El campo direccion es requerido"
      })
    if address == "":
      return _response(400, {
        "status": 400,
        "message": "El campo direccion no puede estar vacío"
      })
    if not isinstance(address, str):
      return _response(400, {
        "status": 400,
        "message": "El campo direccion debe ser un string"
      })

    rut_formatted = format_rut(identification)
    rut_is_valid = validate_rut(rut_formatted)

    if not rut_is_valid and nationalityId == 1:
      return _response(400, {"status": 400, "message": "El RUT no es valido"})

    payload = {
      "firstName": firstName,
      "paternalLastName": paternalLastName,
      "maternalLastName": maternalLastName,
      "identification": rut_formatted if nationalityId == 1 else identification,
      "nationality_id": nationalityId,
      "phone": phone,
      "mobilePhone": phone,
      "email": email,
      "birthDay": birth_day_dt.strftime("%Y-%m-%d"),
      "addressDTO": {
        "street": address,
        "districtId": city
      }
    }

    response = requests.post(f"{BASE_URL}/patient",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      },
      json=payload
    )

    if response.status_code != 201:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "No fue posible realizar la creación del paciente"
      })

    return _response(201, {"status": 201, "message": "El paciente fue creado exitosamente"})
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'text/plain'},
    "body": encode(body_obj)
  }

def clean_rut(rut: str) -> str:
  return re.sub(r"[^\dkK]", "", rut).upper()

def format_rut(rut: str) -> str:
  rut = clean_rut(rut)
  body = rut[:-1]
  dv = rut[-1].upper()
  return f"{body}-{dv}"

def calculate_dv(body: str) -> str:
  reversed_digits = map(int, reversed(body))
  factors = [2, 3, 4, 5, 6, 7]
  total = sum(d * factors[i % 6] for i, d in enumerate(reversed_digits))
  remainder = 11 - (total % 11)
  if remainder == 11:
    return "0"
  elif remainder == 10:
    return "K"
  else:
    return str(remainder)

def validate_rut(rut: str) -> bool:
  rut = clean_rut(rut)
  if len(rut) < 2 or not rut[:-1].isdigit():
    return False
  body, dv = rut[:-1], rut[-1]
  return calculate_dv(body) == dv.upper()

def _parse_iso(dt: str) -> datetime:
  try:
    return datetime.fromisoformat(dt)
  except Exception:
    if dt.endswith("Z"):  # Soporte 'Z' (UTC) -> '+00:00'
      return datetime.fromisoformat(dt.replace("Z", "+00:00"))
    raise
```

----

## función lambda: sacmed_reconoserte_obtener_cita_mas_reciente_por_paciente


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import logging
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

SCL_TZ = ZoneInfo("America/Santiago")
UTC_TZ = ZoneInfo("UTC")

def lambda_handler(event, context):
  try:
    # Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    rut = body.get("rut")

    if rut is None:
      return _response(400, {
        "status": 400,
        "message": "El campo rut es requerido"
      })
    if rut == "":
      return _response(400, {
        "status": 400,
        "message": "El campo rut no puede estar vacío"
      })
    if not isinstance(rut, str):
      return _response(400, {
        "status": 400,
        "message": "El campo rut debe ser un string"
      })

    response = requests.get(
      f"{BASE_URL}/events/by-patient/identification/{rut}",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      },
      timeout=30
    )

    if response.status_code != 200:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "No se encontraron citas asociadas al paciente."
      })

    data = response.json()
    futures = _filter_future_sorted(data)

    if not futures:
      return _response(404, {"status": 404, "message": "No hay citas activas del paciente."})

    formatted_list = [_format_to_scl_payload(ap) for ap in futures]

    return _response(200, {
      "status": 200,
      "message": "Citas obtenidas exitosamente",
      "data": {
        "citas_activas": formatted_list
      }
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'text/plain'},
    "body": encode(body_obj)
  }

def _parse_iso_dt(value: str):
  """
  Devuelve datetime *aware* en America/Santiago.
  - Si la cadena trae 'Z' u offset (+00:00, -03:00), se respeta y se convierte a America/Santiago.
  - Si no trae tz (naive), se ASUME America/Santiago (no UTC).
  """
  if not value or not isinstance(value, str):
    return None
  try:
    v = value
    if v.endswith("Z"):
      v = v[:-1] + "+00:00"  # normaliza 'Z' a +00:00 para fromisoformat
    dt = datetime.fromisoformat(v)  # aware si incluye offset; naive si no
    if dt.tzinfo is None:
      # Asumimos que el backend ya entrega hora local Chile cuando no trae tz
      dt = dt.replace(tzinfo=SCL_TZ)
    else:
      dt = dt.astimezone(SCL_TZ)
    return dt
  except Exception:
    return None

def _filter_future_sorted(appointments: list):
  """
  Devuelve TODAS las citas futuras (>= ahora SCL), ordenadas por start asc.
  """
  now = datetime.now(SCL_TZ)
  futures = []
  for ap in appointments:
    raw = ap.get("start")
    dt = _parse_iso_dt(raw)
    if dt is not None and dt >= now:
      futures.append((dt, ap))
  futures.sort(key=lambda x: x[0])
  return [ap for _, ap in futures]

def _format_to_scl_payload(appt: dict):
  """
  Transforma el appointment a la estructura requerida:
  - Renombra campos según especificación
  - Elimina campos no deseados
  - Conserva joinLink solo si link no es null
  """
  start_dt = _parse_iso_dt(appt.get("start"))
  end_dt = _parse_iso_dt(appt.get("end"))
  
  # Estructura transformada
  transformed = {
    "id_cita": appt.get("eventId"),
    "fecha_inicio": start_dt.replace(tzinfo=None).isoformat(timespec="seconds") if start_dt else None,
    "fecha_termino": end_dt.replace(tzinfo=None).isoformat(timespec="seconds") if end_dt else None,
    "estado_cita": appt.get("statusEvent"),
    "estado_pago": appt.get("statusPaid"),
    "modalidad": appt.get("tipoServicio")
  }
  
  # Transformar practitioner a profesional
  if appt.get("practitioner"):
    prac = appt["practitioner"]
    transformed["profesional"] = {
      "rut": prac.get("identification"),
      "nombre_profesional": prac.get("firstName"),
      "apellidos_profesional": prac.get("lastName"),
      "email": prac.get("email")
    }
  
  # Incluir joinLink solo si link no es null
  join_link = appt.get("joinLink", {})
  if join_link and join_link.get("link") is not None:
    transformed["joinLink"] = join_link
  
  return transformed
```

----

## función lambda: sacmed_reconoserte_obtener_distritos


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import re
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    response = requests.get(f"{BASE_URL}/district",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      },
      timeout=30
    )

    if response.status_code != 200:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "Hubo un problema al intentar obtener los distritos"
      })

    data = response.json()
    
    districts = [
      {
        "id_distrito": district["districtId"],
        "nombre_distrito": district["name"]
      }
      for district in data
    ]

    transformed_data = {
      "distritos": districts
    }

    return _response(200, {
      "status": 200,
      "message": "Distritos obtenidos exitosamente",
      "data": transformed_data
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'text/plain'},
    "body": encode(body_obj)
  }
```

----

## función lambda: sacmed_reconoserte_cancelar_cita


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import re
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    #Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    # Inputs
    id_booking = body.get("id_cita")

    #Validations
    if id_booking is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_cita es requerido"
      })
    if id_booking == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_cita no puede estar vacio"
      })
    if not isinstance(id_booking, int):
      return _response(400, {
        "status": 400,
        "message": "El campo id_cita debe ser un integer"
      }) 
    
    payload = {
      "eventId": id_booking,
      "statusEventId": 7
    }
  
    response = requests.put(f"{BASE_URL}/events/status",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      },
      json=payload,
      timeout=30
    )
    
    if response.status_code == 404:
      return _response(404, {
        "status": 404,
        "message": "La cita no fue encontrada"
      })

    return _response(200, {
      "status": 200,
      "message": "La cita fue cancelada exitosamente"
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'text/plain'},
    "body": encode(body_obj)
  }

```

----

## función lambda: sacmed_reconoserte_obtener_paciente


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    rut = body.get("rut")

    if rut is None:
      return _response(400, {
        "status": 400,
        "message": "El campo rut es requerido"
      })
    if rut == "":
      return _response(400, {
        "status": 400,
        "message": "El campo rut no puede estar vacío"
      })
    if not isinstance(rut, str):
      return _response(400, {
        "status": 400,
        "message": "El campo rut debe ser un string"
      })

    response = requests.get(f"{BASE_URL}/patient?identification={rut}",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      }
    )

    if response.status_code != 200:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "No se encontró al paciente"
      })

    data = response.json()
    
    # Transformar los datos
    transformed_data = _transform_patient_data(data)

    return _response(200, {
      "status": 200,
      "message": "Paciente obtenido exitosamente",
      "data": {
        "paciente": transformed_data
      }
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _transform_patient_data(data):
  if isinstance(data, list):
    return [_transform_single_patient(patient) for patient in data]
  else:
    return _transform_single_patient(data)

def _transform_single_patient(patient):
  return {
    "rut": patient.get("identification"),
    "nombre": patient.get("firstName"),
    "apellido_paterno": patient.get("paternalLastName"),
    "apellido_materno": patient.get("maternalLastName"),
    "nacionalidad": patient.get("nationality"),
    "telefono": patient.get("phone"),
    "email": patient.get("email"),
    "fecha_nacimiento": patient.get("birthDay")
  }

def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'text/plain'},
    "body": encode(body_obj)
  }
```

----

## función lambda: sacmed_reconoserte_obtener_profesionales_por_servicio


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    # Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    # Inputs
    service_id = body.get("id_servicio")

    # Validations
    if service_id is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio es requerido"
      })
    if service_id == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio no puede estar vacío"
      })
    if not isinstance(service_id, int):
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio debe ser un integer"
      })

    response = requests.get(f"{BASE_URL}/practitioners",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      }
    )

    if response.status_code != 200:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "Hubo un problema al intentar obtener los profesionales"
      })

    data = response.json()
    
    filtered_practitioners = []
    for practitioner in data.get("practitioners", []):
      filtered_services = [
        service for service in practitioner.get("services", [])
        if service["service_Id"] == service_id
      ]
      
      if filtered_services:
        all_specialties = []
        for service in filtered_services:
          for specialty in service.get("specialties", []):
            all_specialties.append({
              "id_especialidad": specialty["specialty_Id"],
              "nombre_especialidad": specialty["name"]
            })
        
        transformed_practitioner = {
          "id_profesional": practitioner["userId"],
          "nombre_profesional": practitioner["name"],
          "especialidades": all_specialties
        }
        filtered_practitioners.append(transformed_practitioner)
    
    transformed_data = {
      "profesionales": filtered_practitioners
    }

    return _response(200, {
      "status": 200,
      "message": "Profesionales obtenidos exitosamente",
      "data": transformed_data
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-Type': 'text/plain'},
    "body": encode(body_obj)
  }
```

----

## función lambda: sacmed_reconoserte_obtener_especialidades


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    id_service = body.get("id_servicio")

    if id_service is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio es requerido"
      })
    if id_service == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio no puede estar vacío"
      })
    if not isinstance(id_service, int):
      return _response(400, {
        "status": 400,
        "message": "El campo id_servicio debe ser un integer"
      })

    response = requests.get(f"{BASE_URL}/specialty/by-service/{id_service}",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      }
    )

    if response.status_code != 200:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "Hubo un problema al intentar obtener las especialidades"
      })

    data = response.json()
    
    # Transformar los datos
    specialties = [
      {
        "id_especialidad": item["specialtyId"],
        "nombre_especialidad": item["name"]
      }
      for item in data
    ]

    return _response(200, {
      "status": 200,
      "message": "Especialidades obtenidas exitosamente",
      "data": {
        "especialidades": specialties
      }
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {"Content-Type": "text/plain"},
    "body": encode(body_obj)
  }
```

----

## función lambda: sacmed_reconoserte_confirmar_cita


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import re
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    #Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    # Inputs
    id_booking = body.get("id_cita")

    #Validations
    if id_booking is None:
      return _response(400, {
        "status": 400,
        "message": "El campo id_cita es requerido"
      })
    if id_booking == "":
      return _response(400, {
        "status": 400,
        "message": "El campo id_cita no puede estar vacio"
      })
    if not isinstance(id_booking, int):
      return _response(400, {
        "status": 400,
        "message": "El campo id_cita debe ser un integer"
      }) 
    
    payload = {
      "eventId": id_booking,
      "statusEventId": 2
    }
  
    response = requests.put(f"{BASE_URL}/events/status",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      },
      json=payload,
      timeout=30
    )
    
    if response.status_code == 404:
      return _response(404, {
        "status": 404,
        "message": "La cita no fue encontrada"
      })

    return _response(200, {
      "status": 200,
      "message": "La cita fue confirmada exitosamente"
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'text/plain'},
    "body": json.dumps(encode(body_obj), ensure_ascii=False)
  }

```

----

## función lambda: sacmed_reconoserte_obtener_profesionales


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    # Normalizar body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    response = requests.get(f"{BASE_URL}/practitioners",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      }
    )

    if response.status_code != 200:
      return _response(response.status_code, {
        "status": response.status_code,
        "message": "Hubo un problema al intentar obtener los profesionales"
      })

    data = response.json()
    transformed_practitioners = []

    for practitioner in data.get("practitioners", []):
      all_specialties = []
      for service in practitioner.get("services", []):
        for specialty in service.get("specialties", []):
          all_specialties.append({
            "id_especialidad": specialty["specialty_Id"],
            "nombre_especialidad": specialty["name"]
          })
      
      transformed_practitioner = {
        "id_profesional": practitioner["userId"],
        "nombre_profesional": practitioner["name"],
        "especialidades": all_specialties
      }
      transformed_practitioners.append(transformed_practitioner)
    
    transformed_data = {
      "profesionales": transformed_practitioners
    }

    return _response(200, {
      "status": 200,
      "message": "Profesionales obtenidos exitosamente",
      "data": transformed_data
    })
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Hubo un problema interno del servidor",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {'Content-type': 'text/plain'},
    "body": json.dumps(encode(body_obj), ensure_ascii=False)
  }
```

----

## función lambda: sacmed_reconoserte_obtener_especialistas


### Variables de entorno
```
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```

### Codigo
```
# Python 3.13

import os
import json
import requests

BASE_URL = "https://availability-ms-prod-860551794565.southamerica-west1.run.app/api/v1"
API_TOKEN = os.environ["SACMED_API_TOKEN"]

def lambda_handler(event, context):
  try:
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event

    id_specialty = body.get("id_especialidad")

    if id_specialty is None:
      return _response(400, {"status": 400, "message": "El campo id_especialidad es requerido"})
    if id_specialty == "":
      return _response(400, {"status": 400, "message": "El campo id_especialidad no puede estar vacío"})
    if not isinstance(id_specialty, int):
      return _response(400, {"status": 400, "message": "El campo id_especialidad debe ser un integer"})

    response = requests.get(f"{BASE_URL}/practitioner/by-specialty/{id_specialty}",
      headers={
        "accept": "application/json",
        "X-ApiKey": API_TOKEN
      }
    )

    data = response.json()


    # filtered_data = {
    #   "nombre_servicio": data["service"],
    #   "especialista": data["service_provider"],
    #   "estado": data["status"],
    #   "fecha_inicio": data["start"],
    #   "fecha_fin": data["end"],
    #   "direccion": data["location_address"]
    # }

    return _response(200, {"status": 200, "message": data})
  except Exception as e:
    return _response(500, {
      "status": 500,
      "message": "Internal server error",
      "error": str(e)
    })

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {"Content-Type": "application/json"},
    "body": json.dumps(body_obj, ensure_ascii=False)
  }

```

---
Las funciones lambda y sus codigos son de un cliente en particular (reconoserte) a continuación se puede aplicar lo mismo para otros clientes, para eso se deja a disposición las siguientes variables de entorno que son necesarias:

### Variables de entorno de otros clientes
#### reconoserte (usado para exponer las funciones)
```
GHL_API_TOKEN=pit-1ab473eb-dbfb-4378-b8b2-49225d230e6d
SACMED_API_TOKEN=9457202a-39e1-4f08-8f50-9203b0a424ba
```
El cliente reconoserte en particular requirió utilizar GHL (GoHighLevel API) pero puede que los otros clientes no lo requieran

#### osmchile
```
SACMED_API_TOKEN=36d46878-db25-4394-8a93-2db3ab4684cf
```

#### sociedad_medica_unimed
```
SACMED_API_TOKEN=9dc67aae-78ac-4d42-95f0-6d84c88647e0
```
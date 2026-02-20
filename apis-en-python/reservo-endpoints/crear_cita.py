import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://reservo.cl"
API_TOKEN_PROVIDENCIA = os.environ["RESERVO_API_TOKEN_PROVIDENCIA"]

# Agendas Centro Arbol
ID_AGENDA_PRESENCIAL = "R046YRy070yZCa112n548wD3q7X0Gt"  # 1 = Presencial
ID_AGENDA_ONLINE = "o08hWLi0T05I4u442M44G0q3W4r0Kx"      # 2 = Online

# Excepción personalizada para errores de API
class APIError(Exception):
  pass

def lambda_handler(event, context):
  try:
    # Normalize body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event if isinstance(event, dict) else {}

    # Inputs
    id_treatment        = body.get("id_tratamiento")
    id_professional     = body.get("id_profesional")
    date                = body.get("fecha")
    hour                = body.get("hora")
    id_agenda           = body.get("id_agenda")

    # Inputs paciente individuales
    rut                 = body.get("rut")
    nombre              = body.get("nombre")
    apellido_materno    = body.get("apellido_materno")
    apellido_paterno    = body.get("apellido_paterno")
    email               = body.get("email")
    phone               = body.get("telefono")
    prevision           = body.get("prevision")

    # Validations
    if id_agenda is None:
      return _response(400, {"status": 400, "message": "El campo id_agenda es requerido (1=presencial, 2=online)"})
    
    # Convertir a entero si viene como string
    try:
      id_agenda = int(id_agenda)
    except (ValueError, TypeError):
      return _response(400, {"status": 400, "message": "El campo id_agenda debe ser 1 (presencial) o 2 (online)"})
    
    if id_agenda not in [1, 2]:
      return _response(400, {"status": 400, "message": "El campo id_agenda debe ser 1 (presencial) o 2 (online)"})
    
    # Seleccionar ID de agenda según el tipo
    agenda_id = ID_AGENDA_PRESENCIAL if id_agenda == 1 else ID_AGENDA_ONLINE

    if id_treatment is None:
      return _response(400, {"status": 400, "message": "El campo id_tratamiento es requerido"})
    if id_treatment == "":
      return _response(400, {"status": 400, "message": "El campo id_tratamiento no puede estar vacio"})
    if not isinstance(id_treatment, str):
      return _response(400, {"status": 400, "message": "El campo id_tratamiento debe ser un string"})
    if id_professional is None:
      return _response(400, {"status": 400, "message": "El campo id_profesional es requerido"})
    if id_professional == "":
      return _response(400, {"status": 400, "message": "El campo id_profesional no puede estar vacio"})
    if not isinstance(id_professional, str):
      return _response(400, {"status": 400, "message": "El campo id_profesional debe ser un string"})
    if date is None:
      return _response(400, {"status": 400, "message": "El campo fecha es requerido"})
    if date == "":
      return _response(400, {"status": 400, "message": "El campo fecha no puede estar vacio"})
    if not isinstance(date, str):
      return _response(400, {"status": 400, "message": "El campo fecha debe ser un string en formato YYYY-MM-DD"})
    if hour is None:
      return _response(400, {"status": 400, "message": "El campo hora es requerido"})
    if hour == "":
      return _response(400, {"status": 400, "message": "El campo hora no puede estar vacio"})
    if not isinstance(hour, str):
      return _response(400, {"status": 400, "message": "El campo hora debe ser un string en formato HH:MM"})

    # Validations paciente
    required_pacient_fields = {
      "rut": rut,
      "nombre": nombre,
      "apellido_paterno": apellido_paterno,
      "apellido_materno": apellido_materno,
      "email": email,
      "telefono": phone,
      "prevision": prevision
    }
    for field, value in required_pacient_fields.items():
      if value is None:
        return _response(400, {"status": 400, "message": f"El campo {field} es requerido"})
      if value == "":
        return _response(400, {"status": 400, "message": f"El campo {field} no puede estar vacío"})

    # Construcción del objeto paciente
    # pacient = {
    #   "rut": rut,
    #   "nombre": nombre,
    #   "apellido_materno": apellido_materno,
    #   "apellido_paterno": apellido_paterno,
    #   "email": email,
    #   "telefono": phone,
    #   "prevision": prevision
    # }

    # Selección de sucursal
    api_token = API_TOKEN_PROVIDENCIA
    id_branch = "f25a0d04-c549-11eb-b181-0242c0a80002"

    # Payload final
    payload = {
      "sucursal": id_branch,
      "url": agenda_id,
      "tratamientos_uuid": [id_treatment],
      "agendas_uuid": [id_professional],
      "calendario": {
          "time_zone": "America/Santiago",
          "date": date,
          "hour": hour
      },
      "cliente": required_pacient_fields
    }

    response = requests.post(f"{BASE_URL}/makereserva/confirmApptAPI/",
      headers={
        "accept": "application/json",
        "Authorization": api_token
      },
      json=payload,
      timeout=15
    )

    if response.status_code != 200:
      raise APIError(f"Error del servidor de reservas (código {response.status_code})")

    if not response.text or response.text.strip() == "":
      raise APIError("El servidor de reservas devolvió una respuesta vacía")

    try:
      data = response.json()
    except Exception:
      raise APIError("El servidor de reservas devolvió una respuesta inválida")

    return _response(200, {"status": 200, "message": data})
  except (APIError, Exception):
    return _response(503, {
      "status": 503,
      "message": "Error al agendar cita. Transferir a secretaria."
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
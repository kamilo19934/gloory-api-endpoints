import os
import json
import requests
from datetime import datetime
import pytz
from toon_format import encode, decode

BASE_URL = "https://reservo.cl/APIpublica/v2"
API_TOKEN = os.environ["RESERVO_API_TOKEN_PROVIDENCIA"]

def lambda_handler(event, context):
  try:
    # Normalizar body
    if "body" in event:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    else:
      body = event if isinstance(event, dict) else {}

    # Inputs
    id_pacient  = body.get("id_paciente")

    # Validations
    if not id_pacient:
      return _response(400, {"status": 400, "message": "El campo id_paciente es requerido"})
    if id_pacient == "":
      return _response(400, {"status": 400, "message": "El campo id_paciente no puede estar vacío"})
    if not isinstance(id_pacient, str):
      return _response(400, {"status": 400, "message": "El campo id_paciente debe ser un string"})

    response = requests.get(f"{BASE_URL}/citas/?uuid_cliente={id_pacient}",
      headers={
        "accept": "application/json",
        "Authorization": API_TOKEN
      }
    )

    data = response.json()
    resultados = data.get("resultados", [])
    citas_nc = [c for c in resultados if c.get("estado", {}).get("codigo") == "NC"]

    if not citas_nc:
      return _response(404, {"status": 404, "message": "No hay citas activas"})

    citas_nc.sort(key=lambda x: x.get("fecha_creacion", ""), reverse=True)
    cita = citas_nc[0]
    
    # Convertir fechas a zona horaria local con offset
    cita = _convert_dates_to_local_timezone(cita)

    return _response(200, {"status": 200, "message": cita})
  except Exception as e:
    return _response(500, {"status": 500, "message": "Internal server error", "error": str(e)})

# ---------------------------
# Utils
# ---------------------------
def _convert_dates_to_local_timezone(cita):
  """Convierte las fechas UTC a la zona horaria local con offset"""
  timezone_str = cita.get("zona_horaria", "America/Santiago")
  local_tz = pytz.timezone(timezone_str)
  
  # Campos de fecha a convertir
  date_fields = ["inicio", "fin"]
  
  for field in date_fields:
    if field in cita and cita[field]:
      # Parsear fecha UTC
      utc_dt = datetime.strptime(cita[field], "%Y-%m-%dT%H:%M:%SZ")
      utc_dt = pytz.utc.localize(utc_dt)
      
      # Convertir a zona horaria local
      local_dt = utc_dt.astimezone(local_tz)
      
      # Formatear con offset
      cita[field] = local_dt.isoformat()
  
  return cita

def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {"Content-Type": "text/plain"},
    "body": encode(body_obj)
  }
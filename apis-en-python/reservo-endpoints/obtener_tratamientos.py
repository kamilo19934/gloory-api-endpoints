import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://reservo.cl/APIpublica/v2"
API_TOKEN_PROVIDENCIA = os.environ["RESERVO_API_TOKEN_PROVIDENCIA"]

# Agendas Centro Arbol
ID_AGENDA_PRESENCIAL = "R046YRy070yZCa112n548wD3q7X0Gt"  # 1 = Presencial
ID_AGENDA_ONLINE = "o08hWLi0T05I4u442M44G0q3W4r0Kx"      # 2 = Online

# Excepción personalizada para errores de API
class APIError(Exception):
  pass

def lambda_handler(event, context):
  try:
    # Normalizar body (soporta POST con body o GET con queryStringParameters)
    if "body" in event and event["body"]:
      body = event["body"]
      if isinstance(body, str):
        body = json.loads(body)
    elif "queryStringParameters" in event and event["queryStringParameters"]:
      body = event["queryStringParameters"]
    else:
      body = event if isinstance(event, dict) else {}

    # Input
    id_agenda = body.get("id_agenda")

    # Validations
    if id_agenda is None:
      return _response(400, {"status": 400, "message": "El campo id_agenda es requerido (1=presencial, 2=online)"})
    
    try:
      id_agenda = int(id_agenda)
    except (ValueError, TypeError):
      return _response(400, {"status": 400, "message": "El campo id_agenda debe ser 1 (presencial) o 2 (online)"})
    
    if id_agenda not in [1, 2]:
      return _response(400, {"status": 400, "message": "El campo id_agenda debe ser 1 (presencial) o 2 (online)"})
    
    # Seleccionar ID de agenda según el tipo
    agenda_id = ID_AGENDA_PRESENCIAL if id_agenda == 1 else ID_AGENDA_ONLINE

    response = requests.get(f"{BASE_URL}/agenda_online/{agenda_id}/tratamientos/",
      headers={
        "accept": "application/json",
        "Authorization": API_TOKEN_PROVIDENCIA
      },
      timeout=15
    )

    if response.status_code != 200:
      raise APIError(f"Error del servidor (código {response.status_code})")

    if not response.text or response.text.strip() == "":
      raise APIError("Respuesta vacía del servidor")

    try:
      data = response.json()
    except Exception:
      raise APIError("Respuesta inválida del servidor")

    return _response(200, {"status": 200, "message": data})
  except (APIError, Exception):
    return _response(503, {
      "status": 503,
      "message": "Error al obtener servicios. Transferir a secretaria."
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
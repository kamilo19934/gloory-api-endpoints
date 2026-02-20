import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://reservo.cl/APIpublica/v2"
API_TOKEN_PROVIDENCIA = os.environ["RESERVO_API_TOKEN_PROVIDENCIA"]

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
    id_appointment      = body.get("id_cita")

    # Validations
    if id_appointment is None:
      return _response(400, {"status": 400, "message": "El campo id_cita es requerido"})
    if id_appointment == "":
      return _response(400, {"status": 400, "message": "El campo id_cita no puede estar vacío"})
    if not isinstance(id_appointment, str):
      return _response(400, {"status": 400, "message": "El campo id_cita debe ser un string"})

    api_token = API_TOKEN_PROVIDENCIA

    payload = {
      "uuid": id_appointment,
      "estado_codigo": "S"
    }

    response = requests.put(f"{BASE_URL}/citas/",
      headers={
        "accept": "application/json",
        "Authorization": api_token
      },
      json=payload
    )

    if response.status_code != 200:
      return _response(response.status_code, {"status": response.status_code, "message": "Hubo un error al cancelar la cita."})

    return _response(200, {"status": 200, "message": "Cita cancelada con éxito."})
  except Exception as e:
    return _response(500, {"status": 500, "message": "Internal server error", "error": str(e)})

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {"Content-Type": "text/plain"},
    "body": encode(body_obj)
  }
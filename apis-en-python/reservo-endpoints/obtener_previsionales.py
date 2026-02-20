import os
import json
import requests
from toon_format import encode, decode

BASE_URL = "https://reservo.cl/APIpublica/v2"
API_TOKEN_PROVIDENCIA = os.environ["RESERVO_API_TOKEN_PROVIDENCIA"]

def lambda_handler(event, context):
  try:
    # Normalizar body (por si llega como string)
    body = event.get("body") if isinstance(event, dict) else event
    if isinstance(body, str):
        body = json.loads(body)

    api_token = API_TOKEN_PROVIDENCIA
    id_online_agenda = "o08hWLi0T05I4u442M44G0q3W4r0Kx"

    response = requests.get(f"{BASE_URL}/agenda_online/{id_online_agenda}/form/",
      headers={
        "accept": "application/json",
        "Authorization": api_token,
      },
      timeout=10,
    )

    data = response.json()

    prevision_field = next((f for f in data if f.get("nombre") == "prevision"), None)
    if not prevision_field or not prevision_field.get("options"):
      return _response(404, {"status": 404, "message": "No se encontraron opciones de previsión en el formulario."})

    previsiones = prevision_field["options"]

    return _response(200, {"status": 200, "message": previsiones})
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
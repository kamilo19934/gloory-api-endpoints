import os
import json
import re
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
    rut                 = body.get("rut")

    # Validations
    if rut is None:
      return _response(400, {"status": 400, "message": "El campo rut es requerido"})
    if rut == "":
      return _response(400, {"status": 400, "message": "El campo rut no puede estar vacío"})
    if not isinstance(rut, str):
      return _response(400, {"status": 400, "message": "El campo rut debe ser un string"})

    rut_formatted = format_rut(rut)
    rut_is_valid = validate_rut(rut_formatted)

    if not rut_is_valid:
      return _response(400, {"status": 400, "message": "El rut no es válido"})

    api_token = API_TOKEN_PROVIDENCIA

    response = requests.get(f"{BASE_URL}/cliente/?identificador={rut_formatted}",
      headers={
        "accept": "application/json",
        "Authorization": api_token
      }
    )

    data = response.json()

    return _response(200, {"status": 200, "message": data})
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
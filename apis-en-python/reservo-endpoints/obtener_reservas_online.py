import os
import json
import re
import requests
from toon_format import encode, decode

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
    branch              = body.get("sucursal")

    # Validations
    if branch is None:
      return _response(400, {"status": 400, "message": "El campo sucursal es requerido"})
    if branch == "":
      return _response(400, {"status": 400, "message": "El campo sucursal no puede estar vacío"})

    online_reservations = None

    if branch == "online":
      online_reservations = [
        {"nombre": "Agenda por terapeuta (online)", "uuid": "f05S6XN0a0tyda5Z3h08D5y2z6n3Ea"},
        {"nombre": "Agenda por sede (online)", "uuid": "l0ATrGF0E0shZN0N3I18Ww32c373X9"}
      ]
    elif branch == "providencia":
      online_reservations = [
        {"nombre": "Agenda - Call Center", "uuid": "70Yqk4E0e0F2fu5a2g14Uqz3h990WG"},
        {"nombre": "Agenda por terapeuta (Adulto)", "uuid": "z0sjbch0E00XGE8k2D74F813b6G0gc"},
        {"nombre": "Agenda Meds", "uuid": "j0rGYeW030lGQN5e2534kGP3C0P04s"},
        {"nombre": "Agenda por tratamiento (Adulto)", "uuid": "K0H5qS60V08KhF1D2U74BcT3w1R0y8"}
      ]
    else:
      return _response(400, {"status": 400, "message": "Sucursal no válida"})

    return {
      'statusCode': 200,
      'headers': {
        'Content-Type': 'application/json'
      },
      'body': json.dumps({
        'status': 200,
        'message': online_reservations
      })
    }
  except Exception as e:
    return {
      'statusCode': 500,
      'headers': {
        'Content-Type': 'application/json'
      },
      'body': json.dumps({
        'status': 500,
        'message': 'Internal server error',
        'error': str(e)
      })
    }

# ---------------------------
# Utils
# ---------------------------
def _response(status_code: int, body_obj: dict):
  return {
    "statusCode": status_code,
    "headers": {"Content-Type": "text/plain"},
    "body": encode(body_obj)
  }
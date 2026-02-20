import os
import json
import requests
from datetime import datetime, timedelta
from collections import OrderedDict
from toon_format import encode, decode

BASE_URL = "https://reservo.cl/APIpublica/v2"
API_TOKEN = os.environ["RESERVO_API_TOKEN_PROVIDENCIA"]

# Agendas Centro Arbol
ID_AGENDA_PRESENCIAL = "R046YRy070yZCa112n548wD3q7X0Gt"  # 1 = Presencial
ID_AGENDA_ONLINE = "o08hWLi0T05I4u442M44G0q3W4r0Kx"      # 2 = Online

# Nombres en español
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
         "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

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
    date_str          = body.get("fecha")
    id_treatment      = body.get("id_tratamiento")
    id_agenda         = body.get("id_agenda")

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

    if date_str is None:
      return _response(400, {"status": 400, "message": "El campo fecha es requerido"})
    if date_str == "":
      return _response(400, {"status": 400, "message": "El campo fecha no puede estar vacío"})
    if not isinstance(date_str, str):
      return _response(400, {"status": 400, "message": "El campo fecha debe ser un string en formato YYYY-MM-DD"})
    if id_treatment is None:
      return _response(400, {"status": 400, "message": "El campo id_tratamiento es requerido"})
    if id_treatment == "":
      return _response(400, {"status": 400, "message": "El campo id_tratamiento no puede estar vacío"})
    if not isinstance(id_treatment, str):
      return _response(400, {"status": 400, "message": "El campo id_tratamiento debe ser un string"})

    try:
      dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
      return _response(400, {"status": 400, "message": "El campo fecha debe estar en formato YYYY-MM-DD"})

    payload_1 = _fetch_availability(dt.isoformat(), id_treatment, agenda_id)

    weekday = dt.weekday()  # lunes=0 ... domingo=6
    days_until_next_monday = (7 - weekday) if weekday != 0 else 7
    next_monday = (dt + timedelta(days=days_until_next_monday))
    payload_2 = _fetch_availability(next_monday.isoformat(), id_treatment, agenda_id)
    merged = _merge_payloads(payload_1, payload_2)
    coverage_from = dt.isoformat()
    coverage_to = (next_monday + timedelta(days=4)).isoformat()

    if not merged:
      return _response(404, {"status": 404, "date_from": coverage_from, "date_to": coverage_to,"message": "No se encontró disponibilidad"})

    # Formatear disponibilidad agrupada por fecha
    formatted = _format_availability(merged)

    return _response(200, {"status": 200, "date_from": coverage_from, "date_to": coverage_to, "message": formatted})

  except (APIError, Exception):
    return _response(503, {
      "status": 503,
      "message": "Error de disponibilidad. Transferir a secretaria."
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

def _fetch_availability(p1: str, p2: str, agenda_id: str):
  r = requests.get(f"{BASE_URL}/agenda_online/{agenda_id}/horarios_disponibles/",
    params={
      "fecha": p1,
      "uuid_tratamiento": p2
    },
    headers={
      "accept": "application/json", 
      "Authorization": API_TOKEN
    },
    timeout=15,
  )

  # Manejar respuestas vacías o no-JSON
  if r.status_code != 200:
    raise APIError(f"Error del servidor de reservas (código {r.status_code})")
  
  if not r.text or r.text.strip() == "":
    return []
  
  try:
    return r.json()
  except Exception:
    raise APIError("El servidor de reservas devolvió una respuesta inválida")

def _merge_lists(a_list, b_list):
  seen = set()
  merged = []
  
  for item in (a_list or []) + (b_list or []):
    key = json.dumps(item, sort_keys=True, ensure_ascii=False)
    if key not in seen:
      seen.add(key)
      merged.append(item)

  return merged

def _merge_dicts_by_known_keys(a_dict, b_dict):
  if not isinstance(a_dict, dict) or not isinstance(b_dict, dict):
    return None

  out = dict(a_dict)
  a_list = a_dict.get(key, [])
  b_list = b_dict.get(key, [])
  
  if isinstance(a_list, list) or isinstance(b_list, list):
    out[key] = _merge_lists(a_list if isinstance(a_list, list) else [], b_list if isinstance(b_list, list) else [])
    return out

  return None

def _merge_payloads(p1, p2):
  if isinstance(p1, list) and isinstance(p2, list):
    return _merge_lists(p1, p2)

  if isinstance(p1, dict) and isinstance(p2, dict):
    merged = _merge_dicts_by_known_keys(p1, p2)
    if merged is not None:
      return merged
    return [p1, p2]

  return [p1, p2]

def _format_date_spanish(date_str: str) -> str:
  """Convierte '2026-01-14' a 'Miércoles 14 de Enero 2026'"""
  try:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    dia_semana = DIAS_SEMANA[dt.weekday()]
    mes = MESES[dt.month - 1]
    return f"{dia_semana} {dt.day} de {mes} {dt.year}"
  except ValueError:
    return date_str

def _extract_hora(hora_iso: str) -> str:
  """Extrae solo la hora de un string ISO como '2026-02-04T18:00:00-03:00' -> '18:00'"""
  try:
    dt = datetime.fromisoformat(hora_iso)
    return dt.strftime("%H:%M")
  except:
    return hora_iso

def _format_availability(slots: list) -> dict:
  """Formatea la disponibilidad con fechas en español y extrae sucursal común"""
  if not isinstance(slots, list):
    return slots
  
  # Recopilar todas las sucursales únicas
  sucursales_unicas = {}
  
  for slot in slots:
    if not isinstance(slot, dict):
      continue
    for sucursal in slot.get("sucursales", []):
      uuid = sucursal.get("uuid")
      if uuid and uuid not in sucursales_unicas:
        sucursales_unicas[uuid] = {
          "uuid": uuid,
          "nombre": sucursal.get("nombre"),
          "direccion": sucursal.get("direccion"),
        }
  
  # Si hay una sola sucursal, la extraemos al nivel superior
  una_sola_sucursal = len(sucursales_unicas) == 1
  
  disponibilidad = []
  
  for slot in slots:
    if not isinstance(slot, dict):
      continue
    
    fecha = slot.get("fecha")
    if not fecha:
      continue
    
    # Formatear la fecha en español
    fecha_formateada = _format_date_spanish(fecha)
    
    # Procesar sucursales
    sucursales = slot.get("sucursales", [])
    
    if una_sola_sucursal and sucursales:
      # Si hay una sola sucursal, solo mostramos los profesionales directamente
      todos_profesionales = []
      for sucursal in sucursales:
        for prof in sucursal.get("profesionales", []):
          nuevo_prof = {
            "agenda": prof.get("agenda"),
            "nombre": prof.get("nombre"),
            "horas_disponibles": [_extract_hora(h) for h in prof.get("horas_disponibles", [])]
          }
          todos_profesionales.append(nuevo_prof)
      
      disponibilidad.append({
        "fecha": fecha_formateada,
        "profesionales": todos_profesionales
      })
    else:
      # Si hay múltiples sucursales, mantener la estructura original
      nuevo_slot = {"fecha": fecha_formateada}
      if sucursales:
        nuevas_sucursales = []
        for sucursal in sucursales:
          nueva_sucursal = {
            "uuid": sucursal.get("uuid"),
            "nombre": sucursal.get("nombre"),
            "direccion": sucursal.get("direccion"),
          }
          profesionales = sucursal.get("profesionales", [])
          if profesionales:
            nuevos_profesionales = []
            for prof in profesionales:
              nuevo_prof = {
                "agenda": prof.get("agenda"),
                "nombre": prof.get("nombre"),
                "horas_disponibles": [_extract_hora(h) for h in prof.get("horas_disponibles", [])]
              }
              nuevos_profesionales.append(nuevo_prof)
            nueva_sucursal["profesionales"] = nuevos_profesionales
          nuevas_sucursales.append(nueva_sucursal)
        nuevo_slot["sucursales"] = nuevas_sucursales
      disponibilidad.append(nuevo_slot)
  
  # Si hay una sola sucursal, retornar estructura simplificada
  if una_sola_sucursal and sucursales_unicas:
    sucursal_info = list(sucursales_unicas.values())[0]
    return {
      "sucursal": sucursal_info,
      "disponibilidad": disponibilidad
    }
  
  return disponibilidad
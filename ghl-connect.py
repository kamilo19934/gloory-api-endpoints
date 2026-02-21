from flask import Flask, request, jsonify
import requests
from datetime import datetime, timedelta
import pytz
import logging
import json
import locale

app = Flask(__name__)

# Diccionarios para formateo de fechas en español
DIAS_SEMANA = {
    0: "Lunes",
    1: "Martes", 
    2: "Miércoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sábado",
    6: "Domingo"
}

MESES = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre"
}

def formatear_fecha_espanol(fecha_str):
    """
    Convierte una fecha de formato 'YYYY-MM-DD' a 'Lunes 12 Enero 2026'
    """
    try:
        fecha = datetime.strptime(fecha_str, "%Y-%m-%d")
        dia_semana = DIAS_SEMANA[fecha.weekday()]
        dia = fecha.day
        mes = MESES[fecha.month]
        año = fecha.year
        return f"{dia_semana} {dia} {mes} {año}"
    except Exception as e:
        logging.error(f"[formatear_fecha_espanol] Error formateando fecha {fecha_str}: {e}")
        return fecha_str  # Retornar el formato original si hay error

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Configuración consolidada
GHL_ACCESS_TOKEN = "pit-46df7bc9-22f6-41e7-a55d-de5a3c9b297f"  # Token de acceso para GHL
GHL_BASE_URL = "https://services.leadconnectorhq.com"  # Base URL para API GHL
GHL_LOCATION_ID = "sJbTWDIbEehgwGXb7swH"  # ID de ubicación
API_VERSION = "2021-07-28"  # Versión unificada de API
TIMEZONE = "America/Santiago"  # Zona horaria de Santiago

# Diccionario de calendarios por profesional
CALENDARIOS_PROFESIONALES = {
    1: "8PC2KAjHey5DsSZymBAo",  # Paulina Zapata
    2: "DjC5V9sDPFH4nJsafW3k",  # Katherine Zapata
    3: "EqajuO7J74pc5wbbtvIk",  # Maria Ponce
    4: "FdjmLrPHqdff9wRZx7aH",  # Maria Gutierrez
    5: "cy29RIUoJrRMUHmwHndw",  # Pamela Daza
    6: "gvy7dv2SiX1fHonsdLvE",  # Constanza Vera
    7: "twlWbMxAQbhtssjZ082J",  # Constanza Ponce
    8: "yMIcNmJydOMnwjbhosE0",  # Ariel Navarro
    9: "q0XPdcw0XxfUrPSF2Cfi"   # Gladys Fuentes
}

def get_millis_for_day_range(start_date_str, days=7):
    tz = pytz.timezone(TIMEZONE)
    logging.debug(f"[get_millis_for_day_range] Input date string: {start_date_str}")

    start_date = tz.localize(datetime.strptime(start_date_str, "%Y-%m-%d"))
    end_date = start_date + timedelta(days=days)

    logging.debug(f"[get_millis_for_day_range] Start date (localized): {start_date}")
    logging.debug(f"[get_millis_for_day_range] End date: {end_date}")

    start_ms = int(start_date.timestamp() * 1000)
    end_ms = int(end_date.timestamp() * 1000)

    logging.debug(f"[get_millis_for_day_range] Start timestamp: {start_ms} ({datetime.fromtimestamp(start_ms/1000)})")
    logging.debug(f"[get_millis_for_day_range] End timestamp: {end_ms} ({datetime.fromtimestamp(end_ms/1000)})")

    return start_ms, end_ms

def get_user_info(user_id):
    """Obtiene información del usuario por su ID."""
    url = f"{GHL_BASE_URL}/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": API_VERSION,
        "Accept": "application/json"
    }

    logging.debug(f"[get_user_info] URL: {url}")

    try:
        response = requests.get(url, headers=headers)
        logging.info(f"[get_user_info] Response status: {response.status_code}")

        if response.status_code == 200:
            user_data = response.json()
            user_name = user_data.get('name', 'Profesional')
            logging.info(f"[get_user_info] Nombre del usuario: {user_name}")
            return user_name
        else:
            logging.error(f"[get_user_info] Error obteniendo info del usuario: {response.text}")
            return "Profesional"  # Default fallback
    except Exception as e:
        logging.error(f"[get_user_info] Exception: {e}")
        return "Profesional"  # Default fallback

def get_calendar_info(calendar_id):
    """Obtiene información del calendario, incluyendo slotDuration y teamMembers."""
    url = f"{GHL_BASE_URL}/calendars/{calendar_id}"
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": API_VERSION,
        "Accept": "application/json"
    }

    logging.debug(f"[get_calendar_info] URL: {url}")
    logging.debug(f"[get_calendar_info] Headers: {headers}")

    try:
        response = requests.get(url, headers=headers)
        logging.info(f"[get_calendar_info] Response status: {response.status_code}")

        if response.status_code == 200:
            calendar_data = response.json()
            calendar_info = calendar_data.get('calendar', {})

            # Obtener slot duration
            slot_duration = calendar_info.get('slotDuration', 30)  # Default 30 minutos
            slot_duration_unit = calendar_info.get('slotDurationUnit', 'mins')

            # Convertir a minutos si es necesario
            if slot_duration_unit == 'hours':
                slot_duration_minutes = slot_duration * 60
            else:
                slot_duration_minutes = slot_duration

            # Obtener team members
            team_members = calendar_info.get('teamMembers', [])
            logging.debug(f"[get_calendar_info] Team members: {team_members}")

            # Obtener el primer userId (asumiendo que hay al menos uno)
            user_id = None
            if team_members and len(team_members) > 0:
                user_id = team_members[0].get('userId')
                logging.info(f"[get_calendar_info] User ID encontrado: {user_id}")

            # Obtener nombre del profesional
            profesional_nombre = "Profesional"  # Default
            if user_id:
                profesional_nombre = get_user_info(user_id)

            logging.info(f"[get_calendar_info] Slot duration: {slot_duration_minutes} minutos")
            logging.info(f"[get_calendar_info] Nombre del profesional: {profesional_nombre}")

            return {
                'slot_duration_minutes': slot_duration_minutes,
                'profesional_nombre': profesional_nombre,
                'user_id': user_id
            }
        else:
            logging.error(f"[get_calendar_info] Error obteniendo info del calendario: {response.text}")
            return {
                'slot_duration_minutes': 30,
                'profesional_nombre': 'Profesional',
                'user_id': None
            }
    except Exception as e:
        logging.error(f"[get_calendar_info] Exception: {e}")
        return {
            'slot_duration_minutes': 30,
            'profesional_nombre': 'Profesional',
            'user_id': None
        }

def calculate_slot_duration_from_slots(all_slots):
    """Calcula la duración del slot basándose en los primeros dos slots disponibles."""
    if not all_slots:
        return 30  # Default si no hay slots

    # Buscar los primeros dos slots en cualquier día
    for date_key, date_data in all_slots.items():
        if date_key == 'traceId':
            continue

        slots = date_data.get('slots', [])
        if len(slots) >= 2:
            try:
                first_slot = datetime.fromisoformat(slots[0])
                second_slot = datetime.fromisoformat(slots[1])
                duration = (second_slot - first_slot).total_seconds() / 60
                logging.info(f"[calculate_slot_duration_from_slots] Duración calculada desde slots: {int(duration)} minutos")
                return int(duration)
            except Exception as e:
                logging.error(f"[calculate_slot_duration_from_slots] Error calculando duración: {e}")

    return 30  # Default si no se pudo calcular

def find_consecutive_slots(slots, required_slots, slot_duration_minutos=30):
    """Encuentra slots consecutivos que cumplan con la duración requerida."""
    if not slots or required_slots <= 0:
        return []

    if required_slots == 1:
        return slots  # Si solo necesita 1 slot, devolver todos

    consecutive_starts = []

    for i in range(len(slots) - required_slots + 1):
        is_consecutive = True
        current_slots = []

        for j in range(required_slots):
            if i + j >= len(slots):
                is_consecutive = False
                break

            try:
                current_dt = datetime.fromisoformat(slots[i + j])
                current_slots.append(current_dt)

                if j > 0:
                    # Verificar que sea consecutivo (diferencia debe ser igual al slot duration)
                    prev_dt = current_slots[j - 1]
                    time_diff = (current_dt - prev_dt).total_seconds() / 60

                    # Permitir una pequeña tolerancia en la comparación
                    if abs(time_diff - slot_duration_minutos) > 1:  # Tolerancia de 1 minuto
                        is_consecutive = False
                        break
            except Exception as e:
                logging.error(f"[find_consecutive_slots] Error procesando slot: {e}")
                is_consecutive = False
                break

        if is_consecutive:
            # Agregar solo el primer slot de la secuencia consecutiva
            consecutive_starts.append(slots[i])

    return consecutive_starts

def extract_hours_from_slots(slots_by_day, tiempo_cita_minutos=None, slot_duration_minutos=30):
    logging.info(f"[extract_hours_from_slots] Procesando slots: {slots_by_day}")
    logging.info(f"[extract_hours_from_slots] Tiempo cita: {tiempo_cita_minutos} min, Slot duration: {slot_duration_minutos} min")

    tz = pytz.timezone(TIMEZONE)
    formatted = {}

    # Calcular cuántos slots consecutivos se necesitan
    required_slots = 1
    if tiempo_cita_minutos and slot_duration_minutos:
        required_slots = max(1, (tiempo_cita_minutos + slot_duration_minutos - 1) // slot_duration_minutos)
        logging.info(f"[extract_hours_from_slots] Se necesitan {required_slots} slots consecutivos")

    if not isinstance(slots_by_day, dict):
        logging.error(f"[extract_hours_from_slots] slots_by_day no es un diccionario: {type(slots_by_day)}")
        return formatted

    for date_str, data in slots_by_day.items():
        logging.debug(f"[extract_hours_from_slots] Procesando fecha: {date_str}, data: {data}")

        if date_str == "traceId":
            logging.debug(f"[extract_hours_from_slots] Saltando traceId")
            continue

        if not isinstance(data, dict):
            logging.warning(f"[extract_hours_from_slots] Data para {date_str} no es dict: {type(data)}")
            continue

        slots = data.get("slots", [])
        logging.debug(f"[extract_hours_from_slots] Slots para {date_str}: {slots}")

        # Filtrar slots para encontrar los que cumplen con la duración requerida
        if required_slots > 1:
            valid_slots = find_consecutive_slots(slots, required_slots, slot_duration_minutos)
            logging.debug(f"[extract_hours_from_slots] Slots válidos consecutivos para {date_str}: {len(valid_slots)}")
        else:
            valid_slots = slots

        times = []
        for i, slot in enumerate(valid_slots):
            try:
                logging.debug(f"[extract_hours_from_slots] Procesando slot {i}: {slot}")
                dt = datetime.fromisoformat(slot)
                local_dt = dt.astimezone(tz)
                time_str = local_dt.strftime("%H:%M")
                times.append(time_str)
                logging.debug(f"[extract_hours_from_slots] Slot convertido: {slot} -> {time_str}")
            except Exception as e:
                logging.error(f"[extract_hours_from_slots] Error procesando slot {slot}: {e}")
                continue

        if times:
            # Formatear la fecha en español (ej: "Lunes 12 Enero 2026")
            fecha_formateada = formatear_fecha_espanol(date_str)
            formatted[fecha_formateada] = times
            logging.info(f"[extract_hours_from_slots] Horarios para {fecha_formateada}: {times}")
        else:
            logging.info(f"[extract_hours_from_slots] No hay horarios disponibles para {date_str}")

    logging.info(f"[extract_hours_from_slots] Resultado final: {formatted}")
    return formatted


def _get_free_slots_for_professional(
    profesional_id, fecha, tiempo_cita_minutos
):
    """
    Función auxiliar para obtener los horarios disponibles de un solo profesional.
    """
    if profesional_id not in CALENDARIOS_PROFESIONALES:
        logging.warning(f"[available-times] Profesional inválido: {profesional_id}")
        return {
            "profesional": profesional_id,
            "error": f"Profesional inválido. Profesionales disponibles: {list(CALENDARIOS_PROFESIONALES.keys())}",
        }

    # Obtener el calendar_id según el profesional
    calendar_id = CALENDARIOS_PROFESIONALES[profesional_id]

    logging.info(f"[available-times] Consultando profesional {profesional_id}")
    logging.info(f"[available-times] Calendar ID: {calendar_id}")
    logging.info(
        f"[available-times] Tiempo de cita solicitado: {tiempo_cita_minutos} minutos"
    )

    # Obtener información del calendario para conocer la duración de los slots y nombre del profesional
    calendar_info = get_calendar_info(calendar_id)
    slot_duration_minutos = calendar_info["slot_duration_minutes"]
    profesional_nombre = calendar_info["profesional_nombre"]
    logging.info(
        f"[available-times] Duración de slot del calendario: {slot_duration_minutos} minutos"
    )
    logging.info(f"[available-times] Nombre del profesional: {profesional_nombre}")

    start_ms, end_ms = get_millis_for_day_range(fecha, days=7)
    logging.debug(f"[available-times] Rango de fechas: {start_ms} - {end_ms}")

    url = f"{GHL_BASE_URL}/calendars/{calendar_id}/free-slots"
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": API_VERSION,
        "Accept": "application/json",
    }
    params = {"startDate": start_ms, "endDate": end_ms, "timezone": TIMEZONE}

    logging.debug(f"[available-times] URL: {url}")
    logging.debug(f"[available-times] Headers: {headers}")
    logging.debug(f"[available-times] Params: {params}")

    response = requests.get(url, headers=headers, params=params)

    logging.info(f"[available-times] GHL response status: {response.status_code}")
    logging.debug(f"[available-times] GHL response headers: {dict(response.headers)}")
    logging.info(f"[available-times] GHL response text: {response.text}")

    if response.status_code != 200:
        logging.error(f"[available-times] Error en API GHL: {response.text}")
        return {
            "profesional": profesional_id,
            "profesional_nombre": profesional_nombre,
            "error": "Error en la API de GHL",
            "details": response.text,
            "status_code": response.status_code,
        }

    try:
        raw_data = response.json()
        logging.info(f"[available-times] Raw data recibida: {raw_data}")
    except Exception as e:
        logging.error(f"[available-times] Error parseando JSON: {e}")
        return {
            "profesional": profesional_id,
            "profesional_nombre": profesional_nombre,
            "error": "Error parseando respuesta JSON",
            "details": str(e),
            "status_code": 500,
        }

    # Si el slot_duration_minutos es el default (30) y tenemos datos, calcular desde los slots reales
    if slot_duration_minutos == 30 and raw_data:
        calculated_duration = calculate_slot_duration_from_slots(raw_data)
        if calculated_duration != 30:
            logging.info(f"[available-times] Usando duración calculada desde slots: {calculated_duration} minutos (en lugar de {slot_duration_minutos})")
            slot_duration_minutos = calculated_duration

    formatted = extract_hours_from_slots(
        raw_data, tiempo_cita_minutos, slot_duration_minutos
    )
    logging.info(f"[available-times] Horarios formateados: {formatted}")

    response_data = {
        "horarios_disponibles": formatted,
        "profesional": profesional_id,
        "profesional_nombre": profesional_nombre,
        "slot_duration_minutos": slot_duration_minutos,
    }

    if tiempo_cita_minutos:
        response_data["tiempo_cita_minutos"] = tiempo_cita_minutos
        required_slots = max(
            1,
            (tiempo_cita_minutos + slot_duration_minutos - 1) // slot_duration_minutos,
        )
        response_data["slots_requeridos"] = required_slots

    return response_data


@app.route("/available-times", methods=["POST"])
def get_free_slots():
    data = request.get_json()
    logging.info(f"[available-times] Request data: {data}")

    # Validar campos requeridos
    if not data or "fecha" not in data or "profesional" not in data:
        logging.warning("[available-times] Campos 'fecha' y 'profesional' faltantes")
        return jsonify(
            {"error": "Los campos 'fecha' y 'profesional' son requeridos"}
        ), 400

    fecha = data["fecha"]

    # Obtener tiempo de cita (opcional, por defecto usar duración del slot)
    tiempo_cita_minutos = None
    tiempo_cita = data.get("tiempo_cita")
    if tiempo_cita:
        try:
            tiempo_cita_minutos = int(tiempo_cita)
            if tiempo_cita_minutos <= 0:
                return jsonify(
                    {"error": "tiempo_cita debe ser un número positivo"}
                ), 400
        except (ValueError, TypeError):
            return jsonify(
                {"error": "tiempo_cita debe ser un número válido en minutos"}
            ), 400

    # Determinar si profesional es un solo ID o una lista de IDs
    profesionales_input = data["profesional"]
    if not isinstance(profesionales_input, list):
        profesionales_ids = [profesionales_input]  # Convertir a lista si es un solo INT
        is_list_request = False
    else:
        profesionales_ids = profesionales_input
        is_list_request = True

    all_results = []
    for profesional_id in profesionales_ids:
        # Llamar a la función auxiliar para cada profesional
        result = _get_free_slots_for_professional(
            profesional_id, fecha, tiempo_cita_minutos
        )
        all_results.append(result)

    # Si se solicitó una lista, devolver una lista de resultados
    if is_list_request:
        return jsonify({"resultados_profesionales": all_results}), 200
    # Si se solicitó un solo profesional, devolver su resultado directamente (para compatibilidad)
    else:
        # Si hay un error en el único profesional, devolver el error con el código de estado apropiado
        if "error" in all_results[0]:
            return (
                jsonify(
                    {"error": all_results[0]["error"], "details": all_results[0].get("details")}
                ),
                all_results[0].get("status_code", 400),
            )
        return jsonify(all_results[0]), 200
@app.route('/crear-cita', methods=['POST'])
def crear_cita():
    data = request.get_json()
    logging.info(f"[crear-cita] Request data: {data}")

    # ================= VALIDACIONES BÁSICAS =================
    if not data or 'user_id' not in data or 'start_time' not in data or 'profesional' not in data:
        logging.warning("[crear-cita] Faltan campos requeridos")
        return jsonify({"error": "Se requiere 'user_id', 'start_time' y 'profesional'"}), 400

    profesional = data['profesional']
    if profesional not in CALENDARIOS_PROFESIONALES:
        logging.warning(f"[crear-cita] Profesional inválido: {profesional}")
        return jsonify({
            "error": f"Profesional inválido. Profesionales disponibles: {list(CALENDARIOS_PROFESIONALES.keys())}"
        }), 400

    # ================= TIEMPO DE CITA (OPCIONAL) =================
    tiempo_cita_minutos = None
    if 'tiempo_cita' in data and data['tiempo_cita'] is not None:
        try:
            tiempo_cita_minutos = int(data['tiempo_cita'])
            if tiempo_cita_minutos <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return jsonify({"error": "tiempo_cita debe ser un número entero positivo"}), 400

    # ================= CALENDARIO Y PROFESIONAL =================
    calendar_id = CALENDARIOS_PROFESIONALES[profesional]
    calendar_info = get_calendar_info(calendar_id)
    profesional_nombre = calendar_info['profesional_nombre']

    logging.info(
        f"[crear-cita] Agendando con profesional {profesional} "
        f"({profesional_nombre}) - Calendar ID: {calendar_id}"
    )

    # ================= PARSEO DE FECHA =================
    try:
        local_dt = datetime.strptime(data['start_time'], "%Y-%m-%d %H:%M")
        local_dt = pytz.timezone(TIMEZONE).localize(local_dt)
    except Exception as e:
        logging.error(f"[crear-cita] Error parseando fecha: {e}")
        return jsonify({
            "error": "Formato de fecha inválido. Use 'YYYY-MM-DD HH:MM'",
            "details": str(e)
        }), 400

    # ================= ACTUALIZAR CONTACTO =================
    if (
        ('nombre' in data and data['nombre'].strip()) or
        ('comentario' in data and data['comentario'].strip())
    ):
        logging.info("[crear-cita] Actualizando información del contacto")

        update_contact_payload = {}
        custom_fields = []

        if 'nombre' in data and data['nombre'].strip():
            update_contact_payload["name"] = data['nombre'].strip()

        if 'comentario' in data and data['comentario'].strip():
            custom_fields.append({
                "key": "comentario",
                "field_value": data['comentario'].strip()
            })

        if custom_fields:
            update_contact_payload["customFields"] = custom_fields

        if update_contact_payload:
            try:
                requests.put(
                    f"{GHL_BASE_URL}/contacts/{data['user_id']}",
                    headers={
                        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
                        "Version": API_VERSION,
                        "Content-Type": "application/json"
                    },
                    json=update_contact_payload
                )
            except Exception as e:
                logging.error(f"[crear-cita] Error actualizando contacto: {e}")

    # ================= PAYLOAD DE LA CITA =================
    payload = {
        "calendarId": calendar_id,
        "locationId": GHL_LOCATION_ID,
        "contactId": data['user_id'],
        "startTime": local_dt.isoformat()
    }

    if tiempo_cita_minutos:
        end_dt = local_dt + timedelta(minutes=tiempo_cita_minutos)
        payload["endTime"] = end_dt.isoformat()

    # ================= TÍTULO =================
    if 'nombre' in data and data['nombre'].strip():
        payload["title"] = f"{data['nombre'].strip()} - {profesional_nombre}"
    else:
        payload["title"] = f"Cita - {profesional_nombre}"

    logging.debug(f"[crear-cita] Payload enviado a GHL: {payload}")

    # ================= CREAR CITA =================
    response = requests.post(
        f"{GHL_BASE_URL}/calendars/events/appointments",
        headers={
            "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
            "Version": API_VERSION,
            "Content-Type": "application/json"
        },
        json=payload
    )

    if response.status_code not in [200, 201, 202]:
        logging.error(f"[crear-cita] Error creando la cita: {response.text}")
        return jsonify({
            "error": "Error creando la cita",
            "detalle": response.text
        }), response.status_code

    try:
        r = response.json()
        return jsonify({
            "appoinmentStatus": r.get("appoinmentStatus", ""),
            "id": r.get("id", ""),
            "profesional": profesional,
            "profesional_nombre": profesional_nombre
        }), 200
    except Exception as e:
        logging.error(f"[crear-cita] Error procesando respuesta: {e}")
        return jsonify({
            "error": "Error procesando la respuesta",
            "details": str(e)
        }), 500


@app.route('/actualizar-cita', methods=['POST'])
def actualizar_cita():
    data = request.get_json()
    logging.info(f"[actualizar-cita] Request data: {data}")

    if not data or 'event_id' not in data:
        return jsonify({"error": "event_id es requerido"}), 400

    event_id = data['event_id']

    # ================= OBTENER CITA ACTUAL =================
    try:
        cita = obtener_cita_por_evento(event_id)
        start_time_actual = cita.get("startTime")
    except Exception as e:
        return jsonify({"error": "No se pudo obtener la cita", "detalle": str(e)}), 400

    # ================= PAYLOAD CONTACTO =================
    payload_contacto = {
        "customFields": []
    }

    if 'comentario' in data:
        payload_contacto["customFields"].append({
            "key": "comentario",
            "field_value": data['comentario'] or ""
        })

    if 'telefono' in data and data['telefono']:
        payload_contacto["phone"] = data['telefono'].strip()

    # ================= ACTUALIZAR CONTACTO (SIEMPRE) =================
    if payload_contacto["customFields"] or "phone" in payload_contacto:
        if 'user_id' not in data:
            return jsonify({"error": "user_id es requerido"}), 400

        requests.put(
            f"{GHL_BASE_URL}/contacts/{data['user_id']}",
            headers={
                "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
                "Version": API_VERSION,
                "Content-Type": "application/json",
                "Location-Id": GHL_LOCATION_ID
            },
            json=payload_contacto
        )

    # ================= (OPCIONAL) REAFIRMAR CITA =================
    # Esto no cambia nada, pero deja la acción ligada a la cita
    requests.put(
        f"{GHL_BASE_URL}/calendars/events/appointments/{event_id}",
        headers={
            "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
            "Version": API_VERSION,
            "Content-Type": "application/json",
            "Location-Id": GHL_LOCATION_ID
        },
        json={
            "startTime": start_time_actual
        }
    )

    return jsonify({
        "updated": True,
        "event_id": event_id,
        "start_time_usado": start_time_actual,
        "custom_fields_actualizados": True
    }), 200

def obtener_cita_por_evento(event_id):
    url = f"{GHL_BASE_URL}/calendars/events/appointments/{event_id}"
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": API_VERSION,
        "Accept": "application/json",
        "Location-Id": GHL_LOCATION_ID
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(response.text)

    return response.json()

@app.route('/eliminar-cita', methods=['POST'])
def eliminar_cita():
    data = request.get_json()
    if not data or 'event_id' not in data:
        return jsonify({"error": "Se requiere 'event_id'"}), 400

    event_id = data['event_id']
    url = f"{GHL_BASE_URL}/calendars/events/{event_id}"

    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": API_VERSION,
        "Accept": "application/json"
    }

    response = requests.delete(url, headers=headers)

    print("\n--- RESPUESTA GHL ELIMINAR CITA ---")
    print(response.status_code)
    print(response.text)
    print("--- FIN RESPUESTA GHL ELIMINAR CITA ---\n")

    if response.status_code not in [200, 201]:
        return jsonify({"error": "Error eliminando la cita", "detalle": response.text}), 500

    try:
        resultado = response.json()
        # Filtrar la respuesta para eliminar traceId
        respuesta_filtrada = {
            "mensaje": "Cita eliminada exitosamente",
            "succeeded": resultado.get("succeeded", True),
            "event_id": event_id
        }
        return jsonify(respuesta_filtrada), 200
    except:
        # Si la respuesta no es JSON válido pero el código es 200/201
        if response.status_code in [200, 201]:
            return jsonify({
                "mensaje": "Cita eliminada exitosamente",
                "succeeded": True,
                "event_id": event_id
            }), 200
        return jsonify({"error": "Respuesta inesperada del servidor"}), 500


def get_custom_field_id(field_key):
    url = f"{GHL_BASE_URL}/locations/{GHL_LOCATION_ID}/customFields"
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": API_VERSION,
        "Location-Id": GHL_LOCATION_ID
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception("No se pudieron obtener los custom fields")

    fields = response.json().get("customFields", [])

    for field in fields:
        if field.get("key") == field_key:
            return field.get("id")

    raise Exception(f"Custom field '{field_key}' no encontrado")


@app.route('/citas-contacto', methods=['POST'])
def obtener_citas_contacto():
    data = request.get_json()
    logging.info(f"[citas-contacto] Request data: {data}")
    if not data or 'user_id' not in data:
        logging.warning("[citas-contacto] Falta el campo 'user_id'")
        return jsonify({"error": "Se requiere 'user_id'"}), 400

    user_id = data['user_id']  # Cambiado de contact_id a user_id
    url = f"{GHL_BASE_URL}/contacts/{user_id}/appointments"
    headers = {
        "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
        "Version": API_VERSION,
        "Accept": "application/json"
    }
    logging.debug(f"[citas-contacto] URL: {url}, headers: {headers}")
    response = requests.get(url, headers=headers)
    logging.info(f"[citas-contacto] GHL response status: {response.status_code}")
    logging.debug(f"[citas-contacto] GHL response text: {response.text}")
    if response.status_code != 200:
        logging.error(f"[citas-contacto] Error consultando citas: {response.text}")
        return jsonify({"error": "Error consultando citas", "detalle": response.text}), 500
    eventos = response.json().get("events", [])
    logging.debug(f"[citas-contacto] Eventos recibidos: {eventos}")
    resultados = []
    for evento in eventos:
        start_str = evento.get("startTime")
        evento_id = evento.get("id")  # Obtener el ID del evento
        logging.debug(f"[citas-contacto] Evento: id={evento_id}, startTime={start_str}")
        if not start_str:
            continue
        try:
            # Convertir string a datetime
            start_dt_naive = datetime.strptime(start_str, "%Y-%m-%d %H:%M:%S")
            # Simplemente trabaja con el datetime sin localizar
            fecha = start_dt_naive.strftime("%Y-%m-%d")
            hora = start_dt_naive.strftime("%H:%M")
            resultados.append({
                "id": evento_id,  # Añadir el ID al resultado
                "fecha": fecha, 
                "hora": hora
            })
        except Exception as e:
            logging.error(f"[citas-contacto] Error al parsear fecha: {start_str}, error: {e}")
            continue
    logging.info(f"[citas-contacto] Resultados: {resultados}")
    return jsonify({"citas": resultados})


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=3000)
"""
Plantilla de API para Dentalink/Medilink
Funciones organizadas para gestión de citas médicas/dentales

Funciones principales:
- search_availability: Buscar disponibilidad de profesionales
- search_user: Buscar paciente por RUT
- create_user: Crear nuevo paciente
- schedule_appointment: Agendar cita
- cancel_appointment: Cancelar cita
"""

import logging
import json
import requests
from datetime import datetime, timedelta
import pytz
from flask import Flask, request, jsonify
import os
from typing import List, Dict, Any, Optional, Tuple
import threading
import unicodedata

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__)

# ============================
# CONFIGURACIÓN DE APIS
# ============================

# Configuración de Medilink v5
MEDILINK_API_URL = os.getenv('MEDILINK_API_URL', 'https://api.medilink2.healthatom.com/api/v5/')
MEDILINK_TOKEN = os.getenv('MEDILINK_TOKEN', 'QBl6SlfOGiiOyEdtrfmhDWMMdIGyYdAEGv9gLEeJ.vThde4Lwv88DMLNrX7ni1Orr7C7tKEnUQXTxjv4c')

# Configuración de Dentalink v1  
DENTALINK_API_URL = os.getenv('DENTALINK_API_URL', 'https://api.dentalink.healthatom.com/api/v1/')
DENTALINK_TOKEN = os.getenv('DENTALINK_TOKEN', MEDILINK_TOKEN)

# Headers para las APIs
MEDILINK_HEADERS = {
    "Authorization": f"Token {MEDILINK_TOKEN}",
    "Content-Type": "application/json"
}

DENTALINK_HEADERS = {
    "Authorization": f"Token {DENTALINK_TOKEN}",
    "Content-Type": "application/json"
}

# Configuración de sucursales (personalizar según necesidad)
SUCURSALES_DENTALINK = [1,2,3,4]  # Sucursales que usan Dentalink v1
# Las demás sucursales usan Medilink v5

# ============================
# CONFIGURACIÓN GHL (OPCIONAL)
# ============================

GHL_ACCESS_TOKEN = os.getenv('GHL_ACCESS_TOKEN', 'pit-14ec3c5a-7b38-490a-8455-98abf2c74e1a')
GHL_CALENDAR_ID = os.getenv('GHL_CALENDAR_ID', 'ooALBvSWsEirGZZsSNim')
GHL_LOCATION_ID = os.getenv('GHL_LOCATION_ID', 'OOZTkZtP1Hkmhjq0oQHE')


# ============================
# UTILIDADES
# ============================

def normalizar_texto(texto: str) -> str:
    """Normaliza texto removiendo acentos y convirtiendo a minúscula"""
    if not texto:
        return ""
    nfd = unicodedata.normalize('NFD', texto)
    sin_acentos = ''.join(char for char in nfd if unicodedata.category(char) != 'Mn')
    return sin_acentos.lower().strip()

def extraer_id(valor: Any) -> Optional[int]:
    """Extrae un ID numérico de diferentes tipos de entrada"""
    if isinstance(valor, int):
        return valor
    if isinstance(valor, str):
        try:
            return int(valor.strip())
        except ValueError:
            return None
    return None

def determinar_api_por_sucursal(id_sucursal: int) -> Tuple[str, Dict, bool]:
    """
    Determina qué API usar según el ID de sucursal.
    
    Returns:
        tuple: (api_base_url, headers, is_dentalink)
    """
    usa_dentalink = id_sucursal in SUCURSALES_DENTALINK
    api_base = DENTALINK_API_URL if usa_dentalink else MEDILINK_API_URL
    headers_api = DENTALINK_HEADERS if usa_dentalink else MEDILINK_HEADERS
    return api_base, headers_api, usa_dentalink

def obtener_nombre_api(id_sucursal: int) -> str:
    """Retorna el nombre legible de la API que se usa para una sucursal"""
    return "Dentalink v1" if id_sucursal in SUCURSALES_DENTALINK else "Medilink v5"

def formatear_rut(rut: str) -> str:
    """Formatea un RUT chileno removiendo puntos y manteniendo guión"""
    try:
        rut = rut.replace(".", "").strip()
        if "-" in rut:
            cuerpo, dv = rut.split("-")
        else:
            cuerpo, dv = rut[:-1], rut[-1]
        return f"{int(cuerpo)}-{dv.upper()}"
    except Exception as e:
        logging.warning(f"⚠️ Error al formatear RUT {rut}: {e}")
        return rut

def filtrar_horarios_futuros(horarios: List[Dict], fecha: str, hora_actual: datetime) -> List[Dict]:
    """Filtra horarios para que solo incluya los que son en el futuro"""
    horarios_futuros = []
    
    for horario in horarios:
        try:
            hora_inicio = horario.get("hora_inicio", "")
            hora_cita = datetime.strptime(f"{fecha} {hora_inicio}", "%Y-%m-%d %H:%M:%S")
            
            if hora_actual.tzinfo is not None:
                hora_cita = hora_actual.tzinfo.localize(hora_cita)
            
            if hora_cita > hora_actual:
                horarios_futuros.append(horario)
        except ValueError as e:
            logging.warning(f"⚠️ Error al procesar horario {horario}: {e}")
            continue
    
    return horarios_futuros

def filtrar_horarios_por_duracion(horarios: List[Dict], tiempo_cita: int) -> List[str]:
    """
    Filtra horarios disponibles según el tiempo requerido de la cita.
    Solo retorna horarios donde hay suficientes slots consecutivos.
    Usa el intervalo real del API sin defaults.
    
    Args:
        horarios: Lista de horarios disponibles del API
        tiempo_cita: Duración requerida en minutos
    
    Returns:
        Lista de horas de inicio válidas en formato HH:MM
    """
    if not horarios or not tiempo_cita:
        # Si no hay tiempo_cita especificado, retornar todos los horarios
        return [datetime.strptime(h.get("hora_inicio", ""), "%H:%M:%S").strftime("%H:%M") for h in horarios]
    
    # Ordenar horarios por hora de inicio
    horarios_ordenados = sorted(horarios, key=lambda x: x.get("hora_inicio", ""))
    
    horarios_validos = []
    
    for i, horario in enumerate(horarios_ordenados):
        try:
            # Obtener intervalo del API (obligatorio)
            intervalo = horario.get("intervalo")
            if not intervalo:
                logging.warning(f"⚠️ Slot sin intervalo definido: {horario.get('hora_inicio', 'N/A')} - Se omite")
                continue
            
            hora_inicio_str = horario.get("hora_inicio", "")
            hora_inicio = datetime.strptime(hora_inicio_str, "%H:%M:%S")
            
            # Calcular tiempo total disponible empezando desde este slot
            tiempo_disponible = intervalo  # El slot actual
            hora_esperada = hora_inicio + timedelta(minutes=intervalo)
            slots_usados = 1
            
            # Verificar slots consecutivos
            for j in range(i + 1, len(horarios_ordenados)):
                siguiente_horario = horarios_ordenados[j]
                hora_siguiente_str = siguiente_horario.get("hora_inicio", "")
                hora_siguiente = datetime.strptime(hora_siguiente_str, "%H:%M:%S")
                intervalo_siguiente = siguiente_horario.get("intervalo")
                
                if not intervalo_siguiente:
                    logging.warning(f"⚠️ Slot consecutivo sin intervalo: {hora_siguiente_str} - Se detiene búsqueda")
                    break
                
                # Verificar si es consecutivo
                if hora_siguiente == hora_esperada:
                    tiempo_disponible += intervalo_siguiente
                    slots_usados += 1
                    hora_esperada = hora_siguiente + timedelta(minutes=intervalo_siguiente)
                    
                    # Si ya tenemos suficiente tiempo, este es válido
                    if tiempo_disponible >= tiempo_cita:
                        break
                else:
                    # No es consecutivo, romper la búsqueda
                    break
            
            # Verificar si el tiempo disponible es suficiente
            if tiempo_disponible >= tiempo_cita:
                horarios_validos.append(hora_inicio.strftime("%H:%M"))
                logging.info(f"✅ Horario válido: {hora_inicio.strftime('%H:%M')} ({slots_usados} slots = {tiempo_disponible}min disponibles para {tiempo_cita}min requeridos)")
            else:
                logging.info(f"❌ Horario insuficiente: {hora_inicio.strftime('%H:%M')} (solo {tiempo_disponible}min disponibles, necesita {tiempo_cita}min)")
                
        except Exception as e:
            logging.warning(f"⚠️ Error procesando horario para duración: {e}")
            continue
    
    return horarios_validos

# ============================
# FUNCIÓN 1: BUSCAR DISPONIBILIDAD
# ============================

def search_availability(ids_profesionales: List[int], id_sucursal: int, fecha_inicio: str = None, tiempo_cita: int = None) -> Dict[str, Any]:
    """
    Busca disponibilidad de profesionales en Medilink/Dentalink.
    
    Args:
        ids_profesionales: Lista de IDs de profesionales
        id_sucursal: ID de la sucursal
        fecha_inicio: Fecha de inicio (opcional, default: hoy)
        tiempo_cita: Tiempo en minutos requerido para la cita (opcional)
    
    Returns:
        Dict con la disponibilidad encontrada
    """
    logging.info("🔍 Iniciando búsqueda de disponibilidad")
    logging.info(f"📋 Parámetros recibidos:")
    logging.info(f"   - ids_profesionales: {ids_profesionales}")
    logging.info(f"   - id_sucursal: {id_sucursal}")
    logging.info(f"   - fecha_inicio: {fecha_inicio}")
    logging.info(f"   - tiempo_cita: {tiempo_cita}")
    
    # Validaciones
    if not ids_profesionales:
        logging.error("❌ Error: No se proporcionaron IDs de profesionales")
        return {"error": "Se requiere al menos un ID de profesional"}
    
    if not id_sucursal:
        logging.error("❌ Error: No se proporcionó ID de sucursal")
        return {"error": "Se requiere ID de sucursal"}
    
    # Determinar API a usar
    api_base, headers_api, usa_dentalink = determinar_api_por_sucursal(id_sucursal)
    logging.info(f"🔧 API seleccionada: {obtener_nombre_api(id_sucursal)}")
    logging.info(f"🌐 URL base: {api_base}")
    logging.info(f"🔑 Headers: {headers_api}")
    
    # Obtener nombres de profesionales
    profesionales_info = {}
    logging.info("👨‍⚕️ Obteniendo información de profesionales...")
    
    # Intentar primero con la API correspondiente a la sucursal
    if usa_dentalink:
        try:
            prof_resp = requests.get(f"{api_base}dentistas", headers=headers_api)
            if prof_resp.status_code == 200:
                dentistas = prof_resp.json().get("data", [])
                for dentista in dentistas:
                    if dentista.get("id") in ids_profesionales:
                        apellidos = dentista.get('apellidos', '') or dentista.get('apellido', '')
                        nombre_completo = f"{dentista.get('nombre', 'Desconocido')} {apellidos}".strip()
                        profesionales_info[dentista.get("id")] = nombre_completo
                        logging.info(f"✅ Dentista encontrado en Dentalink: ID {dentista.get('id')} - {nombre_completo}")
            else:
                logging.warning(f"⚠️ No se pudieron obtener dentistas de Dentalink: {prof_resp.status_code}")
        except Exception as e:
            logging.warning(f"⚠️ Error obteniendo dentistas de Dentalink: {e}")
    else:
        # Para Medilink, obtener cada profesional individualmente
        for id_prof in ids_profesionales:
            try:
                prof_resp = requests.get(f"{api_base}profesionales/{id_prof}", headers=headers_api)
                if prof_resp.status_code == 200:
                    prof_data = prof_resp.json().get("data", {})
                    apellidos = prof_data.get('apellidos', '') or prof_data.get('apellido', '')
                    nombre_completo = f"{prof_data.get('nombre', 'Desconocido')} {apellidos}".strip()
                    profesionales_info[id_prof] = nombre_completo
                    logging.info(f"✅ Profesional encontrado en Medilink: ID {id_prof} - {nombre_completo}")
                else:
                    logging.warning(f"⚠️ No se pudo obtener profesional {id_prof} de Medilink: {prof_resp.status_code}")
            except Exception as e:
                logging.warning(f"⚠️ Error obteniendo profesional {id_prof} de Medilink: {e}")
    
    # Buscar profesionales faltantes en la API alternativa
    ids_faltantes = [id_prof for id_prof in ids_profesionales if id_prof not in profesionales_info]
    
    if ids_faltantes:
        logging.info(f"🔄 Buscando {len(ids_faltantes)} profesionales en API alternativa...")
        
        if usa_dentalink:
            # Si usamos Dentalink, buscar faltantes en Medilink
            for id_prof in ids_faltantes:
                try:
                    prof_resp = requests.get(f"{MEDILINK_API_URL}profesionales/{id_prof}", headers=MEDILINK_HEADERS)
                    if prof_resp.status_code == 200:
                        prof_data = prof_resp.json().get("data", {})
                        apellidos = prof_data.get('apellidos', '') or prof_data.get('apellido', '')
                        nombre_completo = f"{prof_data.get('nombre', 'Desconocido')} {apellidos}".strip()
                        profesionales_info[id_prof] = nombre_completo
                        logging.info(f"✅ Profesional encontrado en Medilink (alternativo): ID {id_prof} - {nombre_completo}")
                    else:
                        logging.warning(f"⚠️ Profesional {id_prof} no encontrado en Medilink: {prof_resp.status_code}")
                except Exception as e:
                    logging.warning(f"⚠️ Error buscando profesional {id_prof} en Medilink: {e}")
        else:
            # Si usamos Medilink, buscar faltantes en Dentalink
            try:
                prof_resp = requests.get(f"{DENTALINK_API_URL}dentistas", headers=DENTALINK_HEADERS)
                if prof_resp.status_code == 200:
                    dentistas = prof_resp.json().get("data", [])
                    for dentista in dentistas:
                        if dentista.get("id") in ids_faltantes:
                            apellidos = dentista.get('apellidos', '') or dentista.get('apellido', '')
                            nombre_completo = f"{dentista.get('nombre', 'Desconocido')} {apellidos}".strip()
                            profesionales_info[dentista.get("id")] = nombre_completo
                            logging.info(f"✅ Dentista encontrado en Dentalink (alternativo): ID {dentista.get('id')} - {nombre_completo}")
                else:
                    logging.warning(f"⚠️ No se pudieron obtener dentistas de Dentalink: {prof_resp.status_code}")
            except Exception as e:
                logging.warning(f"⚠️ Error obteniendo dentistas de Dentalink: {e}")
    
    # Fallback: usar IDs como nombres para los que aún faltan
    for id_prof in ids_profesionales:
        if id_prof not in profesionales_info:
            profesionales_info[id_prof] = f"Profesional {id_prof}"
            logging.warning(f"⚠️ No se encontró nombre para profesional {id_prof}, usando fallback")
    
    # Obtener hora actual de Santiago/Chile
    tz_santiago = pytz.timezone("America/Santiago")
    hora_actual = datetime.now(tz_santiago)
    
    # Establecer fecha de inicio
    if not fecha_inicio:
        fecha_inicio = hora_actual.strftime("%Y-%m-%d")
    
    fecha_inicio_dt = datetime.strptime(fecha_inicio, "%Y-%m-%d")
    
    # Búsqueda iterativa hasta 4 semanas
    intentos_maximos = 4
    intento_actual = 1
    
    while intento_actual <= intentos_maximos:
        fecha_fin_dt = fecha_inicio_dt + timedelta(days=6)  # 1 semana
        
        logging.info(f"🔄 Intento {intento_actual} de {intentos_maximos}: "
                    f"Buscando del {fecha_inicio_dt.strftime('%Y-%m-%d')} al {fecha_fin_dt.strftime('%Y-%m-%d')}")
        
        # Preparar parámetros para la API según el tipo
        body_data = None
        params = None
        
        if usa_dentalink:
            # Para Dentalink: usar body JSON con ids_dentista
            body_data = {
                "ids_dentista": ids_profesionales,
                "id_sucursal": id_sucursal,
                "fecha_inicio": fecha_inicio_dt.strftime("%Y-%m-%d"),
                "fecha_fin": fecha_fin_dt.strftime("%Y-%m-%d")
            }
            logging.info(f"📋 Body JSON para Dentalink: {body_data}")
        else:
            # Para Medilink: usar parámetros URL con ids_profesional[]
            params = []
            for id_prof in ids_profesionales:
                params.append(("ids_profesional[]", id_prof))
            params.extend([
                ("id_sucursal", id_sucursal),
                ("fecha_inicio", fecha_inicio_dt.strftime("%Y-%m-%d")),
                ("fecha_fin", fecha_fin_dt.strftime("%Y-%m-%d"))
            ])
            logging.info(f"📋 Params para Medilink: {params}")
        
        # Obtener horarios disponibles - intentar en API principal primero
        response = None
        url_usado = None
        api_usada = None
        
        # Intentar primero con la API correspondiente a la sucursal
        apis_a_probar = [
            {
                "name": obtener_nombre_api(id_sucursal),
                "base": api_base,
                "headers": headers_api,
                "is_dentalink": usa_dentalink,
                "body": body_data,
                "params": params
            }
        ]
        
        # Si falla, agregar API alternativa como fallback
        api_alternativa = {
            "name": "Medilink v5" if usa_dentalink else "Dentalink v1",
            "base": MEDILINK_API_URL if usa_dentalink else DENTALINK_API_URL,
            "headers": MEDILINK_HEADERS if usa_dentalink else DENTALINK_HEADERS,
            "is_dentalink": not usa_dentalink,
            "body": None,
            "params": None
        }
        
        # Preparar params/body para API alternativa si es necesario
        if usa_dentalink:
            # Si original era Dentalink, alternativa es Medilink (usa params)
            api_alternativa["params"] = []
            for id_prof in ids_profesionales:
                api_alternativa["params"].append(("ids_profesional[]", id_prof))
            api_alternativa["params"].extend([
                ("id_sucursal", id_sucursal),
                ("fecha_inicio", fecha_inicio_dt.strftime("%Y-%m-%d")),
                ("fecha_fin", fecha_fin_dt.strftime("%Y-%m-%d"))
            ])
        else:
            # Si original era Medilink, alternativa es Dentalink (usa body)
            api_alternativa["body"] = {
                "ids_dentista": ids_profesionales,
                "id_sucursal": id_sucursal,
                "fecha_inicio": fecha_inicio_dt.strftime("%Y-%m-%d"),
                "fecha_fin": fecha_fin_dt.strftime("%Y-%m-%d")
            }
        
        apis_a_probar.append(api_alternativa)
        
        # Intentar con cada API
        for api_config in apis_a_probar:
            urls_to_try = [f"{api_config['base']}horariosdisponibles/", f"{api_config['base']}horariosdisponibles"]
            
            for url_horarios in urls_to_try:
                try:
                    logging.info(f"🌐 Intentando URL: {url_horarios} ({api_config['name']})")
                    
                    if api_config['is_dentalink']:
                        response = requests.get(url_horarios, headers=api_config['headers'], json=api_config['body'])
                    else:
                        response = requests.get(url_horarios, headers=api_config['headers'], params=api_config['params'])
                    
                    logging.info(f"📊 Status Code: {response.status_code}")
                    
                    if response.status_code == 404:
                        logging.warning(f"⚠️ Endpoint no encontrado en {api_config['name']}")
                        continue
                    
                    if response.status_code != 404:
                        url_usado = url_horarios
                        api_usada = api_config['name']
                        logging.info(f"✅ Endpoint encontrado en {api_usada}")
                        break
                        
                except requests.exceptions.RequestException as e:
                    logging.error(f"❌ Error al conectar con {url_horarios}: {e}")
                    continue
            
            if response and response.status_code != 404:
                break
        
        if response is None or response.status_code == 404:
            logging.error("❌ Endpoint horariosdisponibles no encontrado en ninguna API")
            return {"error": "Endpoint horariosdisponibles no encontrado en ninguna API (Dentalink v1 ni Medilink v5)"}
        
        logging.info(f"✅ URL exitosa: {url_usado} (API: {api_usada})")
        logging.info(f"📄 Response raw: {response.text[:500]}...")  # Primeros 500 caracteres
        
        if response.status_code == 200:
            try:
                data_response = response.json()
                logging.info(f"📦 Estructura de respuesta: {list(data_response.keys())}")
                horarios_data = data_response.get("data", {})
                logging.info(f"📅 Horarios data keys: {list(horarios_data.keys()) if horarios_data else 'No data'}")
                logging.info(f"📊 Cantidad de profesionales con horarios: {len(horarios_data) if horarios_data else 0}")
            except json.JSONDecodeError as e:
                logging.error(f"❌ Error parseando JSON: {e}")
                continue
            
            if horarios_data:
                disponibilidad_final = []
                logging.info(f"🔍 Procesando horarios para {len(horarios_data)} profesionales")
                
                for id_profesional_str, fechas_horarios in horarios_data.items():
                    id_profesional_int = int(id_profesional_str)
                    logging.info(f"👨‍⚕️ Procesando profesional ID: {id_profesional_str}")
                    logging.info(f"📅 Fechas disponibles: {list(fechas_horarios.keys()) if isinstance(fechas_horarios, dict) else 'No es dict'}")
                    
                    # Obtener nombre del profesional
                    nombre_profesional = profesionales_info.get(id_profesional_int, f"Profesional {id_profesional_int}")
                    logging.info(f"👤 Nombre asignado: {nombre_profesional}")
                    
                    disponibilidad_profesional = {
                        "nombre_profesional": nombre_profesional,
                        "fechas": {}
                    }
                    
                    if isinstance(fechas_horarios, dict):
                        for fecha, horarios in fechas_horarios.items():
                            logging.info(f"📆 Procesando fecha {fecha} con {len(horarios) if isinstance(horarios, list) else 'No es lista'} horarios")
                            
                            if isinstance(horarios, list):
                                # Primero filtrar por horarios futuros
                                horarios_futuros = filtrar_horarios_futuros(horarios, fecha, hora_actual)
                                logging.info(f"⏰ Horarios futuros filtrados: {len(horarios_futuros)}")
                                
                                if horarios_futuros:
                                    # Luego filtrar por duración si se especificó tiempo_cita
                                    if tiempo_cita:
                                        logging.info(f"⏱️ Filtrando por duración de {tiempo_cita} minutos")
                                        horarios_normalizados = filtrar_horarios_por_duracion(horarios_futuros, tiempo_cita)
                                        logging.info(f"✅ Horarios válidos para {tiempo_cita}min: {len(horarios_normalizados)}")
                                    else:
                                        # Si no hay tiempo_cita, normalizar todos los horarios futuros
                                        horarios_normalizados = []
                                        for horario in horarios_futuros:
                                            hora_inicio = horario.get("hora_inicio", "")
                                            logging.info(f"🕐 Procesando hora: {hora_inicio}")
                                            
                                            # Normalizar formato de hora
                                            try:
                                                hora_normalizada = datetime.strptime(hora_inicio, "%H:%M:%S").strftime("%H:%M")
                                            except ValueError:
                                                logging.warning(f"⚠️ Formato de hora inválido: {hora_inicio}")
                                                hora_normalizada = hora_inicio
                                            
                                            horarios_normalizados.append(hora_normalizada)
                                    
                                    if horarios_normalizados:
                                        disponibilidad_profesional["fechas"][fecha] = horarios_normalizados
                                        logging.info(f"✅ Fecha {fecha} agregada con {len(horarios_normalizados)} horarios")
                            else:
                                logging.warning(f"⚠️ Horarios para fecha {fecha} no es una lista: {type(horarios)}")
                    else:
                        logging.warning(f"⚠️ fechas_horarios no es un dict: {type(fechas_horarios)}")
                    
                    if disponibilidad_profesional["fechas"]:
                        disponibilidad_final.append(disponibilidad_profesional)
                        logging.info(f"✅ Profesional {id_profesional_str} agregado con {len(disponibilidad_profesional['fechas'])} fechas")
                    else:
                        logging.info(f"❌ Profesional {id_profesional_str} sin fechas disponibles")
                
                logging.info(f"📊 Total profesionales con disponibilidad: {len(disponibilidad_final)}")
                
                if disponibilidad_final:
                    resultado = {
                        "disponibilidad": disponibilidad_final,
                        "fecha_desde": fecha_inicio_dt.strftime('%Y-%m-%d'),
                        "fecha_hasta": fecha_fin_dt.strftime('%Y-%m-%d'),
                        "api_utilizada": api_usada if api_usada else obtener_nombre_api(id_sucursal)
                    }
                    logging.info(f"✅ Retornando disponibilidad exitosa desde {api_usada}")
                    return resultado
            else:
                logging.warning(f"⚠️ No hay datos de horarios en la respuesta para intento {intento_actual}")
        else:
            logging.error(f"❌ Status code no exitoso: {response.status_code}")
            logging.error(f"📄 Response text: {response.text}")
        
        # Avanzar a la siguiente semana
        fecha_inicio_dt += timedelta(days=7)
        intento_actual += 1
    
    return {
        "mensaje": "No se encontró disponibilidad en las próximas 4 semanas",
        "disponibilidad": []
    }

@app.route('/search_availability', methods=['POST'])
def endpoint_search_availability():
    """Endpoint para buscar disponibilidad"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    
    ids_profesionales = data.get("ids_profesionales", [])
    id_sucursal = extraer_id(data.get("id_sucursal"))
    fecha_inicio = data.get("fecha_inicio")
    tiempo_cita = data.get("tiempo_cita")
    
    resultado = search_availability(ids_profesionales, id_sucursal, fecha_inicio, tiempo_cita)
    
    if "error" in resultado:
        return jsonify(resultado), 400
    
    return jsonify(resultado)

# ============================
# FUNCIÓN 2: BUSCAR PACIENTE
# ============================

def search_user(rut: str, id_sucursal: int = None) -> Dict[str, Any]:
    """
    Busca un paciente por RUT en Medilink/Dentalink.
    
    Args:
        rut: RUT del paciente
        id_sucursal: ID de sucursal (opcional, si no se proporciona busca en ambas APIs)
    
    Returns:
        Dict con los datos del paciente encontrado o error
    """
    logging.info(f"🔍 Buscando paciente con RUT: {rut}")
    
    rut_formateado = formatear_rut(rut)
    
    def buscar_paciente_por_rut(rut_busqueda: str, api_base: str, headers_api: Dict, api_name: str):
        """Busca paciente usando el filtro q en una API específica."""
        try:
            filtro = json.dumps({"rut": {"eq": rut_busqueda}})
            logging.info(f"🔍 Buscando paciente en {api_base}pacientes?q=... RUT={rut_busqueda}")
            
            response = requests.get(f"{api_base}pacientes", headers=headers_api, params={"q": filtro})
            logging.info(f"📊 Status búsqueda paciente en {api_name}: {response.status_code}")
            
            if response.status_code == 200:
                pacientes = response.json().get("data", [])
                if pacientes:
                    paciente = pacientes[0]
                    logging.info(f"✅ Paciente encontrado en {api_name} con ID {paciente['id']}")
                    # Extraer solo los campos esenciales
                    nombre_completo = f"{paciente.get('nombre', '')} {paciente.get('apellidos', '')}".strip()
                    return {
                        "id": paciente.get("id"),
                        "nombre": nombre_completo,
                        "celular": paciente.get("celular", ""),
                        "email": paciente.get("email", ""),
                        "rut": paciente.get("rut", "")
                    }
        except Exception as e:
            logging.warning(f"⚠️ Error al buscar paciente en {api_name}: {e}")
        
        return None
    
    # Si se proporciona sucursal, usar API específica según la sucursal
    if id_sucursal:
        api_base, headers_api, usa_dentalink = determinar_api_por_sucursal(id_sucursal)
        api_name = obtener_nombre_api(id_sucursal)
        logging.info(f"🔧 Usando API específica para sucursal {id_sucursal}: {api_name}")
        
        resultado = buscar_paciente_por_rut(rut_formateado, api_base, headers_api, api_name)
        if resultado:
            return resultado
    else:
        # Buscar en ambas APIs si no se especifica sucursal
        logging.info("🔍 Buscando en ambas APIs (no se especificó sucursal)")
        apis = [
            {"name": "Medilink v5", "base": MEDILINK_API_URL, "headers": MEDILINK_HEADERS},
            {"name": "Dentalink v1", "base": DENTALINK_API_URL, "headers": DENTALINK_HEADERS}
        ]
        
        for api in apis:
            resultado = buscar_paciente_por_rut(rut_formateado, api['base'], api['headers'], api['name'])
            if resultado:
                return resultado
    
    return {"error": f"Paciente con RUT {rut_formateado} no encontrado"}

@app.route('/search_user', methods=['POST'])
def endpoint_search_user():
    """Endpoint para buscar paciente"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    
    rut = data.get("rut")
    if not rut:
        return jsonify({"error": "RUT es requerido"}), 400
    
    id_sucursal = extraer_id(data.get("id_sucursal"))
    
    resultado = search_user(rut, id_sucursal)
    
    if "error" in resultado:
        return jsonify(resultado), 404
    
    return jsonify(resultado)

# ============================
# FUNCIÓN 3: CREAR PACIENTE
# ============================

def create_user(nombre: str, apellidos: str, rut: str, telefono: str = "", email: str = "", id_sucursal: int = None) -> Dict[str, Any]:
    """
    Crea un nuevo paciente en Medilink/Dentalink.
    
    Args:
        nombre: Nombre del paciente
        apellidos: Apellidos del paciente
        rut: RUT del paciente
        telefono: Teléfono del paciente (opcional)
        email: Email del paciente (opcional)
        id_sucursal: ID de sucursal (opcional, default usa Medilink)
    
    Returns:
        Dict con los datos del paciente creado o error
    """
    logging.info(f"👤 Creando paciente: {nombre} {apellidos}")
    
    # Validaciones
    if not all([nombre, apellidos, rut]):
        return {"error": "Nombre, apellidos y RUT son requeridos"}
    
    rut_formateado = formatear_rut(rut)
    
    # Verificar si el paciente ya existe (busca en ambas APIs)
    paciente_existente = search_user(rut_formateado, id_sucursal)
    if "id" in paciente_existente:  # Si encontró el paciente (no hay error)
        return {
            "id": paciente_existente["id"],
            "mensaje": "Paciente ya existe"
        }
    
    # Determinar APIs a intentar
    apis_a_intentar = []
    
    if id_sucursal:
        api_base, headers_api, usa_dentalink = determinar_api_por_sucursal(id_sucursal)
        api_name = obtener_nombre_api(id_sucursal)
        
        # API principal
        apis_a_intentar.append({
            "name": api_name,
            "base": api_base,
            "headers": headers_api,
            "is_dentalink": usa_dentalink
        })
        
        # API alternativa como fallback
        api_alt_name = "Medilink v5" if usa_dentalink else "Dentalink v1"
        api_alt_base = MEDILINK_API_URL if usa_dentalink else DENTALINK_API_URL
        api_alt_headers = MEDILINK_HEADERS if usa_dentalink else DENTALINK_HEADERS
        
        apis_a_intentar.append({
            "name": api_alt_name,
            "base": api_alt_base,
            "headers": api_alt_headers,
            "is_dentalink": not usa_dentalink
        })
    else:
        # Default: intentar Medilink primero, luego Dentalink
        apis_a_intentar = [
            {"name": "Medilink v5", "base": MEDILINK_API_URL, "headers": MEDILINK_HEADERS, "is_dentalink": False},
            {"name": "Dentalink v1", "base": DENTALINK_API_URL, "headers": DENTALINK_HEADERS, "is_dentalink": True}
        ]
    
    # Payload del paciente
    payload_paciente = {
        "nombre": nombre,
        "apellidos": apellidos,
        "rut": rut_formateado,
        "celular": telefono,
        "email": email
    }
    
    # Intentar crear en cada API
    errores = []
    
    for api in apis_a_intentar:
        try:
            logging.info(f"🔄 Intentando crear paciente en {api['name']}")
            response = requests.post(f"{api['base']}pacientes/", headers=api['headers'], json=payload_paciente)
            
            if response.status_code == 201:
                paciente_data = response.json().get("data", {})
                id_paciente = paciente_data.get('id')
                logging.info(f"✅ Paciente creado exitosamente en {api['name']} con ID {id_paciente}")
                return {
                    "id": id_paciente,
                    "mensaje": f"Paciente creado exitosamente en {api['name']}",
                    "api_utilizada": api['name']
                }
            elif response.status_code == 400 and "existe" in response.text.lower():
                # Paciente duplicado, intentar buscar nuevamente
                logging.info(f"⚠️ Paciente duplicado detectado en {api['name']}, buscando...")
                paciente_existente = search_user(rut_formateado, id_sucursal)
                if "id" in paciente_existente:
                    return {
                        "id": paciente_existente["id"],
                        "mensaje": "Paciente ya existía"
                    }
            else:
                error_msg = f"{api['name']}: {response.status_code} - {response.text[:200]}"
                logging.warning(f"⚠️ Error en {api['name']}: {response.status_code}")
                errores.append(error_msg)
                continue
                
        except Exception as e:
            error_msg = f"{api['name']}: {str(e)}"
            logging.error(f"❌ Error en {api['name']}: {e}")
            errores.append(error_msg)
            continue
    
    # Si llegamos aquí, falló en todas las APIs
    return {
        "error": "No se pudo crear el paciente en ninguna API",
        "detalles": errores
    }

@app.route('/create_user', methods=['POST'])
def endpoint_create_user():
    """Endpoint para crear paciente"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    
    nombre = data.get("nombre")
    apellidos = data.get("apellidos")
    rut = data.get("rut")
    telefono = data.get("telefono", "")
    email = data.get("email", "")
    id_sucursal = extraer_id(data.get("id_sucursal"))
    
    resultado = create_user(nombre, apellidos, rut, telefono, email, id_sucursal)
    
    if "error" in resultado:
        return jsonify(resultado), 400
    
    return jsonify(resultado)

# ============================
# FUNCIÓN 4: AGENDAR CITA
# ============================

def schedule_appointment(id_paciente: int, id_profesional: int, id_sucursal: int, fecha: str, 
                        hora_inicio: str, user_id: str, tiempo_cita: int = None, 
                        comentario: str = "") -> Dict[str, Any]:
    """
    Agenda una cita en Medilink/Dentalink.
    
    Args:
        id_paciente: ID del paciente
        id_profesional: ID del profesional
        id_sucursal: ID de la sucursal
        fecha: Fecha de la cita (YYYY-MM-DD)
        hora_inicio: Hora de inicio (HH:MM)
        tiempo_cita: Duración en minutos (opcional, usa intervalo del profesional)
        comentario: Comentario para la cita (opcional)
        user_id: ContactId en GHL (requerido para integración)
    
    Returns:
        Dict con los datos de la cita creada o error
    """
    logging.info(f"📅 Agendando cita para paciente {id_paciente} con profesional {id_profesional}")
    
    # Determinar APIs a intentar
    api_base, headers_api, usa_dentalink = determinar_api_por_sucursal(id_sucursal)
    api_name = obtener_nombre_api(id_sucursal)
    
    apis_a_intentar = [
        {
            "name": api_name,
            "base": api_base,
            "headers": headers_api,
            "is_dentalink": usa_dentalink
        }
    ]
    
    # Agregar API alternativa como fallback
    api_alt_name = "Medilink v5" if usa_dentalink else "Dentalink v1"
    api_alt_base = MEDILINK_API_URL if usa_dentalink else DENTALINK_API_URL
    api_alt_headers = MEDILINK_HEADERS if usa_dentalink else DENTALINK_HEADERS
    
    apis_a_intentar.append({
        "name": api_alt_name,
        "base": api_alt_base,
        "headers": api_alt_headers,
        "is_dentalink": not usa_dentalink
    })
    
    # Obtener duración de la cita
    duracion = None
    
    if tiempo_cita:
        duracion = tiempo_cita
        logging.info(f"⏱️ Usando duración especificada: {duracion} min")
    else:
        # Intentar obtener intervalo del profesional
        intervalo_profesional = None
        
        # Intentar primero en API principal
        for api in apis_a_intentar:
            try:
                if api['is_dentalink']:
                    logging.info(f"🔍 Obteniendo intervalo del dentista {id_profesional} desde {api['name']}")
                    prof_resp = requests.get(f"{api['base']}dentistas", headers=api['headers'])
                    if prof_resp.status_code == 200:
                        dentistas = prof_resp.json().get("data", [])
                        for dentista in dentistas:
                            if dentista.get("id") == id_profesional:
                                intervalo_profesional = dentista.get("intervalo")
                                logging.info(f"✅ Intervalo encontrado en {api['name']}: {intervalo_profesional} min")
                                break
                        if intervalo_profesional:
                            break
                else:
                    logging.info(f"🔍 Obteniendo intervalo del profesional {id_profesional} desde {api['name']}")
                    prof_resp = requests.get(f"{api['base']}profesionales/{id_profesional}", headers=api['headers'])
                    if prof_resp.status_code == 200:
                        prof_data = prof_resp.json().get("data", {})
                        intervalo_profesional = prof_data.get("intervalo")
                        if intervalo_profesional:
                            logging.info(f"✅ Intervalo encontrado en {api['name']}: {intervalo_profesional} min")
                            break
            except Exception as e:
                logging.warning(f"⚠️ Error obteniendo intervalo en {api['name']}: {e}")
                continue
        
        if intervalo_profesional:
            duracion = intervalo_profesional
            logging.info(f"⏱️ Usando intervalo del profesional: {duracion} min")
        else:
            logging.error(f"❌ No se pudo determinar la duración de la cita para profesional {id_profesional}")
            return {"error": "No se pudo determinar la duración de la cita. Especifica tiempo_cita o verifica que el profesional tenga intervalo configurado."}
    
    # Intentar agendar en cada API
    errores = []
    
    for api in apis_a_intentar:
        try:
            # Crear payload según la API
            if api['is_dentalink']:
                payload_cita = {
                    "id_dentista": id_profesional,
                    "id_sucursal": id_sucursal,
                    "id_estado": 7,  # Estado confirmado
                    "id_sillon": 1,
                    "id_paciente": id_paciente,
                    "fecha": fecha,
                    "hora_inicio": hora_inicio,
                    "duracion": duracion,
                    "comentario": comentario or "Cita agendada por Sistema"
                }
            else:
                payload_cita = {
                    "id_profesional": id_profesional,
                    "id_sucursal": id_sucursal,
                    "id_estado": 7,  # Estado confirmado
                    "id_sillon": 1,
                    "id_paciente": id_paciente,
                    "fecha": fecha,
                    "hora_inicio": hora_inicio,
                    "duracion": duracion,
                    "comentario": comentario or "Cita agendada por Sistema",
                    "videoconsulta": 0
                }
            
            logging.info(f"🔄 Intentando agendar cita en {api['name']}")
            logging.info(f"📋 Payload: {payload_cita}")
            
            response = requests.post(f"{api['base']}citas/", headers=api['headers'], json=payload_cita)
            
            if response.status_code == 201:
                cita_data = response.json().get("data", {})
                id_cita = cita_data.get("id")
                
                logging.info(f"✅ Cita creada exitosamente en {api['name']} con ID {id_cita}")
                
                # Integración con GHL en segundo plano (requerida)
                if GHL_ACCESS_TOKEN:
                    threading.Thread(target=_integrar_ghl, args=(user_id, fecha, hora_inicio, duracion, id_profesional, id_sucursal)).start()
                else:
                    logging.warning("⚠️ GHL_ACCESS_TOKEN no configurado; se omite integración GHL")
                
                return {
                    "id_cita": id_cita,
                    "mensaje": f"Cita agendada exitosamente en {api['name']}",
                    "api_utilizada": api['name']
                }
            else:
                error_msg = f"{api['name']}: {response.status_code} - {response.text[:200]}"
                logging.warning(f"⚠️ Error en {api['name']}: {response.status_code}")
                errores.append(error_msg)
                continue
                
        except Exception as e:
            error_msg = f"{api['name']}: {str(e)}"
            logging.error(f"❌ Error en {api['name']}: {e}")
            errores.append(error_msg)
            continue
    
    # Si llegamos aquí, falló en todas las APIs
    return {
        "error": "No se pudo agendar la cita en ninguna API",
        "detalles": errores
    }

def _integrar_ghl(user_id: str, fecha: str, hora_inicio: str, duracion: int, id_profesional: int, id_sucursal: int):
    """Función auxiliar para integración con GHL en segundo plano"""
    try:
        if not GHL_ACCESS_TOKEN:
            return
        
        headers_ghl = {
            "Authorization": f"Bearer {GHL_ACCESS_TOKEN}",
            "Content-Type": "application/json",
            "Version": "2021-07-28"
        }
        
        # 1. Obtener nombres del profesional y sucursal
        nombre_profesional = f"Profesional {id_profesional}"
        nombre_sucursal = f"Sucursal {id_sucursal}"
        
        try:
            # Obtener nombre del profesional desde Dentalink (que tiene todos los profesionales)
            prof_resp = requests.get(f"{DENTALINK_API_URL}dentistas", headers=DENTALINK_HEADERS)
            if prof_resp.status_code == 200:
                profesionales = prof_resp.json().get("data", [])
                for prof in profesionales:
                    if prof.get("id") == id_profesional:
                        apellido = prof.get('apellido') or prof.get('apellidos', '')
                        nombre_profesional = f"{prof.get('nombre', 'Desconocido')} {apellido}".strip()
                        break
            
            # Obtener nombre de la sucursal
            suc_resp = requests.get(f"{MEDILINK_API_URL}sucursales/{id_sucursal}", headers=MEDILINK_HEADERS)
            if suc_resp.status_code == 200:
                nombre_sucursal = suc_resp.json().get("data", {}).get("nombre", nombre_sucursal)
        except Exception as e:
            logging.warning(f"⚠️ Error obteniendo nombres: {e}")
        
        # 2. Actualizar contacto con doctor y clínica usando keys
        update_payload = {
            "customFields": [
                {"key": "doctor", "field_value": nombre_profesional},
                {"key": "clinica", "field_value": nombre_sucursal}
            ]
        }
        update_url = f"https://services.leadconnectorhq.com/contacts/{user_id}"
        logging.info(f"🌐 Actualizando contacto en: {update_url}")
        logging.info(f"📋 Payload contacto: {update_payload}")
        
        contact_resp = requests.put(update_url, headers=headers_ghl, json=update_payload)
        logging.info(f"📊 Status Code contacto: {contact_resp.status_code}")
        
        if contact_resp.status_code == 200:
            logging.info(f"✅ Contacto actualizado en GHL: {nombre_profesional} - {nombre_sucursal}")
        else:
            logging.error(f"❌ Error actualizando contacto en GHL: {contact_resp.status_code} - {contact_resp.text}")
        
        # 3. Obtener assignedUserId del calendar
        headers_ghl["Version"] = "2021-04-15"
        calendar_url = f"https://services.leadconnectorhq.com/calendars/{GHL_CALENDAR_ID}"
        logging.info(f"🌐 Obteniendo calendar desde: {calendar_url}")
        logging.info(f"🔑 Headers GHL: {headers_ghl}")
        
        calendar_resp = requests.get(calendar_url, headers=headers_ghl)
        logging.info(f"📊 Status Code GHL Calendar: {calendar_resp.status_code}")
        logging.info(f"📄 Response GHL Calendar: {calendar_resp.text[:1000]}...")  # Primeros 1000 caracteres
        
        assigned_user_id = None
        if calendar_resp.status_code == 200:
            try:
                calendar_data = calendar_resp.json().get("calendar", {})
                logging.info(f"📦 Calendar data keys: {list(calendar_data.keys()) if calendar_data else 'No calendar data'}")
                
                team_members = calendar_data.get("teamMembers", [])
                logging.info(f"👥 Team members encontrados: {len(team_members)}")
                logging.info(f"👥 Team members data: {team_members}")
                
                if team_members:
                    # Usar el primer teamMember disponible
                    assigned_user_id = team_members[0].get("userId")
                    logging.info(f"✅ Obtenido assignedUserId del calendar: {assigned_user_id}")
                else:
                    logging.error("❌ No hay teamMembers en el calendar")
            except Exception as e:
                logging.error(f"❌ Error parseando respuesta del calendar: {e}")
        else:
            logging.error(f"❌ Error obteniendo calendar: {calendar_resp.status_code}")
            logging.error(f"📄 Error response: {calendar_resp.text}")
        
        if not assigned_user_id:
            logging.error("❌ No se pudo obtener assignedUserId del calendar")
            return
        
        # 4. Crear appointment en GHL
        tz_cl = pytz.timezone("America/Santiago")
        naive_start = datetime.strptime(f"{fecha} {hora_inicio}", "%Y-%m-%d %H:%M")
        inicio_dt = tz_cl.localize(naive_start)
        fin_dt = inicio_dt + timedelta(minutes=duracion)
        
        offset = inicio_dt.strftime('%z')
        offset_fmt = offset[:3] + ':' + offset[3:]
        
        appointment_payload = {
            "title": "Cita Médica",
            "overrideLocationConfig": True,
            "appointmentStatus": "new",
            "ignoreDateRange": True,
            "ignoreFreeSlotValidation": True,
            "calendarId": GHL_CALENDAR_ID,
            "locationId": GHL_LOCATION_ID,
            "assignedUserId": assigned_user_id,
            "contactId": user_id,
            "startTime": inicio_dt.strftime("%Y-%m-%dT%H:%M:%S") + offset_fmt,
            "endTime": fin_dt.strftime("%Y-%m-%dT%H:%M:%S") + offset_fmt
        }
        
        appt_resp = requests.post("https://services.leadconnectorhq.com/calendars/events/appointments", 
                                 headers=headers_ghl, json=appointment_payload)
        
        if appt_resp.status_code == 201:
            logging.info("✅ Appointment creado en GHL")
        else:
            logging.error(f"❌ Error creando appointment GHL: {appt_resp.status_code} - {appt_resp.text}")
        
    except Exception as e:
        logging.error(f"❌ Error en integración GHL: {e}")

@app.route('/schedule_appointment', methods=['POST'])
def endpoint_schedule_appointment():
    """Endpoint para agendar cita"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    
    # Validar campos obligatorios
    campos_obligatorios = ["id_paciente", "id_profesional", "id_sucursal", "fecha", "hora_inicio", "user_id"]
    faltantes = [campo for campo in campos_obligatorios if not data.get(campo)]
    if faltantes:
        return jsonify({"error": f"Faltan campos obligatorios: {', '.join(faltantes)}"}), 400
    
    id_paciente = extraer_id(data.get("id_paciente"))
    id_profesional = extraer_id(data.get("id_profesional"))
    id_sucursal = extraer_id(data.get("id_sucursal"))
    fecha = data.get("fecha")
    hora_inicio = data.get("hora_inicio")
    tiempo_cita = data.get("tiempo_cita")
    comentario = data.get("comentario", "")
    user_id = data.get("user_id")
    
    resultado = schedule_appointment(id_paciente, id_profesional, id_sucursal, fecha, 
                                   hora_inicio, user_id, tiempo_cita, comentario)
    
    if "error" in resultado:
        return jsonify(resultado), 400
    
    return jsonify(resultado)

# ============================
# FUNCIÓN 5: CANCELAR CITA
# ============================

def cancel_appointment(rut: str = None, id_cita: int = None) -> Dict[str, Any]:
    """
    Cancela una cita. Puede cancelar por RUT (cancela la próxima cita futura) o por ID de cita específico.
    
    Args:
        rut: RUT del paciente (cancela la próxima cita futura)
        id_cita: ID específico de la cita a cancelar
    
    Returns:
        Dict con el resultado de la cancelación o error
    """
    logging.info(f"❌ Cancelando cita - RUT: {rut}, ID Cita: {id_cita}")
    
    if not rut and not id_cita:
        return {"error": "Se requiere RUT del paciente o ID de cita"}
    
    # Si se proporciona ID de cita, cancelar directamente
    if id_cita:
        return _cancelar_cita_por_id(id_cita)
    
    # Si se proporciona RUT, buscar y cancelar próxima cita futura
    if rut:
        return _cancelar_proxima_cita_por_rut(rut)

def _cancelar_cita_por_id(id_cita: int) -> Dict[str, Any]:
    """Cancela una cita específica por ID"""
    # Intentar en ambas APIs ya que no sabemos en cuál está la cita
    apis = [
        {"name": "Dentalink v1", "base": DENTALINK_API_URL, "headers": DENTALINK_HEADERS, "is_dentalink": True},
        {"name": "Medilink v5", "base": MEDILINK_API_URL, "headers": MEDILINK_HEADERS, "is_dentalink": False}
    ]
    
    errores = []
    cita_data_guardada = None  # Para guardar datos si encontramos la cita pero falla al cancelar
    
    for api in apis:
        try:
            url_cita = f"{api['base']}citas/{id_cita}"
            
            # Obtener datos de la cita primero
            logging.info(f"🔍 Buscando cita {id_cita} en {api['name']}")
            resp_get = requests.get(url_cita, headers=api['headers'])
            
            if resp_get.status_code == 404:
                logging.info(f"⚠️ Cita {id_cita} no encontrada en {api['name']}")
                continue
            
            if resp_get.status_code == 400:
                # Error 400 en GET significa que la API no es compatible con esta cita
                logging.info(f"⚠️ Cita {id_cita} incompatible con {api['name']} (probablemente está en la otra API)")
                continue
            
            if resp_get.status_code != 200:
                error_msg = f"{api['name']} GET: {resp_get.status_code}"
                logging.warning(f"⚠️ Error obteniendo cita en {api['name']}: {error_msg}")
                errores.append(error_msg)
                continue
            
            try:
                cita_data = resp_get.json().get("data", {})
                cita_data_guardada = cita_data  # Guardar por si acaso
                logging.info(f"✅ Cita {id_cita} encontrada en {api['name']}")
            except:
                logging.warning(f"⚠️ Error parseando respuesta de {api['name']}")
                continue
            
            # Preparar payload de cancelación
            if api['is_dentalink']:
                payload_cancelar = {
                    "id_estado": 1,  # Estado anulado
                    "comentarios": "Cita cancelada por sistema",
                    "flag_notificar_anulacion": 1
                }
            else:
                payload_cancelar = {
                    "id_estado": 1,  # Estado anulado
                    "comentario": "Cita cancelada por sistema"
                }
            
            # Cancelar cita
            logging.info(f"🔄 Intentando cancelar cita en {api['name']}")
            resp_cancel = requests.put(url_cita, headers=api['headers'], json=payload_cancelar)
            
            if resp_cancel.status_code == 200:
                logging.info(f"✅ Cita {id_cita} cancelada exitosamente en {api['name']}")
                return {
                    "mensaje": "Cita cancelada exitosamente",
                    "id_cita": id_cita,
                    "fecha": cita_data.get("fecha"),
                    "hora_inicio": cita_data.get("hora_inicio"),
                    "api_utilizada": api['name']
                }
            elif resp_cancel.status_code == 400:
                # Error 400 en PUT: La cita existe pero esta API no puede cancelarla
                # Probablemente es una cita dental en Medilink o viceversa
                logging.warning(f"⚠️ {api['name']} no puede cancelar esta cita (error 400) - Intentando con la otra API")
                errores.append(f"{api['name']} PUT: Incompatibilidad (400)")
                continue  # ← IMPORTANTE: continuar al siguiente API
            else:
                error_msg = f"{api['name']} PUT: {resp_cancel.status_code}"
                logging.warning(f"⚠️ Error cancelando en {api['name']}: {error_msg} - {resp_cancel.text[:200]}")
                errores.append(error_msg)
                continue
            
        except Exception as e:
            error_msg = f"{api['name']}: Exception - {str(e)}"
            logging.warning(f"⚠️ Error en {api['name']}: {e}")
            errores.append(error_msg)
            continue
    
    # Si llegamos aquí, no se pudo cancelar en ninguna API
    return {
        "error": f"No se pudo cancelar la cita {id_cita} en ninguna API",
        "detalles": errores
    }

def _cancelar_proxima_cita_por_rut(rut: str) -> Dict[str, Any]:
    """Cancela la próxima cita futura de un paciente por RUT"""
    rut_formateado = formatear_rut(rut)
    
    # Obtener fecha y hora actual
    tz_santiago = pytz.timezone("America/Santiago")
    hora_actual = datetime.now(tz_santiago)
    fecha_actual = hora_actual.strftime("%Y-%m-%d")
    hora_actual_str = hora_actual.strftime("%H:%M:%S")
    
    apis = [
        {"name": "Medilink v5", "base": MEDILINK_API_URL, "headers": MEDILINK_HEADERS, "is_dentalink": False},
        {"name": "Dentalink v1", "base": DENTALINK_API_URL, "headers": DENTALINK_HEADERS, "is_dentalink": True}
    ]
    
    cita_encontrada = None
    api_cita = None
    
    # Buscar paciente y sus citas en ambas APIs
    for api in apis:
        try:
            # Buscar paciente
            filtro = json.dumps({"rut": {"eq": rut_formateado}})
            resp_pac = requests.get(f"{api['base']}pacientes", headers=api['headers'], params={"q": filtro})
            
            if resp_pac.status_code != 200:
                continue
            
            pacientes = resp_pac.json().get("data", [])
            if not pacientes:
                continue
            
            paciente = pacientes[0]
            
            # Obtener citas del paciente
            citas_link = next((l["href"] for l in paciente.get("links", []) if l.get("rel") == "citas"), None)
            if not citas_link:
                continue
            
            resp_citas = requests.get(citas_link, headers=api['headers'])
            if resp_citas.status_code != 200:
                continue
            
            citas = resp_citas.json().get("data", [])
            
            # Filtrar citas activas y futuras
            citas_futuras = []
            for cita in citas:
                if cita.get("estado_anulacion", 0) != 0:  # Ya anulada
                    continue
                
                fecha_cita = cita["fecha"]
                hora_cita = cita["hora_inicio"]
                
                # Verificar si es futura
                if (fecha_cita > fecha_actual or 
                    (fecha_cita == fecha_actual and hora_cita > hora_actual_str)):
                    citas_futuras.append(cita)
            
            if citas_futuras:
                # Ordenar por fecha y hora (más próxima primero)
                citas_futuras.sort(key=lambda x: (x["fecha"], x["hora_inicio"]))
                cita_candidata = citas_futuras[0]
                
                # Si no tenemos cita o esta es más próxima
                if (not cita_encontrada or 
                    (cita_candidata["fecha"], cita_candidata["hora_inicio"]) < 
                    (cita_encontrada["fecha"], cita_encontrada["hora_inicio"])):
                    cita_encontrada = cita_candidata
                    api_cita = api
                    
        except Exception as e:
            logging.warning(f"⚠️ Error buscando en {api['name']}: {e}")
            continue
    
    if not cita_encontrada:
        return {"mensaje": "No se encontraron citas futuras activas para cancelar"}
    
    # Cancelar la cita encontrada - intentar en ambas APIs si falla
    id_cita = cita_encontrada["id"]
    logging.info(f"🔄 Intentando cancelar cita {id_cita} encontrada en {api_cita['name']}")
    
    # Lista de APIs para intentar (primero la que encontró la cita, luego la otra)
    apis_cancelacion = [api_cita]
    
    # Agregar la API alternativa
    for api in apis:
        if api['name'] != api_cita['name']:
            apis_cancelacion.append(api)
            break
    
    errores_cancelacion = []
    
    for api_cancel in apis_cancelacion:
        try:
            url_cancelar = f"{api_cancel['base']}citas/{id_cita}"
            
            if api_cancel['is_dentalink']:
                payload_cancelar = {
                    "id_estado": 1,
                    "comentarios": "Cita cancelada por sistema",
                    "flag_notificar_anulacion": 1
                }
            else:
                payload_cancelar = {
                    "id_estado": 1,
                    "comentario": "Cita cancelada por sistema"
                }
            
            logging.info(f"🔄 Intentando cancelar en {api_cancel['name']}")
            resp_cancel = requests.put(url_cancelar, headers=api_cancel['headers'], json=payload_cancelar)
            
            if resp_cancel.status_code == 200:
                logging.info(f"✅ Cita cancelada exitosamente en {api_cancel['name']}")
                return {
                    "mensaje": "Cita cancelada exitosamente",
                    "id_cita": id_cita,
                    "fecha": cita_encontrada["fecha"],
                    "hora_inicio": cita_encontrada["hora_inicio"],
                    "api_utilizada": api_cancel['name']
                }
            elif resp_cancel.status_code == 400:
                # Error de incompatibilidad, intentar con la otra API
                error_msg = f"{api_cancel['name']}: Incompatibilidad (400)"
                logging.warning(f"⚠️ {error_msg} - Intentando con otra API")
                errores_cancelacion.append(error_msg)
                continue
            else:
                error_msg = f"{api_cancel['name']}: {resp_cancel.status_code}"
                logging.warning(f"⚠️ Error en {api_cancel['name']}: {error_msg}")
                errores_cancelacion.append(error_msg)
                continue
                
        except Exception as e:
            error_msg = f"{api_cancel['name']}: {str(e)}"
            logging.error(f"❌ Error cancelando en {api_cancel['name']}: {e}")
            errores_cancelacion.append(error_msg)
            continue
    
    # Si llegamos aquí, falló en todas las APIs
    return {
        "error": f"No se pudo cancelar la cita {id_cita}",
        "detalles": errores_cancelacion
    }

@app.route('/cancel_appointment', methods=['POST'])
def endpoint_cancel_appointment():
    """Endpoint para cancelar cita"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    
    rut = data.get("rut")
    id_cita = extraer_id(data.get("id_cita"))
    
    resultado = cancel_appointment(rut, id_cita)
    
    if "error" in resultado:
        return jsonify(resultado), 400
    
    return jsonify(resultado)

# ============================
# FUNCIÓN 6: OBTENER TRATAMIENTOS DE PACIENTE
# ============================

def get_patient_treatments(rut: str) -> Dict[str, Any]:
    """
    Obtiene los tratamientos/atenciones de un paciente por RUT en Medilink/Dentalink.
    
    Nota: 
    - Dentalink v1 usa endpoint /tratamientos con campos id_dentista/nombre_dentista
    - Medilink v5 usa endpoint /atenciones con campos id_profesional/nombre_profesional
    - Ambas APIs consultan automáticamente las citas para obtener hora_inicio
    
    Args:
        rut: RUT del paciente
    
    Returns:
        Dict con los tratamientos del paciente o error
    """
    logging.info(f"🔍 Buscando tratamientos para paciente con RUT: {rut}")
    
    rut_formateado = formatear_rut(rut)
    
    # Buscar en ambas APIs
    apis = [
        {"name": "Medilink v5", "base": MEDILINK_API_URL, "headers": MEDILINK_HEADERS, "is_dentalink": False},
        {"name": "Dentalink v1", "base": DENTALINK_API_URL, "headers": DENTALINK_HEADERS, "is_dentalink": True}
    ]
    
    for api in apis:
        try:
            # 1. Buscar paciente por RUT
            filtro = json.dumps({"rut": {"eq": rut_formateado}})
            logging.info(f"🔍 Buscando paciente en {api['name']}")
            
            resp_paciente = requests.get(f"{api['base']}pacientes", headers=api['headers'], params={"q": filtro})
            logging.info(f"📊 Status búsqueda paciente en {api['name']}: {resp_paciente.status_code}")
            
            if resp_paciente.status_code != 200:
                continue
            
            pacientes_data = resp_paciente.json().get("data", [])
            if not pacientes_data:
                continue
            
            paciente = pacientes_data[0]
            id_paciente = paciente.get("id")
            nombre_completo = f"{paciente.get('nombre', '')} {paciente.get('apellidos', '')}".strip()
            
            logging.info(f"✅ Paciente encontrado en {api['name']}: {nombre_completo} (ID: {id_paciente})")
            
            # 2. Buscar link de tratamientos/atenciones en los links del paciente
            tratamientos_link = None
            
            # Para Medilink, buscar "atenciones"; para Dentalink, buscar "tratamientos"
            rel_a_buscar = "tratamientos" if api['is_dentalink'] else "atenciones"
            
            for link in paciente.get("links", []):
                if link.get("rel") == rel_a_buscar:
                    tratamientos_link = link.get("href")
                    break
            
            # Si no encontró con el rel específico, buscar el alternativo
            if not tratamientos_link:
                rel_alternativo = "atenciones" if api['is_dentalink'] else "tratamientos"
                for link in paciente.get("links", []):
                    if link.get("rel") == rel_alternativo:
                        tratamientos_link = link.get("href")
                        logging.info(f"⚠️ Usando link alternativo '{rel_alternativo}' en {api['name']}")
                        break
            
            if not tratamientos_link:
                # Construir URL manualmente si no existe el link
                logging.warning("⚠️ Link no encontrado, construyendo URL manualmente")
                if api['is_dentalink']:
                    tratamientos_link = f"{api['base']}pacientes/{id_paciente}/tratamientos"
                else:
                    # Medilink usa "atenciones"
                    tratamientos_link = f"{api['base']}pacientes/{id_paciente}/atenciones"
            
            logging.info(f"🔗 Consultando tratamientos/atenciones: {tratamientos_link}")
            
            # 3. Obtener tratamientos
            resp_tratamientos = requests.get(tratamientos_link, headers=api['headers'])
            logging.info(f"📊 Status tratamientos en {api['name']}: {resp_tratamientos.status_code}")
            logging.info(f"🔗 Endpoint usado: {tratamientos_link}")
            
            if resp_tratamientos.status_code != 200:
                logging.warning(f"⚠️ Error al obtener tratamientos: Status {resp_tratamientos.status_code}")
                continue
            
            tratamientos_data = resp_tratamientos.json().get("data", [])
            logging.info(f"📋 Tratamientos encontrados en {api['name']}: {len(tratamientos_data)}")
            
            # 4. Filtrar campos relevantes de tratamientos y obtener citas
            tratamientos_filtrados = []
            for tratamiento in tratamientos_data:
                # Obtener hora_inicio desde las citas del tratamiento
                hora_inicio = None
                citas_info = []
                
                # Buscar link de citas en los links del tratamiento
                citas_link = None
                for link in tratamiento.get("links", []):
                    if link.get("rel") == "citas":
                        citas_link = link.get("href")
                        break
                
                if citas_link:
                    try:
                        logging.info(f"🔗 Consultando citas del tratamiento {tratamiento.get('id')}: {citas_link}")
                        resp_citas = requests.get(citas_link, headers=api['headers'])
                        
                        if resp_citas.status_code == 200:
                            citas_data = resp_citas.json().get("data", [])
                            logging.info(f"📅 Citas encontradas para tratamiento {tratamiento.get('id')}: {len(citas_data)}")
                            
                            # Obtener todas las citas y sus horas
                            for cita in citas_data:
                                cita_info = {
                                    "id_cita": cita.get("id"),
                                    "fecha": cita.get("fecha"),
                                    "hora_inicio": cita.get("hora_inicio"),
                                    "hora_termino": cita.get("hora_termino"),
                                    "estado": cita.get("estado"),
                                    "estado_anulacion": cita.get("estado_anulacion")
                                }
                                citas_info.append(cita_info)
                            
                            # Si hay citas, usar la hora de la primera cita no anulada
                            for cita in citas_data:
                                if cita.get("estado_anulacion", 0) == 0:  # Cita no anulada
                                    hora_inicio = cita.get("hora_inicio")
                                    break
                            
                            if hora_inicio:
                                logging.info(f"✅ Hora de inicio obtenida para tratamiento {tratamiento.get('id')}: {hora_inicio}")
                        else:
                            logging.warning(f"⚠️ Error al obtener citas del tratamiento {tratamiento.get('id')}: {resp_citas.status_code}")
                    except Exception as e:
                        logging.warning(f"⚠️ Error consultando citas del tratamiento {tratamiento.get('id')}: {e}")
                
                # Adaptar campos según la API
                if api['is_dentalink']:
                    tratamiento_filtrado = {
                        "id": tratamiento.get("id"),
                        "nombre": tratamiento.get("nombre"),
                        "fecha": tratamiento.get("fecha"),
                        "hora_inicio": hora_inicio,
                        "id_dentista": tratamiento.get("id_dentista"),
                        "nombre_dentista": tratamiento.get("nombre_dentista"),
                        "id_sucursal": tratamiento.get("id_sucursal"),
                        "nombre_sucursal": tratamiento.get("nombre_sucursal"),
                        "finalizado": tratamiento.get("finalizado"),
                        "bloqueado": tratamiento.get("bloqueado"),
                        "total": tratamiento.get("total"),
                        "abonado": tratamiento.get("abonado"),
                        "deuda": tratamiento.get("deuda"),
                        "citas": citas_info  # Incluir todas las citas del tratamiento
                    }
                else:
                    # Medilink usa id_profesional y tiene tipo_atencion
                    tratamiento_filtrado = {
                        "id": tratamiento.get("id"),
                        "nombre": tratamiento.get("nombre"),
                        "tipo_atencion": tratamiento.get("tipo_atencion"),  # Campo exclusivo de Medilink
                        "fecha": tratamiento.get("fecha"),
                        "hora_inicio": hora_inicio,
                        "id_profesional": tratamiento.get("id_profesional"),  # Medilink usa id_profesional
                        "nombre_profesional": tratamiento.get("nombre_profesional"),  # Medilink usa nombre_profesional
                        "id_sucursal": tratamiento.get("id_sucursal"),
                        "nombre_sucursal": tratamiento.get("nombre_sucursal"),
                        "finalizado": tratamiento.get("finalizado"),
                        "bloqueado": tratamiento.get("bloqueado"),
                        "total": tratamiento.get("total"),
                        "abonado": tratamiento.get("abonado"),
                        "deuda": tratamiento.get("deuda"),
                        "citas": citas_info  # Incluir todas las citas del tratamiento
                    }
                tratamientos_filtrados.append(tratamiento_filtrado)
            
            # 5. Preparar respuesta
            return {
                "paciente": {
                    "id": id_paciente,
                    "nombre": nombre_completo,
                    "rut": rut_formateado,
                    "email": paciente.get("email", ""),
                    "celular": paciente.get("celular", "")
                },
                "tratamientos": tratamientos_filtrados,
                "total_tratamientos": len(tratamientos_filtrados),
                "api_utilizada": api['name']
            }
            
        except Exception as e:
            logging.warning(f"⚠️ Error obteniendo tratamientos en {api['name']}: {e}")
            continue
    
    return {"error": f"Paciente con RUT {rut_formateado} no encontrado o sin tratamientos"}

@app.route('/get_patient_treatments', methods=['POST'])
def endpoint_get_patient_treatments():
    """Endpoint para obtener tratamientos de paciente"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    
    rut = data.get("rut")
    if not rut:
        return jsonify({"error": "RUT es requerido"}), 400
    
    resultado = get_patient_treatments(rut)
    
    if "error" in resultado:
        return jsonify(resultado), 404
    
    return jsonify(resultado)

# ============================
# ENDPOINTS ADICIONALES
# ============================

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de verificación de salud del servicio"""
    return jsonify({
        "status": "ok",
        "service": "Dentalink API Template",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/config', methods=['GET'])
def get_config():
    """Endpoint para obtener configuración actual"""
    return jsonify({
        "sucursales_dentalink": SUCURSALES_DENTALINK,
        "medilink_configured": bool(MEDILINK_TOKEN),
        "dentalink_configured": bool(DENTALINK_TOKEN),
        "ghl_configured": bool(GHL_ACCESS_TOKEN)
    })

# ============================
# FUNCIÓN COMPLETA: CREAR PACIENTE Y AGENDAR
# ============================

@app.route('/create_user_and_schedule', methods=['POST'])
def create_user_and_schedule():
    """
    Función completa que crea (o busca) un paciente y agenda una cita.
    Combina las funciones create_user y schedule_appointment.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    
    # Datos del paciente
    nombre = data.get("nombre")
    apellidos = data.get("apellidos")
    rut = data.get("rut")
    telefono = data.get("telefono", "")
    email = data.get("email", "")
    
    # Datos de la cita
    id_profesional = extraer_id(data.get("id_profesional"))
    id_sucursal = extraer_id(data.get("id_sucursal"))
    fecha = data.get("fecha")
    hora_inicio = data.get("hora_inicio")
    tiempo_cita = data.get("tiempo_cita")
    comentario = data.get("comentario", "")
    user_id = data.get("user_id")
    
    # Validar campos obligatorios
    campos_obligatorios = ["nombre", "apellidos", "rut", "id_profesional", "id_sucursal", "fecha", "hora_inicio", "user_id"]
    faltantes = [campo for campo in campos_obligatorios if not data.get(campo)]
    if faltantes:
        return jsonify({"error": f"Faltan campos obligatorios: {', '.join(faltantes)}"}), 400
    
    # 1. Crear o buscar paciente
    resultado_paciente = create_user(nombre, apellidos, rut, telefono, email, id_sucursal)
    if "error" in resultado_paciente:
        return jsonify(resultado_paciente), 400
    
    id_paciente = resultado_paciente["id"]
    
    # 2. Agendar cita
    resultado_cita = schedule_appointment(id_paciente, id_profesional, id_sucursal, fecha, 
                                        hora_inicio, user_id, tiempo_cita, comentario)
    
    if "error" in resultado_cita:
        return jsonify(resultado_cita), 400
    
    # 3. Respuesta combinada
    return jsonify({
        "mensaje": "Paciente creado/encontrado y cita agendada exitosamente",
        "paciente": resultado_paciente,
        "cita": resultado_cita
    })

if __name__ == '__main__':
    logging.info("🚀 Iniciando servidor Dentalink API Template")
    
    # Verificar configuración
    if not MEDILINK_TOKEN:
        logging.warning("⚠️ MEDILINK_TOKEN no configurado")
    if not DENTALINK_TOKEN:
        logging.warning("⚠️ DENTALINK_TOKEN no configurado")
    
    app.run(debug=True, host='0.0.0.0', port=3000)

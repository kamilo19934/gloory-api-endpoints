"""
API para Dentalink
Funciones organizadas para gestión de citas dentales

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
import locale

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__)

# ============================
# CONFIGURACIÓN DE API
# ============================

# Configuración de Dentalink v1  
DENTALINK_API_URL = os.getenv('DENTALINK_API_URL', 'https://api.dentalink.healthatom.com/api/v1/')
DENTALINK_TOKEN = os.getenv('DENTALINK_TOKEN', 'szUUgciZTnQevke6Vj6JWnZ8r0xOciOheRvKHnuw.7ySKmF5bcMO0dHdeAqU61d8qo0zeC8am2GKHeZmx')

# Headers para la API
DENTALINK_HEADERS = {
    "Authorization": f"Token {DENTALINK_TOKEN}",
    "Content-Type": "application/json"
}

# ============================
# CONFIGURACIÓN GHL (OPCIONAL)
# ============================

GHL_ACCESS_TOKEN = os.getenv('GHL_ACCESS_TOKEN', 'pit-6f501c7a-6f49-44e0-bbbe-96788b1ea6ff')
GHL_CALENDAR_ID = os.getenv('GHL_CALENDAR_ID', '7U0Cv0cyOIBktrn4qihl')
GHL_LOCATION_ID = os.getenv('GHL_LOCATION_ID', 'Y6SfrX5Wf5M9eaz8LSq4')

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

def obtener_configuracion_api() -> Tuple[str, Dict]:
    """
    Obtiene la configuración de la API de Dentalink.
    
    Returns:
        tuple: (api_base_url, headers)
    """
    return DENTALINK_API_URL, DENTALINK_HEADERS

def obtener_nombre_api() -> str:
    """Retorna el nombre legible de la API"""
    return "Dentalink v1"

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

def formatear_fecha_espanol(fecha_str: str) -> str:
    """Convierte una fecha YYYY-MM-DD a formato 'Martes 10 de Octubre 2025'"""
    try:
        # Mapeo de días y meses en español
        dias_semana = {
            0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves",
            4: "Viernes", 5: "Sábado", 6: "Domingo"
        }
        
        meses = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
            5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
            9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
        }
        
        fecha_dt = datetime.strptime(fecha_str, "%Y-%m-%d")
        dia_semana = dias_semana[fecha_dt.weekday()]
        dia = fecha_dt.day
        mes = meses[fecha_dt.month]
        año = fecha_dt.year
        
        return f"{dia_semana} {dia} de {mes} {año}"
    except Exception as e:
        logging.warning(f"⚠️ Error formateando fecha {fecha_str}: {e}")
        return fecha_str

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

def validar_bloques_consecutivos(horarios_str: List[str], tiempo_cita: int, intervalo_profesional: int) -> List[str]:
    """
    Valida que existan bloques consecutivos suficientes para el tiempo de cita solicitado.
    
    Args:
        horarios_str: Lista de horarios en formato "HH:MM" o "HH:MM:SS"
        tiempo_cita: Tiempo requerido en minutos
        intervalo_profesional: Intervalo del profesional en minutos
    
    Returns:
        Lista de horarios válidos (solo el inicio de cada secuencia consecutiva)
    """
    if not horarios_str or not tiempo_cita or not intervalo_profesional:
        return horarios_str
    
    # Calcular cuántos bloques consecutivos se necesitan
    bloques_necesarios = (tiempo_cita + intervalo_profesional - 1) // intervalo_profesional
    
    logging.info(f"🔢 Tiempo cita: {tiempo_cita} min, Intervalo: {intervalo_profesional} min, Bloques necesarios: {bloques_necesarios}")
    
    if bloques_necesarios <= 1:
        # Si solo necesita 1 bloque o menos, todos los horarios son válidos
        return horarios_str
    
    # Convertir horarios a datetime para comparación
    horarios_dt = []
    for hora_str in horarios_str:
        try:
            # Normalizar formato (puede venir HH:MM:SS o HH:MM)
            if len(hora_str.split(':')) == 3:
                dt = datetime.strptime(hora_str, "%H:%M:%S")
            else:
                dt = datetime.strptime(hora_str, "%H:%M")
            horarios_dt.append(dt)
        except ValueError:
            logging.warning(f"⚠️ Formato de hora inválido: {hora_str}")
            continue
    
    # Ordenar horarios
    horarios_dt.sort()
    
    # Encontrar secuencias consecutivas
    horarios_validos = []
    
    for i in range(len(horarios_dt)):
        es_valido = True
        
        # Verificar si hay bloques consecutivos suficientes desde este horario
        for j in range(1, bloques_necesarios):
            if i + j >= len(horarios_dt):
                es_valido = False
                break
            
            # Calcular la diferencia esperada
            diferencia_esperada = timedelta(minutes=intervalo_profesional * j)
            diferencia_real = horarios_dt[i + j] - horarios_dt[i]
            
            # Verificar si los bloques son consecutivos
            if diferencia_real != diferencia_esperada:
                es_valido = False
                break
        
        if es_valido:
            # Agregar el horario de inicio de la secuencia válida
            hora_formateada = horarios_dt[i].strftime("%H:%M")
            horarios_validos.append(hora_formateada)
            logging.info(f"✅ Horario válido encontrado: {hora_formateada} (tiene {bloques_necesarios} bloques consecutivos)")
    
    logging.info(f"📊 Horarios totales: {len(horarios_str)}, Horarios válidos con bloques consecutivos: {len(horarios_validos)}")
    
    return horarios_validos

# ============================
# FUNCIÓN 1: BUSCAR DISPONIBILIDAD
# ============================

def search_availability(ids_profesionales: List[int], id_sucursal: int, fecha_inicio: str = None, tiempo_cita: int = None) -> Dict[str, Any]:
    """
    Busca disponibilidad de profesionales en Dentalink.
    
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
    
    # Obtener configuración de API
    api_base, headers_api = obtener_configuracion_api()
    logging.info(f"🔧 API seleccionada: {obtener_nombre_api()}")
    logging.info(f"🌐 URL base: {api_base}")
    logging.info(f"🔑 Headers: {headers_api}")
    
    # Obtener nombres e intervalos de profesionales
    profesionales_info = {}
    profesionales_intervalos = {}
    try:
        logging.info("👨‍⚕️ Obteniendo información de profesionales...")
        prof_resp = requests.get(f"{api_base}dentistas", headers=headers_api)
        if prof_resp.status_code == 200:
            dentistas = prof_resp.json().get("data", [])
            for dentista in dentistas:
                if dentista.get("id") in ids_profesionales:
                    apellido = dentista.get('apellido') or dentista.get('apellidos', '')
                    nombre_completo = f"{dentista.get('nombre', 'Desconocido')} {apellido}".strip()
                    intervalo = dentista.get('intervalo')  # Sin default, debe venir del profesional
                    profesionales_info[dentista.get("id")] = nombre_completo
                    if intervalo:
                        profesionales_intervalos[dentista.get("id")] = intervalo
                        logging.info(f"✅ Profesional encontrado: ID {dentista.get('id')} - {nombre_completo} (Intervalo: {intervalo} min)")
                    else:
                        logging.warning(f"⚠️ Profesional ID {dentista.get('id')} - {nombre_completo} sin intervalo configurado")
        else:
            logging.warning(f"⚠️ No se pudieron obtener los profesionales: {prof_resp.status_code}")
    except Exception as e:
        logging.warning(f"⚠️ Error obteniendo información de profesionales: {e}")
    
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
        
        # Preparar body JSON para la API según documentación de Dentalink
        body_data = {
            "ids_dentista": ids_profesionales,
            "id_sucursal": id_sucursal,
            "fecha_inicio": fecha_inicio_dt.strftime("%Y-%m-%d"),
            "fecha_fin": fecha_fin_dt.strftime("%Y-%m-%d")
        }
        
        logging.info(f"📋 Body JSON enviado: {body_data}")
        
        # Obtener horarios disponibles
        urls_to_try = [f"{api_base}horariosdisponibles/", f"{api_base}horariosdisponibles"]
        response = None
        url_usado = None
        
        for url_horarios in urls_to_try:
            try:
                logging.info(f"🌐 Intentando URL: {url_horarios}")
                response = requests.get(url_horarios, headers=headers_api, json=body_data)
                logging.info(f"📊 Status Code: {response.status_code}")
                
                if response.status_code != 404:
                    url_usado = url_horarios
                    break
            except requests.exceptions.RequestException as e:
                logging.error(f"❌ Error al conectar con {url_horarios}: {e}")
        
        if response is None or response.status_code == 404:
            logging.error("❌ Endpoint horariosdisponibles no encontrado en ninguna URL")
            return {"error": "Endpoint horariosdisponibles no encontrado"}
        
        logging.info(f"✅ URL exitosa: {url_usado}")
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
                    intervalo_profesional = profesionales_intervalos.get(id_profesional_int)
                    logging.info(f"👤 Nombre asignado: {nombre_profesional}")
                    if intervalo_profesional:
                        logging.info(f"⏱️ Intervalo del profesional: {intervalo_profesional} minutos")
                    else:
                        logging.warning(f"⚠️ Profesional sin intervalo configurado")
                    
                    disponibilidad_profesional = {
                        "id_profesional": id_profesional_int,
                        "nombre_profesional": nombre_profesional,
                        "fechas": {}
                    }
                    
                    if isinstance(fechas_horarios, dict):
                        for fecha, horarios in fechas_horarios.items():
                            logging.info(f"📆 Procesando fecha {fecha} con {len(horarios) if isinstance(horarios, list) else 'No es lista'} horarios")
                            
                            if isinstance(horarios, list):
                                horarios_futuros = filtrar_horarios_futuros(horarios, fecha, hora_actual)
                                logging.info(f"⏰ Horarios futuros filtrados: {len(horarios_futuros)}")
                                
                                if horarios_futuros:
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
                                        # Validar bloques consecutivos si se especificó tiempo_cita Y el profesional tiene intervalo
                                        if tiempo_cita and intervalo_profesional:
                                            logging.info(f"🔍 Validando bloques consecutivos para tiempo_cita={tiempo_cita} min")
                                            horarios_normalizados = validar_bloques_consecutivos(
                                                horarios_normalizados, 
                                                tiempo_cita, 
                                                intervalo_profesional
                                            )
                                        elif tiempo_cita and not intervalo_profesional:
                                            logging.warning(f"⚠️ Se solicitó tiempo_cita={tiempo_cita} min pero el profesional no tiene intervalo configurado. No se puede validar bloques consecutivos.")
                                        
                                        if horarios_normalizados:
                                            # Formatear fecha en español
                                            fecha_formateada = formatear_fecha_espanol(fecha)
                                            disponibilidad_profesional["fechas"][fecha_formateada] = horarios_normalizados
                                            logging.info(f"✅ Fecha {fecha} ({fecha_formateada}) agregada con {len(horarios_normalizados)} horarios")
                                        else:
                                            logging.info(f"❌ Fecha {fecha} sin horarios válidos después de validar bloques consecutivos")
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
                        "fecha_hasta": fecha_fin_dt.strftime('%Y-%m-%d')
                    }
                    logging.info(f"✅ Retornando disponibilidad exitosa")
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
    Busca un paciente por RUT en Dentalink.
    
    Args:
        rut: RUT del paciente
        id_sucursal: ID de sucursal (opcional, no afecta la búsqueda)
    
    Returns:
        Dict con los datos del paciente encontrado o error
    """
    logging.info(f"🔍 Buscando paciente con RUT: {rut}")
    
    rut_formateado = formatear_rut(rut)
    api_base, headers_api = obtener_configuracion_api()
    api_name = obtener_nombre_api()
    
    try:
        filtro = json.dumps({"rut": {"eq": rut_formateado}})
        logging.info(f"🔍 Buscando paciente en {api_base}pacientes?q=... RUT={rut_formateado}")
        
        response = requests.get(f"{api_base}pacientes", headers=headers_api, params={"q": filtro})
        logging.info(f"📊 Status búsqueda paciente en {api_name}: {response.status_code}")
        
        if response.status_code == 200:
            pacientes = response.json().get("data", [])
            if pacientes:
                paciente = pacientes[0]
                logging.info(f"✅ Paciente encontrado en {api_name} con ID {paciente['id']}")
                return {
                    "paciente": paciente
                }
    except Exception as e:
        logging.warning(f"⚠️ Error al buscar paciente en {api_name}: {e}")
    
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

def create_user(nombre: str, apellidos: str, rut: str, telefono: str = "", email: str = "", 
                fecha_nacimiento: str = "", id_sucursal: int = None) -> Dict[str, Any]:
    """
    Crea un nuevo paciente en Dentalink.
    
    Args:
        nombre: Nombre del paciente
        apellidos: Apellidos del paciente
        rut: RUT del paciente
        telefono: Teléfono del paciente (opcional)
        email: Email del paciente (opcional)
        fecha_nacimiento: Fecha de nacimiento del paciente en formato YYYY-MM-DD (opcional)
        id_sucursal: ID de sucursal (opcional, no afecta la creación)
    
    Returns:
        Dict con los datos del paciente creado o error
    """
    logging.info(f"👤 Creando paciente: {nombre} {apellidos}")
    
    # Validaciones
    if not all([nombre, apellidos, rut]):
        return {"error": "Nombre, apellidos y RUT son requeridos"}
    
    rut_formateado = formatear_rut(rut)
    
    # Obtener configuración de API
    api_base, headers_api = obtener_configuracion_api()
    api_name = obtener_nombre_api()
    
    # Verificar si el paciente ya existe
    paciente_existente = search_user(rut_formateado, id_sucursal)
    if "paciente" in paciente_existente:
        return {
            "id_paciente": paciente_existente["paciente"]["id"],
            "mensaje": "Paciente ya existe"
        }
    
    # Crear nuevo paciente
    payload_paciente = {
        "nombre": nombre,
        "apellidos": apellidos,
        "rut": rut_formateado,
        "celular": telefono,
        "email": email
    }
    
    # Agregar fecha_nacimiento si se proporciona
    if fecha_nacimiento:
        payload_paciente["fecha_nacimiento"] = fecha_nacimiento
    
    try:
        response = requests.post(f"{api_base}pacientes/", headers=headers_api, json=payload_paciente)
        
        if response.status_code == 201:
            paciente_data = response.json().get("data", {})
            id_paciente = paciente_data.get('id')
            logging.info(f"✅ Paciente creado exitosamente en {api_name} con ID {id_paciente}")
            return {
                "id_paciente": id_paciente,
                "mensaje": "Paciente creado exitosamente"
            }
        elif response.status_code == 400 and "existe" in response.text.lower():
            # Paciente duplicado, intentar buscar nuevamente
            paciente_existente = search_user(rut_formateado, id_sucursal)
            if "paciente" in paciente_existente:
                return {
                    "id_paciente": paciente_existente["paciente"]["id"],
                    "mensaje": "Paciente ya existía"
                }
        
        return {"error": f"Error al crear paciente: {response.text}"}
        
    except Exception as e:
        logging.error(f"❌ Error al crear paciente: {e}")
        return {"error": f"Error de conexión: {str(e)}"}

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
    fecha_nacimiento = data.get("fecha_nacimiento", "")
    id_sucursal = extraer_id(data.get("id_sucursal"))
    
    resultado = create_user(nombre, apellidos, rut, telefono, email, fecha_nacimiento, id_sucursal)
    
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
    Agenda una cita en Dentalink.
    
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
    
    # Obtener configuración de API
    api_base, headers_api = obtener_configuracion_api()
    api_name = obtener_nombre_api()
    
    # Obtener datos del profesional para el intervalo
    duracion = None
    intervalo_profesional = None
    
    try:
        prof_resp = requests.get(f"{api_base}dentistas", headers=headers_api)
        if prof_resp.status_code == 200:
            dentistas = prof_resp.json().get("data", [])
            for dentista in dentistas:
                if dentista.get("id") == id_profesional:
                    intervalo_profesional = dentista.get("intervalo")
                    break
    except Exception as e:
        logging.warning(f"⚠️ No se pudo obtener intervalo del profesional: {e}")
    
    # Determinar duración: tiempo_cita especificado o intervalo del profesional
    if tiempo_cita:
        duracion = tiempo_cita
    elif intervalo_profesional:
        duracion = intervalo_profesional
    else:
        return {"error": "No se pudo determinar la duración de la cita. Especifica tiempo_cita o verifica que el profesional tenga intervalo configurado."}
    
    # Crear payload de cita para Dentalink
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
    
    try:
        response = requests.post(f"{api_base}citas/", headers=headers_api, json=payload_cita)
        
        if response.status_code == 201:
            cita_data = response.json().get("data", {})
            id_cita = cita_data.get("id")
            
            logging.info(f"✅ Cita creada exitosamente en {api_name} con ID {id_cita}")
            
            # Integración con GHL en segundo plano (requerida)
            if GHL_ACCESS_TOKEN:
                threading.Thread(target=_integrar_ghl, args=(user_id, fecha, hora_inicio, duracion, id_profesional, id_sucursal, comentario)).start()
            else:
                logging.warning("⚠️ GHL_ACCESS_TOKEN no configurado; se omite integración GHL")
            
            return {
                "id_cita": id_cita,
                "mensaje": "Cita agendada exitosamente"
            }
        else:
            return {"error": f"Error al crear cita: {response.text}"}
            
    except Exception as e:
        logging.error(f"❌ Error al agendar cita: {e}")
        return {"error": f"Error de conexión: {str(e)}"}

def _integrar_ghl(user_id: str, fecha: str, hora_inicio: str, duracion: int, id_profesional: int, id_sucursal: int, comentario: str = ""):
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
            # Obtener nombre del profesional desde Dentalink
            prof_resp = requests.get(f"{DENTALINK_API_URL}dentistas", headers=DENTALINK_HEADERS)
            if prof_resp.status_code == 200:
                profesionales = prof_resp.json().get("data", [])
                for prof in profesionales:
                    if prof.get("id") == id_profesional:
                        apellido = prof.get('apellido') or prof.get('apellidos', '')
                        nombre_profesional = f"{prof.get('nombre', 'Desconocido')} {apellido}".strip()
                        break
            
            # Obtener nombre de la sucursal desde Dentalink
            suc_resp = requests.get(f"{DENTALINK_API_URL}sucursales/{id_sucursal}", headers=DENTALINK_HEADERS)
            if suc_resp.status_code == 200:
                nombre_sucursal = suc_resp.json().get("data", {}).get("nombre", nombre_sucursal)
        except Exception as e:
            logging.warning(f"⚠️ Error obteniendo nombres: {e}")
        
        # 2. Actualizar contacto con doctor, clínica y comentario usando keys
        custom_fields = [
            {"key": "doctor", "field_value": nombre_profesional},
            {"key": "clinica", "field_value": nombre_sucursal}
        ]
        
        # Agregar comentario si existe
        if comentario:
            custom_fields.append({"key": "comentario", "field_value": comentario})
        
        update_payload = {
            "customFields": custom_fields
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
    api_base, headers_api = obtener_configuracion_api()
    api_name = obtener_nombre_api()
    
    try:
        url_cita = f"{api_base}citas/{id_cita}"
        
        # Obtener datos de la cita primero
        resp_get = requests.get(url_cita, headers=headers_api)
        if resp_get.status_code != 200:
            return {"error": f"No se encontró la cita con ID {id_cita}"}
        
        cita_data = resp_get.json().get("data", {})
        
        # Preparar payload de cancelación para Dentalink
        payload_cancelar = {
            "id_estado": 1,  # Estado anulado
            "comentarios": "Cita cancelada por sistema",
            "flag_notificar_anulacion": 1
        }
        
        # Cancelar cita
        resp_cancel = requests.put(url_cita, headers=headers_api, json=payload_cancelar)
        
        if resp_cancel.status_code == 200:
            logging.info(f"✅ Cita {id_cita} cancelada en {api_name}")
            return {
                "mensaje": "Cita cancelada exitosamente",
                "id_cita": id_cita,
                "fecha": cita_data.get("fecha"),
                "hora_inicio": cita_data.get("hora_inicio")
            }
        else:
            return {"error": f"Error al cancelar cita: {resp_cancel.text}"}
        
    except Exception as e:
        logging.warning(f"⚠️ Error cancelando cita: {e}")
        return {"error": f"Error de conexión: {str(e)}"}

def _cancelar_proxima_cita_por_rut(rut: str) -> Dict[str, Any]:
    """Cancela la próxima cita futura de un paciente por RUT"""
    rut_formateado = formatear_rut(rut)
    
    # Obtener fecha y hora actual
    tz_santiago = pytz.timezone("America/Santiago")
    hora_actual = datetime.now(tz_santiago)
    fecha_actual = hora_actual.strftime("%Y-%m-%d")
    hora_actual_str = hora_actual.strftime("%H:%M:%S")
    
    api_base, headers_api = obtener_configuracion_api()
    api_name = obtener_nombre_api()
    
    cita_encontrada = None
    
    # Buscar paciente y sus citas en Dentalink
    try:
        # Buscar paciente
        filtro = json.dumps({"rut": {"eq": rut_formateado}})
        resp_pac = requests.get(f"{api_base}pacientes", headers=headers_api, params={"q": filtro})
        
        if resp_pac.status_code != 200:
            return {"error": "No se pudo buscar el paciente"}
        
        pacientes = resp_pac.json().get("data", [])
        if not pacientes:
            return {"error": f"Paciente con RUT {rut_formateado} no encontrado"}
        
        paciente = pacientes[0]
        
        # Obtener citas del paciente
        citas_link = next((l["href"] for l in paciente.get("links", []) if l.get("rel") == "citas"), None)
        if not citas_link:
            return {"error": "No se pudo acceder a las citas del paciente"}
        
        resp_citas = requests.get(citas_link, headers=headers_api)
        if resp_citas.status_code != 200:
            return {"error": "No se pudieron obtener las citas del paciente"}
        
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
            cita_encontrada = citas_futuras[0]
                
    except Exception as e:
        logging.warning(f"⚠️ Error buscando en {api_name}: {e}")
        return {"error": f"Error de conexión: {str(e)}"}
    
    if not cita_encontrada:
        return {"mensaje": "No se encontraron citas futuras activas para cancelar"}
    
    # Cancelar la cita encontrada
    try:
        id_cita = cita_encontrada["id"]
        url_cancelar = f"{api_base}citas/{id_cita}"
        
        payload_cancelar = {
            "id_estado": 1,
            "comentarios": "Cita cancelada por sistema",
            "flag_notificar_anulacion": 1
        }
        
        resp_cancel = requests.put(url_cancelar, headers=headers_api, json=payload_cancelar)
        
        if resp_cancel.status_code == 200:
            return {
                "mensaje": "Cita cancelada exitosamente",
                "id_cita": id_cita,
                "fecha": cita_encontrada["fecha"],
                "hora_inicio": cita_encontrada["hora_inicio"]
            }
        else:
            return {"error": f"Error al cancelar cita: {resp_cancel.text}"}
            
    except Exception as e:
        logging.error(f"❌ Error al cancelar cita: {e}")
        return {"error": f"Error de conexión: {str(e)}"}

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
    Obtiene los tratamientos de un paciente por RUT en Dentalink.
    
    Args:
        rut: RUT del paciente
    
    Returns:
        Dict con los tratamientos del paciente o error
    """
    logging.info(f"🔍 Buscando tratamientos para paciente con RUT: {rut}")
    
    rut_formateado = formatear_rut(rut)
    api_base, headers_api = obtener_configuracion_api()
    api_name = obtener_nombre_api()
    
    try:
        # 1. Buscar paciente por RUT
        filtro = json.dumps({"rut": {"eq": rut_formateado}})
        logging.info(f"🔍 Buscando paciente en {api_base}pacientes")
        
        resp_paciente = requests.get(f"{api_base}pacientes", headers=headers_api, params={"q": filtro})
        logging.info(f"📊 Status búsqueda paciente: {resp_paciente.status_code}")
        
        if resp_paciente.status_code != 200:
            return {"error": f"Error al buscar paciente: {resp_paciente.text}"}
        
        pacientes_data = resp_paciente.json().get("data", [])
        if not pacientes_data:
            return {"error": f"Paciente con RUT {rut_formateado} no encontrado"}
        
        paciente = pacientes_data[0]
        id_paciente = paciente.get("id")
        nombre_completo = f"{paciente.get('nombre', '')} {paciente.get('apellidos', '')}".strip()
        
        logging.info(f"✅ Paciente encontrado: {nombre_completo} (ID: {id_paciente})")
        
        # 2. Buscar link de tratamientos en los links del paciente
        tratamientos_link = None
        for link in paciente.get("links", []):
            if link.get("rel") == "tratamientos":
                tratamientos_link = link.get("href")
                break
        
        if not tratamientos_link:
            # Construir URL manualmente si no existe el link
            logging.warning("⚠️ Link de tratamientos no encontrado, construyendo URL manualmente")
            tratamientos_link = f"{api_base}pacientes/{id_paciente}/tratamientos"
        
        logging.info(f"🔗 Consultando tratamientos: {tratamientos_link}")
        
        # 3. Obtener tratamientos
        resp_tratamientos = requests.get(tratamientos_link, headers=headers_api)
        logging.info(f"📊 Status tratamientos: {resp_tratamientos.status_code}")
        
        if resp_tratamientos.status_code != 200:
            return {"error": f"Error al obtener tratamientos: {resp_tratamientos.text}"}
        
        tratamientos_data = resp_tratamientos.json().get("data", [])
        logging.info(f"📋 Tratamientos encontrados: {len(tratamientos_data)}")
        
        # 4. Filtrar campos relevantes de tratamientos
        tratamientos_filtrados = []
        for tratamiento in tratamientos_data:
            tratamiento_filtrado = {
                "id": tratamiento.get("id"),
                "fecha": tratamiento.get("fecha"),
                "id_dentista": tratamiento.get("id_dentista"),
                "nombre_dentista": tratamiento.get("nombre_dentista"),
                "id_sucursal": tratamiento.get("id_sucursal"),
                "nombre_sucursal": tratamiento.get("nombre_sucursal"),
                "finalizado": tratamiento.get("finalizado")
            }
            tratamientos_filtrados.append(tratamiento_filtrado)
        
        # 5. Preparar respuesta
        return {
            "paciente": {
                "id": id_paciente,
                "nombre": nombre_completo,
                "rut": rut_formateado
            },
            "tratamientos": tratamientos_filtrados,
            "total_tratamientos": len(tratamientos_filtrados)
        }
        
    except Exception as e:
        logging.error(f"❌ Error obteniendo tratamientos: {e}")
        return {"error": f"Error de conexión: {str(e)}"}

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
        "service": "Dentalink API",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/config', methods=['GET'])
def get_config():
    """Endpoint para obtener configuración actual"""
    return jsonify({
        "api": "Dentalink v1",
        "dentalink_configured": bool(DENTALINK_TOKEN),
        "ghl_configured": bool(GHL_ACCESS_TOKEN)
    })


if __name__ == '__main__':
    logging.info("🚀 Iniciando servidor Dentalink API")
    
    # Verificar configuración
    if not DENTALINK_TOKEN:
        logging.warning("⚠️ DENTALINK_TOKEN no configurado")
    
    app.run(debug=True, host='0.0.0.0', port=5001)

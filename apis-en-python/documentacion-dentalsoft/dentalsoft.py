import re
import json
import math
import logging
import time
import uuid
import requests
from typing import Optional, Union
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dateutil.relativedelta import relativedelta
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ─── Logging ──────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("dentalsoft-api")

# ─── Config ───────────────────────────────────────────────────

DS_BASE_URL = "https://api.dentalsoft.cl/external"
DS_CLIENT_ID = "6980a2b79a161"
DS_CLIENT_SECRET = "f5adbd3186bc050903c78acb37319e6137cd67e719de6f60a280852643ea686e"
DS_SCOPE = 77550217

GHL_BASE_URL = "https://services.leadconnectorhq.com"
GHL_PIT_TOKEN = "pit-6d866aa0-0e44-4dc6-a1bf-60ef60ce62a4"
GHL_LOCATION_ID = "Atl4hWzmVIKUzuBX1W4u"
GHL_CALENDAR_ID = "mbf97rP2SnOFtyTSmT3y"

CLINIC_TZ = ZoneInfo("America/Santiago")


@asynccontextmanager
async def lifespan(app):
    logger.info("=" * 50)
    logger.info("DentalSoft API iniciada")
    logger.info(f"DS_BASE_URL: {DS_BASE_URL}")
    logger.info(f"DS_CLIENT_ID: {DS_CLIENT_ID[:6]}***")
    logger.info(f"GHL_LOCATION_ID: {GHL_LOCATION_ID}")
    logger.info(f"GHL_CALENDAR_ID: {GHL_CALENDAR_ID}")
    logger.info(f"Timezone: {CLINIC_TZ}")
    logger.info("=" * 50)
    yield


app = FastAPI(title="DentalSoft API", version="1.0.0", lifespan=lifespan)


# ─── Middleware de logging ────────────────────────────────────


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.time()

    body_bytes = await request.body()
    body_text = body_bytes.decode("utf-8") if body_bytes else ""

    logger.info(
        f"[{request_id}] >>> {request.method} {request.url.path} | body={body_text}"
    )

    response = await call_next(request)

    elapsed = round((time.time() - start) * 1000)
    logger.info(
        f"[{request_id}] <<< {request.method} {request.url.path} | status={response.status_code} | {elapsed}ms"
    )

    return response


# ─── Schemas ──────────────────────────────────────────────────


class CancelarCitaRequest(BaseModel):
    id_cita: int


class CrearCitaRequest(BaseModel):
    id_sucursal: int
    id_profesional: int
    id_sala: int
    id_paciente: int
    fecha: str = Field(..., description="Formato YYYY-MM-DD")
    hora: str = Field(..., description="Formato HH:MM")
    duracion: int = Field(..., gt=0)
    user_id: str = Field(..., description="Id del contacto en GoHighLevel para replicar la cita")


class CrearPacienteRequest(BaseModel):
    rut: str
    nombre: str
    apellido_paterno: str
    apellido_materno: Optional[str] = None
    email: str
    celular: str


class ObtenerPacienteRequest(BaseModel):
    rut: str


class ObtenerDisponibilidadRequest(BaseModel):
    id_sucursal: int
    id_profesional: Union[int, list[int]]
    fecha: str = Field(..., description="Formato YYYY-MM-DD")
    duracion: int = Field(..., gt=0)


class ObtenerCitaMasProximaRequest(BaseModel):
    id_paciente: int


# ─── DentalSoft helpers ───────────────────────────────────────


def dentalsoft_request(method: str, path: str, token: str = None, **kwargs) -> requests.Response:
    url = f"{DS_BASE_URL}{path}"
    headers = kwargs.pop("headers", {})
    if token:
        headers.update({"accept": "application/json", "Authorization": f"Bearer {token}"})

    logger.info(f"  -> DentalSoft {method.upper()} {path}")

    start = time.time()
    response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    elapsed = round((time.time() - start) * 1000)

    logger.info(f"  <- DentalSoft {method.upper()} {path} | status={response.status_code} | {elapsed}ms")

    if response.status_code != 200:
        try:
            resp_body = response.text[:500]
        except Exception:
            resp_body = "(no body)"
        logger.warning(f"  <- DentalSoft response body: {resp_body}")

    return response


def get_access_token() -> str:
    logger.info("  Solicitando access_token...")
    response = dentalsoft_request(
        "post",
        "/access_token",
        headers={"accept": "application/json"},
        data={
            "grant_type": "client_credentials",
            "client_id": DS_CLIENT_ID,
            "client_secret": DS_CLIENT_SECRET,
            "scope": DS_SCOPE,
        },
    )
    response.raise_for_status()
    logger.info("  Access token obtenido OK")
    return response.json()["access_token"]


# ─── GHL helpers ──────────────────────────────────────────────


def ghl_request(method: str, path: str, version: str, **kwargs) -> requests.Response:
    url = f"{GHL_BASE_URL}{path}"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GHL_PIT_TOKEN}",
        "Version": version,
    }

    logger.info(f"  -> GHL {method.upper()} {path}")

    start = time.time()
    response = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    elapsed = round((time.time() - start) * 1000)

    logger.info(f"  <- GHL {method.upper()} {path} | status={response.status_code} | {elapsed}ms")

    if response.status_code >= 400:
        body = response.text[:500] if response.text else "(no body)"
        logger.warning(f"  <- GHL response body: {body}")

    return response


_assigned_user_id_cache: Optional[str] = None


def ghl_get_assigned_user_id() -> Optional[str]:
    global _assigned_user_id_cache
    if _assigned_user_id_cache:
        return _assigned_user_id_cache
    resp = ghl_request("get", f"/calendars/{GHL_CALENDAR_ID}", version="2021-04-15")
    resp.raise_for_status()
    members = resp.json().get("calendar", {}).get("teamMembers", [])
    if not members:
        logger.warning("  GHL calendar sin teamMembers, no se puede asignar appointment")
        return None
    _assigned_user_id_cache = members[0].get("userId")
    logger.info(f"  assignedUserId obtenido: {_assigned_user_id_cache}")
    return _assigned_user_id_cache


def ghl_create_appointment(contact_id: str, start_iso: str, end_iso: str, title: str, to_notify: bool = True) -> dict:
    assigned_user_id = ghl_get_assigned_user_id()

    payload = {
        "title": title,
        "appointmentStatus": "new",
        "overrideLocationConfig": True,
        "ignoreDateRange": True,
        "ignoreFreeSlotValidation": True,
        "calendarId": GHL_CALENDAR_ID,
        "locationId": GHL_LOCATION_ID,
        "contactId": contact_id,
        "startTime": start_iso,
        "endTime": end_iso,
        "toNotify": to_notify,
    }
    if assigned_user_id:
        payload["assignedUserId"] = assigned_user_id

    response = ghl_request("post", "/calendars/events/appointments", version="2021-04-15", json=payload)
    response.raise_for_status()
    return response.json()


# ─── RUT utils ────────────────────────────────────────────────


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


def _simplify_intervals(data):
    if not data:
        return []

    fmt = "%H:%M:%S"

    for d in data:
        d["inicio_dt"] = datetime.strptime(d["inicio"], fmt)
        d["fin_dt"] = datetime.strptime(d["fin"], fmt)

    data.sort(
        key=lambda x: (x["id_profesional"], x["cod_sala"], x["fecha"], x["inicio_dt"])
    )

    result = []
    for d in data:
        if not result:
            result.append(d)
        else:
            last = result[-1]
            if (
                d["fecha"] == last["fecha"]
                and d["id_profesional"] == last["id_profesional"]
                and d["cod_sala"] == last["cod_sala"]
                and d["inicio_dt"] <= last["fin_dt"]
            ):
                last["fin_dt"] = max(last["fin_dt"], d["fin_dt"])
            else:
                result.append(d)

    return [
        {
            "fecha": r["fecha"],
            "inicio": r["inicio_dt"],
            "fin": r["fin_dt"],
            "id_profesional": r["id_profesional"],
            "cod_sala": r["cod_sala"],
        }
        for r in result
    ]


def _generate_start_times(data, duration):
    result = []
    delta = timedelta(minutes=duration)

    for d in data:
        start = d["inicio"]
        end = d["fin"]

        while start + delta <= end:
            result.append(
                {
                    "fecha": d["fecha"],
                    "inicio": start.strftime("%H:%M:%S"),
                    "id_profesional": d["id_profesional"],
                    "cod_sala": d["cod_sala"],
                }
            )
            start += delta

    return result


# ─── Endpoints ────────────────────────────────────────────────


@app.get("/obtener-sucursales")
def obtener_sucursales():
    try:
        jwt = get_access_token()
        response = dentalsoft_request("get", "/sucursal/listado", token=jwt)

        if response.status_code != 200:
            return JSONResponse(status_code=response.status_code, content={
                "status": response.status_code,
                "message": "Error al obtener las sucursales",
            })

        data = response.json()
        logger.info(f"  Sucursales obtenidas: {len(data) if isinstance(data, list) else 'N/A'}")
        return {"status": 200, "message": data}
    except Exception as e:
        logger.exception(f"  Error en /obtener-sucursales: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.get("/obtener-profesionales")
def obtener_profesionales():
    try:
        jwt = get_access_token()
        response = dentalsoft_request("get", "/profesional/listado", token=jwt)

        if response.status_code != 200:
            return JSONResponse(status_code=response.status_code, content={
                "status": response.status_code,
                "message": "Error al obtener los profesionales",
            })

        data = response.json()
        logger.info(f"  Profesionales obtenidos: {len(data) if isinstance(data, list) else 'N/A'}")
        return {"status": 200, "message": data}
    except Exception as e:
        logger.exception(f"  Error en /obtener-profesionales: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.post("/obtener-paciente")
def obtener_paciente(body: ObtenerPacienteRequest):
    try:
        rut_formatted = format_rut(body.rut)
        logger.info(f"  RUT formateado: {rut_formatted}")

        if not validate_rut(rut_formatted):
            logger.warning(f"  RUT invalido: {body.rut}")
            return JSONResponse(status_code=400, content={
                "status": 400, "message": "El rut no es valido.",
            })

        jwt = get_access_token()
        response = dentalsoft_request(
            "get",
            f"/paciente/datos?cedula={rut_formatted}&tipo_cedula_texto=rut",
            token=jwt,
        )

        data = response.json()
        logger.info(f"  Paciente encontrado: {bool(data)}")
        return {"status": 200, "message": data}
    except Exception as e:
        logger.exception(f"  Error en /obtener-paciente: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.post("/crear-paciente")
def crear_paciente(body: CrearPacienteRequest):
    try:
        rut_formatted = format_rut(body.rut)
        logger.info(f"  Creando paciente RUT={rut_formatted} nombre={body.nombre} {body.apellido_paterno}")

        if not validate_rut(rut_formatted):
            logger.warning(f"  RUT invalido: {body.rut}")
            return JSONResponse(status_code=400, content={
                "status": 400, "message": "El rut no es valido.",
            })

        jwt = get_access_token()

        payload = {
            "cedula": rut_formatted,
            "tipo_cedula_texto": "rut",
            "nombre": body.nombre,
            "apellido_paterno": body.apellido_paterno,
            "email": body.email,
            "celular": body.celular,
        }

        if body.apellido_materno is not None:
            payload["apellido_materno"] = body.apellido_materno

        response = dentalsoft_request("post", "/paciente/nuevo", token=jwt, json=payload)

        data = response.json()
        logger.info(f"  Respuesta crear paciente: {json.dumps(data, ensure_ascii=False)[:200]}")
        return {"status": 200, "message": data}
    except Exception as e:
        logger.exception(f"  Error en /crear-paciente: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.post("/obtener-disponibilidad")
def obtener_disponibilidad(body: ObtenerDisponibilidadRequest):
    try:
        jwt = get_access_token()

        block_resp = dentalsoft_request("get", "/agenda/bloque/largo", token=jwt)

        if block_resp.status_code != 200:
            return JSONResponse(status_code=block_resp.status_code, content={
                "status": block_resp.status_code,
                "message": "Error al obtener el largo del bloque de agenda",
            })

        block_length = block_resp.json().get("largo", 5)
        duration_blocks = math.ceil(body.duracion / block_length)
        base_date = datetime.strptime(body.fecha, "%Y-%m-%d")
        all_data = []

        professional_ids = (
            [body.id_profesional]
            if isinstance(body.id_profesional, int)
            else body.id_profesional
        )

        logger.info(
            f"  Consultando disponibilidad: profesionales={professional_ids} "
            f"sucursal={body.id_sucursal} desde={body.fecha} duracion={body.duracion}min "
            f"(bloques={duration_blocks}, largo_bloque={block_length})"
        )

        max_weeks = 8
        for current_professional_id in professional_ids:
            prof_found = False
            for week in range(max_weeks):
                week_start = base_date + timedelta(weeks=week)
                week_data = []
                for i in range(7):
                    day = week_start + timedelta(days=i)
                    date_formatted = day.strftime("%Y-%m-%d")

                    resp = dentalsoft_request(
                        "get",
                        f"/agenda/disponibilidad/diaria/"
                        f"{current_professional_id}/{date_formatted}/"
                        f"{body.id_sucursal}/{duration_blocks}",
                        token=jwt,
                    )

                    if resp.status_code == 200:
                        day_data = resp.json()
                        for d in day_data:
                            d["fecha"] = date_formatted
                        week_data.extend(day_data)
                        if day_data:
                            logger.info(f"    {date_formatted} prof={current_professional_id}: {len(day_data)} bloques")

                all_data.extend(week_data)
                if week_data:
                    prof_found = True
                    logger.info(f"  Disponibilidad encontrada para prof={current_professional_id} en semana {week + 1}")
                    break

            if not prof_found:
                logger.info(f"  Sin disponibilidad para prof={current_professional_id} en {max_weeks} semanas")

        simplified = _simplify_intervals(all_data)
        starts = _generate_start_times(simplified, body.duracion)

        logger.info(f"  Disponibilidad total: {len(starts)} horarios posibles")

        if not starts:
            return {
                "status": 200,
                "message": "No hay disponibilidad para los parámetros solicitados",
                "disponibilidad": [],
            }

        return {
            "status": 200,
            "message": "Disponibilidad encontrada",
            "disponibilidad": starts,
        }
    except Exception as e:
        logger.exception(f"  Error en /obtener-disponibilidad: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.post("/crear-cita")
def crear_cita(body: CrearCitaRequest):
    try:
        logger.info(
            f"  Creando cita: paciente={body.id_paciente} prof={body.id_profesional} "
            f"sucursal={body.id_sucursal} sala={body.id_sala} "
            f"fecha={body.fecha} hora={body.hora} duracion={body.duracion}min "
            f"user_id={body.user_id}"
        )

        jwt = get_access_token()

        block_resp = dentalsoft_request("get", "/agenda/bloque/largo", token=jwt)

        if block_resp.status_code != 200:
            return JSONResponse(status_code=block_resp.status_code, content={
                "status": block_resp.status_code,
                "message": "Error al obtener el largo del bloque de agenda",
            })

        block_length = block_resp.json().get("largo", 5)
        duration_blocks = math.ceil(body.duracion / block_length)
        logger.info(f"  Bloques calculados: {duration_blocks} (largo_bloque={block_length})")

        payload = {
            "sucursal": body.id_sucursal,
            "profesional": body.id_profesional,
            "sala": body.id_sala,
            "paciente": body.id_paciente,
            "fecha": body.fecha,
            "inicio": body.hora,
            "bloques": duration_blocks,
        }

        response = dentalsoft_request("post", "/agenda/cita", token=jwt, json=payload)

        if response.status_code != 200:
            return JSONResponse(status_code=response.status_code, content={
                "status": response.status_code,
                "message": "Error al crear la cita",
            })

        data = response.json()
        logger.info(f"  Cita creada OK: {json.dumps(data, ensure_ascii=False)[:200]}")

        ghl_sync = {"status": "skipped"}
        try:
            start_dt = datetime.strptime(f"{body.fecha} {body.hora}", "%Y-%m-%d %H:%M").replace(tzinfo=CLINIC_TZ)
            end_dt = start_dt + timedelta(minutes=body.duracion)
            title = f"Cita dental {body.fecha} {body.hora}"

            ghl_response = ghl_create_appointment(
                contact_id=body.user_id,
                start_iso=start_dt.isoformat(),
                end_iso=end_dt.isoformat(),
                title=title,
                to_notify=True,
            )
            ghl_appointment_id = ghl_response.get("id") or ghl_response.get("appointment", {}).get("id")
            logger.info(f"  Cita replicada en GHL: id={ghl_appointment_id}")
            ghl_sync = {"status": "success", "appointment_id": ghl_appointment_id}
        except Exception as ghl_error:
            logger.exception(f"  Error replicando cita en GHL: {ghl_error}")
            ghl_sync = {"status": "failed", "error": str(ghl_error)}

        return {
            "status": 200,
            "message": data,
            "ghl_sync": ghl_sync,
            "user_id": body.user_id,
        }
    except Exception as e:
        logger.exception(f"  Error en /crear-cita: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.post("/cancelar-cita")
def cancelar_cita(body: CancelarCitaRequest):
    try:
        logger.info(f"  Cancelando cita id={body.id_cita}")
        jwt = get_access_token()

        payload = {"id": body.id_cita, "estado": "cancelar"}

        response = dentalsoft_request("put", "/agenda/cita/cambia_estado", token=jwt, json=payload)

        data = response.json()
        logger.info(f"  Respuesta cancelar cita: {json.dumps(data, ensure_ascii=False)[:200]}")
        return {"status": 200, "message": data}
    except Exception as e:
        logger.exception(f"  Error en /cancelar-cita: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.post("/obtener-citas-futuras")
def obtener_citas_futuras(body: ObtenerCitaMasProximaRequest):
    try:
        logger.info(f"  Buscando citas futuras para paciente={body.id_paciente}")
        jwt = get_access_token()

        now = datetime.now()
        date_from = now.strftime("%Y-%m-%d")
        date_to = (now + relativedelta(years=2)).strftime("%Y-%m-%d")

        response = dentalsoft_request(
            "get",
            f"/agenda/informes/horas/efectivas/{date_from}/{date_to}?id_paciente={body.id_paciente}",
            token=jwt,
        )

        if response.status_code != 200:
            return JSONResponse(status_code=response.status_code, content={
                "status": response.status_code, "message": "Error al obtener las citas",
            })

        data = response.json()
        future = [
            item for item in data.get("data", [])
            if datetime.strptime(f"{item['fecha_cita']} {item['hora_cita']}", "%Y-%m-%d %H:%M") >= now
        ]
        future.sort(key=lambda x: datetime.strptime(f"{x['fecha_cita']} {x['hora_cita']}", "%Y-%m-%d %H:%M"))

        logger.info(f"  Citas futuras del paciente: {len(future)}")

        if not future:
            return JSONResponse(status_code=404, content={
                "status": 404, "message": "No se encontraron citas futuras del paciente.",
            })

        return {"status": 200, "message": future, "total": len(future)}
    except Exception as e:
        logger.exception(f"  Error en /obtener-citas-futuras: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


@app.post("/obtener-cita-mas-proxima")
def obtener_cita_mas_proxima(body: ObtenerCitaMasProximaRequest):
    try:
        logger.info(f"  Buscando cita mas proxima para paciente={body.id_paciente}")
        jwt = get_access_token()

        now = datetime.now()
        date_from = now.strftime("%Y-%m-%d")
        date_to = (now + relativedelta(years=2)).strftime("%Y-%m-%d")
        logger.info(f"  Rango de busqueda: {date_from} a {date_to}")

        response = dentalsoft_request(
            "get",
            f"/agenda/informes/horas/efectivas/{date_from}/{date_to}"
            f"?id_paciente={body.id_paciente}",
            token=jwt,
        )

        if response.status_code != 200:
            return JSONResponse(status_code=response.status_code, content={
                "status": response.status_code,
                "message": "Error al obtener las citas",
            })

        data = response.json()
        total_citas = len(data.get("data", []))
        logger.info(f"  Total citas del paciente en rango: {total_citas}")

        future = [
            item
            for item in data.get("data", [])
            if datetime.strptime(
                f"{item['fecha_cita']} {item['hora_cita']}", "%Y-%m-%d %H:%M"
            )
            >= now
        ]

        logger.info(f"  Citas futuras del paciente: {len(future)}")

        if not future:
            logger.info(f"  No se encontraron citas futuras para paciente={body.id_paciente}")
            return JSONResponse(status_code=404, content={
                "status": 404,
                "message": "No se encontraron citas futuras del paciente.",
            })

        most_recent = min(
            future,
            key=lambda x: datetime.strptime(
                f"{x['fecha_cita']} {x['hora_cita']}", "%Y-%m-%d %H:%M"
            ),
        )

        logger.info(f"  Cita mas proxima: {most_recent.get('fecha_cita')} {most_recent.get('hora_cita')}")
        return {"status": 200, "message": most_recent}
    except Exception as e:
        logger.exception(f"  Error en /obtener-cita-mas-proxima: {e}")
        return JSONResponse(status_code=500, content={
            "status": 500, "message": "Internal server error", "error": str(e),
        })


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

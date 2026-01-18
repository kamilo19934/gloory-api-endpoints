def get_future_active_appointments(rut: str) -> Dict[str, Any]:
    """
    Obtiene TODAS las citas FUTURAS y ACTIVAS (no anuladas) de un paciente.
    """

    logging.info(f"🔎 Buscando citas FUTURAS y ACTIVAS para RUT: {rut}")

    rut_formateado = formatear_rut(rut)
    api_base, headers_api = obtener_configuracion_api()

    try:
        # 1. Buscar paciente por RUT
        filtro = json.dumps({"rut": {"eq": rut_formateado}})
        resp_pac = requests.get(
            f"{api_base}pacientes",
            headers=headers_api,
            params={"q": filtro}
        )

        if resp_pac.status_code != 200:
            return {"error": "No se pudo buscar el paciente"}

        pacientes = resp_pac.json().get("data", [])
        if not pacientes:
            return {"error": f"Paciente con RUT {rut_formateado} no encontrado"}

        paciente = pacientes[0]

        # 2. Obtener link de citas
        citas_link = next(
            (l["href"] for l in paciente.get("links", []) if l.get("rel") == "citas"),
            None
        )

        if not citas_link:
            return {"error": "No se pudo acceder a las citas del paciente"}

        resp_citas = requests.get(citas_link, headers=headers_api)
        if resp_citas.status_code != 200:
            return {"error": "No se pudieron obtener las citas del paciente"}

        citas = resp_citas.json().get("data", [])
        if not citas:
            return {"mensaje": "El paciente no tiene citas registradas", "citas": []}

        # 3. Fecha y hora actual Chile
        tz = pytz.timezone("America/Santiago")
        ahora = datetime.now(tz)
        fecha_hoy = ahora.strftime("%Y-%m-%d")
        hora_actual = ahora.strftime("%H:%M:%S")

        # 4. Filtrar citas futuras y activas
        citas_futuras = []
        for cita in citas:
            if cita.get("estado_anulacion", 0) != 0:
                continue

            fecha_cita = cita.get("fecha")
            hora_cita = cita.get("hora_inicio")

            if (
                fecha_cita > fecha_hoy or
                (fecha_cita == fecha_hoy and hora_cita > hora_actual)
            ):
                citas_futuras.append(cita)

        if not citas_futuras:
            return {
                "mensaje": "No hay citas futuras activas",
                "citas": []
            }

        # 5. Ordenar por la más próxima
        citas_futuras.sort(key=lambda x: (x["fecha"], x["hora_inicio"]))

        return {
            "mensaje": "Citas futuras activas encontradas",
            "total_citas": len(citas_futuras),
            "citas": citas_futuras
        }
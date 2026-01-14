/**
 * Utilidades para manejo de timezones
 * Usa moment-timezone para conversiones
 */

import * as moment from 'moment-timezone';

/**
 * Obtiene la fecha y hora actual en un timezone específico
 * @param timezone Timezone (ej: 'America/Santiago')
 * @returns Objeto moment con la fecha/hora en el timezone especificado
 */
export function obtenerHoraActual(timezone: string = 'America/Santiago'): moment.Moment {
  return moment().tz(timezone);
}

/**
 * Filtra horarios para que solo incluya los que son en el futuro
 * @param horarios Lista de horarios con estructura {hora_inicio: string}
 * @param fecha Fecha en formato YYYY-MM-DD
 * @param horaActual Momento actual en el timezone correspondiente
 * @returns Lista de horarios futuros
 */
export function filtrarHorariosFuturos(
  horarios: Array<{ hora_inicio: string; [key: string]: any }>,
  fecha: string,
  horaActual: moment.Moment,
): Array<{ hora_inicio: string; [key: string]: any }> {
  const horariosFuturos: Array<{ hora_inicio: string; [key: string]: any }> = [];

  for (const horario of horarios) {
    try {
      const horaInicio = horario.hora_inicio;
      const horaCita = moment.tz(`${fecha} ${horaInicio}`, horaActual.tz());

      if (horaCita.isAfter(horaActual)) {
        horariosFuturos.push(horario);
      }
    } catch (error) {
      console.warn(`⚠️ Error al procesar horario:`, horario, error);
      continue;
    }
  }

  return horariosFuturos;
}

/**
 * Valida que existan bloques consecutivos suficientes para el tiempo de cita solicitado
 * @param horariosStr Lista de horarios en formato "HH:MM" o "HH:MM:SS"
 * @param tiempoCita Tiempo requerido en minutos
 * @param intervaloProfesional Intervalo del profesional en minutos
 * @returns Lista de horarios válidos (solo el inicio de cada secuencia consecutiva)
 */
export function validarBloquesConsecutivos(
  horariosStr: string[],
  tiempoCita: number,
  intervaloProfesional: number,
): string[] {
  if (!horariosStr || !tiempoCita || !intervaloProfesional) {
    return horariosStr;
  }

  // Calcular cuántos bloques consecutivos se necesitan
  const bloquesNecesarios = Math.ceil(tiempoCita / intervaloProfesional);

  console.log(
    `🔢 Tiempo cita: ${tiempoCita} min, Intervalo: ${intervaloProfesional} min, Bloques necesarios: ${bloquesNecesarios}`,
  );

  if (bloquesNecesarios <= 1) {
    // Si solo necesita 1 bloque o menos, todos los horarios son válidos
    return horariosStr;
  }

  // Convertir horarios a moment para comparación
  const horariosMoment: moment.Moment[] = [];
  for (const horaStr of horariosStr) {
    try {
      // Normalizar formato (puede venir HH:MM:SS o HH:MM)
      const formato = horaStr.split(':').length === 3 ? 'HH:mm:ss' : 'HH:mm';
      const m = moment(horaStr, formato);
      if (m.isValid()) {
        horariosMoment.push(m);
      }
    } catch (error) {
      console.warn(`⚠️ Formato de hora inválido: ${horaStr}`);
      continue;
    }
  }

  // Ordenar horarios
  horariosMoment.sort((a, b) => a.diff(b));

  // Encontrar secuencias consecutivas
  const horariosValidos: string[] = [];

  for (let i = 0; i < horariosMoment.length; i++) {
    let esValido = true;

    // Verificar si hay bloques consecutivos suficientes desde este horario
    for (let j = 1; j < bloquesNecesarios; j++) {
      if (i + j >= horariosMoment.length) {
        esValido = false;
        break;
      }

      // Calcular la diferencia esperada
      const diferenciaEsperada = intervaloProfesional * j;
      const diferenciaReal = horariosMoment[i + j].diff(horariosMoment[i], 'minutes');

      // Verificar si los bloques son consecutivos
      if (diferenciaReal !== diferenciaEsperada) {
        esValido = false;
        break;
      }
    }

    if (esValido) {
      // Agregar el horario de inicio de la secuencia válida
      const horaFormateada = horariosMoment[i].format('HH:mm');
      horariosValidos.push(horaFormateada);
      console.log(
        `✅ Horario válido encontrado: ${horaFormateada} (tiene ${bloquesNecesarios} bloques consecutivos)`,
      );
    }
  }

  console.log(
    `📊 Horarios totales: ${horariosStr.length}, Horarios válidos con bloques consecutivos: ${horariosValidos.length}`,
  );

  return horariosValidos;
}

/**
 * Formatea fecha y hora para GHL con timezone
 * @param fecha Fecha en formato YYYY-MM-DD
 * @param hora Hora en formato HH:MM
 * @param timezone Timezone
 * @returns String con formato para GHL
 */
export function formatearFechaHoraGHL(fecha: string, hora: string, timezone: string): string {
  const fechaHora = moment.tz(`${fecha} ${hora}`, timezone);
  const offset = fechaHora.format('Z');
  return `${fechaHora.format('YYYY-MM-DDTHH:mm:ss')}${offset}`;
}


/**
 * Utilidades para formateo de fechas
 */

/**
 * Convierte una fecha YYYY-MM-DD a formato español legible
 * @param fechaStr Fecha en formato YYYY-MM-DD
 * @returns Fecha formateada (ej: "Martes 10 de Octubre 2025")
 */
export function formatearFechaEspanol(fechaStr: string): string {
  try {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    const fecha = new Date(fechaStr + 'T00:00:00');
    const diaSemana = diasSemana[fecha.getDay()];
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const año = fecha.getFullYear();

    return `${diaSemana} ${dia} de ${mes} ${año}`;
  } catch (error) {
    console.warn(`⚠️ Error formateando fecha ${fechaStr}:`, error);
    return fechaStr;
  }
}

/**
 * Normaliza una hora a formato HH:MM
 * @param hora Hora en formato HH:MM o HH:MM:SS
 * @returns Hora en formato HH:MM
 */
export function normalizarHora(hora: string): string {
  try {
    const partes = hora.split(':');
    return `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
  } catch (error) {
    console.warn(`⚠️ Error normalizando hora ${hora}:`, error);
    return hora;
  }
}


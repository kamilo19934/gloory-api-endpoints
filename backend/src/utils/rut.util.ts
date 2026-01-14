/**
 * Utilidades para formateo y validación de RUT chileno
 */

/**
 * Formatea un RUT chileno removiendo puntos y manteniendo guión
 * @param rut RUT a formatear
 * @returns RUT formateado (ej: 12345678-9)
 */
export function formatearRut(rut: string): string {
  try {
    // Remover puntos y espacios
    rut = rut.replace(/\./g, '').trim();

    // Separar cuerpo y dígito verificador
    let cuerpo: string;
    let dv: string;

    if (rut.includes('-')) {
      [cuerpo, dv] = rut.split('-');
    } else {
      cuerpo = rut.slice(0, -1);
      dv = rut.slice(-1);
    }

    // Formatear: número sin puntos + guión + DV en mayúscula
    return `${parseInt(cuerpo, 10)}-${dv.toUpperCase()}`;
  } catch (error) {
    console.warn(`⚠️ Error al formatear RUT ${rut}:`, error);
    return rut;
  }
}

/**
 * Valida formato básico de RUT chileno
 * @param rut RUT a validar
 * @returns true si el formato es válido
 */
export function validarFormatoRut(rut: string): boolean {
  const rutRegex = /^\d{1,8}-[\dkK]$/;
  return rutRegex.test(formatearRut(rut));
}


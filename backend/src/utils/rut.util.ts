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

/**
 * Limpia un RUT dejando solo dígitos y el dígito verificador (K), en mayúscula
 */
export function limpiarRut(rut: string): string {
  return rut.replace(/[^\dkK]/g, '').toUpperCase();
}

/**
 * Calcula el dígito verificador de un cuerpo de RUT (módulo 11)
 */
export function calcularDigitoVerificador(cuerpo: string): string {
  const reversed = cuerpo.split('').reverse().map(Number);
  const factors = [2, 3, 4, 5, 6, 7];
  const total = reversed.reduce((acc, d, i) => acc + d * factors[i % 6], 0);
  const remainder = 11 - (total % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Valida un RUT chileno completo (formato + dígito verificador con módulo 11)
 * @param rut RUT a validar (con o sin puntos/guión)
 * @returns true si el RUT es válido
 */
export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2 || !/^\d+$/.test(limpio.slice(0, -1))) {
    return false;
  }
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return calcularDigitoVerificador(cuerpo) === dv.toUpperCase();
}

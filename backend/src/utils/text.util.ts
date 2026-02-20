/**
 * Utilidades para manipulación de texto
 */

/**
 * Normaliza texto removiendo acentos y convirtiendo a minúscula
 * @param texto Texto a normalizar
 * @returns Texto normalizado sin acentos y en minúscula
 */
export function normalizarTexto(texto: string): string {
  if (!texto) return '';

  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Extrae un ID numérico de diferentes tipos de entrada
 * @param valor Valor que puede ser string o número
 * @returns ID numérico o null si no es válido
 */
export function extraerId(valor: any): number | null {
  if (typeof valor === 'number') {
    return valor;
  }
  if (typeof valor === 'string') {
    try {
      return parseInt(valor.trim(), 10);
    } catch {
      return null;
    }
  }
  return null;
}

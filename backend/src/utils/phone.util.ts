/**
 * Utilidades para formateo y validación de números de teléfono
 */

export interface CountryPhoneConfig {
  countryCode: string;
  mobileLength: number;
  mobileStartsWith?: string[];
}

export interface PhoneFormatResult {
  formatted: string | null;
  original: string;
  isValid: boolean;
  error?: string;
}

export const COUNTRY_PHONE_CONFIGS: Record<string, CountryPhoneConfig> = {
  CL: { countryCode: '56', mobileLength: 9, mobileStartsWith: ['9'] },
  PE: { countryCode: '51', mobileLength: 9, mobileStartsWith: ['9'] },
  CO: { countryCode: '57', mobileLength: 10, mobileStartsWith: ['3'] },
  MX: { countryCode: '52', mobileLength: 10 },
  AR: { countryCode: '54', mobileLength: 10 },
};

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'America/Santiago': 'CL',
  'America/Lima': 'PE',
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Argentina/Buenos_Aires': 'AR',
};

/**
 * Obtiene el código de país ISO desde un timezone
 * @param timezone Timezone string (ej: 'America/Santiago')
 * @returns Código de país ISO (ej: 'CL'). Default: 'CL'
 */
export function obtenerPaisDesdeTimezone(timezone: string): string {
  return TIMEZONE_TO_COUNTRY[timezone] || 'CL';
}

/**
 * Busca la configuración de país por código de teléfono (+XX)
 * Retorna el config y la longitud del código encontrado
 */
function findConfigByPhoneCode(
  digits: string,
): { config: CountryPhoneConfig; codeLength: number; countryIso: string } | null {
  // Intentar con códigos de 2 dígitos primero, luego 3 (ordenar por longitud descendente para evitar ambigüedades)
  for (const [iso, config] of Object.entries(COUNTRY_PHONE_CONFIGS)) {
    const code = config.countryCode;
    if (digits.startsWith(code)) {
      return { config, codeLength: code.length, countryIso: iso };
    }
  }
  return null;
}

/**
 * Valida si un número local calza con el formato del país
 */
function matchesLocalFormat(digits: string, config: CountryPhoneConfig): boolean {
  if (digits.length !== config.mobileLength) {
    return false;
  }
  if (config.mobileStartsWith && config.mobileStartsWith.length > 0) {
    return config.mobileStartsWith.some((prefix) => digits.startsWith(prefix));
  }
  return true;
}

/**
 * Formatea y valida un número de teléfono
 *
 * Escenarios:
 * 1. Con +código: valida longitud según país detectado. Si país no configurado, acepta tal cual.
 * 2. Sin +, pero empieza con código conocido + longitud correcta: agrega + y acepta.
 * 3. Sin código: intenta formatear como número local del país del cliente.
 *
 * @param telefono Número de teléfono a formatear
 * @param codigoPais Código ISO del país del cliente (ej: 'CL', 'PE'). Default: 'CL'
 * @returns PhoneFormatResult con el número formateado o error
 */
export function formatearTelefono(
  telefono: string,
  codigoPais: string = 'CL',
): PhoneFormatResult {
  try {
    if (!telefono || telefono.trim() === '') {
      return {
        formatted: null,
        original: telefono || '',
        isValid: false,
        error: 'Teléfono no proporcionado',
      };
    }

    const original = telefono;
    const hasPlus = telefono.trim().startsWith('+');

    // Strip todo excepto dígitos
    const digits = telefono.replace(/\D/g, '');

    if (digits.length === 0) {
      return {
        formatted: null,
        original,
        isValid: false,
        error: 'El teléfono no contiene dígitos válidos',
      };
    }

    // Escenario 2: Número CON + (código de país explícito)
    if (hasPlus) {
      const match = findConfigByPhoneCode(digits);

      if (match) {
        // País reconocido: validar longitud
        const localDigits = digits.substring(match.codeLength);
        if (localDigits.length === match.config.mobileLength) {
          return {
            formatted: `+${digits}`,
            original,
            isValid: true,
          };
        } else {
          return {
            formatted: null,
            original,
            isValid: false,
            error: `El número de teléfono con código +${match.config.countryCode} debería tener ${match.config.mobileLength} dígitos después del código`,
          };
        }
      } else {
        // País no configurado: aceptar tal cual
        return {
          formatted: `+${digits}`,
          original,
          isValid: true,
        };
      }
    }

    // Escenario 3: Sin +, verificar si empieza con código de país conocido
    const matchWithoutPlus = findConfigByPhoneCode(digits);
    if (matchWithoutPlus) {
      const localDigits = digits.substring(matchWithoutPlus.codeLength);
      if (localDigits.length === matchWithoutPlus.config.mobileLength) {
        return {
          formatted: `+${digits}`,
          original,
          isValid: true,
        };
      }
      // Si empieza con un código pero la longitud no calza, NO asumir que es código de país.
      // Tratar como número local del país del cliente (escenario 1).
    }

    // Escenario 1: Número local sin código de país
    const clientConfig = COUNTRY_PHONE_CONFIGS[codigoPais];
    if (!clientConfig) {
      return {
        formatted: null,
        original,
        isValid: false,
        error: `País no configurado: ${codigoPais}`,
      };
    }

    if (matchesLocalFormat(digits, clientConfig)) {
      return {
        formatted: `+${clientConfig.countryCode}${digits}`,
        original,
        isValid: true,
      };
    }

    // No calza ni como código de país ni como número local
    return {
      formatted: null,
      original,
      isValid: false,
      error: 'El teléfono no tiene el formato correcto ni el código país',
    };
  } catch (error) {
    console.warn(`⚠️ Error al formatear teléfono ${telefono}:`, error);
    return {
      formatted: null,
      original: telefono,
      isValid: false,
      error: 'Error inesperado al formatear teléfono',
    };
  }
}

import { formatearTelefono, obtenerPaisDesdeTimezone } from './phone.util';

describe('phone.util', () => {
  describe('formatearTelefono', () => {
    describe('Chile (CL) - números locales', () => {
      it('debería formatear número de 9 dígitos que empieza con 9', () => {
        const result = formatearTelefono('912345678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería formatear número con espacios', () => {
        const result = formatearTelefono('9 1234 5678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería formatear número con guiones', () => {
        const result = formatearTelefono('9-1234-5678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería rechazar número de 8 dígitos (incompleto)', () => {
        const result = formatearTelefono('12345678', 'CL');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('formato correcto');
      });

      it('debería rechazar número de 9 dígitos que no empieza con 9', () => {
        const result = formatearTelefono('212345678', 'CL');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('formato correcto');
      });
    });

    describe('Chile (CL) - con código de país', () => {
      it('debería aceptar +56 con 9 dígitos', () => {
        const result = formatearTelefono('+56912345678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería aceptar 56 sin + con 9 dígitos', () => {
        const result = formatearTelefono('56912345678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería ser idempotente (ya formateado)', () => {
        const result = formatearTelefono('+56912345678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería aceptar +56 con espacios', () => {
        const result = formatearTelefono('+56 9 1234 5678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería rechazar +56 con pocos dígitos', () => {
        const result = formatearTelefono('+5691234', 'CL');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('9 dígitos');
        expect(result.error).toContain('+56');
      });
    });

    describe('Números extranjeros en cliente CL', () => {
      it('debería aceptar número peruano con +51', () => {
        const result = formatearTelefono('+51987654321', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+51987654321');
      });

      it('debería aceptar número colombiano con +57', () => {
        const result = formatearTelefono('+573101234567', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+573101234567');
      });

      it('debería rechazar +51 con pocos dígitos', () => {
        const result = formatearTelefono('+5198765', 'CL');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('9 dígitos');
        expect(result.error).toContain('+51');
      });

      it('debería aceptar código de país no configurado (ej: Alemania +49)', () => {
        const result = formatearTelefono('+4915712345678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+4915712345678');
      });

      it('debería aceptar código de país no configurado (ej: España +34)', () => {
        const result = formatearTelefono('+34612345678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+34612345678');
      });
    });

    describe('Perú (PE)', () => {
      it('debería formatear número local peruano', () => {
        const result = formatearTelefono('987654321', 'PE');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+51987654321');
      });

      it('debería rechazar número peruano que no empieza con 9', () => {
        const result = formatearTelefono('187654321', 'PE');
        expect(result.isValid).toBe(false);
      });
    });

    describe('Colombia (CO)', () => {
      it('debería formatear número local colombiano', () => {
        const result = formatearTelefono('3101234567', 'CO');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+573101234567');
      });

      it('debería rechazar número colombiano que no empieza con 3', () => {
        const result = formatearTelefono('5101234567', 'CO');
        expect(result.isValid).toBe(false);
      });
    });

    describe('México (MX)', () => {
      it('debería formatear número local mexicano', () => {
        const result = formatearTelefono('5512345678', 'MX');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+525512345678');
      });
    });

    describe('Argentina (AR)', () => {
      it('debería formatear número local argentino', () => {
        const result = formatearTelefono('1123456789', 'AR');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+541123456789');
      });
    });

    describe('Edge cases', () => {
      it('debería rechazar string vacío', () => {
        const result = formatearTelefono('', 'CL');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('no proporcionado');
      });

      it('debería rechazar string con solo espacios', () => {
        const result = formatearTelefono('   ', 'CL');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('no proporcionado');
      });

      it('debería rechazar string con solo letras', () => {
        const result = formatearTelefono('abcdefgh', 'CL');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('dígitos válidos');
      });

      it('debería usar CL como país por defecto', () => {
        const result = formatearTelefono('912345678');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });

      it('debería rechazar país no configurado sin código', () => {
        const result = formatearTelefono('612345678', 'XX' as any);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('País no configurado');
      });

      it('debería manejar número con paréntesis', () => {
        const result = formatearTelefono('(+56) 912345678', 'CL');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('+56912345678');
      });
    });
  });

  describe('obtenerPaisDesdeTimezone', () => {
    it('debería mapear America/Santiago a CL', () => {
      expect(obtenerPaisDesdeTimezone('America/Santiago')).toBe('CL');
    });

    it('debería mapear America/Lima a PE', () => {
      expect(obtenerPaisDesdeTimezone('America/Lima')).toBe('PE');
    });

    it('debería mapear America/Bogota a CO', () => {
      expect(obtenerPaisDesdeTimezone('America/Bogota')).toBe('CO');
    });

    it('debería mapear America/Mexico_City a MX', () => {
      expect(obtenerPaisDesdeTimezone('America/Mexico_City')).toBe('MX');
    });

    it('debería mapear America/Argentina/Buenos_Aires a AR', () => {
      expect(obtenerPaisDesdeTimezone('America/Argentina/Buenos_Aires')).toBe('AR');
    });

    it('debería retornar CL para timezone desconocido', () => {
      expect(obtenerPaisDesdeTimezone('Europe/London')).toBe('CL');
    });

    it('debería retornar CL para string vacío', () => {
      expect(obtenerPaisDesdeTimezone('')).toBe('CL');
    });
  });
});

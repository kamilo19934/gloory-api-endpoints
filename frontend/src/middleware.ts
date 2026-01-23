import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que no requieren autenticación
const publicPaths = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Verificar si es una ruta pública
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Verificar si hay token en localStorage no es posible en middleware
  // El middleware de Next.js corre en el servidor y no tiene acceso a localStorage
  // La protección real se hace del lado del cliente
  
  // Para SSR, podríamos usar cookies, pero como usamos localStorage,
  // la protección se maneja del lado del cliente
  
  // Este middleware solo sirve como primera capa de verificación
  // La verificación real del token se hace en cada componente
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

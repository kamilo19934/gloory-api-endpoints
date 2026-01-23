'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { initAuth, isAuthenticated, getStoredUser, authApi, User } from '@/lib/auth';
import { FiLoader } from 'react-icons/fi';

interface AuthProviderProps {
  children: React.ReactNode;
}

// Rutas públicas que no requieren autenticación
const publicPaths = ['/login'];

export default function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Inicializar autenticación (configurar interceptors)
    initAuth();
    
    const checkAuth = async () => {
      const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
      
      if (isAuthenticated()) {
        // Tiene token, verificar si es válido
        try {
          const response = await authApi.verify();
          setUser(response.user);
          
          // Si está en una ruta pública y está autenticado, redirigir al home
          if (isPublicPath) {
            router.push('/');
            return;
          }
        } catch (error) {
          // Token inválido
          authApi.logout();
          if (!isPublicPath) {
            router.push('/login');
            return;
          }
        }
      } else {
        // No tiene token
        if (!isPublicPath) {
          router.push('/login');
          return;
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Mostrar loading mientras verifica autenticación
  if (isLoading) {
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    
    // No mostrar loading en rutas públicas
    if (isPublicPath) {
      return <>{children}</>;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <FiLoader className="animate-spin text-4xl text-primary-600" />
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook para obtener el usuario actual
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    setUser(getStoredUser());
  }, []);
  
  return {
    user,
    isAuthenticated: isAuthenticated(),
    logout: () => {
      authApi.logout();
      window.location.href = '/login';
    },
  };
}

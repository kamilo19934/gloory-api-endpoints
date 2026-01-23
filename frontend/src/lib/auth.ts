import { api } from './api';

// ============================================
// AUTH TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SetupCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

export function setStoredUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ============================================
// AUTH API
// ============================================

export const authApi = {
  /**
   * Login con email y password
   */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials);
    const data = response.data as LoginResponse;
    
    // Guardar token y usuario
    setToken(data.accessToken);
    setStoredUser(data.user as User);
    
    // Configurar el token en axios para futuras peticiones
    api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
    
    return data;
  },

  /**
   * Logout - limpia tokens
   */
  logout: (): void => {
    removeToken();
    removeStoredUser();
    delete api.defaults.headers.common['Authorization'];
  },

  /**
   * Obtener perfil del usuario autenticado
   */
  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  /**
   * Verificar si el token es válido
   */
  verify: async (): Promise<{ valid: boolean; user: User }> => {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  /**
   * Setup inicial - crear primer admin (solo funciona si no hay usuarios)
   */
  setup: async (credentials: SetupCredentials): Promise<User> => {
    const response = await api.post('/auth/setup', credentials);
    return response.data;
  },
};

// ============================================
// AXIOS INTERCEPTOR SETUP
// ============================================

/**
 * Inicializa el interceptor de autenticación
 * Debe llamarse al cargar la aplicación
 */
export function initAuth(): void {
  const token = getToken();
  
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Interceptor para manejar errores de autenticación
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Token inválido o expirado
        authApi.logout();
        
        // Redirigir al login solo si estamos en el cliente
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
}

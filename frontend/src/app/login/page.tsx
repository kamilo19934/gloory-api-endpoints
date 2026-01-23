'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiMail, FiLock, FiUser, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { authApi, isAuthenticated } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState('');

  // Verificar si ya está autenticado
  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/');
    }
  }, [router]);

  // Verificar si necesita setup inicial
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Intentar verificar si hay usuarios
        // Si el backend devuelve 401, significa que hay usuarios pero no estamos autenticados
        // Si devuelve datos, estamos autenticados (redirigir)
        await authApi.verify();
        router.push('/');
      } catch (err: any) {
        // 401 = hay usuarios pero no autenticados (mostrar login)
        // Cualquier otro error podría significar que no hay usuarios
        setNeedsSetup(false);
      } finally {
        setCheckingSetup(false);
      }
    };
    
    checkSetup();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isSetupMode) {
        // Crear primer admin
        await authApi.setup({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
        });
        toast.success('¡Admin creado exitosamente! Iniciando sesión...');
        
        // Ahora hacer login
        await authApi.login({
          email: formData.email,
          password: formData.password,
        });
      } else {
        // Login normal
        await authApi.login({
          email: formData.email,
          password: formData.password,
        });
      }
      
      toast.success('¡Bienvenido!');
      router.push('/');
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Error al iniciar sesión';
      
      // Si el setup falla porque ya hay usuarios, cambiar a modo login
      if (isSetupMode && message.includes('Ya existe')) {
        setIsSetupMode(false);
        setError('Ya existe un admin. Por favor inicia sesión.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex items-center space-x-3 text-white">
          <FiLoader className="animate-spin text-2xl" />
          <span>Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg shadow-primary-500/30 mb-4">
            <span className="text-2xl font-bold text-white">G</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Gloory API</h1>
          <p className="text-slate-400">
            {isSetupMode ? 'Configuración inicial' : 'Gestión de Integraciones'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isSetupMode ? 'Crear Admin Inicial' : 'Iniciar Sesión'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3">
              <FiAlertCircle className="text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSetupMode && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nombre
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required={isSetupMode}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Juan"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Apellido
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required={isSetupMode}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Pérez"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="admin@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
              {isSetupMode && (
                <p className="mt-2 text-xs text-slate-500">
                  Mínimo 6 caracteres
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin" />
                  <span>{isSetupMode ? 'Creando...' : 'Ingresando...'}</span>
                </>
              ) : (
                <span>{isSetupMode ? 'Crear Admin' : 'Iniciar Sesión'}</span>
              )}
            </button>
          </form>

          {/* Toggle Setup/Login */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSetupMode(!isSetupMode);
                setError('');
              }}
              className="text-sm text-slate-400 hover:text-primary-400 transition-colors"
            >
              {isSetupMode
                ? '¿Ya tienes cuenta? Inicia sesión'
                : '¿Primera vez? Configura el admin inicial'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          Gloory API © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

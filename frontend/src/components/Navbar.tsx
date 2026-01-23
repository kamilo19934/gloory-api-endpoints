'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiDatabase, FiLogOut, FiUser } from 'react-icons/fi';
import { useAuth } from './AuthProvider';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();

  // No mostrar navbar en la página de login
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-2xl font-bold text-primary-600">
                Gloory API
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  pathname === '/'
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <FiHome className="mr-2" />
                Inicio
              </Link>
              <Link
                href="/clients"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  pathname?.startsWith('/clients')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <FiDatabase className="mr-2" />
                Clientes
              </Link>
            </div>
          </div>

          {/* User menu */}
          {isAuthenticated && user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FiUser className="text-gray-400" />
                <span className="hidden md:inline">{user.firstName} {user.lastName}</span>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Cerrar sesión"
              >
                <FiLogOut className="mr-1" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { FiPlus, FiDatabase, FiZap, FiShield } from 'react-icons/fi';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Gestión de Integraciones Dentalink
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Crea y gestiona conexiones con la API de Dentalink de forma simple y segura
          </p>
          <Link
            href="/clients/new"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <FiPlus className="mr-2" />
            Crear Nueva Conexión
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mb-4">
              <FiDatabase className="text-primary-600 text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Gestión de Clientes
            </h3>
            <p className="text-gray-600">
              Crea y administra múltiples clientes, cada uno con su propia API key de Dentalink
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
              <FiZap className="text-green-600 text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Endpoints Unificados
            </h3>
            <p className="text-gray-600">
              Accede a todos los endpoints de Dentalink con URLs específicas por cliente
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
              <FiShield className="text-purple-600 text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Seguro y Extensible
            </h3>
            <p className="text-gray-600">
              Sistema seguro que mantiene las API keys protegidas y permite agregar nuevos endpoints fácilmente
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Endpoints Disponibles
          </h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-md text-xs font-bold">
                POST
              </span>
              <span className="text-gray-700">Crear Cita</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-bold">
                GET
              </span>
              <span className="text-gray-700">Ver Disponibilidad</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-xs font-bold">
                DELETE
              </span>
              <span className="text-gray-700">Cancelar Cita</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-bold">
                PUT
              </span>
              <span className="text-gray-700">Confirmar Cita</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-bold">
                GET
              </span>
              <span className="text-gray-700">Obtener Cita</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-bold">
                GET
              </span>
              <span className="text-gray-700">Listar Citas</span>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/clients"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Ver todos los clientes →
          </Link>
        </div>
      </main>
    </div>
  );
}


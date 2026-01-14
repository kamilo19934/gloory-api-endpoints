'use client';

import Link from 'next/link';
import { Client } from '@/lib/api';
import { FiEdit2, FiTrash2, FiExternalLink } from 'react-icons/fi';
import IntegrationBadges from './IntegrationBadges';

interface ClientCardProps {
  client: Client;
  onDelete: (id: string) => void;
}

export default function ClientCard({ client, onDelete }: ClientCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900">{client.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {client.description || 'Sin descripción'}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-gray-500">
              🌍 {client.timezone || 'America/Santiago'}
            </span>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            client.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {client.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Integraciones */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-1">Integraciones</p>
        <IntegrationBadges integrations={client.integrations} size="sm" />
        {/* Legacy: mostrar badge GHL si está habilitado y no hay integraciones */}
        {(!client.integrations || client.integrations.length === 0) && client.ghlEnabled && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-1">
            🔗 GHL Habilitado
          </span>
        )}
      </div>

      {/* API Key (legacy) */}
      {client.apiKey && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">API Key (Dentalink)</p>
          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
            {client.apiKey.substring(0, 20)}...
          </code>
        </div>
      )}

      <div className="text-xs text-gray-400 mb-4">
        Creado: {new Date(client.createdAt).toLocaleDateString()}
      </div>

      <div className="flex space-x-2">
        <Link
          href={`/clients/${client.id}`}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <FiExternalLink className="mr-2" />
          Ver Detalles
        </Link>
        <Link
          href={`/clients/${client.id}/edit`}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <FiEdit2 />
        </Link>
        <button
          onClick={() => onDelete(client.id)}
          className="inline-flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
}

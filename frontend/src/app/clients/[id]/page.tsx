'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EndpointCard from '@/components/EndpointCard';
import { clientsApi, Client, EndpointDefinition, IntegrationType } from '@/lib/api';
import { FiArrowLeft, FiLoader, FiCheckCircle, FiXCircle, FiSettings } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params?.id as string;
  
  const [client, setClient] = useState<Client | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);

  const loadClientData = useCallback(async () => {
    try {
      setLoading(true);
      const [clientData, endpointsData] = await Promise.all([
        clientsApi.getById(clientId),
        clientsApi.getEndpoints(clientId),
      ]);
      setClient(clientData);
      setEndpoints(endpointsData);
    } catch (error) {
      toast.error('Error al cargar los datos del cliente');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId, loadClientData]);

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const result = await clientsApi.testConnection(clientId);
      setConnectionStatus(result.connected);
      
      if (result.connected) {
        toast.success('Conexión exitosa con Dentalink');
      } else {
        toast.error('No se pudo conectar con Dentalink');
      }
    } catch (error) {
      setConnectionStatus(false);
      toast.error('Error al probar la conexión');
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center py-12">
          <FiLoader className="animate-spin text-4xl text-primary-600" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500">Cliente no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/clients"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft className="mr-2" />
            Volver a Clientes
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
              <p className="text-gray-600 mt-2">{client.description || 'Sin descripción'}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-gray-500">
                  🌍 <strong>Timezone:</strong> {client.timezone || 'America/Santiago'}
                </span>
                {client.ghlEnabled && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                    🔗 GHL Integrado
                  </span>
                )}
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                client.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {client.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">API Key</p>
              <code className="text-sm bg-gray-100 px-3 py-2 rounded block">
                {(() => {
                  // Try to get API key from integrations first
                  const integration = client.integrations?.find(
                    (i) => i.integrationType === IntegrationType.DENTALINK || 
                           i.integrationType === IntegrationType.DENTALINK_MEDILINK
                  );
                  const apiKey = integration?.config?.apiKey || client.apiKey;
                  return apiKey ? `${apiKey.substring(0, 30)}...` : 'No configurada';
                })()}
              </code>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Creado</p>
              <p className="text-sm text-gray-900">
                {new Date(client.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Probando...
                </>
              ) : (
                'Probar Conexión'
              )}
            </button>

            <Link
              href={`/clients/${clientId}/clinic`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <FiSettings className="mr-2" />
              Configuración Clínica
            </Link>

            <Link
              href={`/clients/${clientId}/confirmations`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <FiCheckCircle className="mr-2" />
              Confirmaciones de Citas
            </Link>
            
            {connectionStatus !== null && (
              <div className="flex items-center">
                {connectionStatus ? (
                  <>
                    <FiCheckCircle className="text-green-600 mr-2" />
                    <span className="text-sm text-green-600">Conectado</span>
                  </>
                ) : (
                  <>
                    <FiXCircle className="text-red-600 mr-2" />
                    <span className="text-sm text-red-600">Error de conexión</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Endpoints Disponibles ({endpoints.length})
          </h2>
          <p className="text-gray-600 mt-1">
            Utiliza estas URLs para hacer llamadas a Dentalink
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {endpoints.map((endpoint) => (
            <EndpointCard key={endpoint.id} endpoint={endpoint} client={client || undefined} />
          ))}
        </div>
      </main>
    </div>
  );
}


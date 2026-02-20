'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import IntegrationSelector from '@/components/IntegrationSelector';
import { clientsApi, IntegrationType, CreateClientDto } from '@/lib/api';
import { TIMEZONES } from '@/lib/timezones';
import { FiSave, FiX, FiInfo } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface IntegrationConfig {
  type: IntegrationType;
  isEnabled: boolean;
  config: Record<string, any>;
}

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedIntegrations, setSelectedIntegrations] = useState<IntegrationConfig[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timezone: 'America/Santiago',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Nombre del cliente es obligatorio');
      return;
    }

    if (selectedIntegrations.length === 0) {
      toast.error('Debes seleccionar al menos una integración');
      return;
    }

    // Validar que cada integración tenga sus campos requeridos
    for (const integration of selectedIntegrations) {
      if (integration.type === IntegrationType.DENTALINK && !integration.config.apiKey) {
        toast.error('API Key de Dentalink es obligatorio');
        return;
      }
      if (integration.type === IntegrationType.MEDILINK && !integration.config.apiKey) {
        toast.error('API Key de MediLink es obligatorio');
        return;
      }
      if (integration.type === IntegrationType.RESERVO && !integration.config.apiToken) {
        toast.error('API Token de Reservo es obligatorio');
        return;
      }
    }

    try {
      setLoading(true);

      const dataToSend: CreateClientDto = {
        name: formData.name,
        description: formData.description || undefined,
        timezone: formData.timezone,
        integrations: selectedIntegrations.map((i) => ({
          type: i.type,
          isEnabled: i.isEnabled,
          config: i.config,
        })),
      };

      // Legacy: Si hay integración Dentalink o Dentalink+MediLink, también enviar el apiKey legacy
      const dentalinkIntegration = selectedIntegrations.find(
        (i) => i.type === IntegrationType.DENTALINK || i.type === IntegrationType.DENTALINK_MEDILINK
      );
      if (dentalinkIntegration) {
        dataToSend.apiKey = dentalinkIntegration.config.apiKey;
        dataToSend.ghlEnabled = dentalinkIntegration.config.ghlEnabled || false;
        if (dentalinkIntegration.config.ghlEnabled) {
          dataToSend.ghlAccessToken = dentalinkIntegration.config.ghlAccessToken;
          dataToSend.ghlCalendarId = dentalinkIntegration.config.ghlCalendarId;
          dataToSend.ghlLocationId = dentalinkIntegration.config.ghlLocationId;
        }
      }

      await clientsApi.create(dataToSend);
      toast.success('Cliente creado correctamente');
      router.push('/clients');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al crear el cliente');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nuevo Cliente</h1>
          <p className="text-gray-600 mt-2">
            Crea un nuevo cliente y configura sus integraciones
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Información básica */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="w-1.5 h-6 bg-primary-600 rounded-full mr-3"></span>
              Información del Cliente
            </h2>

            <div className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Nombre del Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
                  placeholder="Ej: Clínica Dental ABC"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Descripción
                  <span className="text-xs font-normal text-gray-500 ml-1">(opcional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300 resize-none"
                  placeholder="Describe el propósito de este cliente..."
                />
              </div>

              <div>
                <label htmlFor="timezone" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Zona Horaria
                </label>
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Selector de integraciones */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start space-x-3 mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
              <FiInfo className="text-blue-600 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Configura las Integraciones
                </h3>
                <p className="text-sm text-blue-800">
                  Selecciona las integraciones que deseas configurar para este cliente.
                  Cada integración tiene sus propios campos de configuración. Haz clic en el ícono de engranaje para expandir la configuración.
                </p>
              </div>
            </div>

            <IntegrationSelector
              selectedIntegrations={selectedIntegrations}
              onChange={setSelectedIntegrations}
              mode="create"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-2">
            <Link
              href="/clients"
              className="inline-flex items-center px-6 py-3 border-2 border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
            >
              <FiX className="mr-2" size={18} />
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading || selectedIntegrations.length === 0}
              className="inline-flex items-center px-8 py-3 border-2 border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
            >
              <FiSave className="mr-2" size={18} />
              {loading ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

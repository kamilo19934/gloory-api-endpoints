'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import IntegrationSelector from '@/components/IntegrationSelector';
import { 
  clientsApi, 
  Client, 
  IntegrationType, 
  ClientIntegration,
  UpdateClientDto 
} from '@/lib/api';
import { TIMEZONES } from '@/lib/timezones';
import { FiArrowLeft, FiSave, FiLoader, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface IntegrationConfig {
  type: IntegrationType;
  isEnabled: boolean;
  config: Record<string, any>;
}

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [selectedIntegrations, setSelectedIntegrations] = useState<IntegrationConfig[]>([]);
  const [originalIntegrationTypes, setOriginalIntegrationTypes] = useState<IntegrationType[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timezone: 'America/Santiago',
    confirmationStateId: undefined as number | undefined,
    contactedStateId: undefined as number | undefined,
    isActive: true,
  });

  // Convertir ClientIntegration del backend al formato del IntegrationSelector
  const convertToSelectorFormat = (integrations: ClientIntegration[]): IntegrationConfig[] => {
    return integrations.map((integration) => ({
      type: integration.integrationType as IntegrationType,
      isEnabled: integration.isEnabled,
      config: integration.config || {},
    }));
  };

  const loadClient = useCallback(async () => {
    try {
      setLoading(true);
      const clientData = await clientsApi.getById(clientId);
      setClient(clientData);
      
      // Cargar datos básicos del formulario
      setFormData({
        name: clientData.name,
        description: clientData.description || '',
        timezone: clientData.timezone || 'America/Santiago',
        confirmationStateId: clientData.confirmationStateId ?? undefined,
        contactedStateId: clientData.contactedStateId ?? undefined,
        isActive: clientData.isActive,
      });

      // Cargar integraciones existentes
      if (clientData.integrations && clientData.integrations.length > 0) {
        const converted = convertToSelectorFormat(clientData.integrations);
        setSelectedIntegrations(converted);
        setOriginalIntegrationTypes(converted.map(i => i.type));
      } else {
        // Compatibilidad legacy: si no hay integraciones pero hay apiKey, crear una de Dentalink
        if (clientData.apiKey) {
          const legacyIntegration: IntegrationConfig = {
            type: IntegrationType.DENTALINK,
            isEnabled: true,
            config: {
              apiKey: clientData.apiKey,
              ghlEnabled: clientData.ghlEnabled || false,
              ghlAccessToken: clientData.ghlAccessToken || '',
              ghlCalendarId: clientData.ghlCalendarId || '',
              ghlLocationId: clientData.ghlLocationId || '',
            },
          };
          setSelectedIntegrations([legacyIntegration]);
          setOriginalIntegrationTypes([IntegrationType.DENTALINK]);
        }
      }
    } catch (error) {
      toast.error('Error al cargar el cliente');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId, loadClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (selectedIntegrations.length === 0) {
      toast.error('Debes tener al menos una integración configurada');
      return;
    }

    // Validar campos requeridos de cada integración
    for (const integration of selectedIntegrations) {
      if (integration.type === IntegrationType.RESERVO) {
        if (!integration.config.apiToken) {
          toast.error('API Token de Reservo es obligatorio');
          return;
        }
      } else if (
        (integration.type === IntegrationType.DENTALINK ||
         integration.type === IntegrationType.MEDILINK ||
         integration.type === IntegrationType.DENTALINK_MEDILINK) &&
        !integration.config.apiKey
      ) {
        toast.error(`API Key es requerida para ${integration.type}`);
        return;
      }
    }

    try {
      setSaving(true);

      // Detectar integraciones eliminadas (estaban antes pero ya no están)
      const currentTypes = selectedIntegrations.map(i => i.type);
      const removedTypes = originalIntegrationTypes.filter(t => !currentTypes.includes(t));

      // Eliminar las integraciones que fueron deseleccionadas
      for (const type of removedTypes) {
        try {
          await clientsApi.removeIntegration(clientId, type);
        } catch (error) {
          console.warn(`No se pudo eliminar la integración ${type}:`, error);
        }
      }

      // Preparar datos para actualizar
      const dataToSend: UpdateClientDto = {
        name: formData.name,
        description: formData.description || undefined,
        timezone: formData.timezone,
        confirmationStateId: formData.confirmationStateId,
        contactedStateId: formData.contactedStateId,
        isActive: formData.isActive,
        integrations: selectedIntegrations.map((i) => ({
          type: i.type,
          isEnabled: i.isEnabled,
          config: i.config,
        })),
      };

      // Legacy: Si hay integración Dentalink, también actualizar campos legacy
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

      await clientsApi.update(clientId, dataToSend);
      toast.success('Cliente actualizado correctamente');
      router.push(`/clients/${clientId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar el cliente');
      console.error(error);
    } finally {
      setSaving(false);
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

  // Detectar si hay integraciones que serán eliminadas
  const currentTypes = selectedIntegrations.map(i => i.type);
  const removedTypes = originalIntegrationTypes.filter(t => !currentTypes.includes(t));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4 font-medium"
          >
            <FiArrowLeft className="mr-2" />
            Volver al cliente
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Editar Cliente</h1>
          <p className="text-gray-600 mt-2">
            Actualiza la información y las integraciones del cliente
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
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
                  placeholder="Nombre del cliente"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Descripción
                  <span className="text-xs font-normal text-gray-500 ml-1">(opcional)</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300 resize-none"
                  placeholder="Descripción opcional del cliente"
                />
              </div>

              <div>
                <label htmlFor="timezone" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Zona Horaria
                </label>
                <select
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Cliente activo
                </label>
              </div>
            </div>
          </div>

          {/* Selector de integraciones */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start space-x-3 mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
              <FiInfo className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Gestiona las Integraciones
                </h3>
                <p className="text-sm text-blue-800">
                  Puedes agregar, modificar o eliminar integraciones. 
                  Al deseleccionar una integración, se eliminará al guardar los cambios.
                </p>
              </div>
            </div>

            {/* Advertencia si hay integraciones que serán eliminadas */}
            {removedTypes.length > 0 && (
              <div className="flex items-start space-x-3 mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                <FiAlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="text-sm font-semibold text-amber-900 mb-1">
                    Integraciones a eliminar
                  </h3>
                  <p className="text-sm text-amber-800">
                    Las siguientes integraciones serán eliminadas al guardar:{' '}
                    <strong>{removedTypes.join(', ')}</strong>
                  </p>
                </div>
              </div>
            )}

            <IntegrationSelector
              selectedIntegrations={selectedIntegrations}
              onChange={setSelectedIntegrations}
              mode="edit"
            />
          </div>

          {/* Configuración adicional */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="w-1.5 h-6 bg-primary-600 rounded-full mr-3"></span>
              Configuración de Estados de Cita
            </h2>

            <div className="space-y-5">
              <div>
                <label htmlFor="confirmationStateId" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Estado de Confirmación (ID)
                  <span className="text-xs font-normal text-gray-500 ml-1">(opcional)</span>
                </label>
                <input
                  type="number"
                  id="confirmationStateId"
                  value={formData.confirmationStateId || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    confirmationStateId: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
                  placeholder="Ej: 7 para Confirmado"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  ID del estado que se usará para confirmar citas. 
                  Ejemplo: 7 = Confirmado, 8 = Confirmado por Bookys.
                </p>
              </div>

              <div>
                <label htmlFor="contactedStateId" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Estado de Contactado (ID)
                  <span className="text-xs font-normal text-gray-500 ml-1">(opcional)</span>
                </label>
                <input
                  type="number"
                  id="contactedStateId"
                  value={formData.contactedStateId || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    contactedStateId: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
                  placeholder="Ej: 9 para Contactado por Bookys"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  ID del estado que se usará para marcar las citas como contactadas después de enviar la confirmación.
                </p>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-2">
            <Link
              href={`/clients/${clientId}`}
              className="inline-flex items-center px-6 py-3 border-2 border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving || selectedIntegrations.length === 0}
              className="inline-flex items-center px-8 py-3 border-2 border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
            >
              {saving ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" size={18} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

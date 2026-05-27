'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  whatsappApi,
  clientsApi,
  WhatsAppGroup,
  Client,
} from '@/lib/api';
import toast from 'react-hot-toast';
import {
  FiRefreshCw,
  FiArrowLeft,
  FiUsers,
  FiCheck,
  FiX,
  FiClock,
} from 'react-icons/fi';

export default function WhatsAppGroupsPage() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [groupsData, clientsData] = await Promise.all([
        whatsappApi.getGroups(),
        clientsApi.getAll(),
      ]);
      setGroups(groupsData);
      setClients(clientsData);
    } catch (error) {
      toast.error('Error al cargar datos');
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    init();
  }, [loadData]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await whatsappApi.syncGroups();
      toast.success(`${result.synced} grupos sincronizados`);
      await loadData();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Error al sincronizar grupos';
      toast.error(message);
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkClient = async (groupId: string, clientId: string) => {
    try {
      setUpdatingId(groupId);
      const linkedClientId = clientId === '' ? null : clientId;
      await whatsappApi.updateGroup(groupId, { linkedClientId });
      toast.success(
        linkedClientId ? 'Cliente vinculado' : 'Cliente desvinculado',
      );
      await loadData();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Error al actualizar grupo';
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleAi = async (group: WhatsAppGroup) => {
    if (!group.linkedClientId) {
      toast.error('Vincula un cliente primero');
      return;
    }
    try {
      setUpdatingId(group.id);
      await whatsappApi.updateGroup(group.id, {
        aiEnabled: !group.aiEnabled,
      });
      toast.success(
        !group.aiEnabled ? 'Agente AI activado' : 'Agente AI desactivado',
      );
      await loadData();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Error al actualizar AI';
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDebounceChange = async (groupId: string, value: string) => {
    const seconds = parseInt(value, 10);
    if (isNaN(seconds) || seconds < 0 || seconds > 600) return;
    try {
      setUpdatingId(groupId);
      await whatsappApi.updateGroup(groupId, { debounceSeconds: seconds });
      toast.success(`Debounce: ${seconds}s`);
      await loadData();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Error al actualizar debounce';
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-yellow-100 text-yellow-800',
      removed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      active: 'Activo',
      inactive: 'Inactivo',
      removed: 'Removido',
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-800'}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  const formatRelativeTime = (isoDate?: string | null) => {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffHours < 24) return `hace ${diffHours} h`;
    if (diffDays < 30) return `hace ${diffDays} d`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/settings/whatsapp"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <FiArrowLeft className="mr-1" />
              Volver a WhatsApp
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FiUsers className="mr-3 text-green-600" />
              Grupos de WhatsApp
            </h1>
            <p className="mt-2 text-gray-600">
              Vincula grupos a clientes y configura el agente AI por grupo.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors"
          >
            <FiRefreshCw className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Grupos'}
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <FiRefreshCw className="animate-spin mx-auto text-4xl text-gray-400" />
            <p className="mt-4 text-gray-500">Cargando grupos...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <FiUsers className="mx-auto text-5xl text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay grupos detectados
            </h3>
            <p className="text-gray-500 mb-4">
              Agrega el bot a un grupo de WhatsApp y aparecerá aquí
              automáticamente.
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 text-primary-600 hover:text-primary-700"
            >
              <FiRefreshCw className="mr-2" />
              Sincronizar ahora
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grupo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participantes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente Vinculado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agente AI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Debounce
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Último Mensaje
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groups.map((group) => {
                    const isUpdating = updatingId === group.id;
                    const aiDisabled = !group.linkedClientId;
                    return (
                      <tr key={group.id} className="hover:bg-gray-50">
                        {/* Nombre */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {group.groupName}
                          </div>
                          {group.groupDescription && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {group.groupDescription}
                            </div>
                          )}
                        </td>

                        {/* Participantes */}
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {group.participantCount}
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-4">
                          {getStatusBadge(group.status)}
                        </td>

                        {/* Cliente Vinculado */}
                        <td className="px-6 py-4">
                          <select
                            value={group.linkedClientId || ''}
                            onChange={(e) =>
                              handleLinkClient(group.id, e.target.value)
                            }
                            disabled={isUpdating || group.status === 'removed'}
                            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-500 disabled:bg-gray-100"
                          >
                            <option value="">— Sin vincular —</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Toggle AI */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleAi(group)}
                            disabled={isUpdating || aiDisabled}
                            title={
                              aiDisabled
                                ? 'Vincula un cliente primero'
                                : group.aiEnabled
                                ? 'Desactivar AI'
                                : 'Activar AI'
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                              group.aiEnabled
                                ? 'bg-green-500'
                                : 'bg-gray-300'
                            } ${aiDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                group.aiEnabled
                                  ? 'translate-x-6'
                                  : 'translate-x-1'
                              }`}
                            />
                            {group.aiEnabled ? (
                              <FiCheck className="absolute left-1 text-white text-xs" />
                            ) : (
                              <FiX className="absolute right-1 text-gray-600 text-xs" />
                            )}
                          </button>
                        </td>

                        {/* Debounce */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <input
                              type="number"
                              min={0}
                              max={600}
                              value={group.debounceSeconds}
                              onChange={(e) =>
                                handleDebounceChange(group.id, e.target.value)
                              }
                              disabled={isUpdating}
                              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:ring-2 focus:ring-primary-200 focus:border-primary-500 disabled:bg-gray-100"
                            />
                            <span className="ml-1 text-xs text-gray-400">s</span>
                          </div>
                        </td>

                        {/* Último Mensaje */}
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <FiClock className="mr-1 text-gray-400" />
                            {formatRelativeTime(group.lastMessageAt)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

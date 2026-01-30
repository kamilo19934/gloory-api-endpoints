'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  clientsApi,
  clientApiLogsApi,
  Client,
  ClientApiLog,
  LogStats,
  LogsQueryParams,
  LogsPagination,
  StatusCategory,
  getStatusCategoryColor,
  getStatusCategoryIcon,
} from '@/lib/api';
import {
  FiArrowLeft,
  FiLoader,
  FiSearch,
  FiFilter,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiTrash2,
  FiClock,
  FiInfo,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ClientLogsPage() {
  const params = useParams();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [logs, setLogs] = useState<ClientApiLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [pagination, setPagination] = useState<LogsPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusCategory | ''>('');
  const [endpointFilter, setEndpointFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal de detalle
  const [selectedLog, setSelectedLog] = useState<ClientApiLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1); // Reset página al buscar
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadClient = useCallback(async () => {
    try {
      const clientData = await clientsApi.getById(clientId);
      setClient(clientData);
    } catch (error) {
      toast.error('Error al cargar el cliente');
      console.error(error);
    }
  }, [clientId]);

  const loadStats = useCallback(async () => {
    try {
      const [statsData, endpointsData] = await Promise.all([
        clientApiLogsApi.getStats(clientId),
        clientApiLogsApi.getEndpoints(clientId),
      ]);
      setStats(statsData);
      setEndpoints(endpointsData.endpoints);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [clientId]);

  const loadLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const queryParams: LogsQueryParams = {
        page,
        limit: 20,
      };

      if (searchDebounced && searchDebounced.length >= 2) {
        queryParams.search = searchDebounced;
      }
      if (statusFilter) {
        queryParams.status = statusFilter;
      }
      if (endpointFilter) {
        queryParams.endpoint = endpointFilter;
      }

      const response = await clientApiLogsApi.getLogs(clientId, queryParams);
      setLogs(response.data);
      setPagination(response.pagination);
    } catch (error) {
      toast.error('Error al cargar los logs');
      console.error(error);
    } finally {
      setLoadingLogs(false);
    }
  }, [clientId, page, searchDebounced, statusFilter, endpointFilter]);

  useEffect(() => {
    if (clientId) {
      setLoading(true);
      Promise.all([loadClient(), loadStats()])
        .finally(() => setLoading(false));
    }
  }, [clientId, loadClient, loadStats]);

  useEffect(() => {
    if (clientId) {
      loadLogs();
    }
  }, [clientId, loadLogs]);

  const handleClearFilters = () => {
    setSearch('');
    setSearchDebounced('');
    setStatusFilter('');
    setEndpointFilter('');
    setPage(1);
  };

  const handleDeleteLogs = async () => {
    if (!confirm('¿Estás seguro de eliminar todos los logs de este cliente? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const result = await clientApiLogsApi.deleteLogs(clientId);
      toast.success(result.message);
      loadLogs();
      loadStats();
    } catch (error) {
      toast.error('Error al eliminar los logs');
      console.error(error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
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
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft className="mr-2" />
            Volver al Cliente
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Logs de API - {client.name}
              </h1>
              <p className="text-gray-600 mt-1">
                Historial de peticiones a los endpoints del cliente (últimos 30 días)
              </p>
            </div>
            <button
              onClick={handleDeleteLogs}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md"
            >
              <FiTrash2 className="mr-2" />
              Limpiar Logs
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Total Peticiones</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">✅ Exitosas (2xx)</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.success} <span className="text-sm font-normal">({stats.successPercentage}%)</span>
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">⚠️ Error Cliente (4xx)</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.clientError} <span className="text-sm font-normal">({stats.clientErrorPercentage}%)</span>
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">❌ Error Servidor (5xx)</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.serverError} <span className="text-sm font-normal">({stats.serverErrorPercentage}%)</span>
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Búsqueda */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar en logs (ej: nombre paciente, RUT, error...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Filtro Status */}
            <div className="w-40">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusCategory | '');
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Todos los status</option>
                <option value="2xx">✅ 2xx (Éxito)</option>
                <option value="4xx">⚠️ 4xx (Error cliente)</option>
                <option value="5xx">❌ 5xx (Error servidor)</option>
              </select>
            </div>

            {/* Filtro Endpoint */}
            <div className="w-48">
              <select
                value={endpointFilter}
                onChange={(e) => {
                  setEndpointFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Todos los endpoints</option>
                {endpoints.map((ep) => (
                  <option key={ep} value={ep}>{ep}</option>
                ))}
              </select>
            </div>

            {/* Limpiar filtros */}
            {(search || statusFilter || endpointFilter) && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <FiX className="mr-1" />
                Limpiar
              </button>
            )}
          </div>

          {searchDebounced && searchDebounced.length >= 2 && (
            <p className="text-sm text-gray-500 mt-2">
              Resultados para &quot;{searchDebounced}&quot;
            </p>
          )}
        </div>

        {/* Tabla de Logs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loadingLogs ? (
            <div className="flex justify-center items-center py-12">
              <FiLoader className="animate-spin text-2xl text-primary-600" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <FiInfo className="mx-auto text-4xl text-gray-400 mb-4" />
              <p className="text-gray-500">No hay logs que mostrar</p>
              {(search || statusFilter || endpointFilter) && (
                <button
                  onClick={handleClearFilters}
                  className="mt-2 text-primary-600 hover:text-primary-700"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha/Hora
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Método
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Endpoint
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duración
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedLog(log);
                          setShowDetail(true);
                        }}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          <FiClock className="inline mr-1" />
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            log.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                            log.method === 'POST' ? 'bg-green-100 text-green-800' :
                            log.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            log.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {log.endpoint}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusCategoryColor(log.statusCategory)}`}>
                            {getStatusCategoryIcon(log.statusCategory)} {log.statusCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {formatDuration(log.duration)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                              setShowDetail(true);
                            }}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {pagination && pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} resultados
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <FiChevronLeft />
                    </button>
                    <span className="text-sm text-gray-700">
                      Página {pagination.page} de {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                      className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <FiChevronRight />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal de Detalle */}
      {showDetail && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Detalle del Log</h2>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Información básica */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duración</p>
                  <p className="font-medium">{formatDuration(selectedLog.duration)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Endpoint</p>
                  <p className="font-medium">
                    <span className={`px-2 py-1 text-xs font-semibold rounded mr-2 ${
                      selectedLog.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                      selectedLog.method === 'POST' ? 'bg-green-100 text-green-800' :
                      selectedLog.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                      selectedLog.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {selectedLog.method}
                    </span>
                    {selectedLog.fullPath}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusCategoryColor(selectedLog.statusCategory)}`}>
                      {getStatusCategoryIcon(selectedLog.statusCategory)} {selectedLog.statusCode}
                    </span>
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {selectedLog.errorMessage && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Mensaje de Error</p>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-700">{selectedLog.errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Request Body */}
              {selectedLog.requestBody && Object.keys(selectedLog.requestBody).length > 0 && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Request Body</p>
                  <pre className="bg-gray-900 text-gray-100 rounded-md p-4 overflow-x-auto text-sm">
                    {JSON.stringify(selectedLog.requestBody, null, 2)}
                  </pre>
                </div>
              )}

              {/* Response Body */}
              {selectedLog.responseBody && Object.keys(selectedLog.responseBody).length > 0 && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Response Body</p>
                  <pre className="bg-gray-900 text-gray-100 rounded-md p-4 overflow-x-auto text-sm">
                    {JSON.stringify(selectedLog.responseBody, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500 mb-2">Metadata</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">IP: </span>
                    <span className="font-mono">{selectedLog.ipAddress || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">User-Agent: </span>
                    <span className="font-mono text-xs">{selectedLog.userAgent || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

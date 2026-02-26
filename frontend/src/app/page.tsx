'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  dashboardApi,
  DashboardStats,
  RecentError,
  getStatusCategoryColor,
} from '@/lib/api';
import {
  FiUsers,
  FiActivity,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrendingUp,
  FiClock,
  FiRefreshCw,
  FiLoader,
  FiExternalLink,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  bgColor,
  iconColor,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center">
        <div
          className={`flex items-center justify-center w-12 h-12 ${bgColor} rounded-lg`}
        >
          <Icon className={`${iconColor} text-xl`} />
        </div>
        <div className="ml-4 flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-800',
    POST: 'bg-green-100 text-green-800',
    PUT: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800',
    PATCH: 'bg-purple-100 text-purple-800',
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors[method] || 'bg-gray-100 text-gray-800'}`}
    >
      {method}
    </span>
  );
}

function StatusBadge({ statusCode, statusCategory }: { statusCode: number; statusCategory: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusCategoryColor(statusCategory as any)}`}
    >
      {statusCode}
    </span>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (error) {
      toast.error('Error al cargar estadísticas del dashboard');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => loadStats(true), 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Panel de Monitoreo
            </h1>
            <p className="text-gray-500 mt-1">
              Vista general del sistema en tiempo real
            </p>
          </div>
          <button
            onClick={() => loadStats(true)}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <FiRefreshCw
              className={`mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-32">
            <FiLoader className="animate-spin text-primary-600 text-3xl" />
          </div>
        ) : stats ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <StatCard
                title="Clientes Conectados"
                value={stats.connectedClients}
                subtitle={`${stats.totalClients} total`}
                icon={FiUsers}
                bgColor="bg-green-100"
                iconColor="text-green-600"
              />
              <StatCard
                title="Total Requests Hoy"
                value={stats.totalToday.toLocaleString('es-CL')}
                icon={FiActivity}
                bgColor="bg-blue-100"
                iconColor="text-blue-600"
              />
              <StatCard
                title="Requests Exitosos"
                value={stats.successToday.toLocaleString('es-CL')}
                icon={FiCheckCircle}
                bgColor="bg-emerald-100"
                iconColor="text-emerald-600"
              />
              <StatCard
                title="Errores Hoy"
                value={stats.clientErrorToday + stats.serverErrorToday}
                subtitle={`4xx: ${stats.clientErrorToday} · 5xx: ${stats.serverErrorToday}`}
                icon={FiAlertTriangle}
                bgColor="bg-red-100"
                iconColor="text-red-600"
              />
              <StatCard
                title="Tasa de Éxito"
                value={`${stats.successRate}%`}
                icon={FiTrendingUp}
                bgColor="bg-indigo-100"
                iconColor="text-indigo-600"
              />
              <StatCard
                title="Tiempo Promedio"
                value={`${stats.avgResponseTime} ms`}
                icon={FiClock}
                bgColor="bg-purple-100"
                iconColor="text-purple-600"
              />
            </div>

            {/* Main Content: Errors Table + Side Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Errors Table - 2 columns */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Errores Recientes
                  </h2>
                </div>
                {stats.recentErrors.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400">
                    Sin errores recientes
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          <th className="px-4 py-3">Hora</th>
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Request</th>
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {stats.recentErrors.map((error: RecentError) => (
                          <tr
                            key={error.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                              {formatTime(error.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/clients/${error.clientId}`}
                                className="text-primary-600 hover:text-primary-700 font-medium text-xs"
                              >
                                {error.clientName}
                              </Link>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <MethodBadge method={error.method} />{' '}
                              <span className="text-gray-700 text-xs">
                                {error.endpoint}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                statusCode={error.statusCode}
                                statusCategory={error.statusCategory}
                              />
                            </td>
                            <td
                              className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate"
                              title={error.errorMessage || ''}
                            >
                              {error.errorMessage || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Side Panel */}
              <div className="space-y-6">
                {/* Top Endpoints */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Endpoints Más Utilizados
                    </h2>
                  </div>
                  {stats.topEndpoints.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                      Sin datos hoy
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {stats.topEndpoints.map((ep, i) => (
                        <li
                          key={ep.endpoint}
                          className="px-6 py-3 flex items-center justify-between"
                        >
                          <div className="flex items-center min-w-0">
                            <span className="text-xs font-bold text-gray-400 w-5">
                              {i + 1}.
                            </span>
                            <span className="text-sm text-gray-700 truncate">
                              {ep.endpoint}
                            </span>
                          </div>
                          <span className="ml-2 text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {ep.count.toLocaleString('es-CL')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Top Clients */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Clientes Más Activos
                    </h2>
                  </div>
                  {stats.topClients.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                      Sin datos hoy
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {stats.topClients.map((client, i) => (
                        <li
                          key={client.clientId}
                          className="px-6 py-3 flex items-center justify-between"
                        >
                          <div className="flex items-center min-w-0">
                            <span className="text-xs font-bold text-gray-400 w-5">
                              {i + 1}.
                            </span>
                            <Link
                              href={`/clients/${client.clientId}`}
                              className="text-sm text-primary-600 hover:text-primary-700 font-medium truncate"
                            >
                              {client.clientName}
                            </Link>
                          </div>
                          <span className="ml-2 text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {client.count.toLocaleString('es-CL')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-32 text-gray-400">
            No se pudieron cargar las estadísticas
          </div>
        )}
      </main>
    </div>
  );
}

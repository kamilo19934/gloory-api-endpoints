'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { ghlOAuthApi, GHLOAuthStatus, GHLOAuthLocation } from '@/lib/api';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiXCircle, FiRefreshCw, FiExternalLink, FiCopy, FiZap, FiTrash2 } from 'react-icons/fi';

export default function GHLOAuthPage() {
  const [status, setStatus] = useState<GHLOAuthStatus | null>(null);
  const [locations, setLocations] = useState<GHLOAuthLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    // Detectar si volvemos del callback de GHL con error
    const params = new URLSearchParams(window.location.search);
    if (params.get('ghl_oauth_error') === 'true') {
      toast.error('Error al conectar con GoHighLevel. Intenta nuevamente.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusData, locationsData] = await Promise.all([
        ghlOAuthApi.checkStatus(),
        ghlOAuthApi.getLocations(),
      ]);
      setStatus(statusData);
      setLocations(locationsData);
    } catch (error) {
      toast.error('Error al cargar estado de GHL OAuth');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Seguro que quieres desconectar GHL OAuth? Se eliminarán todos los tokens.')) return;
    try {
      setDisconnecting(true);
      await ghlOAuthApi.disconnect();
      toast.success('GHL OAuth desconectado');
      await loadData();
    } catch (error) {
      toast.error('Error al desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { authUrl } = await ghlOAuthApi.getConnectUrl();
      window.location.href = authUrl;
    } catch (error) {
      toast.error('Error al obtener URL de autorización');
      setConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const formatExpiry = (date: Date) => {
    return new Date(date).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpiringSoon = (date: Date) => {
    const hoursLeft = (new Date(date).getTime() - Date.now()) / 1000 / 3600;
    return hoursLeft < 24;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FiZap className="text-orange-500 text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GoHighLevel OAuth</h1>
              <p className="text-sm text-gray-500">Conexión via Marketplace App — tokens automáticos para todas las sub-cuentas</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            title="Refrescar"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Estado de conexión */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Estado de Conexión</h2>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <FiRefreshCw className="animate-spin" />
              <span>Verificando...</span>
            </div>
          ) : status?.valid ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiCheckCircle className="text-green-500 text-2xl" />
                <div>
                  <p className="font-semibold text-gray-900">Conectado</p>
                  <p className="text-sm text-gray-500">
                    {status.companies} empresa{status.companies !== 1 ? 's' : ''} conectada{status.companies !== 1 ? 's' : ''} · {locations.length} sub-cuenta{locations.length !== 1 ? 's' : ''} con token
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConnect}
                  disabled={connecting || disconnecting}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50"
                >
                  Re-conectar
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting || connecting}
                  className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
                >
                  {disconnecting ? <FiRefreshCw className="animate-spin" /> : <FiTrash2 />}
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiXCircle className="text-red-400 text-2xl" />
                <div>
                  <p className="font-semibold text-gray-900">No conectado</p>
                  <p className="text-sm text-gray-500">Conecta la app para obtener tokens OAuth de todas las sub-cuentas</p>
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium text-sm"
              >
                {connecting ? (
                  <FiRefreshCw className="animate-spin" />
                ) : (
                  <FiExternalLink />
                )}
                Conectar con GHL
              </button>
            </div>
          )}
        </div>

        {/* Cómo funciona */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-blue-800 mb-2">¿Cómo funciona?</h2>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Haz click en <strong>Conectar con GHL</strong> — serás redirigido al Marketplace de GHL</li>
            <li>Elige tu agencia/empresa y autoriza la app</li>
            <li>El sistema guardará tokens para <strong>todas tus sub-cuentas automáticamente</strong></li>
            <li>En cada cliente, activa <strong>Usar OAuth Marketplace</strong> en la configuración de GHL</li>
            <li>Los tokens se renuevan solos cada hora — sin intervención manual</li>
          </ol>
        </div>

        {/* Sub-cuentas conectadas */}
        {locations.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Sub-cuentas Conectadas ({locations.length})</h2>
              <p className="text-xs text-gray-400 mt-0.5">Copia el Location ID y asígnalo al cliente correspondiente en su configuración de GHL</p>
            </div>
            <div className="divide-y">
              {locations.map((loc) => (
                <div key={loc.locationId} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{loc.locationName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-mono">
                        {loc.locationId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(loc.locationId)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copiar Location ID"
                      >
                        <FiCopy className="text-xs" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-medium ${isExpiringSoon(loc.tokenExpiry) ? 'text-amber-500' : 'text-green-500'}`}>
                      {isExpiringSoon(loc.tokenExpiry) ? '⚠ Expira pronto' : '✓ Token activo'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatExpiry(loc.tokenExpiry)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

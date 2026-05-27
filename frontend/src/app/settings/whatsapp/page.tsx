'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  whatsappApi,
  WhatsAppStatus,
  WhatsAppQrStreamEvent,
  WhatsAppGroup,
} from '@/lib/api';
import toast from 'react-hot-toast';
import {
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiSmartphone,
  FiUsers,
  FiPower,
} from 'react-icons/fi';

export default function WhatsAppSettingsPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [groupCount, setGroupCount] = useState<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.getStatus();
      setStatus(data);
      return data;
    } catch (error) {
      toast.error('Error al cargar estado de WhatsApp');
      console.error(error);
      return null;
    }
  }, []);

  const loadGroupCount = useCallback(async () => {
    try {
      const groups = await whatsappApi.getGroups();
      setGroupCount(groups.filter((g: WhatsAppGroup) => g.status === 'active').length);
    } catch (error) {
      console.error('Error loading group count:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadStatus(), loadGroupCount()]);
      setLoading(false);
    };
    init();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [loadStatus, loadGroupCount]);

  const openQrStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const url = whatsappApi.getQrStreamUrl(token);

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const payload: WhatsAppQrStreamEvent = JSON.parse(evt.data);

        if (payload.type === 'qr' && typeof payload.data === 'string') {
          setQrDataUri(payload.data);
        } else if (payload.type === 'connected') {
          setQrDataUri(null);
          toast.success('¡WhatsApp conectado!');
          loadStatus();
          loadGroupCount();
          es.close();
          eventSourceRef.current = null;
          setConnecting(false);
        } else if (payload.type === 'disconnected') {
          setQrDataUri(null);
          setConnecting(false);
          es.close();
          eventSourceRef.current = null;
        } else if (payload.type === 'error') {
          toast.error(payload.message || 'Error en la conexión');
          setConnecting(false);
          es.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    es.onerror = () => {
      console.warn('SSE connection error');
    };
  }, [loadStatus, loadGroupCount]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setQrDataUri(null);
      openQrStream();
      await whatsappApi.connect();
    } catch (error) {
      toast.error('Error al iniciar conexión');
      console.error(error);
      setConnecting(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        '¿Seguro que quieres desconectar WhatsApp? Tendrás que escanear el QR de nuevo para reconectar.',
      )
    )
      return;
    try {
      setDisconnecting(true);
      await whatsappApi.disconnect();
      toast.success('WhatsApp desconectado');
      await loadStatus();
    } catch (error) {
      toast.error('Error al desconectar');
      console.error(error);
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = status?.status === 'connected';
  const isConnecting = status?.status === 'connecting' || connecting;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FiSmartphone className="mr-3 text-green-600" />
            WhatsApp Agent
          </h1>
          <p className="mt-2 text-gray-600">
            Conecta una cuenta de WhatsApp para recibir mensajes de grupos y
            responder con el agente AI.
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <FiRefreshCw className="animate-spin mx-auto text-4xl text-gray-400" />
            <p className="mt-4 text-gray-500">Cargando estado...</p>
          </div>
        ) : (
          <>
            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Estado de Conexión
                </h2>
                <div className="flex items-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full mr-2 ${
                      isConnected
                        ? 'bg-green-500'
                        : isConnecting
                        ? 'bg-yellow-500 animate-pulse'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {isConnected
                      ? 'Conectado'
                      : isConnecting
                      ? 'Conectando...'
                      : 'Desconectado'}
                  </span>
                </div>
              </div>

              {/* Estado: Conectado */}
              {isConnected && (
                <div>
                  <div className="flex items-center text-green-600 mb-4">
                    <FiCheckCircle className="mr-2" size={24} />
                    <span className="text-lg font-medium">
                      {status?.phoneNumber
                        ? `Número: +${status.phoneNumber}`
                        : 'WhatsApp conectado'}
                    </span>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                  >
                    <FiPower className="mr-2" />
                    {disconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </div>
              )}

              {/* Estado: Conectando - mostrar QR */}
              {!isConnected && isConnecting && (
                <div className="text-center py-4">
                  {qrDataUri ? (
                    <div>
                      <img
                        src={qrDataUri}
                        alt="QR Code WhatsApp"
                        className="mx-auto border-4 border-gray-200 rounded-lg"
                        style={{ maxWidth: 280 }}
                      />
                      <p className="mt-4 text-gray-700 font-medium">
                        Escanea este código con WhatsApp
                      </p>
                      <p className="mt-2 text-sm text-gray-500">
                        WhatsApp → Ajustes → Dispositivos vinculados → Vincular
                        un dispositivo
                      </p>
                    </div>
                  ) : (
                    <div>
                      <FiRefreshCw className="animate-spin mx-auto text-4xl text-gray-400" />
                      <p className="mt-4 text-gray-500">
                        Generando código QR...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Estado: Desconectado */}
              {!isConnected && !isConnecting && (
                <div>
                  <div className="flex items-center text-red-600 mb-4">
                    <FiXCircle className="mr-2" size={24} />
                    <span className="text-lg font-medium">
                      WhatsApp no conectado
                    </span>
                  </div>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                  >
                    <FiSmartphone className="mr-2" />
                    Conectar WhatsApp
                  </button>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                ¿Cómo funciona?
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900">
                <li>
                  Conecta tu cuenta de WhatsApp escaneando el código QR con tu
                  teléfono.
                </li>
                <li>
                  Agrega el número conectado a cualquier grupo de WhatsApp donde
                  quieras tener soporte AI.
                </li>
                <li>
                  Los grupos aparecerán automáticamente en la sección{' '}
                  <strong>Grupos</strong> de esta pantalla.
                </li>
                <li>
                  Vincula cada grupo a un cliente de la plataforma y activa el
                  agente AI.
                </li>
                <li>
                  El agente recibirá los mensajes del grupo y responderá cuando
                  considere necesario.
                </li>
              </ol>
            </div>

            {/* Groups Link */}
            <Link
              href="/settings/whatsapp/groups"
              className="block bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FiUsers className="text-green-600 mr-3" size={28} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Gestión de Grupos
                    </h3>
                    <p className="text-sm text-gray-600">
                      Vincular grupos a clientes y configurar el agente AI
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold mr-3">
                    {groupCount} {groupCount === 1 ? 'grupo' : 'grupos'}
                  </span>
                  <span className="text-gray-400">→</span>
                </div>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

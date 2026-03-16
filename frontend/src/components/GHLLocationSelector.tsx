'use client';

import { useState, useEffect } from 'react';
import {
  ghlOAuthApi,
  GHLOAuthLocation,
  GHLCalendarPreview,
} from '@/lib/api';
import {
  FiMapPin,
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiAlertCircle,
  FiExternalLink,
  FiSettings,
  FiRefreshCw,
} from 'react-icons/fi';

interface GHLLocationSelectorProps {
  locationId: string;
  accessToken: string;
  oauthMode: boolean;
  /** Aplica multiples cambios de config en una sola llamada (evita batching issues) */
  onConfigChange: (changes: Record<string, any>) => void;
}

export default function GHLLocationSelector({
  locationId,
  accessToken,
  oauthMode,
  onConfigChange,
}: GHLLocationSelectorProps) {
  const [oauthConnected, setOauthConnected] = useState(false);
  const [locations, setLocations] = useState<GHLOAuthLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [calendars, setCalendars] = useState<GHLCalendarPreview[]>([]);
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  useEffect(() => {
    loadOAuthData();
  }, []);

  // Detectar si el cliente existente usa modo manual (PIT)
  useEffect(() => {
    if (!loading) {
      const hasPitToken = accessToken && !oauthMode;
      const locationNotInOAuth = locationId && !locations.find((l) => l.locationId === locationId);

      if (hasPitToken || (locationId && locationNotInOAuth && !oauthMode)) {
        setManualMode(true);
      }
    }
  }, [loading, accessToken, oauthMode, locationId, locations]);

  const loadOAuthData = async () => {
    try {
      const [status, locs] = await Promise.all([
        ghlOAuthApi.checkStatus(),
        ghlOAuthApi.getLocations(),
      ]);
      setOauthConnected(status.valid);
      setLocations(locs);
    } catch {
      setOauthConnected(false);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = async (selectedLocationId: string) => {
    // Un solo onChange con todos los campos — evita que React batching pierda valores
    onConfigChange({
      ghlLocationId: selectedLocationId,
      ghlOAuthMode: true,
      ghlAccessToken: '',
    });

    // Cargar preview de calendarios
    if (selectedLocationId) {
      setLoadingCalendars(true);
      try {
        const cals = await ghlOAuthApi.getCalendarsForLocation(selectedLocationId);
        setCalendars(cals);
      } catch {
        setCalendars([]);
      } finally {
        setLoadingCalendars(false);
      }
    } else {
      setCalendars([]);
    }
  };

  const toggleManualMode = () => {
    const newManual = !manualMode;
    setManualMode(newManual);
    if (newManual) {
      onConfigChange({ ghlOAuthMode: false });
      setCalendars([]);
    } else {
      onConfigChange({ ghlOAuthMode: true, ghlAccessToken: '' });
    }
  };

  // Cargar calendarios si ya hay una location seleccionada via OAuth
  useEffect(() => {
    if (!loading && oauthMode && locationId && !manualMode) {
      const matchesOAuth = locations.find((l) => l.locationId === locationId);
      if (matchesOAuth) {
        setLoadingCalendars(true);
        ghlOAuthApi
          .getCalendarsForLocation(locationId)
          .then(setCalendars)
          .catch(() => setCalendars([]))
          .finally(() => setLoadingCalendars(false));
      }
    }
  }, [loading, oauthMode, locationId, manualMode, locations]);

  const selectedLocation = locations.find((l) => l.locationId === locationId);

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-900">
          Ubicacion GHL
        </label>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <FiRefreshCw className="animate-spin text-gray-400" size={16} />
          <span className="text-sm text-gray-500">Verificando conexion OAuth...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-900">
          Ubicacion GHL
        </label>
        <button
          type="button"
          onClick={toggleManualMode}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
        >
          <FiSettings size={12} />
          {manualMode ? 'Usar OAuth' : 'Modo manual (PIT)'}
        </button>
      </div>

      {!manualMode ? (
        // ========== MODO OAUTH ==========
        <div className="space-y-3">
          {oauthConnected && locations.length > 0 ? (
            <>
              {/* Dropdown de locations */}
              <div className="relative">
                <select
                  value={locationId || ''}
                  onChange={(e) => handleLocationSelect(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-colors text-sm bg-white hover:border-gray-300 appearance-none pr-10"
                >
                  <option value="">Seleccionar ubicacion...</option>
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.locationName}
                    </option>
                  ))}
                </select>
                <FiMapPin
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  size={16}
                />
              </div>

              {/* Badge OAuth activo */}
              {selectedLocation && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <FiCheckCircle className="text-green-500 shrink-0" size={16} />
                  <div className="text-xs">
                    <span className="font-medium text-green-800">OAuth activo</span>
                    <span className="text-green-600">
                      {' '}&mdash; tokens se renuevan automaticamente
                    </span>
                  </div>
                </div>
              )}

              {/* Preview de calendarios */}
              {selectedLocation && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCalendarsOpen(!calendarsOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
                  >
                    <span className="text-gray-700 font-medium">
                      Calendarios disponibles
                      {!loadingCalendars && (
                        <span className="ml-1.5 text-gray-400 font-normal">
                          ({calendars.length})
                        </span>
                      )}
                    </span>
                    {calendarsOpen ? (
                      <FiChevronUp className="text-gray-400" size={16} />
                    ) : (
                      <FiChevronDown className="text-gray-400" size={16} />
                    )}
                  </button>

                  {calendarsOpen && (
                    <div className="p-3 border-t border-gray-200 bg-white">
                      {loadingCalendars ? (
                        <div className="flex items-center gap-2 text-gray-400 py-2">
                          <FiRefreshCw className="animate-spin" size={14} />
                          <span className="text-xs">Cargando calendarios...</span>
                        </div>
                      ) : calendars.length > 0 ? (
                        <div className="space-y-1.5">
                          {calendars.map((cal) => (
                            <div
                              key={cal.id}
                              className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded text-xs"
                            >
                              <span className="text-gray-700 font-medium">{cal.name}</span>
                              {cal.calendarType && (
                                <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {cal.calendarType}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 py-1">
                          No se encontraron calendarios en esta ubicacion
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* No hay OAuth conectado */
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                <div className="space-y-2">
                  <p className="text-sm text-orange-800 font-medium">
                    OAuth GHL no conectado
                  </p>
                  <p className="text-xs text-orange-600">
                    Conecta la app del Marketplace para seleccionar ubicaciones
                    automaticamente con tokens que se renuevan solos.
                  </p>
                  <a
                    href="/settings/ghl-oauth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 hover:text-orange-800 underline"
                  >
                    <FiExternalLink size={12} />
                    Ir a configuracion OAuth
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ========== MODO MANUAL (PIT) ==========
        <div className="space-y-3">
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              Modo manual: ingresa el Location ID y Private Integration Token directamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              GHL Location ID
            </label>
            <input
              type="text"
              value={locationId || ''}
              onChange={(e) => onConfigChange({ ghlLocationId: e.target.value })}
              placeholder="Ingresa el Location ID"
              className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              GHL Access Token (PIT)
            </label>
            <input
              type="password"
              value={accessToken || ''}
              onChange={(e) => onConfigChange({ ghlAccessToken: e.target.value })}
              placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm font-mono bg-white hover:border-gray-300"
            />
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { FiInfo } from 'react-icons/fi';

interface GHLIntegrationSectionProps {
  ghlEnabled: boolean;
  setGhlEnabled: (enabled: boolean) => void;
  formData: {
    ghlAccessToken: string;
    ghlCalendarId: string;
    ghlLocationId: string;
  };
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function GHLIntegrationSection({
  ghlEnabled,
  setGhlEnabled,
  formData,
  handleChange,
}: GHLIntegrationSectionProps) {
  return (
    <div className="border rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            🔗 Integración GoHighLevel
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Sincroniza automáticamente al <strong>crear citas</strong>
          </p>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => setGhlEnabled(!ghlEnabled)}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            ghlEnabled ? 'bg-primary-600' : 'bg-gray-300'
          }`}
          aria-label="Toggle GHL Integration"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
              ghlEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
        <div className="flex items-start">
          <FiInfo className="text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>¿Cuándo se usa?</strong> Solo al crear una cita. Si proporcionas
            el <code className="bg-blue-100 px-1 rounded">userId</code> (Contact ID de GHL),
            la cita se sincronizará automáticamente con tu calendario de GoHighLevel.
          </p>
        </div>
      </div>

      {/* Campos condicionales */}
      {ghlEnabled && (
        <div className="space-y-4 mt-4 animate-in slide-in-from-top duration-300">
          <div>
            <label htmlFor="ghlAccessToken" className="block text-sm font-medium text-gray-700">
              GHL Access Token *
            </label>
            <input
              type="password"
              id="ghlAccessToken"
              name="ghlAccessToken"
              value={formData.ghlAccessToken}
              onChange={handleChange}
              required={ghlEnabled}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-4 py-2 border"
              placeholder="pit-xxxxx..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Token de acceso de tu cuenta de GoHighLevel
            </p>
          </div>

          <div>
            <label htmlFor="ghlCalendarId" className="block text-sm font-medium text-gray-700">
              GHL Calendar ID *
            </label>
            <input
              type="text"
              id="ghlCalendarId"
              name="ghlCalendarId"
              value={formData.ghlCalendarId}
              onChange={handleChange}
              required={ghlEnabled}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-4 py-2 border"
              placeholder="7U0Cv0cyOIBktrn4qihl"
            />
            <p className="mt-1 text-xs text-gray-500">
              ID del calendario donde se crearán las citas
            </p>
          </div>

          <div>
            <label htmlFor="ghlLocationId" className="block text-sm font-medium text-gray-700">
              GHL Location ID *
            </label>
            <input
              type="text"
              id="ghlLocationId"
              name="ghlLocationId"
              value={formData.ghlLocationId}
              onChange={handleChange}
              required={ghlEnabled}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-4 py-2 border"
              placeholder="Y6SfrX5Wf5M9eaz8LSq4"
            />
            <p className="mt-1 text-xs text-gray-500">
              ID de la ubicación en GoHighLevel
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import {
  IntegrationMetadata,
  IntegrationType,
  IntegrationFieldDefinition,
  integrationsApi,
  getIntegrationColor,
} from '@/lib/api';
import { FiCheck, FiPlus, FiX, FiSettings } from 'react-icons/fi';

interface IntegrationConfig {
  type: IntegrationType;
  isEnabled: boolean;
  config: Record<string, any>;
}

interface IntegrationSelectorProps {
  selectedIntegrations: IntegrationConfig[];
  onChange: (integrations: IntegrationConfig[]) => void;
  mode?: 'create' | 'edit';
}

export default function IntegrationSelector({
  selectedIntegrations,
  onChange,
  mode = 'create',
}: IntegrationSelectorProps) {
  const [availableIntegrations, setAvailableIntegrations] = useState<IntegrationMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIntegration, setExpandedIntegration] = useState<IntegrationType | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const integrations = await integrationsApi.getAll();
      setAvailableIntegrations(integrations);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSelected = (type: IntegrationType) => {
    return selectedIntegrations.some((i) => i.type === type);
  };

  const getSelectedConfig = (type: IntegrationType) => {
    return selectedIntegrations.find((i) => i.type === type);
  };

  const toggleIntegration = (type: IntegrationType) => {
    if (isSelected(type)) {
      onChange(selectedIntegrations.filter((i) => i.type !== type));
      if (expandedIntegration === type) {
        setExpandedIntegration(null);
      }
    } else {
      const metadata = availableIntegrations.find((i) => i.type === type);
      if (metadata) {
        const defaultConfig: Record<string, any> = {};
        [...metadata.requiredFields, ...metadata.optionalFields].forEach((field) => {
          if (field.defaultValue !== undefined) {
            defaultConfig[field.key] = field.defaultValue;
          }
        });
        onChange([
          ...selectedIntegrations,
          { type, isEnabled: true, config: defaultConfig },
        ]);
        setExpandedIntegration(type);
      }
    }
  };

  const updateConfig = (type: IntegrationType, key: string, value: any) => {
    onChange(
      selectedIntegrations.map((i) =>
        i.type === type ? { ...i, config: { ...i.config, [key]: value } } : i
      )
    );
  };

  const renderField = (
    field: IntegrationFieldDefinition,
    integration: IntegrationConfig
  ) => {
    const value = integration.config[field.key] ?? field.defaultValue ?? '';

    switch (field.type) {
      case 'boolean':
        return (
          <div key={field.key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-900">{field.label}</label>
              {field.description && (
                <p className="text-xs text-gray-600 mt-0.5">{field.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => updateConfig(integration.type, field.key, !value)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                value ? 'bg-primary-600 shadow-sm' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  value ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-900">
              {field.label}
              {field.description && (
                <span className="block text-xs font-normal text-gray-600 mt-0.5">{field.description}</span>
              )}
            </label>
            <select
              value={value}
              onChange={(e) => updateConfig(integration.type, field.key, e.target.value)}
              className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'password':
        return (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-900">
              {field.label}
              {field.description && (
                <span className="block text-xs font-normal text-gray-600 mt-0.5">{field.description}</span>
              )}
            </label>
            <input
              type="password"
              value={value}
              onChange={(e) => updateConfig(integration.type, field.key, e.target.value)}
              placeholder={field.placeholder}
              className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm font-mono bg-white hover:border-gray-300"
            />
          </div>
        );

      default:
        return (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-900">
              {field.label}
              {field.description && (
                <span className="block text-xs font-normal text-gray-600 mt-0.5">{field.description}</span>
              )}
            </label>
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) =>
                updateConfig(
                  integration.type,
                  field.key,
                  field.type === 'number' ? Number(e.target.value) : e.target.value
                )
              }
              placeholder={field.placeholder}
              className="block w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors text-sm bg-white hover:border-gray-300"
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 bg-gray-200 rounded-lg"></div>
        <div className="h-16 bg-gray-200 rounded-lg"></div>
        <div className="h-16 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">Integraciones Disponibles</h3>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-800">
            {selectedIntegrations.length} seleccionada{selectedIntegrations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        {availableIntegrations.map((integration) => {
          const selected = isSelected(integration.type);
          const config = getSelectedConfig(integration.type);
          const isExpanded = expandedIntegration === integration.type;

          return (
            <div
              key={integration.type}
              className={`rounded-xl transition-all duration-200 ${
                selected
                  ? 'border-2 border-primary-400 bg-gradient-to-br from-primary-50 to-primary-100 shadow-md'
                  : 'border-2 border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'
              }`}
            >
              <div
                className="flex items-center p-4 cursor-pointer group"
                onClick={() => toggleIntegration(integration.type)}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${getIntegrationColor(
                    integration.type
                  )} text-white font-bold text-lg shadow-md transform transition-transform group-hover:scale-105`}
                >
                  {integration.name.charAt(0)}
                </div>
                <div className="ml-4 flex-1">
                  <h4 className="text-base font-semibold text-gray-900">{integration.name}</h4>
                  <p className="text-sm text-gray-600 mt-0.5">{integration.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {integration.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-[11px] px-2.5 py-0.5 bg-white border border-gray-200 text-gray-700 rounded-full font-medium"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  {selected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedIntegration(isExpanded ? null : integration.type);
                      }}
                      className={`p-2.5 rounded-lg transition-colors ${
                        isExpanded 
                          ? 'bg-primary-600 text-white shadow-sm' 
                          : 'bg-white text-gray-600 hover:bg-primary-100 hover:text-primary-700'
                      }`}
                      title={isExpanded ? 'Ocultar configuración' : 'Mostrar configuración'}
                    >
                      <FiSettings size={18} />
                    </button>
                  )}
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      selected
                        ? 'border-primary-600 bg-primary-600 text-white shadow-md scale-110'
                        : 'border-gray-300 bg-white text-gray-400 group-hover:border-primary-400'
                    }`}
                  >
                    {selected ? <FiCheck size={16} className="font-bold" /> : <FiPlus size={16} />}
                  </div>
                </div>
              </div>

              {selected && isExpanded && config && (
                <div className="px-5 pb-5 border-t-2 border-primary-200 bg-white/60 rounded-b-xl">
                  <div className="pt-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <FiSettings className="text-primary-600" size={18} />
                      <h5 className="text-base font-bold text-gray-900">
                        Configuración de {integration.name}
                      </h5>
                    </div>

                    {integration.requiredFields.length > 0 && (
                      <div className="mb-5">
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Campos Requeridos</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Obligatorio
                          </span>
                        </div>
                        <div className="space-y-3">
                          {integration.requiredFields.map((field) => renderField(field, config))}
                        </div>
                      </div>
                    )}

                    {integration.optionalFields.length > 0 && (
                      <div>
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Campos Opcionales</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Opcional
                          </span>
                        </div>
                        <div className="space-y-3">
                          {integration.optionalFields.map((field) => renderField(field, config))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

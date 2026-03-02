'use client';

import {
  Client,
  ClientIntegration,
  IntegrationType,
  getIntegrationDisplayName,
  getIntegrationColor,
} from '@/lib/api';
import { FiCheck, FiX } from 'react-icons/fi';

interface IntegrationBadgesProps {
  integrations?: ClientIntegration[];
  client?: Client;
  showStatus?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Infiere integraciones desde campos legacy del cliente
 * cuando no hay registros en la tabla ClientIntegration
 */
function getLegacyIntegrations(client: Client): { type: IntegrationType; enabled: boolean }[] {
  const result: { type: IntegrationType; enabled: boolean }[] = [];

  if (client.apiKey) {
    result.push({ type: IntegrationType.DENTALINK, enabled: true });
  }

  if (client.ghlEnabled && client.ghlAccessToken) {
    result.push({ type: IntegrationType.GOHIGHLEVEL, enabled: true });
  }

  return result;
}

export default function IntegrationBadges({
  integrations = [],
  client,
  showStatus = true,
  size = 'sm',
}: IntegrationBadgesProps) {
  const hasNewIntegrations = integrations && integrations.length > 0;
  const legacyIntegrations = !hasNewIntegrations && client ? getLegacyIntegrations(client) : [];

  if (!hasNewIntegrations && legacyIntegrations.length === 0) {
    return (
      <span className="text-xs text-gray-400 italic">Sin integraciones</span>
    );
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {hasNewIntegrations
        ? integrations.map((integration) => (
            <span
              key={integration.id}
              className={`inline-flex items-center rounded-full ${sizeClasses[size]} ${
                integration.isEnabled
                  ? `${getIntegrationColor(integration.integrationType)} text-white`
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {getIntegrationDisplayName(integration.integrationType)}
              {showStatus && (
                <span className="ml-1">
                  {integration.isEnabled ? (
                    <FiCheck size={size === 'sm' ? 10 : 12} />
                  ) : (
                    <FiX size={size === 'sm' ? 10 : 12} />
                  )}
                </span>
              )}
            </span>
          ))
        : legacyIntegrations.map((legacy) => (
            <span
              key={legacy.type}
              className={`inline-flex items-center rounded-full ${sizeClasses[size]} ${
                legacy.enabled
                  ? `${getIntegrationColor(legacy.type)} text-white`
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {getIntegrationDisplayName(legacy.type)}
              {showStatus && (
                <span className="ml-1">
                  {legacy.enabled ? (
                    <FiCheck size={size === 'sm' ? 10 : 12} />
                  ) : (
                    <FiX size={size === 'sm' ? 10 : 12} />
                  )}
                </span>
              )}
            </span>
          ))}
    </div>
  );
}

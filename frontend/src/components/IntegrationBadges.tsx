'use client';

import {
  ClientIntegration,
  IntegrationType,
  getIntegrationDisplayName,
  getIntegrationColor,
} from '@/lib/api';
import { FiCheck, FiX } from 'react-icons/fi';

interface IntegrationBadgesProps {
  integrations?: ClientIntegration[];
  showStatus?: boolean;
  size?: 'sm' | 'md';
}

export default function IntegrationBadges({
  integrations = [],
  showStatus = true,
  size = 'sm',
}: IntegrationBadgesProps) {
  if (!integrations || integrations.length === 0) {
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
      {integrations.map((integration) => (
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
      ))}
    </div>
  );
}

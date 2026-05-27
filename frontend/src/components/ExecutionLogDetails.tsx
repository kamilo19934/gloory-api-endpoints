'use client';

import { ExecutionStepEntry, ExecutionStepName, ExecutionStepStatus } from '@/lib/api';

const STEP_LABELS: Record<ExecutionStepName, string> = {
  resolve_ghl_credentials: 'Resolver credenciales GHL',
  find_or_create_contact: 'Buscar/crear contacto en GHL',
  update_contact_custom_fields: 'Actualizar custom fields del contacto',
  update_platform_status: 'Actualizar estado en plataforma origen',
};

const STATUS_BADGE: Record<ExecutionStepStatus, string> = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  skipped: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<ExecutionStepStatus, string> = {
  success: 'OK',
  error: 'Error',
  warning: 'Advertencia',
  skipped: 'Omitido',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function groupByAttempt(log: ExecutionStepEntry[]): Map<number, ExecutionStepEntry[]> {
  const groups = new Map<number, ExecutionStepEntry[]>();
  for (const entry of log) {
    const arr = groups.get(entry.attempt) ?? [];
    arr.push(entry);
    groups.set(entry.attempt, arr);
  }
  return groups;
}

interface Props {
  log: ExecutionStepEntry[] | null | undefined;
}

export function ExecutionLogDetails({ log }: Props) {
  if (!log || log.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic px-4 py-3">
        Sin registro de ejecución todavía. Aparecerá aquí después del primer intento de procesamiento.
      </div>
    );
  }

  const groups = groupByAttempt(log);
  const attempts = Array.from(groups.keys()).sort((a, b) => b - a);

  return (
    <div className="px-4 py-3 space-y-4 bg-gray-50">
      {attempts.map((attempt) => {
        const entries = groups.get(attempt)!;
        return (
          <div key={attempt} className="border border-gray-200 rounded-md bg-white">
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-100 text-xs font-semibold text-gray-700">
              Intento #{attempt}
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Paso</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Inicio</th>
                  <th className="px-3 py-2 text-left">Duración</th>
                  <th className="px-3 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, idx) => (
                  <tr key={`${entry.step}-${idx}`} className="align-top">
                    <td className="px-3 py-2 font-medium text-gray-700">
                      {STEP_LABELS[entry.step] ?? entry.step}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[entry.status]}`}
                      >
                        {STATUS_LABEL[entry.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {formatTime(entry.startedAt)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {entry.durationMs}ms
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {entry.errorMessage && (
                        <div className="text-red-700">
                          <div className="font-medium">
                            {entry.errorMessage}
                            {entry.httpStatus !== undefined && (
                              <span className="ml-2 text-xs text-red-600">
                                (HTTP {entry.httpStatus})
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {entry.metadata?.ghlError && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                            Ver respuesta de GHL
                          </summary>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-auto max-h-48">
                            {JSON.stringify(entry.metadata.ghlError, null, 2)}
                          </pre>
                        </details>
                      )}
                      {entry.status === 'success' && entry.metadata && !entry.metadata.ghlError && (
                        <div className="text-xs text-gray-500">
                          {Object.entries(entry.metadata)
                            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                            .join(' · ')}
                        </div>
                      )}
                      {entry.status === 'skipped' && entry.metadata?.reason && (
                        <div className="text-xs text-gray-500">{entry.metadata.reason}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

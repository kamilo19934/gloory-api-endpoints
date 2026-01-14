'use client';

import { EndpointDefinition, EndpointArgument } from '@/lib/api';
import { FiCopy, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useState } from 'react';

interface EndpointCardProps {
  endpoint: EndpointDefinition;
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800',
  POST: 'bg-green-100 text-green-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-purple-100 text-purple-800',
};

const typeColors: Record<string, string> = {
  string: 'text-emerald-600',
  number: 'text-blue-600',
  boolean: 'text-amber-600',
  array: 'text-violet-600',
  object: 'text-rose-600',
};

function ArgumentRow({ arg }: { arg: EndpointArgument }) {
  return (
    <div className="flex items-start py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-sm font-semibold text-gray-900">{arg.name}</code>
          <span className={`text-xs font-mono ${typeColors[arg.type] || 'text-gray-500'}`}>
            {arg.type}
          </span>
          {arg.required ? (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded">
              requerido
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded">
              opcional
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600">{arg.description}</p>
        {arg.example !== undefined && (
          <div className="mt-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Ejemplo: </span>
            <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded text-gray-700">
              {JSON.stringify(arg.example)}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EndpointCard({ endpoint }: EndpointCardProps) {
  const [copied, setCopied] = useState(false);
  const [showArguments, setShowArguments] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(endpoint.clientUrl || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasArguments = endpoint.arguments && endpoint.arguments.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <span
              className={`px-3 py-1 rounded-md text-xs font-bold ${
                methodColors[endpoint.method]
              }`}
            >
              {endpoint.method}
            </span>
            <h3 className="text-lg font-semibold text-gray-900">
              {endpoint.name}
            </h3>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">{endpoint.description}</p>

        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Path</p>
            <code className="text-sm bg-gray-100 px-3 py-2 rounded block">
              {endpoint.path}
            </code>
          </div>

          {endpoint.clientUrl && (
            <div>
              <p className="text-xs text-gray-500 mb-1">URL Completa</p>
              <div className="flex items-center space-x-2">
                <code className="text-sm bg-gray-100 px-3 py-2 rounded flex-1 truncate">
                  {endpoint.clientUrl}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center justify-center p-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  title="Copiar URL"
                >
                  {copied ? <FiCheck className="text-green-600" /> : <FiCopy />}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
              {endpoint.category}
            </span>

            {hasArguments && (
              <button
                onClick={() => setShowArguments(!showArguments)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                {showArguments ? (
                  <>
                    <FiChevronUp className="w-3.5 h-3.5" />
                    Ocultar argumentos
                  </>
                ) : (
                  <>
                    <FiChevronDown className="w-3.5 h-3.5" />
                    Ver argumentos ({endpoint.arguments?.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Arguments Panel */}
      {showArguments && hasArguments && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Argumentos del Endpoint
          </h4>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {endpoint.arguments?.map((arg) => (
              <div key={arg.name} className="px-4">
                <ArgumentRow arg={arg} />
              </div>
            ))}
          </div>
          
          {/* Example JSON */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Ejemplo de Request Body
            </h4>
            <pre className="bg-gray-800 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
              <code>
                {JSON.stringify(
                  endpoint.arguments?.reduce((acc, arg) => {
                    if (arg.example !== undefined) {
                      acc[arg.name] = arg.example;
                    }
                    return acc;
                  }, {} as Record<string, any>),
                  null,
                  2
                )}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

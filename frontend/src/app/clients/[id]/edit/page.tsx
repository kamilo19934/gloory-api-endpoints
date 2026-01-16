'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { clientsApi, Client } from '@/lib/api';
import { FiArrowLeft, FiSave, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    apiKey: '',
    timezone: 'America/Santiago',
    confirmationStateId: undefined as number | undefined,
    isActive: true,
  });

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  const loadClient = async () => {
    try {
      setLoading(true);
      const client = await clientsApi.getById(clientId);
      setFormData({
        name: client.name,
        description: client.description || '',
        apiKey: client.apiKey || '',
        timezone: client.timezone || 'America/Santiago',
        confirmationStateId: client.confirmationStateId,
        isActive: client.isActive,
      });
    } catch (error) {
      toast.error('Error al cargar el cliente');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      setSaving(true);
      await clientsApi.update(clientId, formData);
      toast.success('Cliente actualizado correctamente');
      router.push(`/clients/${clientId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar el cliente');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center py-12">
          <FiLoader className="animate-spin text-4xl text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
          >
            <FiArrowLeft className="mr-2" />
            Volver al cliente
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Editar Cliente</h1>
          <p className="text-gray-600 mt-2">
            Actualiza la información del cliente
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Nombre del cliente"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Descripción opcional del cliente"
              />
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                API Key de Dentalink
              </label>
              <input
                type="text"
                id="apiKey"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                placeholder="API Key de Dentalink"
              />
              <p className="text-xs text-gray-500 mt-1">
                Puedes obtener tu API Key en tu panel de Dentalink
              </p>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                Zona Horaria
              </label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="America/Santiago">America/Santiago (Chile)</option>
                <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                <option value="America/Lima">America/Lima (Perú)</option>
                <option value="America/Bogota">America/Bogota (Colombia)</option>
                <option value="America/Mexico_City">America/Mexico_City (México)</option>
                <option value="America/Sao_Paulo">America/Sao_Paulo (Brasil)</option>
              </select>
            </div>

            <div>
              <label htmlFor="confirmationStateId" className="block text-sm font-medium text-gray-700 mb-2">
                Estado de Confirmación (ID)
              </label>
              <input
                type="number"
                id="confirmationStateId"
                value={formData.confirmationStateId || ''}
                onChange={(e) => setFormData({ ...formData, confirmationStateId: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: 7 para Confirmado"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                ID del estado que se usará para confirmar citas (requerido para usar el endpoint "Confirmar Cita"). 
                Ejemplo: 7 = Confirmado, 8 = Confirmado por Bookys. Puedes crear un estado personalizado en Dentalink/MediLink.
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Cliente activo
              </label>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <FiLoader className="animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2" />
                    Guardar Cambios
                  </>
                )}
              </button>
              <Link
                href={`/clients/${clientId}`}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

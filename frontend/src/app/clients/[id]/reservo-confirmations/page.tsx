'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  clientsApi,
  reservoConfirmationsApi,
  Client,
  ReservoConfirmationConfig,
  ReservoPendingConfirmation,
  ReservoConfirmationStatus,
  CreateReservoConfirmationConfigDto,
} from '@/lib/api';
import {
  FiArrowLeft,
  FiLoader,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiSave,
  FiX,
  FiSettings,
  FiPlay,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ReservoConfirmationsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [configs, setConfigs] = useState<ReservoConfirmationConfig[]>([]);
  const [pending, setPending] = useState<ReservoPendingConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ReservoConfirmationConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedConfirmations, setSelectedConfirmations] = useState<Set<string>>(new Set());
  const [processingAction, setProcessingAction] = useState(false);
  const [triggeringConfig, setTriggeringConfig] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    daysBeforeAppointment: 1,
    timeToSend: '09:00',
    ghlCalendarId: '',
    isEnabled: true,
    order: 1,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [clientData, configsData, pendingData] = await Promise.all([
        clientsApi.getById(clientId),
        reservoConfirmationsApi.getConfigs(clientId),
        reservoConfirmationsApi.getPending(clientId),
      ]);

      setClient(clientData);
      setConfigs(configsData);
      setPending(pendingData);
    } catch (error: any) {
      toast.error('Error cargando datos: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId, loadData]);

  // ============================================
  // CONFIG CRUD
  // ============================================

  const resetForm = () => {
    setFormData({
      name: '',
      daysBeforeAppointment: 1,
      timeToSend: '09:00',
      ghlCalendarId: '',
      isEnabled: true,
      order: configs.length + 1,
    });
  };

  const handleCreateConfig = async () => {
    if (!formData.name || !formData.ghlCalendarId) {
      toast.error('Nombre y GHL Calendar ID son requeridos');
      return;
    }

    try {
      const dto: CreateReservoConfirmationConfigDto = {
        name: formData.name,
        daysBeforeAppointment: formData.daysBeforeAppointment,
        timeToSend: formData.timeToSend,
        ghlCalendarId: formData.ghlCalendarId,
        isEnabled: formData.isEnabled,
        order: formData.order,
      };

      await reservoConfirmationsApi.createConfig(clientId, dto);
      toast.success('Configuracion creada');
      setIsCreating(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return;

    try {
      await reservoConfirmationsApi.updateConfig(clientId, editingConfig.id, {
        name: formData.name,
        daysBeforeAppointment: formData.daysBeforeAppointment,
        timeToSend: formData.timeToSend,
        ghlCalendarId: formData.ghlCalendarId,
        isEnabled: formData.isEnabled,
        order: formData.order,
      });
      toast.success('Configuracion actualizada');
      setIsEditing(false);
      setEditingConfig(null);
      resetForm();
      await loadData();
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Eliminar esta configuracion?')) return;

    try {
      await reservoConfirmationsApi.deleteConfig(clientId, configId);
      toast.success('Configuracion eliminada');
      await loadData();
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const startEditing = (config: ReservoConfirmationConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      daysBeforeAppointment: config.daysBeforeAppointment,
      timeToSend: config.timeToSend,
      ghlCalendarId: config.ghlCalendarId,
      isEnabled: config.isEnabled,
      order: config.order,
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  const startCreating = () => {
    setIsCreating(true);
    setIsEditing(false);
    setEditingConfig(null);
    resetForm();
  };

  const cancelForm = () => {
    setIsCreating(false);
    setIsEditing(false);
    setEditingConfig(null);
    resetForm();
  };

  // ============================================
  // TRIGGER & PROCESS
  // ============================================

  const handleTrigger = async (configId?: string) => {
    try {
      setTriggeringConfig(configId || 'all');
      const result = await reservoConfirmationsApi.trigger(clientId, configId ? { configId } : {});
      toast.success(`${result.stored} citas almacenadas de ${result.totalAppointments} encontradas`);
      await loadData();
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setTriggeringConfig(null);
    }
  };

  const handleProcessSelected = async () => {
    if (selectedConfirmations.size === 0) {
      toast.error('Selecciona al menos una confirmacion');
      return;
    }

    try {
      setProcessingAction(true);
      const result = await reservoConfirmationsApi.processSelected(
        clientId,
        Array.from(selectedConfirmations),
      );
      toast.success(`${result.completed} de ${result.processed} procesadas exitosamente`);
      setSelectedConfirmations(new Set());
      await loadData();
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessingAction(false);
    }
  };

  const handleProcessAll = async () => {
    if (!confirm('Procesar TODAS las confirmaciones pendientes?')) return;

    try {
      setProcessingAction(true);
      const result = await reservoConfirmationsApi.processAll(clientId);
      toast.success(
        `Procesadas: ${result.processed}, Completadas: ${result.completed}, Fallidas: ${result.failed}`,
      );
      await loadData();
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessingAction(false);
    }
  };

  // ============================================
  // GHL SETUP
  // ============================================

  const handleSetupGHL = async () => {
    try {
      const result = await reservoConfirmationsApi.setupGHL(clientId);
      if (result.success) {
        toast.success(`Setup GHL completado. Creados: ${result.created.length}`);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleValidateGHL = async () => {
    try {
      const result = await reservoConfirmationsApi.validateGHL(clientId);
      if (result.valid) {
        toast.success('Todos los custom fields estan configurados');
      } else {
        toast.error(`Faltan ${result.missing.length} campos: ${result.missing.join(', ')}`);
      }
    } catch (error: any) {
      toast.error('Error: ' + (error.response?.data?.message || error.message));
    }
  };

  // ============================================
  // SELECTION
  // ============================================

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedConfirmations);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedConfirmations(newSelection);
  };

  const selectAllPending = () => {
    const pendingIds = filteredPending
      .filter((p) => p.status === ReservoConfirmationStatus.PENDING)
      .map((p) => p.id);
    setSelectedConfirmations(new Set(pendingIds));
  };

  const clearSelection = () => {
    setSelectedConfirmations(new Set());
  };

  // ============================================
  // FILTERING
  // ============================================

  const filteredPending = pending.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterDate && p.appointmentData.fecha !== filterDate) return false;
    return true;
  });

  // ============================================
  // STATUS HELPERS
  // ============================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case ReservoConfirmationStatus.PENDING:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <FiClock className="mr-1" /> Pendiente
          </span>
        );
      case ReservoConfirmationStatus.PROCESSING:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <FiLoader className="mr-1 animate-spin" /> Procesando
          </span>
        );
      case ReservoConfirmationStatus.COMPLETED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <FiCheckCircle className="mr-1" /> Completada
          </span>
        );
      case ReservoConfirmationStatus.FAILED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <FiXCircle className="mr-1" /> Fallida
          </span>
        );
      default:
        return <span className="text-gray-500">{status}</span>;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <FiLoader className="animate-spin text-3xl text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <FiArrowLeft className="mr-1" /> Volver al cliente
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Confirmaciones Reservo
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {client?.name} - Confirmaciones automaticas de citas desde Reservo via GHL
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleValidateGHL}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiCheckCircle className="mr-1" /> Validar GHL
              </button>
              <button
                onClick={handleSetupGHL}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                <FiSettings className="mr-1" /> Configurar GHL
              </button>
            </div>
          </div>
        </div>

        {/* Info banner: Reservo states */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <FiAlertCircle className="text-purple-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-purple-700">
              <p className="font-medium">Estados de cita en Reservo</p>
              <p className="mt-1">
                Reservo usa estados fijos:{' '}
                <span className="font-medium">NC</span> (No Confirmado),{' '}
                <span className="font-medium">C</span> (Confirmado),{' '}
                <span className="font-medium">S</span> (Suspendido).
                El sistema obtiene automaticamente las citas con estado NC y las marca como C
                despues de sincronizar con GHL.
              </p>
            </div>
          </div>
        </div>

        {/* Configurations Section */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Configuraciones ({configs.length}/3)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleTrigger()}
                disabled={triggeringConfig !== null || configs.length === 0}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {triggeringConfig === 'all' ? (
                  <FiLoader className="animate-spin mr-1" />
                ) : (
                  <FiPlay className="mr-1" />
                )}
                Obtener Citas
              </button>
              {configs.length < 3 && (
                <button
                  onClick={startCreating}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                >
                  <FiPlus className="mr-1" /> Nueva Config
                </button>
              )}
            </div>
          </div>

          {/* Config list */}
          <div className="divide-y divide-gray-200">
            {configs.map((config) => (
              <div
                key={config.id}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        config.isEnabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      #{config.order}
                    </span>
                    <span className="font-medium text-gray-900">{config.name}</span>
                    <span className="text-sm text-gray-500">
                      {config.daysBeforeAppointment === 0
                        ? 'Mismo dia'
                        : `${config.daysBeforeAppointment} dia${config.daysBeforeAppointment > 1 ? 's' : ''} antes`}{' '}
                      a las {config.timeToSend}
                    </span>
                    {!config.isEnabled && (
                      <span className="text-xs text-red-500 font-medium">Deshabilitada</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTrigger(config.id)}
                    disabled={triggeringConfig !== null}
                    className="p-1.5 text-gray-400 hover:text-purple-600 disabled:opacity-50"
                    title="Obtener citas para esta config"
                  >
                    {triggeringConfig === config.id ? (
                      <FiLoader className="animate-spin" />
                    ) : (
                      <FiClock />
                    )}
                  </button>
                  <button
                    onClick={() => startEditing(config)}
                    className="p-1.5 text-gray-400 hover:text-blue-600"
                    title="Editar"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    onClick={() => handleDeleteConfig(config.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Eliminar"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
            {configs.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                No hay configuraciones. Crea una para empezar.
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Form */}
        {(isCreating || isEditing) && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {isEditing ? 'Editar Configuracion' : 'Nueva Configuracion'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Recordatorio 24h antes"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GHL Calendar ID
                  </label>
                  <input
                    type="text"
                    value={formData.ghlCalendarId}
                    onChange={(e) => setFormData({ ...formData, ghlCalendarId: e.target.value })}
                    placeholder="ID del calendario en GoHighLevel"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dias antes de la cita
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.daysBeforeAppointment}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        daysBeforeAppointment: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de envio
                  </label>
                  <input
                    type="time"
                    value={formData.timeToSend}
                    onChange={(e) => setFormData({ ...formData, timeToSend: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orden (1-3)
                  </label>
                  <select
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isEnabled}
                      onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Habilitada</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={cancelForm}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiX className="mr-1" /> Cancelar
                </button>
                <button
                  onClick={isEditing ? handleUpdateConfig : handleCreateConfig}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                >
                  <FiSave className="mr-1" /> {isEditing ? 'Guardar Cambios' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Confirmations Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Confirmaciones Pendientes ({filteredPending.length})
              </h2>
              <div className="flex gap-2">
                {selectedConfirmations.size > 0 && (
                  <button
                    onClick={handleProcessSelected}
                    disabled={processingAction}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  >
                    {processingAction ? (
                      <FiLoader className="animate-spin mr-1" />
                    ) : (
                      <FiPlay className="mr-1" />
                    )}
                    Procesar Seleccionadas ({selectedConfirmations.size})
                  </button>
                )}
                <button
                  onClick={handleProcessAll}
                  disabled={processingAction || filteredPending.filter(p => p.status === ReservoConfirmationStatus.PENDING).length === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Procesar Todas
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-3 flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">Todos los estados</option>
                <option value={ReservoConfirmationStatus.PENDING}>Pendiente</option>
                <option value={ReservoConfirmationStatus.PROCESSING}>Procesando</option>
                <option value={ReservoConfirmationStatus.COMPLETED}>Completada</option>
                <option value={ReservoConfirmationStatus.FAILED}>Fallida</option>
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
              />
              {(filterStatus !== 'all' || filterDate) && (
                <button
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterDate('');
                  }}
                  className="text-sm text-purple-600 hover:text-purple-800"
                >
                  Limpiar filtros
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={selectAllPending}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Seleccionar pendientes
                </button>
                {selectedConfirmations.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Deseleccionar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {/* checkbox */}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Paciente / Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID Cita
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha / Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Profesional
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sucursal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Envio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPending.map((confirmation) => (
                  <tr key={confirmation.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      {confirmation.status === ReservoConfirmationStatus.PENDING && (
                        <input
                          type="checkbox"
                          checked={selectedConfirmations.has(confirmation.id)}
                          onChange={() => toggleSelection(confirmation.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {confirmation.appointmentData.nombre_paciente}
                      </div>
                      <div className="text-xs text-gray-500">
                        {confirmation.appointmentData.telefono_paciente && (
                          <span className="mr-2">{confirmation.appointmentData.telefono_paciente}</span>
                        )}
                        {confirmation.appointmentData.email_paciente && (
                          <span>{confirmation.appointmentData.email_paciente}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <span className="font-mono text-xs">
                        {confirmation.reservoAppointmentUuid.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {confirmation.appointmentData.fecha}
                      </div>
                      <div className="text-xs text-gray-500">
                        {confirmation.appointmentData.hora_inicio}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {confirmation.appointmentData.nombre_profesional}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {confirmation.appointmentData.nombre_sucursal}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(confirmation.scheduledFor).toLocaleString('es-CL', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(confirmation.status)}
                      {confirmation.status === ReservoConfirmationStatus.FAILED &&
                        confirmation.errorMessage && (
                          <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate">
                            {confirmation.errorMessage}
                          </div>
                        )}
                      {confirmation.attempts > 0 && confirmation.status !== ReservoConfirmationStatus.COMPLETED && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Intentos: {confirmation.attempts}/3
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPending.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No hay confirmaciones pendientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

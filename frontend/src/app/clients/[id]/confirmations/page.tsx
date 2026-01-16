'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  clientsApi,
  appointmentConfirmationsApi,
  Client,
  ConfirmationConfig,
  PendingConfirmation,
  ConfirmationStatus,
  CreateConfirmationConfigDto,
  AppointmentState,
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
  FiChevronDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// Utilidades para mejorar colores
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// Oscurecer color para hacerlo más vibrante y visible
const darkenColor = (hex: string, factor: number = 0.4): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  // Calcular la luminosidad del color
  const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  // Si el color es muy claro (luminosidad > 0.7), oscurecerlo más
  const adjustedFactor = luminosity > 0.7 ? factor * 1.5 : factor;
  
  return rgbToHex(
    Math.max(0, rgb.r * (1 - adjustedFactor)),
    Math.max(0, rgb.g * (1 - adjustedFactor)),
    Math.max(0, rgb.b * (1 - adjustedFactor))
  );
};

// Calcular si el texto debe ser blanco o negro basado en el contraste
const getContrastTextColor = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  
  // Calcular luminosidad (YIQ)
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  
  // Si la luminosidad es mayor a 128, usar negro, si no, blanco
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

// Obtener color mejorado y color de texto apropiado
const getImprovedColors = (originalColor: string): { bg: string; text: string } => {
  const improvedBg = darkenColor(originalColor);
  const textColor = getContrastTextColor(improvedBg);
  return { bg: improvedBg, text: textColor };
};

export default function AppointmentConfirmationsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [configs, setConfigs] = useState<ConfirmationConfig[]>([]);
  const [pending, setPending] = useState<PendingConfirmation[]>([]);
  const [appointmentStates, setAppointmentStates] = useState<AppointmentState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfirmationConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    estado: 'all',
    fecha: '',
    status: 'all',
  });

  // Form state
  const [formData, setFormData] = useState<CreateConfirmationConfigDto>({
    name: '',
    daysBeforeAppointment: 1,
    timeToSend: '09:00',
    ghlCalendarId: '',
    appointmentStates: [7],
    isEnabled: true,
    order: 1,
  });

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.states-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientData, configsData, pendingData, statesData] = await Promise.all([
        clientsApi.getById(clientId),
        appointmentConfirmationsApi.getConfigs(clientId),
        appointmentConfirmationsApi.getPending(clientId),
        appointmentConfirmationsApi.getAppointmentStates(clientId),
      ]);
      setClient(clientData);
      setConfigs(configsData);
      setPending(pendingData);
      setAppointmentStates(statesData);
    } catch (error) {
      toast.error('Error al cargar los datos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async () => {
    if (!formData.name || !formData.ghlCalendarId) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    if (configs.length >= 3) {
      toast.error('Solo se permiten hasta 3 configuraciones');
      return;
    }

    try {
      await appointmentConfirmationsApi.createConfig(clientId, formData);
      toast.success('Configuración creada exitosamente');
      setIsCreating(false);
      setIsDropdownOpen(false);
      setFormData({
        name: '',
        daysBeforeAppointment: 1,
        timeToSend: '09:00',
        ghlCalendarId: '',
        appointmentStates: [7],
        isEnabled: true,
        order: configs.length + 1,
      });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al crear configuración');
      console.error(error);
    }
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return;

    try {
      await appointmentConfirmationsApi.updateConfig(clientId, editingConfig.id, {
        name: formData.name,
        daysBeforeAppointment: formData.daysBeforeAppointment,
        timeToSend: formData.timeToSend,
        ghlCalendarId: formData.ghlCalendarId,
        appointmentStates: formData.appointmentStates,
        isEnabled: formData.isEnabled,
      });
      toast.success('Configuración actualizada exitosamente');
      setIsEditing(false);
      setEditingConfig(null);
      setIsDropdownOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar configuración');
      console.error(error);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta configuración?')) return;

    try {
      await appointmentConfirmationsApi.deleteConfig(clientId, configId);
      toast.success('Configuración eliminada');
      await loadData();
    } catch (error) {
      toast.error('Error al eliminar configuración');
      console.error(error);
    }
  };

  const handleTrigger = async (configId?: string) => {
    try {
      const result = await appointmentConfirmationsApi.trigger(clientId, {
        confirmationConfigId: configId,
      });
      toast.success(`${result.stored} citas almacenadas para confirmación`);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al disparar confirmaciones');
      console.error(error);
    }
  };

  const handleProcess = async () => {
    if (!confirm('¿Procesar todas las confirmaciones pendientes ahora? Esto sincronizará las citas con GoHighLevel inmediatamente.')) {
      return;
    }

    try {
      const result = await appointmentConfirmationsApi.process(clientId);
      toast.success(
        `Procesadas: ${result.processed} | Exitosas: ${result.completed} | Fallidas: ${result.failed}`
      );
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al procesar confirmaciones');
      console.error(error);
    }
  };

  const handleSetupGHL = async () => {
    if (!confirm('¿Configurar custom fields en GoHighLevel? Esto creará los 8 custom fields necesarios si no existen.')) {
      return;
    }

    try {
      const result = await appointmentConfirmationsApi.setupGHL(clientId);
      
      if (result.success) {
        const messages = [];
        if (result.totalCreated > 0) {
          messages.push(`Creados: ${result.totalCreated}`);
        }
        if (result.totalExisting > 0) {
          messages.push(`Existentes: ${result.totalExisting}`);
        }
        if (result.errors.length > 0) {
          messages.push(`Errores: ${result.errors.length}`);
        }
        
        toast.success(`Setup completado. ${messages.join(' | ')}`);
        
        if (result.errors.length > 0) {
          console.error('Errores durante setup:', result.errors);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al configurar GHL');
      console.error(error);
    }
  };

  const handleValidateGHL = async () => {
    try {
      const result = await appointmentConfirmationsApi.validateGHL(clientId);
      
      if (result.valid) {
        toast.success('✅ Todos los custom fields están configurados correctamente');
      } else {
        toast.error(`Faltan ${result.missing.length} custom fields: ${result.missing.join(', ')}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al validar GHL');
      console.error(error);
    }
  };

  const startEditing = (config: ConfirmationConfig) => {
    setEditingConfig(config);
    const stateIds = config.appointmentStates.split(',').map(id => parseInt(id.trim(), 10));
    setFormData({
      name: config.name,
      daysBeforeAppointment: config.daysBeforeAppointment,
      timeToSend: config.timeToSend,
      ghlCalendarId: config.ghlCalendarId,
      appointmentStates: stateIds,
      isEnabled: config.isEnabled,
      order: config.order,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingConfig(null);
    setIsCreating(false);
    setIsDropdownOpen(false);
    setFormData({
      name: '',
      daysBeforeAppointment: 1,
      timeToSend: '09:00',
      ghlCalendarId: '',
      appointmentStates: [7],
      isEnabled: true,
      order: configs.length + 1,
    });
  };

  const getStatusIcon = (status: ConfirmationStatus) => {
    switch (status) {
      case ConfirmationStatus.COMPLETED:
        return <FiCheckCircle className="text-green-600" />;
      case ConfirmationStatus.FAILED:
        return <FiXCircle className="text-red-600" />;
      case ConfirmationStatus.PROCESSING:
        return <FiLoader className="text-blue-600 animate-spin" />;
      default:
        return <FiClock className="text-yellow-600" />;
    }
  };

  const getStatusColor = (status: ConfirmationStatus) => {
    switch (status) {
      case ConfirmationStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case ConfirmationStatus.FAILED:
        return 'bg-red-100 text-red-800';
      case ConfirmationStatus.PROCESSING:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Filtrar citas pendientes
  const filteredPending = pending.filter(item => {
    if (filters.estado !== 'all' && item.appointmentData.id_estado !== parseInt(filters.estado)) {
      return false;
    }
    if (filters.fecha && item.appointmentData.fecha !== filters.fecha) {
      return false;
    }
    if (filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }
    return true;
  });

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

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500">Cliente no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft className="mr-2" />
            Volver a Cliente
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirmaciones de Citas</h1>
          <p className="text-gray-600 mb-4">
            Configura hasta 3 confirmaciones automáticas para sincronizar citas con GoHighLevel
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <div className="flex items-start">
              <FiAlertCircle className="text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>Recomendación:</strong> Lo ideal es que las confirmaciones sean enviadas a
                primera hora en la mañana para maximizar la tasa de respuesta.
              </p>
            </div>
          </div>

          {client.ghlEnabled && (
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start flex-1">
                  <FiSettings className="text-purple-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-purple-900 mb-1">
                      Configuración de GoHighLevel
                    </p>
                    <p className="text-sm text-purple-800">
                      Asegúrate de que los 8 custom fields necesarios estén configurados en GHL antes de usar las confirmaciones.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={handleValidateGHL}
                    className="inline-flex items-center px-3 py-1.5 border border-purple-300 text-xs font-medium rounded-md text-purple-700 bg-white hover:bg-purple-50"
                    title="Validar custom fields"
                  >
                    <FiCheckCircle className="mr-1.5" size={14} />
                    Validar
                  </button>
                  <button
                    onClick={handleSetupGHL}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                    title="Configurar custom fields automáticamente"
                  >
                    <FiSettings className="mr-1.5" size={14} />
                    Configurar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Estado de Confirmación para endpoint "Confirmar Cita" */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Estado de Confirmación de Citas
              </h2>
              <p className="text-sm text-gray-600">
                Configura el estado que se aplicará al usar el endpoint "Confirmar Cita"
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await appointmentConfirmationsApi.createBookysConfirmationState(clientId);
                  
                  if (result.alreadyExists) {
                    toast.success(`El estado ya existe (ID: ${result.state.id})`);
                  } else {
                    toast.success(`Estado "${result.state.nombre}" creado exitosamente (ID: ${result.state.id})`);
                  }
                  
                  // Recargar datos para mostrar el nuevo estado
                  await loadData();
                  
                  // Seleccionar automáticamente el estado creado
                  await clientsApi.update(clientId, { confirmationStateId: result.state.id });
                  await loadData();
                  
                } catch (error: any) {
                  toast.error(error.response?.data?.message || 'Error al crear el estado');
                  console.error(error);
                }
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              title="Crea automáticamente el estado 'Confirmado por Bookys'"
            >
              <FiPlus className="mr-2" />
              Crear Estado Bookys
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
            <div className="flex items-start">
              <FiAlertCircle className="text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Este estado se usa cuando confirmas una cita a través del endpoint <code className="bg-amber-100 px-1.5 py-0.5 rounded">POST /appointments/confirm</code>. 
                Si no lo configuras, el endpoint no estará disponible.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado de Confirmación
              </label>
              <select
                value={client.confirmationStateId || ''}
                onChange={async (e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                  try {
                    await clientsApi.update(clientId, { confirmationStateId: value });
                    toast.success('Estado de confirmación actualizado');
                    await loadData();
                  } catch (error: any) {
                    toast.error(error.response?.data?.message || 'Error al actualizar');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sin configurar</option>
                {appointmentStates.map((state) => {
                  const colors = getImprovedColors(state.color);
                  return (
                    <option key={state.id} value={state.id}>
                      {state.nombre} (ID: {state.id})
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selecciona el estado que se aplicará al confirmar citas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado Actual
              </label>
              {client.confirmationStateId ? (
                (() => {
                  const currentState = appointmentStates.find(s => s.id === client.confirmationStateId);
                  if (currentState) {
                    const colors = getImprovedColors(currentState.color);
                    return (
                      <div className="flex items-center space-x-3">
                        <span
                          className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {currentState.nombre}
                        </span>
                        <span className="text-sm text-gray-600">
                          (ID: {currentState.id})
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="text-sm text-gray-500 py-2">
                      Estado no encontrado
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center space-x-2 py-2">
                  <FiAlertCircle className="text-amber-500" />
                  <span className="text-sm text-amber-700">
                    No configurado - El endpoint "Confirmar Cita" no estará disponible
                  </span>
                </div>
              )}
            </div>
          </div>

          {client.confirmationStateId && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start">
                <FiCheckCircle className="text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  <strong>Listo para usar:</strong> El endpoint "Confirmar Cita" está configurado correctamente. 
                  Cuando lo uses, las citas cambiarán automáticamente al estado "{appointmentStates.find(s => s.id === client.confirmationStateId)?.nombre}" 
                  y se agregará el comentario "Confirmado por Bookys".
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Configuraciones */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Configuraciones ({configs.length}/3)
            </h2>
            {configs.length < 3 && !isCreating && !isEditing && (
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                <FiPlus className="mr-2" />
                Nueva Configuración
              </button>
            )}
          </div>

          {/* Form for create/edit */}
          {(isCreating || isEditing) && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-primary-200">
              <h3 className="text-lg font-semibold mb-4">
                {isEditing ? 'Editar Configuración' : 'Nueva Configuración'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Confirmación 24h antes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días antes de la cita
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.daysBeforeAppointment}
                    onChange={(e) =>
                      setFormData({ ...formData, daysBeforeAppointment: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora de envío (formato 24h)
                  </label>
                  <input
                    type="time"
                    value={formData.timeToSend}
                    onChange={(e) => setFormData({ ...formData, timeToSend: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GHL Calendar ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ghlCalendarId}
                    onChange={(e) => setFormData({ ...formData, ghlCalendarId: e.target.value })}
                    placeholder="ID del calendario de GoHighLevel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estados de Cita a Confirmar <span className="text-red-500">*</span>
                  </label>
                  
                  {/* Tags seleccionados */}
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[42px] p-2 border border-gray-300 rounded-md bg-gray-50">
                    {formData.appointmentStates && formData.appointmentStates.length > 0 ? (
                      formData.appointmentStates.map(stateId => {
                        const state = appointmentStates.find(s => s.id === stateId);
                        if (!state) return null;
                        const colors = getImprovedColors(state.color);
                        return (
                          <span
                            key={stateId}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium shadow-md"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            {state.nombre}
                            <button
                              type="button"
                              onClick={() => {
                                const newStates = formData.appointmentStates!.filter(id => id !== stateId);
                                setFormData({ ...formData, appointmentStates: newStates.length > 0 ? newStates : [7] });
                              }}
                              className="ml-2 hover:bg-black/20 rounded-full p-0.5"
                            >
                              <FiX className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-gray-400 text-sm">Selecciona al menos un estado...</span>
                    )}
                  </div>

                  {/* Dropdown para agregar estados */}
                  <div className="relative states-dropdown-container">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-700">Agregar estados</span>
                      <FiChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {appointmentStates.filter(state => !formData.appointmentStates?.includes(state.id)).length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            Todos los estados están seleccionados
                          </div>
                        ) : (
                          appointmentStates
                            .filter(state => !formData.appointmentStates?.includes(state.id))
                            .map(state => {
                              const colors = getImprovedColors(state.color);
                              return (
                                <button
                                  key={state.id}
                                  type="button"
                                  onClick={() => {
                                    const newStates = [...(formData.appointmentStates || []), state.id];
                                    setFormData({ ...formData, appointmentStates: newStates });
                                    setIsDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <span
                                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm border border-gray-200"
                                    style={{ backgroundColor: colors.bg }}
                                  />
                                  <span className="text-sm text-gray-900">{state.nombre}</span>
                                </button>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-1">
                    Haz clic en &quot;Agregar estados&quot; para seleccionar, y en la X para eliminar
                  </p>
                </div>

                <div className="md:col-span-2 flex items-center">
                  <input
                    type="checkbox"
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isEnabled" className="ml-2 block text-sm text-gray-900">
                    Habilitar esta configuración
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={cancelEditing}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiX className="mr-2" />
                  Cancelar
                </button>
                <button
                  onClick={isEditing ? handleUpdateConfig : handleCreateConfig}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <FiSave className="mr-2" />
                  {isEditing ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          )}

          {/* List of configs */}
          {configs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay configuraciones creadas</p>
              <p className="text-sm text-gray-400 mt-2">
                Crea tu primera configuración para empezar
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            config.isEnabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {config.isEnabled ? 'Activa' : 'Inactiva'}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          Orden {config.order}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          📅 <strong>Enviar:</strong> {config.daysBeforeAppointment} día
                          {config.daysBeforeAppointment !== 1 ? 's' : ''} antes a las{' '}
                          {config.timeToSend}
                        </p>
                        <p>
                          📆 <strong>Calendario GHL:</strong>{' '}
                          <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {config.ghlCalendarId}
                          </code>
                        </p>
                        <p className="flex items-center flex-wrap gap-1">
                          🏥 <strong className="mr-2">Estados:</strong>
                          {config.appointmentStates.split(',').map(id => {
                            const state = appointmentStates.find(s => s.id === parseInt(id.trim()));
                            if (!state) return null;
                            const colors = getImprovedColors(state.color);
                            return (
                              <span
                                key={id}
                                className="px-2 py-1 rounded text-xs font-medium shadow-sm"
                                style={{ backgroundColor: colors.bg, color: colors.text }}
                              >
                                {state.nombre}
                              </span>
                            );
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTrigger(config.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                        title="Ejecutar manualmente"
                      >
                        <FiClock size={18} />
                      </button>
                      <button
                        onClick={() => startEditing(config)}
                        disabled={isEditing || isCreating}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
                        title="Editar"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(config.id)}
                        disabled={isEditing || isCreating}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                        title="Eliminar"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Citas Pendientes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Citas Pendientes ({filteredPending.length}{filteredPending.length !== pending.length && ` de ${pending.length}`})
            </h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleTrigger()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                title="Obtener citas de Dentalink y almacenarlas como pendientes"
              >
                <FiClock className="mr-2" />
                Obtener Citas
              </button>
              <button
                onClick={handleProcess}
                disabled={pending.length === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Procesar y sincronizar con GoHighLevel ahora (para testing)"
              >
                <FiCheckCircle className="mr-2" />
                Procesar Pendientes ({pending.filter(p => p.status === ConfirmationStatus.PENDING).length})
              </button>
            </div>
          </div>

          {/* Filtros */}
          {pending.length > 0 && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Filtrar por Estado de Cita
                </label>
                <select
                  value={filters.estado}
                  onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">Todos los estados</option>
                  {appointmentStates.map(state => (
                    <option key={state.id} value={state.id}>{state.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Filtrar por Fecha de Cita
                </label>
                <input
                  type="date"
                  value={filters.fecha}
                  onChange={(e) => setFilters({ ...filters, fecha: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Filtrar por Estado de Proceso
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="processing">Procesando</option>
                  <option value="completed">Completado</option>
                  <option value="failed">Fallido</option>
                </select>
              </div>
            </div>
          )}

          {pending.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay citas pendientes de confirmación</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paciente / Contacto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Cita
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha / Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado Cita
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dentista
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Envío
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado Proceso
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPending.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {item.appointmentData.nombre_paciente}
                        </div>
                        {item.appointmentData.telefono_paciente && (
                          <div className="text-xs text-gray-600">
                            📱 {item.appointmentData.telefono_paciente}
                          </div>
                        )}
                        {item.appointmentData.email_paciente && (
                          <div className="text-xs text-gray-600">
                            ✉️ {item.appointmentData.email_paciente}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">
                          #{item.appointmentData.id_paciente}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.appointmentData.fecha.split('-').reverse().join('/')}
                        </div>
                        <div className="text-xs text-gray-600">
                          ⏰ {item.appointmentData.hora_inicio}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const state = appointmentStates.find(
                            s => s.id === item.appointmentData.id_estado
                          );
                          const originalColor = state?.color || '#6b7280';
                          const colors = getImprovedColors(originalColor);
                          return (
                            <span
                              className="px-2 py-1 rounded text-xs font-medium shadow-sm"
                              style={{
                                backgroundColor: colors.bg,
                                color: colors.text
                              }}
                            >
                              {item.appointmentData.estado_cita}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {item.appointmentData.nombre_dentista}
                        </div>
                        <div className="text-xs text-gray-600">
                          {item.appointmentData.nombre_sucursal}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {new Date(item.scheduledFor).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            item.status,
                          )}`}
                        >
                          <span className="mr-1">{getStatusIcon(item.status)}</span>
                          {item.status}
                        </span>
                        {item.errorMessage && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={item.errorMessage}>
                            {item.errorMessage}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

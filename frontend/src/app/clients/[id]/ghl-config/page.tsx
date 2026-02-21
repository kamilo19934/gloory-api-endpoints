'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  clientsApi,
  ghlApi,
  Client,
  GHLBranchResponse,
  GHLCalendarResponse,
  GHLStats,
  IntegrationType,
} from '@/lib/api';
import {
  FiArrowLeft,
  FiLoader,
  FiRefreshCw,
  FiMapPin,
  FiUser,
  FiPhone,
  FiClock,
  FiEdit2,
  FiCheck,
  FiX,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function GHLConfigPage() {
  const params = useParams();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [branches, setBranches] = useState<GHLBranchResponse[]>([]);
  const [calendars, setCalendars] = useState<GHLCalendarResponse[]>([]);
  const [stats, setStats] = useState<GHLStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Branch creation form
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchForm, setBranchForm] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    ciudad: '',
    comuna: '',
  });
  const [savingBranch, setSavingBranch] = useState(false);

  // Branch editing
  const [editingBranch, setEditingBranch] = useState<number | null>(null);
  const [editBranchForm, setEditBranchForm] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    ciudad: '',
    comuna: '',
  });

  // Calendar assignment
  const [assigningCalendar, setAssigningCalendar] = useState<number | null>(null);
  const [selectedBranches, setSelectedBranches] = useState<number[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [clientData, branchesData, calendarsData, statsData] = await Promise.all([
        clientsApi.getById(clientId),
        ghlApi.getAllBranches(clientId),
        ghlApi.getAllCalendars(clientId),
        ghlApi.getStats(clientId),
      ]);
      setClient(clientData);
      setBranches(branchesData);
      setCalendars(calendarsData);
      setStats(statsData);
    } catch (error) {
      toast.error('Error al cargar los datos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId, loadData]);

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const result = await ghlApi.testConnection(clientId);
      if (result.connected) {
        toast.success(`Conexion exitosa - ${result.calendars} calendarios encontrados`);
      } else {
        toast.error(result.message || 'No se pudo conectar con GoHighLevel');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al probar la conexion');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await ghlApi.sync(clientId);
      toast.success(result.mensaje, { duration: 5000 });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  // Branch CRUD
  const handleCreateBranch = async () => {
    if (!branchForm.nombre.trim()) {
      toast.error('El nombre de la sede es obligatorio');
      return;
    }
    try {
      setSavingBranch(true);
      await ghlApi.createBranch(clientId, {
        nombre: branchForm.nombre.trim(),
        direccion: branchForm.direccion.trim() || undefined,
        telefono: branchForm.telefono.trim() || undefined,
        ciudad: branchForm.ciudad.trim() || undefined,
        comuna: branchForm.comuna.trim() || undefined,
      });
      toast.success('Sede creada exitosamente');
      setBranchForm({ nombre: '', direccion: '', telefono: '', ciudad: '', comuna: '' });
      setShowBranchForm(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al crear sede');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleUpdateBranch = async (branchId: number) => {
    try {
      await ghlApi.updateBranch(clientId, branchId, {
        nombre: editBranchForm.nombre.trim() || undefined,
        direccion: editBranchForm.direccion.trim() || undefined,
        telefono: editBranchForm.telefono.trim() || undefined,
        ciudad: editBranchForm.ciudad.trim() || undefined,
        comuna: editBranchForm.comuna.trim() || undefined,
      });
      toast.success('Sede actualizada');
      setEditingBranch(null);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar sede');
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta sede?')) return;
    try {
      await ghlApi.deleteBranch(clientId, branchId);
      toast.success('Sede eliminada');
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al eliminar sede');
    }
  };

  const handleToggleBranch = async (branch: GHLBranchResponse) => {
    try {
      const newStatus = !branch.activa;
      await ghlApi.toggleBranch(clientId, branch.id, newStatus);
      setBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, activa: newStatus } : b)),
      );
      toast.success(`Sede ${newStatus ? 'activada' : 'desactivada'}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cambiar estado');
    }
  };

  // Calendar actions
  const handleToggleCalendar = async (calendar: GHLCalendarResponse) => {
    try {
      const newStatus = !calendar.activo;
      await ghlApi.toggleCalendar(clientId, calendar.id, newStatus);
      setCalendars((prev) =>
        prev.map((c) => (c.id === calendar.id ? { ...c, activo: newStatus } : c)),
      );
      toast.success(`Calendario ${newStatus ? 'activado' : 'desactivado'}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cambiar estado');
    }
  };

  const handleSpecialtyUpdate = async (calendar: GHLCalendarResponse, newSpecialty: string) => {
    try {
      await ghlApi.updateCalendarSpecialty(clientId, calendar.id, newSpecialty);
      setCalendars((prev) =>
        prev.map((c) => (c.id === calendar.id ? { ...c, especialidad: newSpecialty } : c)),
      );
      toast.success('Especialidad actualizada');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar');
    }
  };

  const handleAssignBranches = async (calendarId: number) => {
    try {
      await ghlApi.assignCalendarToBranches(clientId, calendarId, selectedBranches);
      toast.success('Sedes asignadas');
      setAssigningCalendar(null);
      setSelectedBranches([]);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al asignar sedes');
    }
  };

  const startAssigning = (calendar: GHLCalendarResponse) => {
    setAssigningCalendar(calendar.id);
    setSelectedBranches(calendar.branches || []);
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

  const needsSync = calendars.length === 0;

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
            Volver a {client.name}
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Configuracion GoHighLevel
              </h1>
              <p className="text-gray-600 mt-2">
                Calendarios, sedes y asignaciones de <strong>{client.name}</strong>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {testingConnection ? (
                  <>
                    <FiLoader className="animate-spin mr-2" />
                    Probando...
                  </>
                ) : (
                  'Probar Conexion'
                )}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <FiLoader className="animate-spin mr-2" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <FiRefreshCw className="mr-2" />
                    Sincronizar Calendarios
                  </>
                )}
              </button>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-orange-700">{stats.totalCalendarios}</p>
                <p className="text-sm text-orange-600">Calendarios</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-700">{stats.calendariosActivos}</p>
                <p className="text-sm text-green-600">Activos</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-700">{stats.totalSedes}</p>
                <p className="text-sm text-blue-600">Sedes</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-emerald-700">{stats.sedesActivas}</p>
                <p className="text-sm text-emerald-600">Sedes Activas</p>
              </div>
            </div>
          )}
        </div>

        {needsSync && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 text-center">
            <FiRefreshCw className="mx-auto text-4xl text-amber-600 mb-4" />
            <h3 className="text-lg font-semibold text-amber-800 mb-2">
              No hay calendarios sincronizados
            </h3>
            <p className="text-amber-700 mb-4">
              Haz clic en &quot;Sincronizar Calendarios&quot; para traer los calendarios desde GoHighLevel.
            </p>
          </div>
        )}

        {/* Sedes Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <FiMapPin className="mr-2 text-blue-600" />
              Sedes ({branches.length})
            </h2>
            <button
              onClick={() => setShowBranchForm(!showBranchForm)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <FiPlus className="mr-1" />
              Nueva Sede
            </button>
          </div>

          {showBranchForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Crear Nueva Sede</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={branchForm.nombre}
                    onChange={(e) => setBranchForm({ ...branchForm, nombre: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nombre de la sede"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                  <input
                    type="text"
                    value={branchForm.direccion}
                    onChange={(e) => setBranchForm({ ...branchForm, direccion: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Direccion"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="text"
                    value={branchForm.telefono}
                    onChange={(e) => setBranchForm({ ...branchForm, telefono: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Telefono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={branchForm.ciudad}
                    onChange={(e) => setBranchForm({ ...branchForm, ciudad: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ciudad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comuna</label>
                  <input
                    type="text"
                    value={branchForm.comuna}
                    onChange={(e) => setBranchForm({ ...branchForm, comuna: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Comuna"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3 mt-4">
                <button
                  onClick={handleCreateBranch}
                  disabled={savingBranch}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingBranch ? <FiLoader className="animate-spin mr-2" /> : <FiCheck className="mr-2" />}
                  Crear Sede
                </button>
                <button
                  onClick={() => setShowBranchForm(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiX className="mr-2" />
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {branches.length === 0 && !showBranchForm ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FiMapPin className="mx-auto text-3xl text-gray-400 mb-3" />
              <p className="text-gray-500">No hay sedes creadas</p>
              <p className="text-sm text-gray-400 mt-1">Crea sedes manualmente para asignar calendarios</p>
            </div>
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`bg-white rounded-lg shadow-sm border p-4 ${
                    !branch.activa ? 'opacity-60' : ''
                  }`}
                >
                  {editingBranch === branch.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editBranchForm.nombre}
                          onChange={(e) => setEditBranchForm({ ...editBranchForm, nombre: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Nombre"
                        />
                        <input
                          type="text"
                          value={editBranchForm.direccion}
                          onChange={(e) => setEditBranchForm({ ...editBranchForm, direccion: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Direccion"
                        />
                        <input
                          type="text"
                          value={editBranchForm.telefono}
                          onChange={(e) => setEditBranchForm({ ...editBranchForm, telefono: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Telefono"
                        />
                        <input
                          type="text"
                          value={editBranchForm.ciudad}
                          onChange={(e) => setEditBranchForm({ ...editBranchForm, ciudad: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Ciudad"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUpdateBranch(branch.id)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <FiCheck className="mr-1" /> Guardar
                        </button>
                        <button
                          onClick={() => setEditingBranch(null)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                        >
                          <FiX className="mr-1" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full mr-3 ${
                            branch.activa ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {branch.nombre}
                            {!branch.activa && (
                              <span className="ml-2 text-xs text-red-500">(Desactivada)</span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {branch.direccion && `${branch.direccion}`}
                            {branch.comuna && `, ${branch.comuna}`}
                            {branch.ciudad && ` - ${branch.ciudad}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {branch.telefono && (
                          <span className="text-sm text-gray-500 flex items-center">
                            <FiPhone className="mr-1" />
                            {branch.telefono}
                          </span>
                        )}
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                          ID: {branch.id}
                        </span>
                        <button
                          onClick={() => {
                            setEditingBranch(branch.id);
                            setEditBranchForm({
                              nombre: branch.nombre || '',
                              direccion: branch.direccion || '',
                              telefono: branch.telefono || '',
                              ciudad: branch.ciudad || '',
                              comuna: branch.comuna || '',
                            });
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar sede"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteBranch(branch.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar sede"
                        >
                          <FiTrash2 size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleBranch(branch)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            branch.activa ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          title={branch.activa ? 'Desactivar sede' : 'Activar sede'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              branch.activa ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendars Section */}
        {calendars.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <FiUser className="mr-2 text-orange-600" />
              Calendarios ({calendars.length})
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Cada calendario de GoHighLevel representa un profesional. Puedes editar la especialidad y asignarlos a sedes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {calendars.map((calendar) => (
                <CalendarCard
                  key={calendar.id}
                  calendar={calendar}
                  branches={branches}
                  isAssigning={assigningCalendar === calendar.id}
                  selectedBranches={assigningCalendar === calendar.id ? selectedBranches : calendar.branches || []}
                  onToggle={handleToggleCalendar}
                  onUpdateSpecialty={handleSpecialtyUpdate}
                  onStartAssign={() => startAssigning(calendar)}
                  onCancelAssign={() => {
                    setAssigningCalendar(null);
                    setSelectedBranches([]);
                  }}
                  onToggleBranchSelection={(branchId) => {
                    setSelectedBranches((prev) =>
                      prev.includes(branchId)
                        ? prev.filter((id) => id !== branchId)
                        : [...prev, branchId],
                    );
                  }}
                  onSaveAssign={() => handleAssignBranches(calendar.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CalendarCard({
  calendar,
  branches,
  isAssigning,
  selectedBranches,
  onToggle,
  onUpdateSpecialty,
  onStartAssign,
  onCancelAssign,
  onToggleBranchSelection,
  onSaveAssign,
}: {
  calendar: GHLCalendarResponse;
  branches: GHLBranchResponse[];
  isAssigning: boolean;
  selectedBranches: number[];
  onToggle: (calendar: GHLCalendarResponse) => Promise<void>;
  onUpdateSpecialty: (calendar: GHLCalendarResponse, newSpecialty: string) => Promise<void>;
  onStartAssign: () => void;
  onCancelAssign: () => void;
  onToggleBranchSelection: (branchId: number) => void;
  onSaveAssign: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(calendar.especialidad || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (editValue.trim() === (calendar.especialidad || '')) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdateSpecialty(calendar, editValue.trim());
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
        !calendar.activo ? 'opacity-60 bg-gray-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4
            className={`font-semibold ${
              calendar.activo ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            {calendar.nombre}
            {!calendar.activo && (
              <span className="ml-2 text-xs text-red-500">(Desactivado)</span>
            )}
          </h4>

          {/* Specialty editing */}
          {isEditing ? (
            <div className="mt-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Especialidad"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') {
                    setEditValue(calendar.especialidad || '');
                    setIsEditing(false);
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? <FiLoader className="animate-spin mr-1" /> : <FiCheck className="mr-1" />}
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setEditValue(calendar.especialidad || '');
                    setIsEditing(false);
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  <FiX className="mr-1" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center mt-1 group">
              <p className="text-sm text-orange-600 font-medium">
                {calendar.especialidad || (
                  <span className="text-gray-400 italic">Sin especialidad</span>
                )}
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="ml-2 p-1 text-gray-400 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Editar especialidad"
              >
                <FiEdit2 size={14} />
              </button>
            </div>
          )}

          <p className="mt-1 text-xs text-gray-500 flex items-center">
            <FiClock className="mr-1" />
            {calendar.slotDuration} min por slot
          </p>

          {/* Branch assignment */}
          <div className="mt-3">
            {isAssigning ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">Asignar a sedes:</p>
                {branches.length === 0 ? (
                  <p className="text-xs text-gray-400">No hay sedes creadas</p>
                ) : (
                  <div className="space-y-1">
                    {branches.map((branch) => (
                      <label
                        key={branch.id}
                        className="flex items-center space-x-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(branch.id)}
                          onChange={() => onToggleBranchSelection(branch.id)}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-gray-700">{branch.nombre}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={onSaveAssign}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-orange-600 text-white hover:bg-orange-700"
                  >
                    <FiCheck className="mr-1" /> Guardar
                  </button>
                  <button
                    onClick={onCancelAssign}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    <FiX className="mr-1" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {calendar.branches && calendar.branches.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {calendar.branches.map((branchId) => {
                      const branch = branches.find((b) => b.id === branchId);
                      return (
                        <span
                          key={branchId}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700"
                        >
                          {branch ? branch.nombre : `Sede ${branchId}`}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Sin sedes asignadas</p>
                )}
                <button
                  onClick={onStartAssign}
                  className="mt-2 text-xs text-orange-600 hover:text-orange-800 font-medium"
                >
                  <FiMapPin className="inline mr-1" size={12} />
                  Asignar sedes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2 ml-3">
          <span className="text-[10px] px-2 py-0.5 rounded bg-orange-100 text-orange-600">
            ID: {calendar.id}
          </span>
          <button
            onClick={() => onToggle(calendar)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              calendar.activo ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={calendar.activo ? 'Desactivar calendario' : 'Activar calendario'}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                calendar.activo ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { clientsApi, clinicApi, Client, Branch, Professional, ClinicStats } from '@/lib/api';
import {
  FiArrowLeft,
  FiLoader,
  FiRefreshCw,
  FiMapPin,
  FiUser,
  FiPhone,
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiCheck,
  FiX,
  FiToggleLeft,
  FiToggleRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ClinicConfigPage() {
  const params = useParams();
  const clientId = params?.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [stats, setStats] = useState<ClinicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedBranch, setExpandedBranch] = useState<number | null>(null);
  const [branchProfessionals, setBranchProfessionals] = useState<{ [key: number]: Professional[] }>({});
  const [loadingBranch, setLoadingBranch] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Cargar todo incluyendo desactivados para el panel admin
      const [clientData, branchesData, professionalsData, statsData] = await Promise.all([
        clientsApi.getById(clientId),
        clinicApi.getAllBranches(clientId),
        clinicApi.getAllProfessionals(clientId),
        clinicApi.getStats(clientId),
      ]);
      setClient(clientData);
      setBranches(branchesData);
      setProfessionals(professionalsData);
      setStats(statsData);
    } catch (error) {
      toast.error('Error al cargar los datos de la clínica');
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

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await clinicApi.sync(clientId);
      
      // Mostrar mensaje con detalles de la sincronización
      if (result.totalProfesionalesAPI !== undefined) {
        toast.success(
          `${result.mensaje}\n\nTotal en API: ${result.totalSucursalesAPI} sucursales, ${result.totalProfesionalesAPI} profesionales`,
          { duration: 5000 }
        );
      } else {
        toast.success(result.mensaje);
      }
      
      // Limpiar cache de profesionales por sucursal
      setBranchProfessionals({});
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al sincronizar');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleBranchClick = async (branch: Branch) => {
    if (expandedBranch === branch.id) {
      setExpandedBranch(null);
      return;
    }

    setExpandedBranch(branch.id);

    if (branchProfessionals[branch.id]) {
      return;
    }

    try {
      setLoadingBranch(branch.id);
      // Incluir todos para el panel admin
      const profs = await clinicApi.getProfessionalsByBranch(clientId, branch.id, true);
      setBranchProfessionals((prev) => ({
        ...prev,
        [branch.id]: profs,
      }));
    } catch (error) {
      toast.error('Error al cargar profesionales de la sucursal');
      console.error(error);
    } finally {
      setLoadingBranch(null);
    }
  };

  const handleToggleBranch = async (branch: Branch) => {
    try {
      const newStatus = !(branch.activa ?? true);
      await clinicApi.toggleBranch(clientId, branch.id, newStatus);
      
      // Actualizar estado local
      setBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, activa: newStatus } : b))
      );
      
      toast.success(`Sucursal ${newStatus ? 'activada' : 'desactivada'}`);
      
      // Recargar stats
      const statsData = await clinicApi.getStats(clientId);
      setStats(statsData);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cambiar estado');
      console.error(error);
    }
  };

  const handleToggleProfessional = async (professional: Professional) => {
    try {
      const newStatus = !(professional.activo ?? true);
      await clinicApi.toggleProfessional(clientId, professional.id, newStatus);
      
      // Actualizar en la lista principal
      setProfessionals((prev) =>
        prev.map((p) => (p.id === professional.id ? { ...p, activo: newStatus } : p))
      );

      // Actualizar en las listas por sucursal
      setBranchProfessionals((prev) => {
        const updated = { ...prev };
        for (const branchId in updated) {
          updated[branchId] = updated[branchId].map((p) =>
            p.id === professional.id ? { ...p, activo: newStatus } : p
          );
        }
        return updated;
      });
      
      toast.success(`Profesional ${newStatus ? 'activado' : 'desactivado'}`);
      
      // Recargar stats
      const statsData = await clinicApi.getStats(clientId);
      setStats(statsData);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cambiar estado');
      console.error(error);
    }
  };

  const handleSpecialtyUpdate = async (professional: Professional, newSpecialty: string) => {
    try {
      await clinicApi.updateProfessionalSpecialty(clientId, professional.id.toString(), newSpecialty);
      toast.success('Especialidad actualizada');
      
      // Actualizar en la lista principal
      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === professional.id ? { ...p, especialidad: newSpecialty } : p
        )
      );

      // Actualizar en las listas por sucursal
      setBranchProfessionals((prev) => {
        const updated = { ...prev };
        for (const branchId in updated) {
          updated[branchId] = updated[branchId].map((p) =>
            p.id === professional.id ? { ...p, especialidad: newSpecialty } : p
          );
        }
        return updated;
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar');
      console.error(error);
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

  const needsSync = stats?.totalSucursales === 0 && stats?.totalProfesionales === 0;

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

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Configuración Clínica
              </h1>
              <p className="text-gray-600 mt-2">
                Sucursales y profesionales de <strong>{client.name}</strong>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Solo se muestran profesionales habilitados con agenda online
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <FiRefreshCw className="mr-2" />
                  Actualizar desde Dentalink
                </>
              )}
            </button>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-700">{stats.totalSucursales}</p>
                <p className="text-sm text-blue-600">Sucursales</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-700">{stats.sucursalesHabilitadas}</p>
                <p className="text-sm text-green-600">Habilitadas</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-emerald-700">{stats.sucursalesActivas}</p>
                <p className="text-sm text-emerald-600">Activas</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-purple-700">{stats.totalProfesionales}</p>
                <p className="text-sm text-purple-600">Profesionales</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-amber-700">{stats.profesionalesHabilitados}</p>
                <p className="text-sm text-amber-600">Habilitados</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-teal-700">{stats.profesionalesActivos}</p>
                <p className="text-sm text-teal-600">Activos</p>
              </div>
            </div>
          )}
        </div>

        {needsSync && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 text-center">
            <FiRefreshCw className="mx-auto text-4xl text-amber-600 mb-4" />
            <h3 className="text-lg font-semibold text-amber-800 mb-2">
              No hay datos sincronizados
            </h3>
            <p className="text-amber-700 mb-4">
              Haz clic en &quot;Actualizar desde Dentalink&quot; para cargar las sucursales y profesionales.
            </p>
          </div>
        )}

        {branches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <FiMapPin className="mr-2 text-primary-600" />
              Sucursales ({branches.length})
            </h2>

            <div className="space-y-4">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`bg-white rounded-lg shadow-md overflow-hidden ${
                    branch.activa === false ? 'opacity-60' : ''
                  }`}
                >
                  <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <button
                      onClick={() => handleBranchClick(branch)}
                      className="flex items-center flex-1"
                    >
                      <div
                        className={`w-3 h-3 rounded-full mr-3 ${
                          (branch.habilitada ?? true) && (branch.activa ?? true) ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <div className="text-left">
                        <h3 className={`font-semibold ${(branch.activa ?? true) ? 'text-gray-900' : 'text-gray-400'}`}>
                          {branch.nombre}
                          {branch.activa === false && <span className="ml-2 text-xs text-red-500">(Desactivada)</span>}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {branch.direccion && `${branch.direccion}`}
                          {branch.comuna && `, ${branch.comuna}`}
                          {branch.ciudad && ` - ${branch.ciudad}`}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center space-x-4">
                      {branch.telefono && (
                        <span className="text-sm text-gray-500 flex items-center">
                          <FiPhone className="mr-1" />
                          {branch.telefono}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                        ID: {branch.id}
                      </span>
                      {/* Toggle de activación */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBranch(branch);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          (branch.activa ?? true) ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={(branch.activa ?? true) ? 'Desactivar sucursal' : 'Activar sucursal'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            (branch.activa ?? true) ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button onClick={() => handleBranchClick(branch)}>
                        {expandedBranch === branch.id ? (
                          <FiChevronUp className="text-gray-400" />
                        ) : (
                          <FiChevronDown className="text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {expandedBranch === branch.id && (
                    <div className="border-t bg-gray-50 px-6 py-4">
                      <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center">
                        <FiUser className="mr-2" />
                        Profesionales en esta sucursal
                      </h4>

                      {loadingBranch === branch.id ? (
                        <div className="flex justify-center py-4">
                          <FiLoader className="animate-spin text-primary-600" />
                        </div>
                      ) : branchProfessionals[branch.id]?.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">
                          No hay profesionales activos en esta sucursal
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {branchProfessionals[branch.id]?.map((prof) => (
                            <ProfessionalCard
                              key={prof.id}
                              professional={prof}
                              onUpdateSpecialty={handleSpecialtyUpdate}
                              onToggle={handleToggleProfessional}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {professionals.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <FiUser className="mr-2 text-primary-600" />
              Todos los Profesionales Activos ({professionals.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {professionals.map((prof) => (
                <ProfessionalCard
                  key={prof.id}
                  professional={prof}
                  showBranches
                  onUpdateSpecialty={handleSpecialtyUpdate}
                  onToggle={handleToggleProfessional}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ProfessionalCard({
  professional,
  showBranches = false,
  onUpdateSpecialty,
  onToggle,
}: {
  professional: Professional;
  showBranches?: boolean;
  onUpdateSpecialty: (professional: Professional, newSpecialty: string) => Promise<void>;
  onToggle: (professional: Professional) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(professional.especialidad || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (editValue.trim() === professional.especialidad) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onUpdateSpecialty(professional, editValue.trim());
      setIsEditing(false);
    } catch (error) {
      // Error handled in parent
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(professional.especialidad || '');
    setIsEditing(false);
  };

  return (
    <div className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
      professional.activo === false ? 'opacity-60 bg-gray-50' : ''
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className={`font-semibold ${(professional.activo ?? true) ? 'text-gray-900' : 'text-gray-400'}`}>
            {professional.nombre} {professional.apellidos || ''}
            {professional.activo === false && <span className="ml-2 text-xs text-red-500">(Desactivado)</span>}
          </h4>

          {isEditing ? (
            <div className="mt-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Especialidad"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? <FiLoader className="animate-spin mr-1" /> : <FiCheck className="mr-1" />}
                  Guardar
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  <FiX className="mr-1" />
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center mt-1 group">
              <p className="text-sm text-primary-600 font-medium">
                {professional.especialidad || <span className="text-gray-400 italic">Sin especialidad</span>}
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="ml-2 p-1 text-gray-400 hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Editar especialidad"
              >
                <FiEdit2 size={14} />
              </button>
            </div>
          )}

          <div className="mt-2 space-y-1 text-xs text-gray-500">
            {professional.intervalo && (
              <p className="flex items-center">
                <FiClock className="mr-1" />
                {professional.intervalo} min
              </p>
            )}
          </div>

          {showBranches && professional.sucursales && professional.sucursales.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {professional.sucursales.map((branchId) => (
                <span
                  key={branchId}
                  className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700"
                >
                  Suc. {branchId}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end space-y-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            ID: {professional.id}
          </span>
          {/* Toggle de activación */}
          <button
            onClick={() => onToggle(professional)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              (professional.activo ?? true) ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={(professional.activo ?? true) ? 'Desactivar profesional' : 'Activar profesional'}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                (professional.activo ?? true) ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

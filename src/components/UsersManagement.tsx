import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Calendar,
  CheckSquare,
  Square,
  ShieldCheck,
  Truck,
  Factory,
  DollarSign,
  Settings as SettingsIcon,
  RefreshCw,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AppState } from '../types';

export const AVAILABLE_MENUS = [
  // GRUPO 1: RUTAS Y DISTRIBUCIÓN
  { key: 'dashboard', label: 'Ventas', group: 'Rutas', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'planner', label: 'Planificador', group: 'Rutas', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'clientes', label: 'Clientes', group: 'Rutas', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'reports', label: 'Histórico GPS', group: 'Rutas', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'alerts', label: 'Inteligencia', group: 'Rutas', color: 'text-blue-700 bg-blue-50 border-blue-200' },

  // GRUPO 2: PLANTA Y PRODUCCIÓN
  { key: 'production_lines', label: 'Líneas de Producción', group: 'Planta', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { key: 'production', label: 'Empaque', group: 'Planta', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { key: 'supplies_inventory', label: 'Inventario de Insumos', group: 'Planta', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { key: 'production_kpis', label: 'KPIs de Producción', group: 'Planta', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { key: 'purchases', label: 'Compras e Insumos', group: 'Planta', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },

  // GRUPO 3: ADMINISTRACIÓN Y FINANZAS
  { key: 'sales_reports', label: 'Reportes de Venta', group: 'Finanzas', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'commissions', label: 'Nómina y Comisiones', group: 'Finanzas', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'estado_resultados', label: 'Estado de Resultados', group: 'Finanzas', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'contabilidad', label: 'Contabilidad', group: 'Finanzas', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },

  // GRUPO 4: RECURSOS HUMANOS
  { key: 'rh', label: 'Todo RH (Acceso Total)', group: 'Recursos Humanos', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { key: 'recursos_humanos', label: 'Padrón RH', group: 'Recursos Humanos', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { key: 'checadas', label: 'Checadas', group: 'Recursos Humanos', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { key: 'nomina', label: 'Nómina y Recibos', group: 'Recursos Humanos', color: 'text-purple-700 bg-purple-50 border-purple-200' },

  // GRUPO 5: SISTEMA
  { key: 'zones', label: 'Zonas', group: 'Sistema', color: 'text-slate-700 bg-slate-100 border-slate-300' },
  { key: 'settings', label: 'Ajustes', group: 'Sistema', color: 'text-slate-700 bg-slate-100 border-slate-300' }
];

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE/edit?usp=sharing';

export default function UsersManagement({ state, setState }: { state: AppState; setState: any }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    role: 'operator',
    password: '',
    extraMenus: [] as string[],
    extraMenusExpiresAt: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const users = state.users || [];
  const todayStr = new Date().toISOString().slice(0, 10);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const resetForm = () => {
    setEditForm({
      username: '',
      role: 'operator',
      password: '',
      extraMenus: [],
      extraMenusExpiresAt: ''
    });
  };

  const handleSyncSheets = async (action: 'pull' | 'push' = 'pull') => {
    try {
      setSyncingSheets(true);
      const res = await apiFetch('/api/users/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success && data.users) {
        setState((prev: AppState) => ({ ...prev, users: data.users }));
        showToast(data.message || 'Sincronizado con Google Sheets con éxito', 'success');
      } else {
        showToast(data.message || 'Error al sincronizar con Google Sheets', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast('Error de conexión con Google Sheets', 'error');
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.username || !editForm.password) return;
    try {
      setIsSubmitting(true);
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        setState((prev: AppState) => ({ ...prev, users: [...(prev.users || []), data.user] }));
        setIsAdding(false);
        resetForm();
        showToast(`Usuario "${data.user.username}" guardado en la app y en tu Google Sheet`, 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Error al guardar usuario', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      setIsSubmitting(true);
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        setState((prev: AppState) => ({
          ...prev,
          users: prev.users.map((u: any) => (u.id === id ? data.user : u))
        }));
        setEditingId(null);
        resetForm();
        showToast(`Usuario "${data.user.username}" actualizado en la app y en tu Google Sheet`, 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Error al actualizar usuario', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario? Se actualizará también en Google Sheet.')) return;
    try {
      const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setState((prev: AppState) => ({
          ...prev,
          users: prev.users.filter((u: any) => u.id !== id)
        }));
        showToast('Usuario eliminado en la app y en tu Google Sheet', 'success');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({
      username: user.username,
      role: user.role,
      password: user.password,
      extraMenus: user.extraMenus || [],
      extraMenusExpiresAt: user.extraMenusExpiresAt || ''
    });
    setIsAdding(false);
  };

  const toggleMenu = (key: string) => {
    setEditForm(prev => {
      const exists = prev.extraMenus.includes(key);
      return {
        ...prev,
        extraMenus: exists ? prev.extraMenus.filter(m => m !== key) : [...prev.extraMenus, key]
      };
    });
  };

  const roleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return { label: 'Administrador', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'gerencia':
        return { label: 'Gerencia', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'rh':
      case 'recursos_humanos':
        return { label: 'Recursos Humanos', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'supervisor_rutas':
      case 'supervisor':
        return { label: 'Sup. Rutas', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'supervisor_produccion':
        return { label: 'Sup. Producción', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'produccion':
        return { label: 'Producción', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'produccion_linea':
        return { label: 'Línea Planta', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'auxiliar_contable':
        return { label: 'Auxiliar Contable', color: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'operator':
        return { label: 'Chofer Ruta', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      default:
        return { label: r, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const renderExtraMenusForm = () => (
    <div className="w-full mt-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">
            Menús y Funciones Temporales / Adicionales
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            (El rol base se mantiene intacto)
          </span>
        </div>

        {/* Expiration date */}
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600 font-semibold text-[11px]">Válido hasta:</span>
          <input
            type="date"
            value={editForm.extraMenusExpiresAt}
            onChange={e => setEditForm({ ...editForm, extraMenusExpiresAt: e.target.value })}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {editForm.extraMenusExpiresAt && (
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, extraMenusExpiresAt: '' })}
              title="Quitar vencimiento (Hacer permanente)"
              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold ml-1"
            >
              Quitar fecha
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Marca los menús adicionales que esta persona podrá ver y operar. Si especificas una fecha,
        el acceso se desactivará automáticamente después de ese día (ideal para vacaciones o guardias).
      </p>

      {/* Grid of Menus by Group */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
        {/* Rutas */}
        <div className="space-y-1.5 p-2 rounded-lg bg-blue-50/50 border border-blue-100">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-blue-700">
            <Truck className="w-3 h-3" />
            <span>Rutas</span>
          </div>
          <div className="space-y-1">
            {AVAILABLE_MENUS.filter(m => m.group === 'Rutas').map(menu => {
              const checked = editForm.extraMenus.includes(menu.key);
              return (
                <label
                  key={menu.key}
                  onClick={() => toggleMenu(menu.key)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all ${
                    checked
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'hover:bg-blue-100/70 text-slate-700'
                  }`}
                >
                  {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{menu.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Planta */}
        <div className="space-y-1.5 p-2 rounded-lg bg-indigo-50/50 border border-indigo-100">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-700">
            <Factory className="w-3 h-3" />
            <span>Planta y Producción</span>
          </div>
          <div className="space-y-1">
            {AVAILABLE_MENUS.filter(m => m.group === 'Planta').map(menu => {
              const checked = editForm.extraMenus.includes(menu.key);
              return (
                <label
                  key={menu.key}
                  onClick={() => toggleMenu(menu.key)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all ${
                    checked
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-indigo-100/70 text-slate-700'
                  }`}
                >
                  {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{menu.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Finanzas */}
        <div className="space-y-1.5 p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700">
            <DollarSign className="w-3 h-3" />
            <span>Administración</span>
          </div>
          <div className="space-y-1">
            {AVAILABLE_MENUS.filter(m => m.group === 'Finanzas').map(menu => {
              const checked = editForm.extraMenus.includes(menu.key);
              return (
                <label
                  key={menu.key}
                  onClick={() => toggleMenu(menu.key)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all ${
                    checked
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'hover:bg-emerald-100/70 text-slate-700'
                  }`}
                >
                  {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{menu.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Recursos Humanos */}
        <div className="space-y-1.5 p-2 rounded-lg bg-purple-50/50 border border-purple-100">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-purple-700">
            <Users className="w-3 h-3" />
            <span>Recursos Humanos</span>
          </div>
          <div className="space-y-1">
            {AVAILABLE_MENUS.filter(m => m.group === 'Recursos Humanos').map(menu => {
              const checked = editForm.extraMenus.includes(menu.key);
              return (
                <label
                  key={menu.key}
                  onClick={() => toggleMenu(menu.key)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all ${
                    checked
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'hover:bg-purple-100/70 text-slate-700'
                  }`}
                >
                  {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{menu.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Sistema */}
        <div className="space-y-1.5 p-2 rounded-lg bg-slate-100/60 border border-slate-200">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-700">
            <SettingsIcon className="w-3 h-3" />
            <span>Sistema</span>
          </div>
          <div className="space-y-1">
            {AVAILABLE_MENUS.filter(m => m.group === 'Sistema').map(menu => {
              const checked = editForm.extraMenus.includes(menu.key);
              return (
                <label
                  key={menu.key}
                  onClick={() => toggleMenu(menu.key)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all ${
                    checked
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'hover:bg-slate-200/70 text-slate-700'
                  }`}
                >
                  {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{menu.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMsg && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-sm font-semibold animate-in fade-in slide-in-from-top-3 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Banner de Sincronización Permanente con Google Sheets */}
      <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Persistencia 100% Permanente en Google Sheets
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Pestaña "Usuarios" Conectada
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              Todos los usuarios, contraseñas y permisos temporales se guardan de forma permanente en tu hoja oficial de Google. Nunca más se perderán tras una actualización o reinicio.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={() => handleSyncSheets('pull')}
            disabled={syncingSheets}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all shadow-sm"
            title="Recargar usuarios directamente desde la hoja de Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingSheets ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Sincronizar con Sheet</span>
          </button>

          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-all"
            title="Abrir hoja de cálculo oficial en Google Sheets"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver Hoja</span>
          </a>
        </div>
      </div>

      {/* Header Principal */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Gestión de Usuarios y Permisos Temporales
          </h3>
          <p className="text-xs text-slate-500">
            Administra roles base y delega accesos temporales con fecha de caducidad sin alterar comisiones ni nóminas.
          </p>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            resetForm();
          }}
          className="flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      <div className="space-y-3">
        {/* Formulario de Agregar Nuevo Usuario */}
        {isAdding && (
          <form
            onSubmit={handleAdd}
            className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 shadow-sm space-y-3 animate-in fade-in"
          >
            <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Registrar Nuevo Usuario
            </div>

            <div className="flex flex-wrap gap-2.5 items-center">
              <input
                type="text"
                placeholder="Nombre de Usuario (ej: pedro_planta)"
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm flex-1 min-w-[140px] bg-white font-medium focus:ring-2 focus:ring-blue-500"
                value={editForm.username}
                onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                required
              />
              <select
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm flex-1 min-w-[150px] bg-white font-semibold focus:ring-2 focus:ring-blue-500"
                value={editForm.role}
                onChange={e => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="admin">Administrador (Total)</option>
                <option value="gerencia">Gerencia (Rutas y Producción)</option>
                <option value="rh">Recursos Humanos (Padrón, Checadas y Nómina)</option>
                <option value="supervisor_rutas">Supervisor de Rutas</option>
                <option value="supervisor_produccion">Supervisor de Producción</option>
                <option value="produccion">Operador de Producción (Solo Planta)</option>
                <option value="produccion_linea">Operador de Línea (Solo Línea)</option>
                <option value="auxiliar_contable">Auxiliar Contable (Solo Captura y Estado de Resultados)</option>
                <option value="operator">Ruta / Chofer</option>
              </select>
              <input
                type="text"
                placeholder="Contraseña"
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm flex-1 min-w-[120px] bg-white font-mono focus:ring-2 focus:ring-blue-500"
                value={editForm.password}
                onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                required
              />
            </div>

            {/* Checkboxes de Menús Adicionales */}
            {renderExtraMenusForm()}

            <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  resetForm();
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Usuario</span>
              </button>
            </div>
          </form>
        )}

        {/* Lista de Usuarios */}
        {users.map((u: any) => {
          const badge = roleBadge(u.role);
          const hasExtra = Array.isArray(u.extraMenus) && u.extraMenus.length > 0;
          const isExpired = Boolean(u.extraMenusExpiresAt && u.extraMenusExpiresAt < todayStr);

          if (editingId === u.id) {
            return (
              <div
                key={u.id}
                className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 shadow-sm space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Editando Usuario: <strong className="text-slate-800">{u.username}</strong>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    Rol Base: {badge.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Nombre de Usuario</label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                      value={editForm.username}
                      onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                    />
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Rol Base</label>
                    <select
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white font-semibold focus:ring-2 focus:ring-indigo-500"
                      value={editForm.role}
                      onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      <option value="admin">Administrador (Total)</option>
                      <option value="gerencia">Gerencia (Rutas y Producción)</option>
                      <option value="rh">Recursos Humanos (Padrón, Checadas y Nómina)</option>
                      <option value="supervisor_rutas">Supervisor de Rutas</option>
                      <option value="supervisor_produccion">Supervisor de Producción</option>
                      <option value="produccion">Operador de Producción (Solo Planta)</option>
                      <option value="produccion_linea">Operador de Línea (Solo Línea)</option>
                      <option value="auxiliar_contable">Auxiliar Contable (Solo Captura y Estado de Resultados)</option>
                      <option value="operator">Ruta / Chofer</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Contraseña</label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white font-mono focus:ring-2 focus:ring-indigo-500"
                      value={editForm.password}
                      onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    />
                  </div>
                </div>

                {/* Checkboxes de Menús Adicionales */}
                {renderExtraMenusForm()}

                <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleUpdate(u.id)}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={u.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{u.username}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>

                  {/* Badge de permisos temporales */}
                  {hasExtra && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isExpired
                          ? 'bg-slate-100 text-slate-500 border-slate-200 line-through'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                      title={
                        isExpired
                          ? `Expiró el ${u.extraMenusExpiresAt}`
                          : u.extraMenusExpiresAt
                          ? `Activo hasta el ${u.extraMenusExpiresAt}`
                          : 'Acceso temporal permanente'
                      }
                    >
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>
                        +{u.extraMenus.length} {u.extraMenus.length === 1 ? 'menú adicional' : 'menús adicionales'}
                      </span>
                      {u.extraMenusExpiresAt ? (
                        <span className="font-medium opacity-80">
                          ({isExpired ? `venció ${u.extraMenusExpiresAt}` : `vence ${u.extraMenusExpiresAt}`})
                        </span>
                      ) : (
                        <span className="font-medium opacity-80">(sin fecha corte)</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Lista de menús adicionales otorgados */}
                {hasExtra && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Menús extra:</span>
                    {u.extraMenus.map((key: string) => {
                      const item = AVAILABLE_MENUS.find(m => m.key === key);
                      return (
                        <span
                          key={key}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            isExpired
                              ? 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                              : item?.color || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item?.label || key}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="text-[11px] text-slate-400 font-medium">
                  {u.password ? '••••••••' : 'Sin contraseña'}
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                <button
                  onClick={() => startEdit(u)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar / Permisos</span>
                </button>

                <button
                  onClick={() => handleDelete(u.id)}
                  className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100"
                  disabled={u.role === 'admin' && users.filter((x: any) => x.role === 'admin').length === 1}
                  title={
                    u.role === 'admin' && users.filter((x: any) => x.role === 'admin').length === 1
                      ? 'No puedes eliminar el último administrador'
                      : 'Eliminar usuario'
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

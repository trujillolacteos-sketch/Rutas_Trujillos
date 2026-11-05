import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, Search, Phone, MessageSquare, AlertCircle,
  DollarSign, Briefcase, Download, RefreshCw,
  Edit2, UserX, UserCheck, Eye, X, CheckCircle2,
  Calendar, FileSpreadsheet, ExternalLink
} from 'lucide-react';

export interface EmpleadoRH {
  id: string;
  numeroEmpleado: number;
  estatus: 'ACTIVO' | 'INACTIVO';
  primerApellido: string;
  segundoApellido: string;
  nombre: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  curp?: string;
  telefonoWhatsapp?: string;
  correoElectronico?: string;
  contactoEmergenciaTelefono?: string;
  contactoEmergenciaParentesco?: string;
  contactoEmergenciaNombre?: string;
  puesto: string;
  sueldoBase: number;
  sueldoBaseTexto: string;
  fechaIngreso?: string;
  fechaBaja?: string;
  departamento: string;
  tipoSalario: string;
  rowNumber: number;
  edad?: number;
  antiguedad?: string;
}

export interface RHStats {
  totalPlantilla: number;
  totalActivos: number;
  totalInactivos: number;
  masaSalarialSemanalActiva: number;
  departamentos: { depto: string; total: number; activos: number }[];
  puestos: { puesto: string; total: number; activos: number }[];
  tiposSalario: { tipo: string; total: number }[];
}

interface RecursosHumanosViewProps {
  token: string;
  role?: string;
  user?: any;
}

export default function RecursosHumanosView({ token, role, user }: RecursosHumanosViewProps) {
  const userRole = (role || user?.role || '').toLowerCase();
  const isGerenciaOrAdmin = userRole === 'admin' || userRole === 'gerencia' || userRole === 'administrador';

  const [empleados, setEmpleados] = useState<EmpleadoRH[]>([]);
  const [stats, setStats] = useState<RHStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Filtros - Default a 'ACTIVO'
  const [search, setSearch] = useState('');
  const [estatusFiltro, setEstatusFiltro] = useState<'TODOS' | 'ACTIVO' | 'INACTIVO'>('ACTIVO');
  const [deptoFiltro, setDeptoFiltro] = useState('TODOS');
  const [tipoSalarioFiltro, setTipoSalarioFiltro] = useState('TODOS');

  // Modales
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmpleadoRH | null>(null);
  const [detailEmp, setDetailEmp] = useState<EmpleadoRH | null>(null);
  const [bajaEmp, setBajaEmp] = useState<EmpleadoRH | null>(null);
  const [fechaBajaInput, setFechaBajaInput] = useState('');
  const [motivoBajaInput, setMotivoBajaInput] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    numeroEmpleado: 0,
    nombre: '',
    primerApellido: '',
    segundoApellido: '',
    estatus: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
    fechaNacimiento: '',
    curp: '',
    telefonoWhatsapp: '',
    correoElectronico: '',
    contactoEmergenciaNombre: '',
    contactoEmergenciaParentesco: '',
    contactoEmergenciaTelefono: '',
    puesto: 'PRODUCCIÓN',
    departamento: 'PRODUCCIÓN',
    tipoSalario: 'jornada',
    sueldoBase: 2200,
    fechaIngreso: '',
    fechaBaja: ''
  });

  const [formSaving, setFormSaving] = useState(false);

  // Fetch Empleados
  const fetchEmpleados = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (estatusFiltro !== 'TODOS') params.append('estatus', estatusFiltro);
      if (deptoFiltro !== 'TODOS') params.append('departamento', deptoFiltro);
      if (tipoSalarioFiltro !== 'TODOS') params.append('tipoSalario', tipoSalarioFiltro);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/rh/empleados?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setEmpleados(data.empleados || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced auto-fetch on filter or search change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmpleados();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, estatusFiltro, deptoFiltro, tipoSalarioFiltro]);

  // Sincronizar desde Sheets
  const handleSyncSheets = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/rh/sync-sheets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`¡Sincronización exitosa! Se cargaron ${data.count} colaboradores desde la hoja RH.`);
        fetchEmpleados();
      } else {
        alert(data.error || 'Error al sincronizar');
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Abrir Modal de Alta
  const handleOpenCreate = async () => {
    try {
      const res = await fetch('/api/rh/next-numero', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const nextNum = data.nextNumero || 1059;

      setEditingEmp(null);
      setFormData({
        numeroEmpleado: nextNum,
        nombre: '',
        primerApellido: '',
        segundoApellido: '',
        estatus: 'ACTIVO',
        fechaNacimiento: '',
        curp: '',
        telefonoWhatsapp: '',
        correoElectronico: '',
        contactoEmergenciaNombre: '',
        contactoEmergenciaParentesco: '',
        contactoEmergenciaTelefono: '',
        puesto: 'PRODUCCIÓN',
        departamento: 'PRODUCCIÓN',
        tipoSalario: 'jornada',
        sueldoBase: 2200,
        fechaIngreso: new Date().toLocaleDateString('es-MX'),
        fechaBaja: ''
      });
      setShowFormModal(true);
    } catch (err: any) {
      alert(`Error al obtener número de empleado: ${err.message}`);
    }
  };

  // Abrir Modal de Edición
  const handleOpenEdit = (emp: EmpleadoRH) => {
    setEditingEmp(emp);
    setFormData({
      numeroEmpleado: emp.numeroEmpleado,
      nombre: emp.nombre,
      primerApellido: emp.primerApellido,
      segundoApellido: emp.segundoApellido,
      estatus: emp.estatus,
      fechaNacimiento: emp.fechaNacimiento || '',
      curp: emp.curp || '',
      telefonoWhatsapp: emp.telefonoWhatsapp || '',
      correoElectronico: emp.correoElectronico || '',
      contactoEmergenciaNombre: emp.contactoEmergenciaNombre || '',
      contactoEmergenciaParentesco: emp.contactoEmergenciaParentesco || '',
      contactoEmergenciaTelefono: emp.contactoEmergenciaTelefono || '',
      puesto: emp.puesto,
      departamento: emp.departamento,
      tipoSalario: emp.tipoSalario,
      sueldoBase: emp.sueldoBase,
      fechaIngreso: emp.fechaIngreso || '',
      fechaBaja: emp.fechaBaja || ''
    });
    setShowFormModal(true);
  };

  // Guardar Formulario (Alta o Edición)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    setFormSaving(true);
    try {
      const url = editingEmp ? `/api/rh/empleados/${editingEmp.id}` : '/api/rh/empleados';
      const method = editingEmp ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setShowFormModal(false);
        fetchEmpleados();
      } else {
        alert(data.error || 'Error al guardar colaborador');
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setFormSaving(false);
    }
  };

  // Confirmar Baja
  const handleConfirmBaja = async () => {
    if (!bajaEmp) return;
    try {
      const res = await fetch(`/api/rh/empleados/${bajaEmp.id}/baja`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fechaBaja: fechaBajaInput || new Date().toLocaleDateString('es-MX'),
          motivo: motivoBajaInput
        })
      });
      const data = await res.json();
      if (data.success) {
        setBajaEmp(null);
        fetchEmpleados();
      } else {
        alert(data.error || 'Error al procesar baja');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Reactivar Empleado
  const handleReactivar = async (emp: EmpleadoRH) => {
    if (!confirm(`¿Reactivar al colaborador ${emp.nombreCompleto}?`)) return;
    try {
      const res = await fetch(`/api/rh/empleados/${emp.id}/reactivar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fechaIngreso: new Date().toLocaleDateString('es-MX')
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchEmpleados();
      } else {
        alert(data.error || 'Error al reactivar');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Formatter Currency
  const fmt = (val: number | undefined | null) => {
    const num = Number(val) || 0;
    return num.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Exportar CSV
  const handleExportCSV = () => {
    if (empleados.length === 0) return;
    const headers = [
      'Num Empleado', 'Estatus', 'Nombre Completo', 'Puesto', 'Departamento',
      'Sueldo Base', 'Tipo Salario', 'Fecha Ingreso', 'Fecha Baja',
      'Telefono', 'CURP', 'Contacto Emergencia', 'Parentesco', 'Tel Emergencia'
    ];
    const rows = empleados.map(e => [
      e.numeroEmpleado,
      e.estatus,
      `"${e.nombreCompleto}"`,
      `"${e.puesto}"`,
      `"${e.departamento}"`,
      e.sueldoBase,
      e.tipoSalario,
      e.fechaIngreso || '',
      e.fechaBaja || '',
      e.telefonoWhatsapp || '',
      e.curp || '',
      `"${e.contactoEmergenciaNombre || ''}"`,
      `"${e.contactoEmergenciaParentesco || ''}"`,
      e.contactoEmergenciaTelefono || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `padron_rh_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Departamentos únicos para el filtro
  const listaDeptos = useMemo(() => {
    if (!stats) return [];
    return stats.departamentos.map(d => d.depto).filter(Boolean);
  }, [stats]);

  return (
    <div className="space-y-4 pb-16">
      {/* Encabezado limpio y minimalista */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Recursos Humanos</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Padrón
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Padrón de colaboradores y expedientes sincronizados con la pestaña RH de Google Sheets.
            </p>
          </div>
        </div>

        {/* Botones de acción principales */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-all shadow-sm"
            title="Descargar padrón actual a formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>

          {/* Procesos Google Sheets (Exclusivo Gerencia y Admin) */}
          {isGerenciaOrAdmin && (
            <>
              <a
                href="https://docs.google.com/spreadsheets/d/1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE/edit#gid=1584300112"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white transition-all shadow-sm"
                title="Acceso exclusivo Gerencia/Admin: Abrir pestaña RH en Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Abrir Sheet</span>
                <ExternalLink className="w-3 h-3 text-emerald-200" />
              </a>

              <button
                onClick={handleSyncSheets}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-800 transition-all disabled:opacity-50"
                title="Sincronizar directamente con la pestaña RH de Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
                <span>{syncing ? 'Sincronizando...' : 'Sincronizar Sheet'}</span>
              </button>
            </>
          )}

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-all shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nuevo Colaborador</span>
          </button>
        </div>
      </div>

      {/* Resumen rápido de métricas (KPIs compactos) */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-800 block">Colaboradores Activos</span>
              <div className="text-xl font-black text-emerald-900 mt-0.5">{stats.totalActivos}</div>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-indigo-200/80 bg-indigo-50/20 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-indigo-800 block">Masa Salarial Activa</span>
              <div className="text-lg font-black text-indigo-950 mt-0.5">{fmt(stats.masaSalarialSemanalActiva)}</div>
            </div>
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Bajas / Inactivos</span>
              <div className="text-xl font-black text-slate-700 mt-0.5">{stats.totalInactivos}</div>
            </div>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
              <UserX className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Plantilla Total</span>
              <div className="text-xl font-black text-slate-800 mt-0.5">{stats.totalPlantilla}</div>
            </div>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros & Búsqueda: Simple y directa */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Buscador predictivo */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, puesto, # empleado, teléfono o CURP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Filtro de Estatus (Activos por default) */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs shrink-0">
          <button
            onClick={() => setEstatusFiltro('ACTIVO')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              estatusFiltro === 'ACTIVO'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setEstatusFiltro('INACTIVO')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              estatusFiltro === 'INACTIVO'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bajas
          </button>
          <button
            onClick={() => setEstatusFiltro('TODOS')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              estatusFiltro === 'TODOS'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos
          </button>
        </div>

        {/* Filtro Departamento */}
        <select
          value={deptoFiltro}
          onChange={(e) => setDeptoFiltro(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
        >
          <option value="TODOS">Todos los Deptos</option>
          {listaDeptos.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Filtro Tipo Salario */}
        <select
          value={tipoSalarioFiltro}
          onChange={(e) => setTipoSalarioFiltro(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
        >
          <option value="TODOS">Todos los Salarios</option>
          <option value="jornada">Jornada</option>
          <option value="fijo">Fijo</option>
          <option value="hora">Por Hora</option>
          <option value="gerencia">Gerencia</option>
        </select>
      </div>

      {/* Renglones dentro de la Tabla */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200 shadow-sm">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
          <div className="text-sm font-bold text-slate-800">Cargando colaboradores...</div>
          <div className="text-xs text-slate-400 mt-0.5">Consultando hoja RH de Google Sheets</div>
        </div>
      ) : empleados.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
          No se encontraron colaboradores con los filtros seleccionados ({estatusFiltro === 'ACTIVO' ? 'Activos' : estatusFiltro === 'INACTIVO' ? 'Bajas' : 'Todos'}).
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3"># Emp</th>
                  <th className="py-2.5 px-3">Estatus</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Nombre Completo</th>
                  <th className="py-2.5 px-3">Puesto</th>
                  <th className="py-2.5 px-3">Departamento</th>
                  <th className="py-2.5 px-3 text-right">Sueldo Base</th>
                  <th className="py-2.5 px-3 text-center">Tipo</th>
                  <th className="py-2.5 px-3">Antigüedad</th>
                  <th className="py-2.5 px-3">WhatsApp / Tel</th>
                  <th className="py-2.5 px-4 min-w-[180px]">Contacto Emergencia</th>
                  <th className="py-2.5 px-3 text-center min-w-[120px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empleados.map((emp) => {
                  const isActivo = emp.estatus === 'ACTIVO';
                  const cleanPhone = (emp.telefonoWhatsapp || '').replace(/\D/g, '');
                  const cleanEmergPhone = (emp.contactoEmergenciaTelefono || '').replace(/\D/g, '');

                  return (
                    <tr
                      key={emp.id}
                      className={`transition-colors ${isActivo ? 'hover:bg-indigo-50/30' : 'bg-slate-50/50 hover:bg-slate-100/60 opacity-85'}`}
                    >
                      {/* # Empleado */}
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                          #{emp.numeroEmpleado}
                        </span>
                      </td>

                      {/* Estatus */}
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActivo
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                        }`}>
                          {emp.estatus}
                        </span>
                      </td>

                      {/* Nombre Completo */}
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{emp.nombreCompleto}</span>
                          {emp.edad && (
                            <span className="text-[10px] text-slate-400 font-normal">({emp.edad}a)</span>
                          )}
                        </div>
                      </td>

                      {/* Puesto */}
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {emp.puesto}
                      </td>

                      {/* Departamento */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                          {emp.departamento}
                        </span>
                      </td>

                      {/* Sueldo Base */}
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {emp.sueldoBaseTexto || fmt(emp.sueldoBase)}
                      </td>

                      {/* Tipo Salario */}
                      <td className="py-2.5 px-3 text-center uppercase text-[10px] font-bold text-slate-500">
                        {emp.tipoSalario}
                      </td>

                      {/* Antigüedad */}
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        <div>{emp.antiguedad || '-'}</div>
                        <div className="text-[10px] text-slate-400">Ing: {emp.fechaIngreso || 'N/D'}</div>
                      </td>

                      {/* WhatsApp / Teléfono */}
                      <td className="py-2.5 px-3 text-slate-600">
                        {emp.telefonoWhatsapp ? (
                          <div className="flex items-center gap-1">
                            <a
                              href={`https://wa.me/52${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                              title="Enviar WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{emp.telefonoWhatsapp}</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Contacto de Emergencia */}
                      <td className="py-2.5 px-4">
                        {emp.contactoEmergenciaNombre ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-rose-900 block leading-tight text-[11px]">
                              {emp.contactoEmergenciaNombre}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <span>({emp.contactoEmergenciaParentesco || 'Familiar'})</span>
                              {emp.contactoEmergenciaTelefono && (
                                <a
                                  href={`tel:${cleanEmergPhone}`}
                                  className="text-rose-700 hover:underline font-bold inline-flex items-center gap-0.5"
                                  title="Llamar"
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{emp.contactoEmergenciaTelefono}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Ver Expediente */}
                          <button
                            onClick={() => setDetailEmp(emp)}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors"
                            title="Ver expediente digital completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Editar Colaborador */}
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors"
                            title="Editar datos del colaborador"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Baja o Reactivar */}
                          {isActivo ? (
                            <button
                              onClick={() => {
                                setBajaEmp(emp);
                                setFechaBajaInput(new Date().toLocaleDateString('es-MX'));
                                setMotivoBajaInput('');
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Dar de baja"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivar(emp)}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 transition-colors"
                              title="Reactivar colaborador"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: DETALLE EXPEDIENTE COMPLETO ================= */}
      {detailEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md">
                  #{detailEmp.numeroEmpleado}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900">{detailEmp.nombreCompleto}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      detailEmp.estatus === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {detailEmp.estatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {detailEmp.puesto} • <strong className="text-indigo-700">{detailEmp.departamento}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailEmp(null)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid de Secciones */}
            <div className="space-y-3.5 text-xs">
              {/* Sección 1: Datos Personales */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  1. Información Personal
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Nombres:</span>
                    <span className="font-bold text-slate-800">{detailEmp.nombre || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Apellidos:</span>
                    <span className="font-bold text-slate-800">{detailEmp.primerApellido} {detailEmp.segundoApellido}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha de Nacimiento:</span>
                    <span className="font-bold text-slate-800">
                      {detailEmp.fechaNacimiento || 'N/D'} {detailEmp.edad ? `(${detailEmp.edad} años)` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">CURP:</span>
                    <span className="font-mono font-bold text-slate-800">{detailEmp.curp || 'No registrada'}</span>
                  </div>
                </div>
              </div>

              {/* Sección 2: Contacto & Emergencia */}
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-rose-900 tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  2. Contacto de Emergencia & WhatsApp
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Teléfono WhatsApp:</span>
                    <span className="font-bold text-slate-800">{detailEmp.telefonoWhatsapp || 'N/D'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Correo Electrónico:</span>
                    <span className="font-bold text-slate-800 truncate block">{detailEmp.correoElectronico || 'N/D'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Contacto de Emergencia:</span>
                    <span className="font-black text-rose-950">{detailEmp.contactoEmergenciaNombre || 'No registrado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Parentesco:</span>
                    <span className="font-bold text-slate-800">{detailEmp.contactoEmergenciaParentesco || 'N/D'}</span>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Teléfono de Emergencia:</span>
                    {detailEmp.contactoEmergenciaTelefono ? (
                      <a
                        href={`tel:${detailEmp.contactoEmergenciaTelefono}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs mt-1 hover:bg-rose-700 transition-colors shadow-xs"
                      >
                        <Phone className="w-3 h-3" />
                        Llamar a {detailEmp.contactoEmergenciaTelefono}
                      </a>
                    ) : (
                      <span className="text-slate-400">Sin teléfono</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección 3: Datos Laborales */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  3. Datos Laborales y Sueldo
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Sueldo Base:</span>
                    <span className="text-sm font-black text-emerald-800">{detailEmp.sueldoBaseTexto || fmt(detailEmp.sueldoBase)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo de Salario:</span>
                    <span className="font-bold uppercase text-slate-800">{detailEmp.tipoSalario}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha de Ingreso:</span>
                    <span className="font-bold text-slate-800">{detailEmp.fechaIngreso || 'N/D'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Antigüedad:</span>
                    <span className="font-bold text-indigo-700">{detailEmp.antiguedad || 'N/D'}</span>
                  </div>
                  {detailEmp.fechaBaja && (
                    <div className="col-span-2">
                      <span className="text-rose-500 block text-[10px] uppercase font-bold">Fecha de Baja:</span>
                      <span className="font-black text-rose-900">{detailEmp.fechaBaja}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setDetailEmp(null);
                  handleOpenEdit(detailEmp);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Expediente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ALTA Y EDICIÓN DE COLABORADOR (PASO 2) ================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {editingEmp ? `Editar Colaborador #${editingEmp.numeroEmpleado}` : 'Registrar Nuevo Colaborador'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Los datos se sincronizarán directamente en la pestaña RH de Google Sheets.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              {/* Sección 1: Datos Personales */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider block">
                  1. Datos Personales
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Nombre (s) *</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej. Jorge"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Primer Apellido</label>
                    <input
                      type="text"
                      value={formData.primerApellido}
                      onChange={(e) => setFormData({ ...formData, primerApellido: e.target.value })}
                      placeholder="Ej. Ortiz"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Segundo Apellido</label>
                    <input
                      type="text"
                      value={formData.segundoApellido}
                      onChange={(e) => setFormData({ ...formData, segundoApellido: e.target.value })}
                      placeholder="Ej. Paredes"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Fecha de Nacimiento</label>
                    <input
                      type="text"
                      value={formData.fechaNacimiento}
                      onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                      placeholder="DD/MM/AAAA"
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">CURP</label>
                    <input
                      type="text"
                      value={formData.curp}
                      onChange={(e) => setFormData({ ...formData, curp: e.target.value })}
                      placeholder="18 caracteres"
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Contacto & Emergencia */}
              <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-2.5">
                <span className="text-[10px] font-black uppercase text-rose-900 tracking-wider block">
                  2. Contacto & Emergencias
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Teléfono WhatsApp</label>
                    <input
                      type="tel"
                      value={formData.telefonoWhatsapp}
                      onChange={(e) => setFormData({ ...formData, telefonoWhatsapp: e.target.value })}
                      placeholder="10 dígitos"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Correo Electrónico</label>
                    <input
                      type="email"
                      value={formData.correoElectronico}
                      onChange={(e) => setFormData({ ...formData, correoElectronico: e.target.value })}
                      placeholder="ejemplo@correo.com"
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Nombre Contacto Emergencia</label>
                    <input
                      type="text"
                      value={formData.contactoEmergenciaNombre}
                      onChange={(e) => setFormData({ ...formData, contactoEmergenciaNombre: e.target.value })}
                      placeholder="Ej. Familiar o cónyuge"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Parentesco</label>
                      <input
                        type="text"
                        value={formData.contactoEmergenciaParentesco}
                        onChange={(e) => setFormData({ ...formData, contactoEmergenciaParentesco: e.target.value })}
                        placeholder="Ej. Esposa"
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Tel. Emergencia</label>
                      <input
                        type="tel"
                        value={formData.contactoEmergenciaTelefono}
                        onChange={(e) => setFormData({ ...formData, contactoEmergenciaTelefono: e.target.value })}
                        placeholder="10 dígitos"
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 3: Datos Laborales */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-2.5">
                <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider block">
                  3. Datos Laborales & Nómina
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Número de Empleado</label>
                    <input
                      type="number"
                      required
                      value={formData.numeroEmpleado}
                      onChange={(e) => setFormData({ ...formData, numeroEmpleado: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 text-xs font-black rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Puesto</label>
                    <input
                      type="text"
                      required
                      value={formData.puesto}
                      onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                      placeholder="Ej. PRODUCCIÓN"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Departamento</label>
                    <select
                      value={formData.departamento}
                      onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    >
                      <option value="PRODUCCIÓN">PRODUCCIÓN</option>
                      <option value="GERENCIA">GERENCIA</option>
                      <option value="RUTA">RUTA</option>
                      <option value="ADMINISTRACIÓN">ADMINISTRACIÓN</option>
                      <option value="VENTAS">VENTAS</option>
                      <option value="CHOFER">CHOFER</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Sueldo Base ($)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.sueldoBase}
                      onChange={(e) => setFormData({ ...formData, sueldoBase: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-black rounded-xl border border-slate-200 bg-white text-emerald-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Tipo de Salario</label>
                    <select
                      value={formData.tipoSalario}
                      onChange={(e) => setFormData({ ...formData, tipoSalario: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="jornada">Jornada</option>
                      <option value="fijo">Fijo</option>
                      <option value="hora">Por Hora</option>
                      <option value="gerencia">Gerencia</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Estatus</label>
                    <select
                      value={formData.estatus}
                      onChange={(e) => setFormData({ ...formData, estatus: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="INACTIVO">INACTIVO</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Fecha de Ingreso</label>
                    <input
                      type="text"
                      value={formData.fechaIngreso}
                      onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })}
                      placeholder="DD/MM/AAAA"
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {formData.estatus === 'INACTIVO' && (
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-rose-600 block mb-1 uppercase">Fecha de Baja</label>
                      <input
                        type="text"
                        value={formData.fechaBaja}
                        onChange={(e) => setFormData({ ...formData, fechaBaja: e.target.value })}
                        placeholder="DD/MM/AAAA"
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-rose-200 bg-rose-50 text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Botones del Formulario */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {formSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{formSaving ? 'Guardando en Sheets...' : editingEmp ? 'Actualizar Colaborador' : 'Crear Colaborador'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRMACIÓN DE BAJA ================= */}
      {bajaEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-600">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Dar de Baja Colaborador</h3>
                <p className="text-xs text-slate-500">{bajaEmp.nombreCompleto} (#{bajaEmp.numeroEmpleado})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              El colaborador pasará a estatus <strong>INACTIVO</strong> en el sistema y en la hoja RH de Google Sheets.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha de Baja (DD/MM/AAAA)</label>
                <input
                  type="text"
                  value={fechaBajaInput}
                  onChange={(e) => setFechaBajaInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Motivo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Renuncia voluntaria, fin de contrato..."
                  value={motivoBajaInput}
                  onChange={(e) => setMotivoBajaInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setBajaEmp(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBaja}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md"
              >
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

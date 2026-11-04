import React, { useState, useEffect } from 'react';
import {
  Clock, Calendar, Search, RefreshCw, Download, CheckCircle2,
  AlertTriangle, Users, Award, ShieldAlert, Edit2, ChevronRight,
  Sun, Moon, Coffee, X, Info
} from 'lucide-react';

export interface ChecadaDia {
  entrada1: string;
  salida1: string;
  entrada2: string;
  salida2: string;
  total: string;
  extras: string;
}

export interface EmpleadoChecada {
  rowNumber: number;
  nombre: string;
  jornada: string;
  faltas: number;
  jornadaIncompleta: string;
  incapacidades: number;
  vacaciones: number;
  tipoJornada: string;
  extrasSemana: string;
  totalHorasSemana: string;
  dias: {
    lunes: ChecadaDia;
    martes: ChecadaDia;
    miercoles: ChecadaDia;
    jueves: ChecadaDia;
    viernes: ChecadaDia;
    sabado: ChecadaDia;
  };
}

export interface ChecadasStats {
  totalEmpleados: number;
  totalFaltas: number;
  empleadosConFaltas: number;
  totalHorasExtras: string;
  totalHorasTrabajadas: string;
}

interface ChecadasViewProps {
  token: string;
  role?: string;
  user?: any;
}

type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado';

const DIAS_LABEL: Record<DiaSemana, { nombre: string; color: string; badge: string }> = {
  lunes: { nombre: 'Lunes', color: 'bg-blue-50 text-blue-700 border-blue-200', badge: 'bg-blue-600 text-white' },
  martes: { nombre: 'Martes', color: 'bg-purple-50 text-purple-700 border-purple-200', badge: 'bg-purple-600 text-white' },
  miercoles: { nombre: 'Miércoles', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', badge: 'bg-emerald-600 text-white' },
  jueves: { nombre: 'Jueves', color: 'bg-amber-50 text-amber-700 border-amber-200', badge: 'bg-amber-600 text-white' },
  viernes: { nombre: 'Viernes', color: 'bg-slate-100 text-slate-700 border-slate-300', badge: 'bg-slate-700 text-white' },
  sabado: { nombre: 'Sábado', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', badge: 'bg-indigo-600 text-white' }
};

export default function ChecadasView({ token, role, user }: ChecadasViewProps) {
  const [checadas, setChecadas] = useState<EmpleadoChecada[]>([]);
  const [stats, setStats] = useState<ChecadasStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [tipoJornadaFiltro, setTipoJornadaFiltro] = useState('TODOS');
  const [viewDia, setViewDia] = useState<DiaSemana | 'resumen'>('resumen');

  // Modal de Edición de Día
  const [editModal, setEditModal] = useState<{
    open: boolean;
    rowNumber: number;
    nombre: string;
    dia: DiaSemana;
    entrada1: string;
    salida1: string;
    entrada2: string;
    salida2: string;
  } | null>(null);
  const [savingDia, setSavingDia] = useState(false);

  // Modal de Incapacidades / Vacaciones
  const [incapModal, setIncapModal] = useState<{
    open: boolean;
    rowNumber: number;
    nombre: string;
    incapacidades: number;
    vacaciones: number;
  } | null>(null);
  const [savingIncap, setSavingIncap] = useState(false);

  // Fetch Checadas
  const fetchChecadas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rh/checadas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setChecadas(data.checadas || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecadas();
  }, []);

  // Sync bajo demanda con Sheets
  const handleSyncSheets = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/rh/checadas/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`¡Sincronización exitosa! Se cargaron ${data.count} colaboradores desde la hoja Checadas.`);
        setChecadas(data.checadas || []);
        setStats(data.stats || null);
      } else {
        alert(data.error || 'Error al sincronizar Checadas');
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Abrir modal de edición para un día
  const handleOpenEditDia = (emp: EmpleadoChecada, dia: DiaSemana) => {
    const d = emp.dias[dia];
    setEditModal({
      open: true,
      rowNumber: emp.rowNumber,
      nombre: emp.nombre,
      dia,
      entrada1: d.entrada1 || '',
      salida1: d.salida1 || '',
      entrada2: d.entrada2 || '',
      salida2: d.salida2 || ''
    });
  };

  // Guardar edición de día
  const handleSaveDia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setSavingDia(true);
    try {
      const res = await fetch(`/api/rh/checadas/${editModal.rowNumber}/dia`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dia: editModal.dia,
          entrada1: editModal.entrada1.trim(),
          salida1: editModal.salida1.trim(),
          entrada2: editModal.entrada2.trim(),
          salida2: editModal.salida2.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditModal(null);
        fetchChecadas();
      } else {
        alert(data.error || 'Error al guardar checada');
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setSavingDia(false);
    }
  };

  // Guardar Incapacidades / Vacaciones
  const handleSaveIncap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incapModal) return;
    setSavingIncap(true);
    try {
      const res = await fetch(`/api/rh/checadas/${incapModal.rowNumber}/incapacidades-vacaciones`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          incapacidades: incapModal.incapacidades,
          vacaciones: incapModal.vacaciones
        })
      });
      const data = await res.json();
      if (data.success) {
        setIncapModal(null);
        fetchChecadas();
      } else {
        alert(data.error || 'Error al guardar');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingIncap(false);
    }
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (checadas.length === 0) return;
    const headers = [
      'Empleado', 'Jornada', 'Faltas', 'Jornada Incompleta', 'Incapacidades', 'Vacaciones', 'Tipo',
      'Extras Total', 'Horas Totales',
      'Lun Tot', 'Lun Ext',
      'Mar Tot', 'Mar Ext',
      'Mie Tot', 'Mie Ext',
      'Jue Tot', 'Jue Ext',
      'Vie Tot', 'Vie Ext',
      'Sab Tot', 'Sab Ext'
    ];
    const rows = checadas.map(c => [
      `"${c.nombre}"`,
      c.jornada,
      c.faltas,
      c.jornadaIncompleta,
      c.incapacidades,
      c.vacaciones,
      c.tipoJornada,
      c.extrasSemana,
      c.totalHorasSemana,
      c.dias.lunes.total, c.dias.lunes.extras,
      c.dias.martes.total, c.dias.martes.extras,
      c.dias.miercoles.total, c.dias.miercoles.extras,
      c.dias.jueves.total, c.dias.jueves.extras,
      c.dias.viernes.total, c.dias.viernes.extras,
      c.dias.sabado.total, c.dias.sabado.extras
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `checadas_semana_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrado
  const filteredChecadas = checadas.filter(c => {
    const matchesSearch = !search.trim() || c.nombre.toLowerCase().includes(search.toLowerCase());
    const matchesTipo = tipoJornadaFiltro === 'TODOS' || c.tipoJornada.toLowerCase() === tipoJornadaFiltro.toLowerCase();
    return matchesSearch && matchesTipo;
  });

  return (
    <div className="space-y-4 pb-16">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Checadas & Asistencia</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Lunes a Sábado
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Control de entradas, salidas, faltas y horas extras sincronizadas con la pestaña Checadas de Google Sheets.
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleSyncSheets}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* KPIs superiores */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Plantilla en Checador</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{stats.totalEmpleados}</div>
            </div>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-rose-200/80 bg-rose-50/20 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-rose-800 block">Faltas Acumuladas</span>
              <div className="text-xl font-black text-rose-950 mt-0.5">{stats.totalFaltas}</div>
            </div>
            <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-800 block">Con Faltas / Retardos</span>
              <div className="text-xl font-black text-amber-950 mt-0.5">{stats.empleadosConFaltas}</div>
            </div>
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-indigo-200/80 bg-indigo-50/20 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-indigo-800 block">Jornada Objetivo</span>
              <div className="text-lg font-black text-indigo-950 mt-0.5">09:00 hrs/día</div>
            </div>
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
              <Award className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Selector de Vista: Resumen vs Días individuales */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setViewDia('resumen')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              viewDia === 'resumen'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Resumen Semanal
          </button>
          {(Object.keys(DIAS_LABEL) as DiaSemana[]).map(d => {
            const isSel = viewDia === d;
            return (
              <button
                key={d}
                onClick={() => setViewDia(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isSel
                    ? DIAS_LABEL[d].badge + ' shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {DIAS_LABEL[d].nombre}
              </button>
            );
          })}
        </div>

        {/* Buscador & Filtro de Jornada */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={tipoJornadaFiltro}
            onChange={(e) => setTipoJornadaFiltro(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
          >
            <option value="TODOS">Todos los tipos</option>
            <option value="jornada">Jornada</option>
            <option value="fijo">Fijo</option>
            <option value="hora">Hora</option>
            <option value="Gerencia">Gerencia</option>
          </select>
        </div>
      </div>

      {/* Contenido: Tabla de Renglones */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200 shadow-sm">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
          <div className="text-sm font-bold text-slate-800">Cargando registros de checadas...</div>
          <div className="text-xs text-slate-400 mt-0.5">Consultando hoja Checadas de Google Sheets</div>
        </div>
      ) : filteredChecadas.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
          No se encontraron colaboradores en el checador con los filtros seleccionados.
        </div>
      ) : viewDia === 'resumen' ? (
        /* ================= VISTA RESUMEN SEMANAL ================= */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 min-w-[190px]">Colaborador</th>
                  <th className="py-2.5 px-2 text-center">Tipo</th>
                  <th className="py-2.5 px-2 text-center">Faltas</th>
                  <th className="py-2.5 px-2 text-center">Jor. Incompleta</th>
                  <th className="py-2.5 px-2 text-center">Incap/Vac</th>
                  <th className="py-2.5 px-2 text-center">Extras Sem</th>
                  <th className="py-2.5 px-3 text-right">Total Horas</th>
                  <th className="py-2.5 px-2 text-center text-blue-700 bg-blue-50/40">Lun</th>
                  <th className="py-2.5 px-2 text-center text-purple-700 bg-purple-50/40">Mar</th>
                  <th className="py-2.5 px-2 text-center text-emerald-700 bg-emerald-50/40">Mié</th>
                  <th className="py-2.5 px-2 text-center text-amber-700 bg-amber-50/40">Jue</th>
                  <th className="py-2.5 px-2 text-center text-slate-700 bg-slate-100/50">Vie</th>
                  <th className="py-2.5 px-2 text-center text-indigo-700 bg-indigo-50/40">Sáb</th>
                  <th className="py-2.5 px-2 text-center">Ajustes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChecadas.map(emp => {
                  const hasFaltas = emp.faltas > 0;
                  return (
                    <tr key={emp.rowNumber} className="hover:bg-slate-50/80 transition-colors">
                      {/* Colaborador */}
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <span>{emp.nombre}</span>
                      </td>

                      {/* Tipo de Jornada */}
                      <td className="py-2.5 px-2 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          {emp.tipoJornada}
                        </span>
                      </td>

                      {/* Faltas */}
                      <td className="py-2.5 px-2 text-center">
                        {hasFaltas ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            {emp.faltas}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold text-xs">0</span>
                        )}
                      </td>

                      {/* Jornada Incompleta */}
                      <td className="py-2.5 px-2 text-center">
                        {emp.jornadaIncompleta && emp.jornadaIncompleta !== '0:00' && emp.jornadaIncompleta !== '0' ? (
                          <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                            {emp.jornadaIncompleta}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Incapacidades / Vacaciones */}
                      <td className="py-2.5 px-2 text-center text-slate-600 text-[11px]">
                        {(emp.incapacidades > 0 || emp.vacaciones > 0) ? (
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            I:{emp.incapacidades} / V:{emp.vacaciones}
                          </span>
                        ) : (
                          <span className="text-slate-300">0/0</span>
                        )}
                      </td>

                      {/* Extras Semanales */}
                      <td className="py-2.5 px-2 text-center">
                        {emp.extrasSemana && emp.extrasSemana !== '0:00' && emp.extrasSemana !== '0' ? (
                          <span className="font-mono font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                            +{emp.extrasSemana}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0:00</span>
                        )}
                      </td>

                      {/* Total Horas Semana */}
                      <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900 text-xs">
                        {emp.totalHorasSemana}
                      </td>

                      {/* Días Resumidos (Total / Extras) - Click para editar */}
                      {(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as DiaSemana[]).map(dia => {
                        const d = emp.dias[dia];
                        const isZero = !d.total || d.total === '0:00' || d.total === '0';
                        return (
                          <td
                            key={dia}
                            onClick={() => handleOpenEditDia(emp, dia)}
                            className="py-2.5 px-2 text-center cursor-pointer hover:bg-indigo-100/50 transition-colors"
                            title={`Clic para registrar checadas de ${DIAS_LABEL[dia].nombre}`}
                          >
                            <div className="text-[11px] font-mono leading-tight">
                              <span className={isZero ? 'text-slate-300' : 'font-bold text-slate-800'}>
                                {d.total || '0:00'}
                              </span>
                              {d.extras && d.extras !== '0:00' && d.extras !== '0' && (
                                <span className="block text-[9px] text-emerald-700 font-bold">+{d.extras}</span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Botón Ajustes Incapacidades / Vacaciones */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => setIncapModal({
                            open: true,
                            rowNumber: emp.rowNumber,
                            nombre: emp.nombre,
                            incapacidades: emp.incapacidades,
                            vacaciones: emp.vacaciones
                          })}
                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                          title="Ajustar Incapacidades o Días de Vacaciones"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= VISTA POR DÍA ESPECÍFICO ================= */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${DIAS_LABEL[viewDia].badge}`}>
                {DIAS_LABEL[viewDia].nombre}
              </span>
              <span className="text-xs text-slate-500">
                Captura de checadas: Turno Mañana (Entrada 1 - Salida 1) y Turno Tarde / Regreso (Entrada 2 - Salida 2)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 min-w-[200px]">Colaborador</th>
                  <th className="py-2.5 px-2 text-center">Tipo</th>
                  <th className="py-2.5 px-3 text-center">Entrada 1</th>
                  <th className="py-2.5 px-3 text-center">Salida 1 (Comida)</th>
                  <th className="py-2.5 px-3 text-center">Entrada 2 (Regreso)</th>
                  <th className="py-2.5 px-3 text-center">Salida 2 (Final)</th>
                  <th className="py-2.5 px-3 text-right">Horas Día</th>
                  <th className="py-2.5 px-3 text-right">Horas Extras</th>
                  <th className="py-2.5 px-3 text-center">Capturar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChecadas.map(emp => {
                  const d = emp.dias[viewDia];
                  return (
                    <tr key={emp.rowNumber} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{emp.nombre}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                          {emp.tipoJornada}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {d.entrada1 || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {d.salida1 || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {d.entrada2 || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {d.salida2 || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {d.total || '0:00'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                        {d.extras && d.extras !== '0:00' && d.extras !== '0' ? `+${d.extras}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleOpenEditDia(emp, viewDia)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors flex items-center gap-1 mx-auto"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL DE EDICIÓN DE CHECADA POR DÍA ================= */}
      {editModal && editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Checada: {DIAS_LABEL[editModal.dia].nombre}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{editModal.nombre}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDia} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider block">
                  Primer Turno (Mañana)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Entrada 1 (HH:MM)</label>
                    <input
                      type="text"
                      placeholder="08:00"
                      value={editModal.entrada1}
                      onChange={(e) => setEditModal({ ...editModal, entrada1: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Salida 1 (Comida)</label>
                    <input
                      type="text"
                      placeholder="14:00"
                      value={editModal.salida1}
                      onChange={(e) => setEditModal({ ...editModal, salida1: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider block">
                  Segundo Turno / Regreso (Opcional)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Entrada 2 (Regreso)</label>
                    <input
                      type="text"
                      placeholder="15:00"
                      value={editModal.entrada2}
                      onChange={(e) => setEditModal({ ...editModal, entrada2: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Salida 2 (Final)</label>
                    <input
                      type="text"
                      placeholder="17:00"
                      value={editModal.salida2}
                      onChange={(e) => setEditModal({ ...editModal, salida2: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDia}
                  className="px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingDia ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{savingDia ? 'Guardando en Sheets...' : 'Guardar Checada'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE AJUSTE DE INCAPACIDADES / VACACIONES ================= */}
      {incapModal && incapModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Ajuste de Asistencia</h3>
                  <p className="text-xs text-slate-500 font-medium">{incapModal.nombre}</p>
                </div>
              </div>
              <button
                onClick={() => setIncapModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Los días de vacaciones o incapacidad se descuentan automáticamente de las faltas calculadas en Google Sheets.
            </p>

            <form onSubmit={handleSaveIncap} className="space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Días de Incapacidad</label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={incapModal.incapacidades}
                    onChange={(e) => setIncapModal({ ...incapModal, incapacidades: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Días de Vacaciones</label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={incapModal.vacaciones}
                    onChange={(e) => setIncapModal({ ...incapModal, vacaciones: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIncapModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingIncap}
                  className="px-4.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingIncap ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{savingIncap ? 'Guardando...' : 'Aplicar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

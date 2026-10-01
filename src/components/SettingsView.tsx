import React, { useState } from "react";
import { apiFetch } from '../lib/api';
import { AppState, SyncLog } from "../types";
import {
  Database,
  RefreshCw,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  FileText,
  Map,
  ShieldAlert,
  ShieldCheck,
  Download,
  Upload,
} from "lucide-react";
import UsersManagement from "./UsersManagement";
export default function SettingsView({
  state,
  setState,
}: {
  state: AppState;
  setState: any;
}) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [restoring, setRestoring] = useState(false);

  const handleDownloadBackup = () => {
    window.open('/api/backup/export', '_blank');
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setRestoring(true);
        setBackupMsg("Restaurando copia de seguridad...");
        const json = JSON.parse(event.target?.result as string);
        const res = await apiFetch("/api/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        });
        const data = await res.json();
        if (data.success && data.state) {
          setState(data.state);
          setBackupMsg("¡Copia de seguridad restaurada con éxito en todos los dispositivos!");
          setTimeout(() => setBackupMsg(""), 4000);
        } else {
          setBackupMsg("Error al restaurar: " + (data.error || "Datos inválidos"));
        }
      } catch (err: any) {
        setBackupMsg("Error leyendo archivo: " + err.message);
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMsg("Importando de Odoo y calculando rutas...");
    try {
      const res = await apiFetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routes: state.routes,
          clientOverrides: state.clientOverrides,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setState({ ...data.state, settings: state.settings });
        setMsg("¡Sincronización y cálculo completado!");
      } else {
        setMsg("Error: " + data.error);
      }
    } catch (e: any) {
      setMsg("Error: " + e.message);
    }
    setSyncing(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg("");
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: state.settings }),
      });
      if (res.ok) {
        setSettingsMsg("Ajustes guardados correctamente.");
        setTimeout(() => setSettingsMsg(""), 3000);
      } else {
        setSettingsMsg("Error al guardar.");
      }
    } catch (e) {
      setSettingsMsg("Error de conexión.");
    }
    setSavingSettings(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev: AppState) => ({
      ...prev,
      settings: {
        ...prev.settings,
        closeTime: e.target.value,
      },
    }));
  };

  const toggleRouteStatus = async (
    id: number,
    field: "isAuthorized" | "isDelivery",
  ) => {
    const route = state.routes.find((r) => r.id === id);
    if (!route) return;

    const newVal = !route[field];
    try {
      const res = await apiFetch(`/api/routes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newVal }),
      });
      if (res.ok) {
        setState((prev: AppState) => ({
          ...prev,
          routes: prev.routes.map((r) =>
            r.id === id ? { ...r, [field]: newVal } : r,
          ),
        }));
      }
    } catch (e) {
      if (e && e.message !== "Failed to fetch") console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl pb-10">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Ajustes del Sistema
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Configuración, permisos y sincronización Odoo
        </p>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-600" />
            Gestión de POS / Rutas
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Autoriza los nuevos POS creados en Odoo para evitar que entren
            automáticamente en el sistema. Desactiva "Es de Reparto" para los
            POS que no requieran planificación de rutas (ej: sucursales
            físicas).
          </p>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">POS (Ruta)</th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Autorizado
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Es de Reparto
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.routes.map((route) => (
                  <tr
                    key={route.id}
                    className={!route.isAuthorized ? "bg-rose-50/30" : ""}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {route.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          toggleRouteStatus(route.id, "isAuthorized")
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          route.isAuthorized
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                        }`}
                      >
                        {route.isAuthorized ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <ShieldAlert className="w-4 h-4" />
                        )}
                        {route.isAuthorized ? "Sí" : "No"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          toggleRouteStatus(route.id, "isDelivery")
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          route.isDelivery
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {route.isDelivery ? "Sí" : "No"}
                      </button>
                    </td>
                  </tr>
                ))}
                {state.routes.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No hay rutas sincronizadas aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Los cambios se reflejarán en la próxima sincronización o recálculo
            de rutas.
          </p>
        </div>

        <hr className="border-slate-100" />

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Horario Comercial
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Configura la hora límite de visitas para el cierre de operaciones.
            Las visitas cercanas a esta hora se marcarán en rojo.
          </p>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">
              Hora de Cierre:
            </label>
            <input
              type="time"
              value={state.settings?.closeTime || "18:00"}
              onChange={handleTimeChange}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              {savingSettings ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
          {settingsMsg && (
            <p className="mt-2 text-sm text-emerald-600 font-medium">
              {settingsMsg}
            </p>
          )}
        </div>

        <hr className="border-slate-100" />

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Sincronización Manual
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            El sistema importa datos automáticamente los domingos. Usa esto para
            forzar una sincronización ahora.
          </p>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold transition-colors shadow-sm"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Procesando..." : "Sincronizar y Calcular Ahora"}
          </button>

          {msg && (
            <p className="mt-4 text-sm font-medium text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
              {msg}
            </p>
          )}
          {state.lastSync && (
            <p className="mt-2 text-xs text-slate-400">
              Última sincronización: {new Date(state.lastSync).toLocaleString()}
            </p>
          )}
        </div>

        {state.syncLogs && state.syncLogs.length > 0 && (
          <>
            <hr className="border-slate-100" />
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Bitácora de Sincronización
              </h3>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-64 overflow-y-auto space-y-3">
                {state.syncLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <div className="mt-0.5">{getLogIcon(log.type)}</div>
                    <div className="flex-1">
                      <p className="text-slate-700">{log.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <hr className="border-slate-100" />

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Porcentajes de Comisión
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Ajusta el porcentaje que se aplica por defecto para calcular las comisiones de individuos y empresas. (Con 1 decimal).
          </p>
          <div className="flex flex-col gap-4 max-w-sm">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-slate-700">Comisión Individual (%):</label>
              <input 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={state.settings?.commissionRatePerson ?? 2.0} 
                onChange={(e) => setState({ ...state, settings: { ...state.settings, commissionRatePerson: parseFloat(e.target.value) } })}
                className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-slate-700">Comisión Empresa (%):</label>
              <input 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={state.settings?.commissionRateCompany ?? 1.0} 
                onChange={(e) => setState({ ...state, settings: { ...state.settings, commissionRateCompany: parseFloat(e.target.value) } })}
                className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-slate-700">Multiplicador de ajuste:</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={state.settings?.commissionAdjustmentMultiplier ?? 1.0}
                onChange={(e) => setState({
                  ...state,
                  settings: {
                    ...state.settings,
                    commissionAdjustmentMultiplier: parseFloat(e.target.value)
                  }
                })}
                className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
            <p className="text-xs text-slate-400 -mt-2">
              1.00 = sin ajuste; 1.10 = aumenta 10%; 0.90 = reduce 10%.
            </p>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="mt-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              {savingSettings ? 'Guardando...' : 'Guardar Comisiones'}
            </button>
          </div>
        </div>

        <hr className="border-slate-100" />

        <UsersManagement state={state} setState={setState} />

        <hr className="border-slate-100" />

        {/* Respaldo y Restauración Permanente */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Copia de Seguridad y Sincronización Permanente</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            El sistema sincroniza automáticamente todos los celulares y computadoras en tiempo real. Puedes descargar una copia de seguridad en JSON de toda tu configuración, clientes y rutas, o restaurar una copia guardada previamente.
          </p>

          {backupMsg && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium">
              {backupMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center">
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-600" />
              Descargar Respaldo JSON
            </button>

            <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium cursor-pointer transition shadow-sm">
              <Upload className="w-4 h-4 text-indigo-600" />
              {restoring ? 'Restaurando...' : 'Restaurar Respaldo JSON'}
              <input
                type="file"
                accept=".json"
                className="hidden"
                disabled={restoring}
                onChange={handleUploadBackup}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

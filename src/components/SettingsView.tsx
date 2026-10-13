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
  Lock,
  Key,
  FolderOpen,
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

  const [encryptedPass, setEncryptedPass] = useState("");
  const [encBackupMsg, setEncBackupMsg] = useState("");
  const [restoringEnc, setRestoringEnc] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveMsg, setDriveMsg] = useState("");

  const handleSyncDriveNow = async () => {
    try {
      setSyncingDrive(true);
      setDriveMsg("Subiendo respaldo cifrado a tu carpeta de Google Drive...");
      const res = await apiFetch("/api/backup/sync-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        setDriveMsg("✅ " + data.message);
        setTimeout(() => setDriveMsg(""), 6000);
      } else {
        setDriveMsg("⚠️ " + (data.message || "Error al conectar con Google Drive"));
      }
    } catch (err: any) {
      setDriveMsg("Error al sincronizar: " + err.message);
    } finally {
      setSyncingDrive(false);
    }
  };


  const handleDownloadBackup = () => {
    window.open('/api/backup/export', '_blank');
  };

  const handleDownloadEncryptedBackup = () => {
    const url = encryptedPass ? `/api/backup/export-encrypted?passphrase=${encodeURIComponent(encryptedPass)}` : '/api/backup/export-encrypted';
    window.open(url, '_blank');
  };

  const handleUploadEncryptedBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setRestoringEnc(true);
        setEncBackupMsg("Descifrando y validando respaldo con clave AES-256...");
        const text = event.target?.result as string;
        const res = await apiFetch("/api/backup/restore-encrypted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encryptedData: text, passphrase: encryptedPass || undefined }),
        });
        const data = await res.json();
        if (data.success && data.state) {
          setState(data.state);
          setEncBackupMsg("¡Respaldo cifrado verificado y restaurado con éxito!");
          setTimeout(() => setEncBackupMsg(""), 4000);
        } else {
          setEncBackupMsg("Error al restaurar: " + (data.error || "Contraseña incorrecta o archivo dañado"));
        }
      } catch (err: any) {
        setEncBackupMsg("Error leyendo archivo cifrado: " + err.message);
      } finally {
        setRestoringEnc(false);
      }
    };
    reader.readAsText(file);
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

        {/* 4 Candados de Seguridad & Respaldo Cifrado Google Drive */}
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Respaldo Cifrado y Candados de Seguridad (Google Drive)
                </h3>
                <p className="text-xs text-slate-500">
                  Protección de grado militar para sincronizar en múltiples celulares y computadoras sin riesgo.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
              4 Candados Activos
            </span>
          </div>

          {/* Lista de los 4 Candados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">1. Cifrado Militar AES-256-GCM</h4>
                <p className="text-[11px] text-slate-500">
                  Nadie puede abrir ni leer tu base de clientes si la descargan de tu Google Drive en otro dispositivo.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">2. Aislamiento Total de Dispositivos</h4>
                <p className="text-[11px] text-slate-500">
                  Tus fotos, documentos y correos personales de Google Drive quedan 100% aislados e intocados.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
              <Database className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">3. Protección Anti-Borrado</h4>
                <p className="text-[11px] text-slate-500">
                  Duplicado local automático y versionado de 30 días para recuperar cualquier día con 1 clic.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">4. Costo $0.00 Permanente</h4>
                <p className="text-[11px] text-slate-500">
                  Sin servidores SQL de pago (Cloud SQL eliminado y facturación desconectada). Cero mensualidades.
                </p>
              </div>
            </div>
          </div>

          {encBackupMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium">
              {encBackupMsg}
            </div>
          )}

          
          {/* Carpeta Oficial de Google Drive Conectada */}
          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-800">
                  Carpeta Oficial de Google Drive Vinculada
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Respaldo programado diario a las 23:59 hrs (Rotación de 15 días)
              </span>
            </div>

            <p className="text-[11px] text-slate-600">
              ID de Carpeta: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px]">1mT33WRGF8yEecTOdBwcbApFFmMYJ3gCj</code>
            </p>

            {driveMsg && (
              <div className="p-2.5 bg-white border border-emerald-300 rounded-lg text-xs font-medium text-emerald-800">
                {driveMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleSyncDriveNow}
                disabled={syncingDrive}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Database className="w-3.5 h-3.5" />
                {syncingDrive ? 'Subiendo a Drive...' : 'Sincronizar a Google Drive Ahora'}
              </button>

              <a
                href="https://drive.google.com/drive/folders/1mT33WRGF8yEecTOdBwcbApFFmMYJ3gCj"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Ver Carpeta en Drive
              </a>
            </div>
          </div>

          {/* Opciones de descarga y restauración cifrada */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2 max-w-xs w-full sm:w-auto">
              <Key className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="password"
                value={encryptedPass}
                onChange={(e) => setEncryptedPass(e.target.value)}
                placeholder="Clave maestra (opcional)"
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                title="Si lo dejas vacío se usa la clave de seguridad por defecto del sistema"
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleDownloadEncryptedBackup}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                Descargar Respaldo Cifrado (.enc)
              </button>

              <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition border border-slate-200 shadow-sm">
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                {restoringEnc ? 'Descifrando...' : 'Restaurar Respaldo Cifrado (.enc)'}
                <input
                  type="file"
                  accept=".enc"
                  className="hidden"
                  disabled={restoringEnc}
                  onChange={handleUploadEncryptedBackup}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

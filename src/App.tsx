import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from './lib/api';
import { AppState, PlannedVisit, ClientData } from './types';
import { Route, LayoutDashboard, Map, Map as MapIcon, Bell, Settings as SettingsIcon, LogOut, CheckCircle2, Navigation, AlertTriangle, RefreshCw, Users, Clock, DollarSign, BarChart3, Factory, ShoppingCart, Layers } from 'lucide-react';
import { motion } from 'motion/react';

// Subcomponents
import DashboardView from './components/DashboardView';
import PlannerView from './components/PlannerView';
import AlertsView from './components/AlertsView';
import SettingsView from './components/SettingsView';
import ZonesView from './components/ZonesView';
import ClientsView from './components/ClientsView';
import ReportsView from './components/ReportsView';
import SalesReportView from './components/SalesReportView';
import LiveRouteMonitor from './components/LiveRouteMonitor';
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import CommissionsView from './components/CommissionsView';
import ProductionView from './components/ProductionView';
import ProductionLinesView from './components/ProductionLinesView';
import PurchasesView from './components/PurchasesView';
import { auth } from './lib/firebase';


function App() {
  const { user: fbUser, token, login, logout, loading: fbLoading } = useAuth();
  const [user, setUser] = useState<{ username: string, role: string } | null>(() => {
    try {
      const stored = localStorage.getItem('offline_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem('offline_state');
      return stored ? JSON.parse(stored) : { clients: [], visits: [], routes: [], lastSync: null };
    } catch {
      return { clients: [], visits: [], routes: [], lastSync: null };
    }
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'alerts' | 'clientes' | 'settings' | 'reports' | 'sales_reports' | 'commissions' | 'zones' | 'production' | 'production_lines' | 'purchases'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const fetchData = () => {
    apiFetch('/api/data?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.error === 'Offline') {
          setIsOffline(true);
          setLoading(false);
          return;
        }
        setState(data);
        localStorage.setItem('offline_state', JSON.stringify(data));
        setLoading(false);
        setIsOffline(false);
      })
      .catch(e => {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
          setIsOffline(true);
        } else {
          if (e && e.message !== 'Failed to fetch' && !(e instanceof SyntaxError)) { console.error(e); }
        }
        setLoading(false);
      });
  };

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const fetchDelta = () => {
    const since = Date.now() - 15 * 60 * 1000; // 15 mins
    const currentVersion = stateRef.current?.stateVersion || 0;
    apiFetch(`/api/data/delta?since=${since}&version=${currentVersion}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(delta => {
        setState(prev => {
          const newVisits = [...prev.visits];
          if (delta.visits) {
             delta.visits.forEach((dv: any) => {
               const idx = newVisits.findIndex(v => v.id === dv.id);
               if (idx >= 0) newVisits[idx] = dv;
               else newVisits.push(dv);
             });
          }
          let newState: AppState;
          if (delta.needsFullSync) {
            newState = {
              ...prev,
              visits: newVisits,
              users: delta.users || prev.users,
              settings: delta.settings || prev.settings,
              routes: delta.routes || prev.routes,
              disabledZones: delta.disabledZones || prev.disabledZones,
              clientOverrides: delta.clientOverrides || prev.clientOverrides,
              zoneOverrides: delta.zoneOverrides || prev.zoneOverrides,
              stateVersion: delta.stateVersion || prev.stateVersion,
            };
          } else {
            newState = {
              ...prev,
              visits: newVisits,
              stateVersion: delta.stateVersion || prev.stateVersion
            };
          }
          localStorage.setItem('offline_state', JSON.stringify(newState));
          return newState;
        });
        setLoading(false);
        setIsOffline(false);
      })
      .catch(e => {
        setIsOffline(true);
      });
  };

  useEffect(() => {
    fetchData(); // initial full fetch

    const handleOnline = () => {
      fetchDelta();
    };
    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        fetchDelta();
      } else {
        setIsOffline(true);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (state.clients.length > 0 || state.visits.length > 0) {
      localStorage.setItem('offline_state', JSON.stringify(state));
    }
  }, [state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedUsername = loginForm.username.trim().replace(/[\x00-\x1F\x7F]/g, '');
    const sanitizedPassword = loginForm.password.trim();

    if (!sanitizedUsername || !sanitizedPassword) {
      setLoginError('Por favor, completa ambos campos.');
      return;
    }

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: sanitizedUsername, password: sanitizedPassword })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const userInfo = { username: data.user.username, role: data.user.role };
          setUser(userInfo);
          localStorage.setItem('offline_user', JSON.stringify(userInfo));
          setLoginError('');
          setLoginForm({ username: '', password: '' });
          fetchDelta();
          return;
        }
      } else if (res.status === 401) {
        setLoginError('Usuario o contraseña incorrectos');
        return;
      }
    } catch (netErr) {
      console.warn("Server login unreachable, trying offline fallback:", netErr);
    }

    const fallbackUsers = [
      { id: 1, username: 'Administrador', role: 'admin', password: 'Admin.1234' },
      { id: 2, username: 'Supervisor', role: 'supervisor', password: 'Super.1234' },
      { id: 3, username: 'Ruta 1', role: 'operator', password: 'Ruta1.1234' },
      { id: 4, username: 'Ruta 2', role: 'operator', password: 'Ruta2.1234' },
      { id: 5, username: 'Ruta 3', role: 'operator', password: 'Ruta3.1234' },
      { id: 6, username: 'Ruta 4', role: 'operator', password: 'Ruta4.1234' },
      { id: 7, username: 'Ruta 5', role: 'operator', password: 'Ruta5.1234' },
      { id: 8, username: 'Operador Producción', role: 'produccion', password: 'Produccion.1234' },
      { id: 9, username: 'Operador Planta', role: 'produccion', password: 'Produccion.1234' },
      { id: 10, username: 'Operador Línea', role: 'produccion_linea', password: 'Linea.1234' }
    ];

    const usersList = (state?.users && state.users.length > 0) ? state.users : fallbackUsers;
    const foundUser = usersList.find((u: any) => 
      u.username?.toLowerCase() === sanitizedUsername.toLowerCase() && 
      u.password === sanitizedPassword
    );
    
    if (foundUser) {
      const userInfo = { username: foundUser.username, role: foundUser.role };
      setUser(userInfo);
      localStorage.setItem('offline_user', JSON.stringify(userInfo));
      setLoginError('');
      setLoginForm({ username: '', password: '' });
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  useEffect(() => {
    if (token && fbUser) {
      apiFetch('/api/auth/role', { headers: { Authorization: 'Bearer ' + token }})
      .then(r => r.json())
      .then(d => {
         const r = d.role || 'user';
         const userInfo = { username: fbUser.email, role: r };
         setUser(userInfo);
         localStorage.setItem('offline_user', JSON.stringify(userInfo));
      }).catch(e => {
        if (e && e.message !== 'Failed to fetch') console.error(e);
      });
    }
  }, [token, fbUser]);

  const handleSignOut = () => {
    logout();
    setUser(null);
    localStorage.removeItem('offline_user');
    setLoginForm({ username: '', password: '' });
    setLoginError('');
  };

  const isAdmin = user?.role === 'admin';
  const isGerencia = user?.role === 'gerencia';
  const isSupervisorRutas = user?.role === 'supervisor_rutas' || user?.role === 'supervisor';
  const isSupervisorProduccion = user?.role === 'supervisor_produccion';
  const isProduccion = user?.role === 'produccion';
  const isProduccionLinea = user?.role === 'produccion_linea';
  const isOperator = user?.role === 'operator';

  const canAccessRoutes = isAdmin || isGerencia || isSupervisorRutas;
  const canAccessProduction = isAdmin || isGerencia || isSupervisorProduccion || isProduccion;
  const canAccessProductionLines = isAdmin || isGerencia || isSupervisorProduccion || isProduccionLinea;
  const canAccessPurchases = isAdmin || isGerencia || isSupervisorProduccion || isProduccion;
  const canManageCosts = isAdmin || isGerencia || isSupervisorProduccion || isProduccion;
  const role = user?.role || 'user';

  const [loginMode, setLoginMode] = useState<'rutas' | 'produccion' | 'gerencia' | 'all'>('rutas');

  useEffect(() => {
    const preferred = localStorage.getItem('preferred_view');
    if (preferred === 'production' && canAccessProduction) {
      setActiveTab('production');
      localStorage.removeItem('preferred_view');
      return;
    }
    if (user?.role === 'produccion_linea') {
      setActiveTab('production_lines');
    } else if (user?.role === 'produccion' || user?.role === 'supervisor_produccion') {
      setActiveTab('production');
    } else if (user?.role === 'supervisor_rutas' || user?.role === 'supervisor') {
      setActiveTab('dashboard');
    } else if (user?.role === 'operator') {
      if (!['dashboard', 'planner', 'sales_reports', 'commissions'].includes(activeTab)) {
        setActiveTab('planner');
      }
    }
  }, [user?.role]);

  if (!user) {
    const rawUsers = (state?.users && state.users.length > 0) ? state.users : [
      { id: 1, username: 'Administrador', role: 'admin' },
      { id: 2, username: 'Gerencia', role: 'gerencia' },
      { id: 3, username: 'Supervisor Rutas', role: 'supervisor_rutas' },
      { id: 4, username: 'Supervisor Planta', role: 'supervisor_produccion' },
      { id: 5, username: 'Operador Producción', role: 'produccion' },
      { id: 6, username: 'Operador Línea', role: 'produccion_linea' },
      { id: 7, username: 'Ruta 1', role: 'operator' },
      { id: 8, username: 'Ruta 2', role: 'operator' },
      { id: 9, username: 'Ruta 3', role: 'operator' },
      { id: 10, username: 'Ruta 4', role: 'operator' },
      { id: 11, username: 'Ruta 5', role: 'operator' }
    ];

    const availableUsers = rawUsers.filter((u: any) => {
      if (loginMode === 'rutas') {
        return ['supervisor_rutas', 'supervisor', 'operator', 'gerencia', 'admin'].includes(u.role);
      }
      if (loginMode === 'produccion') {
        return ['supervisor_produccion', 'produccion', 'produccion_linea', 'gerencia', 'admin'].includes(u.role);
      }
      if (loginMode === 'gerencia') {
        return ['gerencia', 'admin'].includes(u.role);
      }
      return true;
    });

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white p-7 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full">
          {/* Logo & Header */}
          <div className="flex flex-col items-center justify-center mb-3">
            <img 
              src="/logo-trujillos.png" 
              alt="Lácteos Trujillos" 
              className="h-16 w-auto object-contain drop-shadow-sm mb-1" 
            />
          </div>
          <h1 className="text-base font-bold text-center mb-0.5 tracking-tight text-slate-900">Distribución & Planta</h1>
          <p className="text-xs text-slate-500 text-center mb-4">
            {loginMode === 'produccion'
              ? 'Supervisión de Planta, Producción y Compras'
              : loginMode === 'gerencia'
              ? 'Panel de Gerencia y Dirección General'
              : 'Supervisión de Rutas y Choferes'}
          </p>

          {/* Area Selector Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-4 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => { setLoginMode('rutas'); setLoginForm({ username: '', password: '' }); }}
              className={`py-1.5 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                loginMode === 'rutas' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Route className="w-3 h-3 shrink-0" />
              <span>Rutas</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('produccion'); setLoginForm({ username: '', password: '' }); }}
              className={`py-1.5 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                loginMode === 'produccion' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Factory className="w-3 h-3 shrink-0" />
              <span>Planta</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('gerencia'); setLoginForm({ username: '', password: '' }); }}
              className={`py-1.5 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                loginMode === 'gerencia' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Gerencia</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('all'); setLoginForm({ username: '', password: '' }); }}
              className={`py-1.5 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
                loginMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Todos</span>
            </button>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-3.5 mb-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Usuario / Perfil
              </label>
              <select 
                value={loginForm.username} 
                onChange={e => {
                  setLoginForm({...loginForm, username: e.target.value});
                  setLoginError('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 text-xs"
              >
                <option value="">-- Selecciona tu usuario o rol --</option>
                {availableUsers.map((u: any) => (
                  <option key={u.id || u.username} value={u.username}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Contraseña</label>
              <input 
                type="password"
                value={loginForm.password}
                onChange={e => {
                  setLoginForm({...loginForm, password: e.target.value});
                  setLoginError('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 text-xs"
                placeholder="Ingresa tu contraseña"
              />
            </div>
            {loginError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium text-center">
                {loginError}
              </div>
            )}
            <button 
              type="submit" 
              className={`w-full py-3 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-xs ${
                loginMode === 'produccion' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Iniciar Sesión
            </button>
          </form>

          <div className="relative mb-4">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
             <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Supervisión con Google</span></div>
          </div>

          {/* Dual Clear Supervision Buttons */}
          <div className="space-y-2 text-center">
            <button 
              type="button" 
              onClick={() => {
                localStorage.setItem('preferred_view', 'dashboard');
                login();
              }} 
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2 text-xs"
            >
              <Route className="w-3.5 h-3.5 text-blue-400" />
              <span>Supervisión de Rutas (Google)</span>
            </button>

            <button 
              type="button" 
              onClick={() => {
                localStorage.setItem('preferred_view', 'production');
                login();
              }} 
              className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2 text-xs"
            >
              <Factory className="w-3.5 h-3.5 text-emerald-300" />
              <span>Supervisión de Producción (Google)</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Sidebar / Topbar */}
      <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col z-20 sticky top-0 md:h-screen shadow-sm md:shadow-none">
        {/* Header with App Title & Mobile User Switcher */}
        <div className="p-3 md:p-5 flex items-center justify-between border-b md:border-b-0 border-slate-100">
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo-trujillos.png" 
              alt="Lácteos Trujillos" 
              className="h-10 w-auto object-contain shrink-0" 
            />
            <div>
              <h1 className="font-bold text-slate-900 leading-tight text-sm md:text-base">Lácteos Trujillos</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] md:text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {user?.username || role}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase hidden md:inline">
                  • {role}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Change User / Logout button visible on mobile */}
          <button 
            onClick={handleSignOut} 
            className="flex md:hidden items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl transition-colors border border-rose-200 shadow-sm"
            title="Cambiar de usuario o cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir / Cambiar</span>
          </button>
        </div>

        {/* Tab Navigation with Clear Visible Labels on Both Mobile & Desktop */}
        <nav className="flex-1 px-3 md:px-4 py-2.5 md:py-2 flex md:flex-col gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible no-scrollbar">
          {(canAccessRoutes || isOperator) && (
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Ventas</span>
            </button>
          )}
          
          {(canAccessRoutes || isOperator) && (
            <button 
              onClick={() => setActiveTab('planner')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'planner' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <Map className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Planificador</span>
            </button>
          )}

          {canAccessRoutes && (
            <button 
              onClick={() => setActiveTab('clientes')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'clientes' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <Users className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Clientes</span>
            </button>
          )}

          {canAccessRoutes && (
            <button 
              onClick={() => setActiveTab('reports')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <Clock className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Histórico GPS</span>
            </button>
          )}

          {canAccessProduction && (
            <button 
              onClick={() => setActiveTab('production')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'production' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <Factory className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Planta y Empaque</span>
            </button>
          )}

          {canAccessProductionLines && (
            <button 
              onClick={() => setActiveTab('production_lines')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'production_lines' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <Layers className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Líneas de Producción</span>
            </button>
          )}

          {canAccessPurchases && (
            <button 
              onClick={() => setActiveTab('purchases')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'purchases' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Compras e Insumos</span>
            </button>
          )}

          {(canAccessRoutes || isOperator) && (
            <button 
              onClick={() => setActiveTab('sales_reports')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'sales_reports' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Reportes</span>
            </button>
          )}

          {(canAccessRoutes || isOperator) && (
            <button 
              onClick={() => setActiveTab('commissions')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'commissions' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Nómina y Comisiones</span>
            </button>
          )}

          {canAccessRoutes && (
            <button 
              onClick={() => setActiveTab('alerts')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'alerts' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <Bell className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Inteligencia</span>
            </button>
          )}

          {isAdmin && (
            <button 
              onClick={() => setActiveTab('zones')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'zones' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <MapIcon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Zonas</span>
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`flex items-center gap-2 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50 md:bg-transparent border border-slate-200/60 md:border-transparent'}`}
            >
              <SettingsIcon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span>Ajustes</span>
            </button>
          )}
        </nav>

        {/* User Card on Desktop Sidebar */}
        <div className="p-4 mt-auto border-t border-slate-100 hidden md:block">
          <div className="px-3 py-2.5 mb-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Sesión iniciada como:</span>
            <span className="text-sm font-bold text-slate-800 block truncate">{user?.username}</span>
            <span className="text-[11px] text-blue-600 font-semibold uppercase">{role}</span>
          </div>
          <button 
            onClick={handleSignOut} 
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl transition-colors border border-rose-200 shadow-sm"
            title="Cambiar de usuario o cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión / Cambiar</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-50 relative">
        {isOffline && (
          <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Modo Sin Conexión - Mostrando datos guardados localmente
          </div>
        )}
        <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-full">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Cargando datos...
            </div>
          ) : (
            <ErrorBoundary>
              {activeTab === 'dashboard' && <DashboardView state={state} role={role} user={user} />}
              {activeTab === 'planner' && <PlannerView state={state} role={role} user={user} setState={setState} />}
              {activeTab === 'clientes' && canAccessRoutes && <ClientsView state={state} setState={setState} role={role} user={user} />}
              {activeTab === 'reports' && (
                <>
                  {canAccessRoutes && (
                    <LiveRouteMonitor state={state} setState={setState} />
                  )}
                  <ReportsView state={state} />
                </>
              )}
              {activeTab === 'sales_reports' && <SalesReportView state={state} role={role} user={user} />}
              {activeTab === 'commissions' && <CommissionsView token={token!} state={state} role={role} user={user} />}
              {activeTab === 'alerts' && <AlertsView state={state} setState={setState} />}
              {activeTab === 'settings' && <SettingsView state={state} setState={setState} />}
              {activeTab === 'zones' && <ZonesView state={state} setState={setState} />}
              {activeTab === 'production' && <ProductionView role={role} user={user} state={state} />}
              {activeTab === 'production_lines' && canAccessProductionLines && <ProductionLinesView role={role} user={user} state={state} />}
              {activeTab === 'purchases' && canAccessPurchases && <PurchasesView role={role} user={user} state={state} />}
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

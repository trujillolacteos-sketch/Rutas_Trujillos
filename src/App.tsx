import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/api';
import { AppState, PlannedVisit, ClientData } from './types';
import { Route, LayoutDashboard, Map, Map as MapIcon, Bell, Settings as SettingsIcon, LogOut, CheckCircle2, Navigation, AlertTriangle, RefreshCw, Users, Clock, DollarSign, BarChart3 } from 'lucide-react';
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
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import CommissionsView from './components/CommissionsView';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'alerts' | 'clientes' | 'settings' | 'reports' | 'sales_reports' | 'commissions' | 'zones'>('dashboard');
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

  const fetchDelta = () => {
    const since = Date.now() - 15 * 60 * 1000; // 15 mins
    apiFetch('/api/data/delta?since=' + since, { cache: 'no-store' })
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
          const newState = { ...prev, visits: newVisits };
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedUsername = loginForm.username.trim().replace(/[\x00-\x1F\x7F]/g, '');
    const sanitizedPassword = loginForm.password.trim();

    if (!sanitizedUsername || !sanitizedPassword) {
      setLoginError('Por favor, completa ambos campos.');
      return;
    }

    const fallbackUsers = [
      { id: 1, username: 'Administrador', role: 'admin', password: 'Admin.1234' },
      { id: 2, username: 'Supervisor', role: 'supervisor', password: 'Super.1234' },
      { id: 3, username: 'Ruta 1', role: 'operator', password: 'Ruta1.1234' },
      { id: 4, username: 'Ruta 2', role: 'operator', password: 'Ruta2.1234' },
      { id: 5, username: 'Ruta 3', role: 'operator', password: 'Ruta3.1234' },
      { id: 6, username: 'Ruta 4', role: 'operator', password: 'Ruta4.1234' },
      { id: 7, username: 'Ruta 5', role: 'operator', password: 'Ruta5.1234' }
    ];

    const usersList = (state?.users && state.users.length > 0) ? state.users : fallbackUsers;
    const foundUser = usersList.find((u: any) => u.username === sanitizedUsername && u.password === sanitizedPassword);
    
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
  const isSupervisor = user?.role === 'supervisor';
  const isOperator = user?.role === 'operator';
  const role = user?.role || 'user';

  if (!user) {
    const availableUsers = (state?.users && state.users.length > 0) ? state.users : [
      { id: 1, username: 'Administrador', role: 'admin' },
      { id: 2, username: 'Supervisor', role: 'supervisor' },
      { id: 3, username: 'Ruta 1', role: 'operator' },
      { id: 4, username: 'Ruta 2', role: 'operator' },
      { id: 5, username: 'Ruta 3', role: 'operator' },
      { id: 6, username: 'Ruta 4', role: 'operator' },
      { id: 7, username: 'Ruta 5', role: 'operator' }
    ];

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-2">
              <Route className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-1 tracking-tight text-slate-900">Lácteos Trujillos</h1>
          <p className="text-sm text-slate-500 text-center mb-6">Control de Rutas y Distribución</p>
          
          <form onSubmit={handleLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Usuario / Ruta</label>
              <select 
                value={loginForm.username} 
                onChange={e => {
                  setLoginForm({...loginForm, username: e.target.value});
                  setLoginError('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="">-- Selecciona tu usuario o ruta --</option>
                {availableUsers.map((u: any) => (
                  <option key={u.id || u.username} value={u.username}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Contraseña</label>
              <input 
                type="password"
                value={loginForm.password}
                onChange={e => {
                  setLoginForm({...loginForm, password: e.target.value});
                  setLoginError('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                placeholder="Ingresa tu contraseña"
              />
            </div>
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium text-center">
                {loginError}
              </div>
            )}
            <button 
              type="submit" 
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
            >
              Iniciar Sesión
            </button>
          </form>

          <div className="relative mb-6">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
             <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400 font-medium uppercase tracking-wider">O con cuenta Google</span></div>
          </div>

          <div className="space-y-4 text-center">
            <button 
              type="button" 
              onClick={login} 
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
            >
               Supervisión (Google)
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col z-20 sticky top-0 md:h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-sm">
            <Route className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">OdooRoute</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{role}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="hidden md:inline">Dashboard</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('planner')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'planner' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Map className="w-5 h-5" />
            <span className="hidden md:inline">Planificador</span>
          </button>

          {(isAdmin || isSupervisor) && (
            <>
              <button 
                onClick={() => setActiveTab('clientes')} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'clientes' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Users className="w-5 h-5" />
                <span className="hidden md:inline">Clientes</span>
              </button>
              <button 
                onClick={() => setActiveTab('reports')} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reports' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Clock className="w-5 h-5" />
                <span className="hidden md:inline">Histórico GPS</span>
              </button>
              <button 
                onClick={() => setActiveTab('sales_reports')} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'sales_reports' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="hidden md:inline">Reportes</span>
              </button>
            </>
          )}


          {(isAdmin || isSupervisor) && (
            <button 
              onClick={() => setActiveTab('commissions')} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'commissions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <DollarSign className="w-5 h-5" />
              <span className="hidden md:inline">Nómina y Comisiones</span>
            </button>
          )}

          {(isAdmin || isSupervisor) && (
            <button 
              onClick={() => setActiveTab('alerts')} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'alerts' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Bell className="w-5 h-5" />
              <span className="hidden md:inline">Inteligencia</span>
            </button>
          )}

          {isAdmin && (
            <button 
              onClick={() => setActiveTab('zones')} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'zones' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <MapIcon className="w-5 h-5" />
              <span className="hidden md:inline">Zonas</span>
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="hidden md:inline">Ajustes</span>
            </button>
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
          <div className="px-3 py-2 mb-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Sesión iniciada como:</span>
            <span className="text-sm font-bold text-slate-800 block truncate">{user?.username}</span>
            <span className="text-[11px] text-blue-600 font-semibold uppercase">{role}</span>
          </div>
          <button 
            onClick={handleSignOut} 
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-xl transition-colors border border-rose-200"
            title="Cerrar sesión o cambiar de usuario"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Cerrar Sesión</span>
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
              {activeTab === 'dashboard' && <DashboardView state={state} role={role} />}
              {activeTab === 'planner' && <PlannerView state={state} role={role} user={user} setState={setState} />}
              {activeTab === 'clientes' && <ClientsView state={state} setState={setState} />}
              {activeTab === 'reports' && <ReportsView state={state} />}
              {activeTab === 'sales_reports' && <SalesReportView state={state} />}
              {activeTab === 'commissions' && <CommissionsView token={token!} state={state} />}
              {activeTab === 'alerts' && <AlertsView state={state} setState={setState} />}
              {activeTab === 'settings' && <SettingsView state={state} setState={setState} />}
              {activeTab === 'zones' && <ZonesView state={state} setState={setState} />}
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

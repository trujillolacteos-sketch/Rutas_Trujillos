import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { AppState } from '../types';
import { Users, TrendingUp, DollarSign, MapPin, AlertTriangle } from 'lucide-react';
import { ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, ScatterChart, Scatter, ZAxis, ReferenceLine } from 'recharts';


function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

export default function DashboardView({ 
  state, 
  role, 
  user 
}: { 
  state: AppState; 
  role?: string; 
  user?: { username: string; role: string }; 
}) {
  const [commissions, setCommissions] = useState<any[]>([]);

  const isOperator = role === 'operator';
  const operatorRoute = React.useMemo(() => {
    if (!isOperator || !user) return null;
    return (state.routes || []).find(r => r.name.toLowerCase() === user.username.toLowerCase());
  }, [isOperator, user, state.routes]);

  const effectiveVisits = React.useMemo(() => {
    if (isOperator && operatorRoute) {
      return (state.visits || []).filter(v => v.routeId === operatorRoute.id);
    }
    return state.visits || [];
  }, [isOperator, operatorRoute, state.visits]);

  const effectiveRoutes = React.useMemo(() => {
    if (isOperator && operatorRoute) {
      return (state.routes || []).filter(r => r.id === operatorRoute.id);
    }
    return state.routes || [];
  }, [isOperator, operatorRoute, state.routes]);

  const routeClientIds = React.useMemo(() => {
    if (isOperator && operatorRoute) {
      return new Set(effectiveVisits.map(v => v.clientId));
    }
    return null;
  }, [isOperator, operatorRoute, effectiveVisits]);

  const effectiveClients = React.useMemo(() => {
    if (routeClientIds) {
      return (state.clients || []).filter(c => 
        routeClientIds.has(c.id) || 
        c.assignedRouteId === operatorRoute?.id || 
        c.permanentRouteId === operatorRoute?.id
      );
    }
    return state.clients || [];
  }, [routeClientIds, state.clients, operatorRoute]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    apiFetch('/api/commissions', { headers })
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) setCommissions(data);
      })
      .catch(e => { if (e.message !== 'Failed to fetch') console.error(e) });
  }, []);

  const effectiveCommissions = React.useMemo(() => {
    if (!Array.isArray(commissions)) return [];
    if (isOperator && operatorRoute) {
      return commissions.filter(c => 
        c.routeId === operatorRoute.id || 
        (c.routeName && c.routeName.toLowerCase() === operatorRoute.name.toLowerCase())
      );
    }
    return commissions;
  }, [isOperator, operatorRoute, commissions]);

  // Stats calculations
  const totalVisits = effectiveVisits.length;
  const completedVisits = effectiveVisits.filter(v => v.status === 'SURTIDO' || v.status === 'VISITADO').length;
  const pendingVisits = effectiveVisits.filter(v => v.status === 'PENDIENTE').length;
  
  const getWeekNumber = (d: string | Date | number) => {
    if (!d) return 0;
    try {
      const date = typeof d === 'string' && !d.includes('T') ? new Date(d + 'T00:00:00') : new Date(d);
      date.setHours(0, 0, 0, 0);
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      const pastDaysOfYear = Math.round((date.getTime() - startOfYear.getTime()) / 86400000);
      return Math.floor((pastDaysOfYear + startOfYear.getDay()) / 7) + 1;
    } catch {
      return 0;
    }
  };

  const weeklySalesData = React.useMemo(() => {
    if (!effectiveCommissions || effectiveCommissions.length === 0) return [];
    
    const weeklyTotals: Record<string, { conCliente: number; sinCliente: number; total: number }> = {};
    effectiveCommissions.forEach(c => {
       const week = `Semana ${getWeekNumber(c.dateOrder)}`;
       if (!weeklyTotals[week]) {
         weeklyTotals[week] = { conCliente: 0, sinCliente: 0, total: 0 };
       }
       const amt = Number(c.orderTotal) || 0;
       const isSinCliente = c.clientType === 'sin_cliente' || !c.clientId;
       if (isSinCliente) {
         weeklyTotals[week].sinCliente += amt;
       } else {
         weeklyTotals[week].conCliente += amt;
       }
       weeklyTotals[week].total += amt;
    });

    const sortedWeeks = Object.keys(weeklyTotals).sort((a, b) => parseInt(a.split(" ")[1]) - parseInt(b.split(" ")[1]));
    
    // Get last 10 weeks or so
    return sortedWeeks.slice(-10).map(w => ({
       name: w,
       Ventas: Math.round(weeklyTotals[w].conCliente),
       sinCliente: Math.round(weeklyTotals[w].sinCliente),
       total: Math.round(weeklyTotals[w].total),
    }));
  }, [effectiveCommissions]);

  const currentWeekNumber = getWeekNumber(new Date());

  const averageWeeklySales = React.useMemo(() => {
    if (weeklySalesData.length > 0) {
      const completedWeeks = weeklySalesData.filter(w => w.name !== `Semana ${currentWeekNumber}`);
      const sliceWeeks = completedWeeks.length >= 2 ? completedWeeks.slice(-4) : weeklySalesData;
      const total = sliceWeeks.reduce((acc, w) => acc + w.Ventas, 0);
      return Math.round(total / (sliceWeeks.length || 1));
    }
    return Math.round(effectiveClients.reduce((acc, c) => acc + (c.salesVolume || 0), 0) / 14);
  }, [weeklySalesData, effectiveClients, currentWeekNumber]);

  const actualSalesThisWeek = React.useMemo(() => {
    if (effectiveCommissions && effectiveCommissions.length > 0) {
      const thisWeekOrders = effectiveCommissions.filter(c => getWeekNumber(c.dateOrder) === currentWeekNumber);
      if (thisWeekOrders.length > 0) {
        return thisWeekOrders.filter(c => c.clientType !== 'sin_cliente' && c.clientId).reduce((acc, c) => acc + (c.orderTotal || 0), 0);
      }
    }
    return effectiveClients.filter(c => c.boughtThisWeek).reduce((acc, c) => acc + (c.salesVolume || 0) / 14, 0);
  }, [effectiveCommissions, effectiveClients, currentWeekNumber]);

  const actualSinClienteThisWeek = React.useMemo(() => {
    if (effectiveCommissions && effectiveCommissions.length > 0) {
      const thisWeekOrders = effectiveCommissions.filter(c => getWeekNumber(c.dateOrder) === currentWeekNumber);
      return thisWeekOrders.filter(c => c.clientType === 'sin_cliente' || !c.clientId).reduce((acc, c) => acc + (c.orderTotal || 0), 0);
    }
    return 0;
  }, [effectiveCommissions, currentWeekNumber]);

  const actualTotalThisWeek = actualSalesThisWeek + actualSinClienteThisWeek;

  const salesData = [
    {
      name: 'Ventas Semana',
      'Promedio Semanal': averageWeeklySales,
      'Venta Actual': Math.round(actualSalesThisWeek),
    }
  ];

  const visitsData = [
    { name: 'Visitados', value: completedVisits },
    { name: 'No Visitados', value: pendingVisits }
  ];

  const efficiencyData = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map(day => {
    const dayVisits = effectiveVisits.filter(v => v.day === day);
    const scheduled = dayVisits.length;
    const completed = dayVisits.filter(v => v.status === 'SURTIDO' || v.status === 'VISITADO').length;
    return {
      day,
      Programadas: scheduled,
      Completadas: completed,
      Eficiencia: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
    };
  });

  const VEHICLE_CAPACITY = 25000;
  
  const routeDistances = effectiveRoutes.map(route => {
    const visits = effectiveVisits.filter(v => v.routeId === route.id);
    let totalDist = 0;
    if (visits.length > 1) {
      for (let i = 0; i < visits.length - 1; i++) {
        if (visits[i].lat && visits[i].lng && visits[i+1].lat && visits[i+1].lng) {
          totalDist += getDistance(visits[i].lat, visits[i].lng, visits[i+1].lat, visits[i+1].lng);
        }
      }
    }
    const stops = visits.length;
    const distancePerStop = stops > 0 ? totalDist / stops : 0;
    return {
      id: route.id,
      name: route.name,
      distancia: Math.round(totalDist),
      paradas: stops,
      ineficiencia: distancePerStop
    };
  }).filter(r => r.paradas > 0);

  const avgInefficiency = routeDistances.length > 0 
    ? routeDistances.reduce((acc, curr) => acc + curr.ineficiencia, 0) / routeDistances.length 
    : 0;

  const inefficiencyThreshold = avgInefficiency > 0 ? avgInefficiency * 1.5 : 10;

  const inefficiencyData = routeDistances.map(r => ({
    ...r,
    alert: r.ineficiencia > inefficiencyThreshold,
    fill: r.ineficiencia > inefficiencyThreshold ? '#ef4444' : '#3b82f6'
  }));

  const routeMetrics = effectiveRoutes.map(route => {
    const visits = effectiveVisits.filter(v => v.routeId === route.id);
    const pending = visits.filter(v => v.status === 'PENDIENTE').length;
    const load = visits.reduce((acc, visit) => {
      const client = state.clients.find(c => c.id === visit.clientId);
      return acc + ((client?.salesVolume || 0) / 14);
    }, 0);
    return {
      name: route.name,
      pendientes: pending,
      carga: Math.round(load),
      capacidadUsada: Math.min(Math.round((load / VEHICLE_CAPACITY) * 100), 100)
    };
  }).filter(r => r.pendientes > 0 || r.carga > 0);

  const activeRoutesCount = routeMetrics.length;
  const avgCapacity = activeRoutesCount > 0 
    ? Math.round(routeMetrics.reduce((acc, curr) => acc + curr.capacidadUsada, 0) / activeRoutesCount) 
    : 0;

  const COLORS = ['#10b981', '#f43f5e'];

  const routeDayDetails = [];
  const routeDayChartData = [];
  const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const routeNames = effectiveRoutes.map(r => r.name);
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
  
  DAYS.forEach(day => {
    const dayData = { day };
    effectiveRoutes.forEach(route => {
      const visits = effectiveVisits.filter(v => v.routeId === route.id && v.day === day);
      if (visits.length > 0) {
        let totalDist = 0;
        for (let i = 0; i < visits.length - 1; i++) {
          if (visits[i].lat && visits[i].lng && visits[i+1].lat && visits[i+1].lng) {
            totalDist += getDistance(visits[i].lat, visits[i].lng, visits[i+1].lat, visits[i+1].lng);
          }
        }
        const km = Math.round(totalDist);
        routeDayDetails.push({
          day,
          routeName: route.name,
          visits: visits.length,
          km: km,
          kmPerStop: visits.length > 0 ? (totalDist / visits.length).toFixed(1) : 0
        });
        dayData[route.name + 'Visits'] = visits.length;
        dayData[route.name + 'Km'] = km;
      } else {
        dayData[route.name + 'Visits'] = 0;
        dayData[route.name + 'Km'] = 0;
      }
    });
    routeDayChartData.push(dayData);
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isOperator ? `Ventas y Rendimiento — ${operatorRoute?.name || user?.username || 'Mi Ruta'}` : 'Ventas y Rendimiento'}
            </h2>
            {isOperator && (
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
                {operatorRoute?.name || user?.username || 'Mi Ruta'}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {isOperator 
              ? `Estadísticas exclusivas de entregas, avance semanal y eficiencia para ${operatorRoute?.name || user?.username || 'tu ruta'}` 
              : 'Estadísticas globales, avance operativo y proyecciones de rutas'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-md">Esta Semana</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Visitas Completadas</p>
            <h3 className="text-2xl font-bold text-slate-900">{completedVisits} <span className="text-sm font-medium text-slate-400">/ {totalVisits}</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-md">Últimas 4 Semanas</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Promedio Semanal</p>
            <h3 className="text-2xl font-bold text-slate-900">${averageWeeklySales.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <DollarSign className="w-5 h-5" />
            </div>
            {actualSinClienteThisWeek > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md" title="Ventas POS sin cliente asignado">
                +${Math.round(actualSinClienteThisWeek).toLocaleString()} Sin Cliente
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Venta Esta Semana</p>
            <h3 className="text-2xl font-bold text-slate-900">${actualSalesThisWeek.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            {actualSinClienteThisWeek > 0 && (
              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                Total con mostrador: <strong className="text-blue-700">${Math.round(actualTotalThisWeek).toLocaleString()}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Visitas Pendientes</p>
            <h3 className="text-2xl font-bold text-slate-900">{pendingVisits}</h3>
          </div>
        </div>
      </div>

      {/* Tarjeta de Resumen Operativo */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <div className="w-full lg:w-1/3 space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">Resumen Operativo</h3>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-600 font-medium text-sm">{isOperator ? 'Tu Ruta' : 'Rutas Activas'}</span>
              <span className="text-xl font-bold text-slate-900">{isOperator ? (operatorRoute?.name || user?.username || 'Asignada') : activeRoutesCount}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-600 font-medium text-sm">Capacidad Media Usada</span>
              <span className="text-xl font-bold text-blue-600">{avgCapacity}%</span>
            </div>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-600 font-medium text-sm">Visitas Pendientes Totales</span>
              <span className="text-xl font-bold text-rose-600">{pendingVisits}</span>
            </div>
          </div>
          <div className="w-full lg:w-2/3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', color: '#64748b'}}/>
                <Bar yAxisId="left" dataKey="capacidadUsada" name="Capacidad (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar yAxisId="right" dataKey="pendientes" name="Visitas Pendientes" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex justify-between items-center">
             <span>{isOperator ? `Ventas Reales por Semana (${operatorRoute?.name || user?.username || 'Mi Ruta'})` : 'Ventas Reales por Semana (Odoo - 100 Días)'}</span>
             <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">Ventas Hechas</span>
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={weeklySalesData}
                margin={{ top: 20, right: 25, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
                {/* Eje Izquierdo: Barras de Ventas con y sin cliente */}
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  width={60}
                  style={{ fontSize: '11px' }}
                />
                {/* Eje Derecho (Secundario): Ventas Totales */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  width={60}
                  style={{ fontSize: '11px' }}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  formatter={(value: number, name: string) => [
                    `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    name
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                {/* Barra existente e intacta: Ventas (con cliente / ruteros) */}
                <Bar
                  yAxisId="left"
                  dataKey="Ventas"
                  name="Ventas Rutero (Con Cliente)"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />

                {/* Barra adicional: Ventas Sin Cliente */}
                <Bar
                  yAxisId="left"
                  dataKey="sinCliente"
                  name="Ventas Sin Cliente"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />

                {/* Eje Secundario: Ventas Totales */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total"
                  name="Ventas Totales (Eje Der.)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">Estado de Visitas</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visitsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {visitsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">Eficiencia de Visitas por Día</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={efficiencyData}
                margin={{ top: 20, right: 30, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', color: '#64748b'}}/>
                <Bar yAxisId="left" dataKey="Programadas" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar yAxisId="left" dataKey="Completadas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">Progreso por Día y Ruta</h3>
          <div className="space-y-6">
            {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map(day => {
              const dayVisits = effectiveVisits.filter(v => v.day === day);
              if (dayVisits.length === 0) return null;
              const completed = dayVisits.filter(v => v.status !== 'PENDIENTE').length;
              const pct = Math.round((completed / dayVisits.length) * 100);
              
              // Break down by route for this day
              const routesForDay = Array.from(new Set(dayVisits.map(v => v.routeId)));
              
              return (
                <div key={day} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-bold text-slate-900">{day}</span>
                    <span className="font-bold text-slate-900">{pct}% ({completed}/{dayVisits.length})</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                  
                  {/* Route Breakdown */}
                  <div className="space-y-2.5 pl-2 mt-3 border-l-2 border-slate-100">
                    {routesForDay.map(routeId => {
                      const routeVisits = dayVisits.filter(v => v.routeId === routeId);
                      const routeCompleted = routeVisits.filter(v => v.status !== 'PENDIENTE').length;
                      const routePct = Math.round((routeCompleted / routeVisits.length) * 100);
                      const routeName = state.routes.find(r => r.id === routeId)?.name || `Ruta ${routeId}`;
                      
                      return (
                        <div key={routeId}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-600 truncate mr-2" title={routeName}>{routeName}</span>
                            <span className="font-medium text-slate-600 whitespace-nowrap">{routePct}% ({routeCompleted}/{routeVisits.length})</span>
                          </div>
                          <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${routePct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">Eficiencia de Ruta (Paradas vs Distancia)</h3>
          {inefficiencyData.some(d => d.alert) && (
            <span className="flex items-center text-xs font-bold text-rose-700 bg-rose-100 px-3 py-1 rounded-full">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Rutas Ineficientes Detectadas
            </span>
          )}
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                type="number" 
                dataKey="paradas" 
                name="Paradas" 
                tick={{fontSize: 12, fill: '#64748b'}} 
                axisLine={false} 
                tickLine={false} 
                label={{ value: 'Número de Paradas', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#64748b' }} 
              />
              <YAxis 
                type="number" 
                dataKey="distancia" 
                name="Distancia (km)" 
                tick={{fontSize: 12, fill: '#64748b'}} 
                axisLine={false} 
                tickLine={false}
                label={{ value: 'Distancia Recorrida (km)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#64748b' }}
              />
              <ZAxis type="number" range={[100, 100]} />
              <RechartsTooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px'}}
                formatter={(value, name) => [value, name === 'paradas' ? 'Paradas' : 'Distancia (km)']}
                labelFormatter={() => ''}
              />
              <Scatter name="Rutas" data={inefficiencyData} fill="#8884d8">
                {inefficiencyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        {inefficiencyData.some(d => d.alert) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Rutas que requieren revisión:</h4>
            <div className="flex flex-wrap gap-2">
              {inefficiencyData.filter(d => d.alert).map(route => (
                <div key={route.id} className="flex flex-col text-xs bg-rose-50 border border-rose-100 p-2 rounded-lg">
                  <span className="font-bold text-rose-800">{route.name}</span>
                  <span className="text-rose-600">{(route.distancia / route.paradas).toFixed(1)} km/parada</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mt-6">
        <h3 className="font-bold text-slate-800 mb-4">Análisis de Carga y Distancia por Ruta y Día</h3>
        
        
        <div className="mb-8">
          <div className="h-[400px]">
            <h4 className="text-sm font-semibold text-slate-700 mb-2 text-center">Visitas (Barras) y Kilómetros (Líneas) por Ruta y Día</h4>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={routeDayChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} label={{ value: 'Visitas', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} label={{ value: 'Kilómetros', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', color: '#64748b'}} />
                
                {routeNames.map((name, idx) => (
                  <Bar key={'bar-'+name} dataKey={name + 'Visits'} name={name + ' (Visitas)'} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} yAxisId="left" />
                ))}
                
                {routeNames.map((name, idx) => (
                  <Line type="monotone" key={'line-'+name} dataKey={name + 'Km'} name={name + ' (Km)'} stroke={colors[idx % colors.length]} strokeWidth={3} dot={{r: 4, fill: colors[idx % colors.length]}} activeDot={{r: 6}} yAxisId="right" />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="overflow-x-auto border-t border-slate-100 pt-6">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Día</th>
                <th className="px-4 py-3">Ruta</th>
                <th className="px-4 py-3 text-right">Paradas</th>
                <th className="px-4 py-3 text-right">Distancia (km)</th>
                <th className="px-4 py-3 text-right">Eficiencia (km/p)</th>
              </tr>
            </thead>
            <tbody>
              {routeDayDetails.map((rd, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{rd.day}</td>
                  <td className="px-4 py-3">{rd.routeName}</td>
                  <td className="px-4 py-3 text-right font-medium">{rd.visits}</td>
                  <td className="px-4 py-3 text-right">{rd.km}</td>
                  <td className="px-4 py-3 text-right">{rd.kmPerStop}</td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      </div>
    </div>
  );
}


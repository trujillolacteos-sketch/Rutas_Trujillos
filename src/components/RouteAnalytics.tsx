import React, { useMemo } from 'react';
import { AppState } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, BatteryCharging, Zap } from 'lucide-react';

export default function RouteAnalytics({ state }: { state: AppState }) {
  
  // Analizar datos para predecir potencial
  const routeStats = useMemo(() => {
    return state.routes.map(route => {
      // Clientes asignados a esta ruta
      const routeClients = state.clients.filter(c => c.assignedRouteId === route.id);
      
      // Distribución por día
      const daysCount = { "Lunes":0, "Martes":0, "Miércoles":0, "Jueves":0, "Viernes":0, "Sábado":0 };
      let totalVisits = 0;
      
      routeClients.forEach(c => {
         const freq = c.visitFrequency || 1;
         totalVisits += freq;
         // Estimación simple de días
      });
      
      // Esta estimación requiere analizar state.visits. 
      // Mejor usamos el plan generado (state.visits)
      const plannedVisits = state.visits.filter(v => v.routeId === route.id);
      plannedVisits.forEach(v => {
        if (daysCount.hasOwnProperty(v.day)) {
           daysCount[v.day as keyof typeof daysCount]++;
        }
      });
      
      const maxDailyVisits = Math.max(...Object.values(daysCount));
      const avgDailyVisits = totalVisits / 6;
      
      // Calcular "Dispersión" aproximada (promedio de distancia al centroide)
      let cLat = 0, cLng = 0;
      routeClients.forEach(c => { cLat += c.lat; cLng += c.lng; });
      if (routeClients.length > 0) {
        cLat /= routeClients.length;
        cLng /= routeClients.length;
      }
      
      let dispersion = 0;
      routeClients.forEach(c => {
         const dist = Math.sqrt((c.lat - cLat)**2 + (c.lng - cLng)**2) * 111;
         dispersion += dist;
      });
      const avgDispersion = routeClients.length > 0 ? dispersion / routeClients.length : 0;
      
      // Índice de Potencialidad (0 a 100)
      // Menos dispersión = Más potencial para meter más clientes
      // Menos carga actual = Más potencial
      const MAX_CAPACITY_PER_DAY = 60; // asumiendo 60 clientes max por dia
      const capacityUsage = maxDailyVisits / MAX_CAPACITY_PER_DAY;
      const densityScore = Math.max(0, 1 - (avgDispersion / 15)); // 15km avg dispersion = 0 score
      
      const potentialScore = Math.round(((1 - capacityUsage) * 0.6 + densityScore * 0.4) * 100);

      return {
        id: route.id,
        name: route.name,
        visits: Object.values(daysCount),
        maxVisits: maxDailyVisits,
        avgDispersion: avgDispersion.toFixed(1),
        potentialScore,
        capacityUsage: Math.round(capacityUsage * 100),
        densityScore: Math.round(densityScore * 100)
      };
    }).sort((a, b) => b.potentialScore - a.potentialScore);
  }, [state.routes, state.clients, state.visits]);

  const radarData = routeStats.map(r => ({
    subject: r.name,
    A: r.potentialScore,
    fullMark: 100,
  }));

  const workloadData = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((day, idx) => {
    const obj: any = { name: day };
    routeStats.forEach(r => {
      obj[r.name] = r.visits[idx] || 0;
    });
    return obj;
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 shadow-xl text-white">
        <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
          <Zap className="w-6 h-6 text-amber-400" />
          Predictor de Potencialidad de Rutas
        </h2>
        <p className="text-indigo-200">
          Análisis de densidad geográfica y capacidad de carga para identificar qué rutas pueden absorber más clientes en la planeación.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Índice Global de Potencial
          </h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar isAnimationActive={false} name="Potencial (%)" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.5} />
                <RechartsTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 text-center mt-2">Basado en dispersión (km) vs capacidad máxima (visitas/día)</p>
        </div>

        {/* Bar Chart - Workload */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BatteryCharging className="w-5 h-5 text-emerald-600" />
            Saturación Proyectada por Día
          </h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={workloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {routeStats.map((r, i) => (
                    <linearGradient key={r.id} id={`color${r.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={`hsl(${i * 137 % 360}, 70%, 50%)`} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={`hsl(${i * 137 % 360}, 70%, 50%)`} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                {routeStats.map((r, i) => (
                  <Area isAnimationActive={false} 
                    key={r.id} 
                    type="monotone" 
                    dataKey={r.name} 
                    stroke={`hsl(${i * 137 % 360}, 70%, 50%)`} 
                    fillOpacity={1} 
                    fill={`url(#color${r.id})`} 
                    stackId="1"
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tarjetas de Análisis Detallado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routeStats.map((route, idx) => (
          <div key={route.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-2 h-full ${route.potentialScore > 70 ? 'bg-emerald-500' : route.potentialScore > 40 ? 'bg-amber-400' : 'bg-rose-500'}`} />
            <h4 className="font-bold text-slate-800 text-lg mb-4">{route.name}</h4>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Potencial de Expansión</span>
                  <span className={route.potentialScore > 70 ? 'text-emerald-600' : 'text-slate-700'}>{route.potentialScore}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${route.potentialScore > 70 ? 'bg-emerald-500' : route.potentialScore > 40 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${route.potentialScore}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Dispersión Promedio</p>
                  <p className="text-xl font-black text-slate-700">{route.avgDispersion} <span className="text-sm font-semibold text-slate-400">km</span></p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Pico Máximo</p>
                  <p className="text-xl font-black text-slate-700">{route.maxVisits} <span className="text-sm font-semibold text-slate-400">visitas</span></p>
                </div>
              </div>

              {route.potentialScore > 70 && (
                <div className="bg-indigo-50 text-indigo-700 text-xs font-bold p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Ruta altamente densa. Puedes agregar hasta {60 - route.maxVisits} visitas extra el día de mayor holgura sin afectar la eficiencia.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

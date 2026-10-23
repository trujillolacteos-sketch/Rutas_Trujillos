import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import {
  Layers,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Milk,
  Flame,
  Snowflake,
  Pizza,
  Sparkles,
  Info,
  Scale,
  PackageCheck
} from 'lucide-react';
import { AppState } from '../types';

export type ProductionLineId = 
  | 'descremado_pasteurizado'
  | 'queso_pizzero'
  | 'quesos_calientes'
  | 'quesos_frescos'
  | 'quesos_frios';

interface LineMeta {
  id: ProductionLineId;
  name: string;
  badge: string;
  icon: any;
  color: string;
  activeColor: string;
  bgLight: string;
}

const PRODUCTION_LINES: LineMeta[] = [
  {
    id: 'descremado_pasteurizado',
    name: 'Descremado y Pasteurizado',
    badge: 'Línea Base',
    icon: Milk,
    color: 'text-sky-600',
    activeColor: 'bg-sky-600 text-white',
    bgLight: 'bg-sky-50'
  },
  {
    id: 'queso_pizzero',
    name: 'Queso Pizzero',
    badge: 'Alta Demanda',
    icon: Pizza,
    color: 'text-amber-600',
    activeColor: 'bg-amber-600 text-white',
    bgLight: 'bg-amber-50'
  },
  {
    id: 'quesos_calientes',
    name: 'Quesos Calientes',
    badge: 'Asadero & Mozzarella',
    icon: Flame,
    color: 'text-orange-600',
    activeColor: 'bg-orange-600 text-white',
    bgLight: 'bg-orange-50'
  },
  {
    id: 'quesos_frescos',
    name: 'Quesos Frescos',
    badge: 'Panela & Adoberas',
    icon: Sparkles,
    color: 'text-emerald-600',
    activeColor: 'bg-emerald-600 text-white',
    bgLight: 'bg-emerald-50'
  },
  {
    id: 'quesos_frios',
    name: 'Quesos Fríos',
    badge: 'Oaxaca, Manchego, Cheddar',
    icon: Snowflake,
    color: 'text-indigo-600',
    activeColor: 'bg-indigo-600 text-white',
    bgLight: 'bg-indigo-50'
  }
];

// Insumos estándar por tipo de línea
const INSUMOS_18 = [
  'Leche en polvo', 'P. Titanium', 'Sabor', 'Fáxil',
  'Sorbato', 'Benzoato', 'Citrato', 'Sal refinada',
  'Natamicina', 'Estabilizante', 'Núcleo', 'Grasa Vegetal',
  'Inagel', 'Cuajo', 'Dióxido', 'C. Calcio',
  'Ácido Cítrico', 'Pasta'
];

const INSUMOS_17 = [
  'Leche en polvo', 'P. Titanium', 'Sabor', 'Fáxil',
  'Sorbato', 'Benzoato', 'Citrato', 'Sal refinada',
  'Natamicina', 'Estabilizante', 'Núcleo', 'Grasa Vegetal',
  'Inagel', 'Cuajo', 'Dióxido', 'C. Calcio',
  'Ácido Cítrico'
];

// Presentaciones por línea
const PRESENTACIONES_PIZZERO = [
  { id: 'Queso Pizzero 1 kg', name: 'Queso Pizzero 1 kg', unitKg: 1 },
  { id: 'Queso Pizzero 1/2 kg', name: 'Queso Pizzero 1/2 kg', unitKg: 0.5 },
  { id: 'Pizzero 1/4', name: 'Pizzero 1/4 kg', unitKg: 0.25 }
];

const PRESENTACIONES_CALIENTES = [
  { id: 'Queso Asadero Adobado 1 kg', name: 'Queso Asadero Adobado 1 kg', unitKg: 1 },
  { id: 'Queso Asadero Adobado 500 g', name: 'Queso Asadero Adobado 500 g', unitKg: 0.5 },
  { id: 'Queso Asadero Barra 250 g', name: 'Queso Asadero Barra 250 g', unitKg: 0.25 },
  { id: 'Queso Asadero Barra 500 g', name: 'Queso Asadero Barra 500 g', unitKg: 0.5 },
  { id: 'Queso Asadero Bola 1 kg', name: 'Queso Asadero Bola 1 kg', unitKg: 1 },
  { id: 'Queso Asadero Bola 200 g', name: 'Queso Asadero Bola 200 g', unitKg: 0.2 },
  { id: 'Queso Asadero Bola 500 g', name: 'Queso Asadero Bola 500 g', unitKg: 0.5 },
  { id: 'Queso Asadero Rallado 1 kg', name: 'Queso Asadero Rallado 1 kg', unitKg: 1 },
  { id: 'Queso Asadero Rallado 250 g', name: 'Queso Asadero Rallado 250 g', unitKg: 0.25 },
  { id: 'Queso Asadero Rallado 5 kg', name: 'Queso Asadero Rallado 5 kg', unitKg: 5 },
  { id: 'Queso Asadero Rallado 500 g', name: 'Queso Asadero Rallado 500 g', unitKg: 0.5 },
  { id: 'Queso Mozzarella Amarillo Barra 1 kg', name: 'Queso Mozzarella Amarillo Barra 1 kg', unitKg: 1 },
  { id: 'Queso Mozzarella Barra 1 kg', name: 'Queso Mozzarella Barra 1 kg', unitKg: 1 },
  { id: 'Queso Mozzarella Barra 500 g', name: 'Queso Mozzarella Barra 500 g', unitKg: 0.5 },
  { id: 'Queso Mozzarella Rallado Blanco 1 kg', name: 'Queso Mozzarella Rallado Blanco 1 kg', unitKg: 1 },
  { id: 'Queso Mozzarella Rallado Blanco 250 g', name: 'Queso Mozzarella Rallado Blanco 250 g', unitKg: 0.25 }
];

const PRESENTACIONES_FRESCOS = [
  { id: 'Adobera natural 500 gr', name: 'Adobera Natural 500 g', unitKg: 0.5 },
  { id: 'Adobera natural 1 kg', name: 'Adobera Natural 1 kg', unitKg: 1 },
  { id: 'Fresco 200 gr', name: 'Queso Fresco 200 g', unitKg: 0.2 },
  { id: 'Panela 400 gr', name: 'Queso Panela 400 g', unitKg: 0.4 },
  { id: 'Adobera añejo 500 gr', name: 'Adobera Añejo 500 g', unitKg: 0.5 },
  { id: 'Adobera añejo 1 kg', name: 'Adobera Añejo 1 kg', unitKg: 1 },
  { id: 'Adobera de fundir 500 gr', name: 'Adobera de Fundir 500 g', unitKg: 0.5 },
  { id: 'Adobera de fundir 1 kg', name: 'Adobera de Fundir 1 kg', unitKg: 1 },
  { id: 'Adobera de morral 500 gr', name: 'Adobera de Morral 500 g', unitKg: 0.5 },
  { id: 'Adobera de morral 1 kg', name: 'Adobera de Morral 1 kg', unitKg: 1 },
  { id: 'Adobera con chipotle 700 gr', name: 'Adobera con Chipotle 700 g', unitKg: 0.7 },
  { id: 'Adobera con chipotle y jamon 700 gr', name: 'Adobera con Chipotle y Jamón 700 g', unitKg: 0.7 },
  { id: 'Adobera con jalapeño y jamon 700 gr', name: 'Adobera con Jalapeño y Jamón 700 g', unitKg: 0.7 },
  { id: 'Ranchero 200 gr', name: 'Queso Ranchero 200 g', unitKg: 0.2 }
];

const PRESENTACIONES_FRIOS = [
  { id: 'Queso Adobera De Morral Añejo 1 kg', name: 'Adobera Morral Añejo 1 kg', unitKg: 1 },
  { id: 'Queso Adobera De Morral Añejo 500 g', name: 'Adobera Morral Añejo 500 g', unitKg: 0.5 },
  { id: 'Queso Adobera Con Chipotle 1 kg', name: 'Adobera con Chipotle 1 kg', unitKg: 1 },
  { id: 'Queso Adobera Con Chipotle 500 g', name: 'Adobera con Chipotle 500 g', unitKg: 0.5 },
  { id: 'Queso Adobera Con Jalapeño Y Jamon 1 kg', name: 'Adobera Jalapeño y Jamón 1 kg', unitKg: 1 },
  { id: 'Queso Adobera Con Jalapeño Y Jamon 500 g', name: 'Adobera Jalapeño y Jamón 500 g', unitKg: 0.5 },
  { id: 'Queso Adobera De Fundir 1 kg', name: 'Adobera de Fundir 1 kg', unitKg: 1 },
  { id: 'Queso Adobera De Fundir 500 g', name: 'Adobera de Fundir 500 g', unitKg: 0.5 },
  { id: 'Queso Adobera Natural 1 kg', name: 'Adobera Natural 1 kg', unitKg: 1 },
  { id: 'Queso Adobera Natural 2 kg', name: 'Adobera Natural 2 kg', unitKg: 2 },
  { id: 'Queso Adobera Natural 500 g', name: 'Adobera Natural 500 g', unitKg: 0.5 },
  { id: 'Queso Cheddar Blanco Barra 1 kg', name: 'Cheddar Blanco Barra 1 kg', unitKg: 1 },
  { id: 'Queso Cheddar Blanco Barra 500 g', name: 'Cheddar Blanco Barra 500 g', unitKg: 0.5 },
  { id: 'Queso Cheddar Blanco Rallado 1 kg', name: 'Cheddar Blanco Rallado 1 kg', unitKg: 1 },
  { id: 'Queso Cheddar Blanco Rallado 500 g', name: 'Cheddar Blanco Rallado 500 g', unitKg: 0.5 },
  { id: 'Queso Cheddar Blanco Rallado 250 g', name: 'Cheddar Blanco Rallado 250 g', unitKg: 0.25 },
  { id: 'Queso Cheddar Jalapeño Con Habanero 1 kg', name: 'Cheddar Jalapeño/Habanero 1 kg', unitKg: 1 },
  { id: 'Queso Cheddar Jalapeño Con Habanero 500 g', name: 'Cheddar Jalapeño/Habanero 500 g', unitKg: 0.5 },
  { id: 'Queso Chihuahua 1 kg', name: 'Queso Chihuahua 1 kg', unitKg: 1 },
  { id: 'Queso Chihuahua 500 g', name: 'Queso Chihuahua 500 g', unitKg: 0.5 },
  { id: 'Queso Chihuahua Rallado 1 kg', name: 'Queso Chihuahua Rallado 1 kg', unitKg: 1 },
  { id: 'Queso Manchego Barra 1 kg', name: 'Queso Manchego Barra 1 kg', unitKg: 1 },
  { id: 'Queso Manchego Barra 500 g', name: 'Queso Manchego Barra 500 g', unitKg: 0.5 },
  { id: 'Queso Manchego Rallado 1 kg', name: 'Queso Manchego Rallado 1 kg', unitKg: 1 },
  { id: 'Queso Manchego Rallado 500 g', name: 'Queso Manchego Rallado 500 g', unitKg: 0.5 },
  { id: 'Queso Oaxaca 1 kg', name: 'Queso Oaxaca 1 kg', unitKg: 1 },
  { id: 'Queso Oaxaca 500 g', name: 'Queso Oaxaca 500 g', unitKg: 0.5 },
  { id: 'Queso Oaxaca 250 g', name: 'Queso Oaxaca 250 g', unitKg: 0.25 },
  { id: 'Queso Oaxaca barra Amarilla 1 Kg', name: 'Queso Oaxaca Barra Amarilla 1 kg', unitKg: 1 }
];

export default function ProductionLinesView({
  role,
  user,
  state
}: {
  role?: string;
  user?: { username: string; role: string };
  state: AppState;
}) {
  const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1Qh14NXamdskjHWPQj2VaijhwBGPSvSaPl2d76fEvElE/edit?usp=sharing';
  const canAccessSheets = role === 'admin' || role === 'gerencia' || user?.role === 'admin' || user?.role === 'gerencia';
  const todayStr = new Date().toISOString().slice(0, 10);

  // Active Line & Active Tab (form vs history)
  const [selectedLine, setSelectedLine] = useState<ProductionLineId>('descremado_pasteurizado');
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Form Fields Common
  const [fecha, setFecha] = useState<string>(todayStr);
  const [horaRecepcion, setHoraRecepcion] = useState<string>('');
  const [horaFinalizacion, setHoraFinalizacion] = useState<string>('');
  const [recibio, setRecibio] = useState<string>(user?.username || '');
  const [procesoEstado, setProcesoEstado] = useState<string>('Cuajada, fundida');
  const [notas, setNotas] = useState<string>('');

  // Milk Reception
  const [lecheEnteraLitros, setLecheEnteraLitros] = useState<number | ''>('');
  const [ranchoEntera, setRanchoEntera] = useState<string>('Rancho La Estrella');
  const [ranchoEnteraModo, setRanchoEnteraModo] = useState<'estrella' | 'otro'>('estrella');
  const [ranchoEnteraCustom, setRanchoEnteraCustom] = useState<string>('');

  const [pipaEntera, setPipaEntera] = useState<string>('Pipa 1');
  const [pipaEnteraModo, setPipaEnteraModo] = useState<'pipa1' | 'pipa2' | 'pipa3' | 'otro'>('pipa1');
  const [pipaEnteraCustom, setPipaEnteraCustom] = useState<string>('');

  const [lecheDescremadaLitros, setLecheDescremadaLitros] = useState<number | ''>('');
  const [ranchoDescremada, setRanchoDescremada] = useState<string>('');
  const [pipaDescremada, setPipaDescremada] = useState<string>('');

  // Yields
  const [kgObtenidos, setKgObtenidos] = useState<number | ''>('');
  const [sueroObtenido, setSueroObtenido] = useState<number | ''>('');
  const [cremaNatural, setCremaNatural] = useState<number | ''>('');
  const [sobrante, setSobrante] = useState<number | ''>('');
  const [merma, setMerma] = useState<number | ''>('');
  const [formulado, setFormulado] = useState<number | ''>('');

  // Thermo (Descremado only)
  const [termoInicial, setTermoInicial] = useState<number | ''>('');
  const [termoUtilizados, setTermoUtilizados] = useState<number | ''>('');
  const [termoEnviados, setTermoEnviados] = useState<number | ''>('');
  const [termoCierre, setTermoCierre] = useState<number | ''>('');

  // Insumos
  const [insumosValues, setInsumosValues] = useState<Record<string, number | ''>>({});

  // Packaging items (piezas)
  const [empaquePiezas, setEmpaquePiezas] = useState<Record<string, number | ''>>({});

  // History State
  const [reportsHistory, setReportsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyFilterDate, setHistoryFilterDate] = useState<string>('');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto calculate Thermo Cierre
  useEffect(() => {
    if (selectedLine === 'descremado_pasteurizado') {
      const ini = Number(termoInicial) || 0;
      const uti = Number(termoUtilizados) || 0;
      const env = Number(termoEnviados) || 0;
      if (termoInicial !== '' || termoUtilizados !== '' || termoEnviados !== '') {
        setTermoCierre(ini - uti + env);
      }
    }
  }, [termoInicial, termoUtilizados, termoEnviados, selectedLine]);

  // Load history when tab is clicked or line changes
  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await apiFetch(`/api/production-lines/reports?line=${selectedLine}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setReportsHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching lines history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedLine]);

  // Current Line Meta
  const currentLine = useMemo(() => {
    return PRODUCTION_LINES.find(l => l.id === selectedLine) || PRODUCTION_LINES[0];
  }, [selectedLine]);

  // Presentaciones list for current line
  const presentaciones = useMemo(() => {
    switch (selectedLine) {
      case 'queso_pizzero': return PRESENTACIONES_PIZZERO;
      case 'quesos_calientes': return PRESENTACIONES_CALIENTES;
      case 'quesos_frescos': return PRESENTACIONES_FRESCOS;
      case 'quesos_frios': return PRESENTACIONES_FRIOS;
      default: return [];
    }
  }, [selectedLine]);

  // Insumos list for current line
  const insumosList = useMemo(() => {
    if (selectedLine === 'descremado_pasteurizado') return [];
    if (selectedLine === 'queso_pizzero' || selectedLine === 'quesos_calientes') return INSUMOS_18;
    return INSUMOS_17;
  }, [selectedLine]);

  // Total packaging kg calculated
  const totalKgEmpacados = useMemo(() => {
    let sum = 0;
    presentaciones.forEach(p => {
      const pz = Number(empaquePiezas[p.id]) || 0;
      sum += pz * p.unitKg;
    });
    return sum;
  }, [presentaciones, empaquePiezas]);

  // Total milk received
  const totalLecheRecibida = useMemo(() => {
    const e = Number(lecheEnteraLitros) || 0;
    const d = Number(lecheDescremadaLitros) || 0;
    return e + d;
  }, [lecheEnteraLitros, lecheDescremadaLitros]);

  // Handle Input Changes
  const handleInsumoChange = (name: string, val: string) => {
    setInsumosValues(prev => ({
      ...prev,
      [name]: val === '' ? '' : Number(val)
    }));
  };

  const handleEmpaqueChange = (prodId: string, val: string) => {
    setEmpaquePiezas(prev => ({
      ...prev,
      [prodId]: val === '' ? '' : Number(val)
    }));
  };

  const resetForm = () => {
    setHoraRecepcion('');
    setHoraFinalizacion('');
    setLecheEnteraLitros('');
    setRanchoEntera('Rancho La Estrella');
    setRanchoEnteraModo('estrella');
    setRanchoEnteraCustom('');
    setPipaEntera('Pipa 1');
    setPipaEnteraModo('pipa1');
    setPipaEnteraCustom('');
    setLecheDescremadaLitros('');
    setRanchoDescremada('');
    setPipaDescremada('');
    setKgObtenidos('');
    setSueroObtenido('');
    setCremaNatural('');
    setSobrante('');
    setMerma('');
    setFormulado('');
    setTermoInicial('');
    setTermoUtilizados('');
    setTermoEnviados('');
    setTermoCierre('');
    setInsumosValues({});
    setEmpaquePiezas({});
    setNotas('');
  };

  // Submit Report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!fecha) {
      setFeedback({ type: 'error', message: 'Por favor indica la fecha del reporte.' });
      return;
    }

    setSubmitting(true);
    try {
      // Build payload
      const payload = {
        lineId: selectedLine,
        fecha,
        horaRecepcion,
        horaFinalizacion,
        recibio,
        operador: user?.username || 'Operador Planta',
        procesoEstado: (selectedLine === 'quesos_frescos' || selectedLine === 'quesos_frios') ? procesoEstado : undefined,
        lecheEnteraLitros: lecheEnteraLitros !== '' ? Number(lecheEnteraLitros) : undefined,
        ranchoEntera,
        pipaEntera,
        lecheDescremadaLitros: lecheDescremadaLitros !== '' ? Number(lecheDescremadaLitros) : undefined,
        ranchoDescremada,
        pipaDescremada,
        kgObtenidos: kgObtenidos !== '' ? Number(kgObtenidos) : undefined,
        sueroObtenido: sueroObtenido !== '' ? Number(sueroObtenido) : undefined,
        cremaNatural: cremaNatural !== '' ? Number(cremaNatural) : undefined,
        sobrante: sobrante !== '' ? Number(sobrante) : undefined,
        merma: merma !== '' ? Number(merma) : undefined,
        formulado: formulado !== '' ? Number(formulado) : undefined,
        termoInicial: termoInicial !== '' ? Number(termoInicial) : undefined,
        termoUtilizados: termoUtilizados !== '' ? Number(termoUtilizados) : undefined,
        termoEnviados: termoEnviados !== '' ? Number(termoEnviados) : undefined,
        termoCierre: termoCierre !== '' ? Number(termoCierre) : undefined,
        insumos: insumosValues,
        empaque: {},
        notas
      };

      const res = await apiFetch('/api/production-lines/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: data.message || 'Reporte guardado con éxito'
        });
        resetForm();
        fetchHistory();
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'Error al guardar el reporte'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error de conexión con el servidor'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este reporte de la bitácora local?')) return;
    try {
      const res = await apiFetch(`/api/production-lines/report/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchHistory();
      } else {
        alert(data.message || 'No se pudo eliminar el reporte');
      }
    } catch (err: any) {
      alert('Error al comunicarse con el servidor: ' + err.message);
    }
  };

  const renderRanchoEnteraField = () => (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        Rancho de Procedencia
      </label>
      <select
        value={ranchoEnteraModo}
        onChange={e => {
          const mode = e.target.value as 'estrella' | 'otro';
          setRanchoEnteraModo(mode);
          if (mode === 'estrella') {
            setRanchoEntera('Rancho La Estrella');
          } else {
            setRanchoEntera(ranchoEnteraCustom);
          }
        }}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 mb-1.5"
      >
        <option value="estrella">Rancho La Estrella (Predeterminado)</option>
        <option value="otro">Otro rancho...</option>
      </select>

      {ranchoEnteraModo === 'otro' && (
        <input
          type="text"
          value={ranchoEnteraCustom}
          onChange={e => {
            setRanchoEnteraCustom(e.target.value);
            setRanchoEntera(e.target.value);
          }}
          placeholder="Nombre del rancho proveedor..."
          className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
          autoFocus
        />
      )}
    </div>
  );

  const renderPipaEnteraField = () => (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        Pipa / Identificador
      </label>
      <select
        value={pipaEnteraModo}
        onChange={e => {
          const mode = e.target.value as 'pipa1' | 'pipa2' | 'pipa3' | 'otro';
          setPipaEnteraModo(mode);
          if (mode === 'pipa1') setPipaEntera('Pipa 1');
          else if (mode === 'pipa2') setPipaEntera('Pipa 2');
          else if (mode === 'pipa3') setPipaEntera('Pipa 3');
          else setPipaEntera(pipaEnteraCustom);
        }}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 mb-1.5"
      >
        <option value="pipa1">Pipa 1 (Predeterminada)</option>
        <option value="pipa2">Pipa 2</option>
        <option value="pipa3">Pipa 3</option>
        <option value="otro">Otra pipa...</option>
      </select>

      {pipaEnteraModo === 'otro' && (
        <input
          type="text"
          value={pipaEnteraCustom}
          onChange={e => {
            setPipaEnteraCustom(e.target.value);
            setPipaEntera(e.target.value);
          }}
          placeholder="Identificador o placa de la pipa..."
          className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500"
          autoFocus
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                  Líneas de Producción
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium">
                  Bitácoras y reportes diarios digitales de las 5 líneas de la planta
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canAccessSheets && (
              <a
                href={SPREADSHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-bold text-xs border border-emerald-200 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Ver Hoja Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}

            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 5 Line Selectors Tabs */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {PRODUCTION_LINES.map(line => {
            const Icon = line.icon;
            const isSelected = selectedLine === line.id;
            return (
              <button
                key={line.id}
                onClick={() => {
                  setSelectedLine(line.id);
                  setFeedback(null);
                }}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? `${line.activeColor} border-transparent shadow-md scale-[1.02]`
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : line.bgLight + ' ' + line.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {line.badge}
                  </span>
                </div>
                <span className="text-xs md:text-sm font-bold leading-tight block">
                  {line.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-Tabs: Formulario vs Bitácora */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                activeTab === 'form'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📝 Nuevo Reporte Diario
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📋 Bitácora e Historial</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-black">
                {reportsHistory.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Línea seleccionada: <strong className="text-slate-800">{currentLine.name}</strong></span>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-bold animate-in fade-in duration-200 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: FORMULARIO DE CAPTURA DIARIO */}
      {/* ============================================================ */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Encabezado General */}
          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>1. Datos Generales de la Jornada ({currentLine.name})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Fecha de Producción *
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Hora de Recepción
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="time"
                    value={horaRecepcion}
                    onChange={e => setHoraRecepcion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Hora de Finalización
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="time"
                    value={horaFinalizacion}
                    onChange={e => setHoraFinalizacion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {selectedLine === 'descremado_pasteurizado' ? 'Recibió (Operador)' : 'Responsable / Recibió'}
                </label>
                <input
                  type="text"
                  value={recibio}
                  onChange={e => setRecibio(e.target.value)}
                  placeholder="Nombre de quien recibe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Sub-status for Frescos & Fríos */}
            {(selectedLine === 'quesos_frescos' || selectedLine === 'quesos_frios') && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4">
                <span className="text-xs font-bold text-slate-600">Estado de Proceso:</span>
                <span className="px-3 py-1 bg-amber-50 text-amber-800 font-bold text-xs rounded-lg border border-amber-200">
                  {procesoEstado}
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Recepción de Leche & Tina */}
          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Milk className="w-4 h-4 text-sky-600" />
              <span>2. Recepción de Leche y Materia Prima</span>
            </h2>

            {selectedLine === 'descremado_pasteurizado' ? (
              /* Descremado layout: Recepción Leche Entera + Rancho + Pipa */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-sky-50/50 border border-sky-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Leche Entera Recibida (Litros)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lecheEnteraLitros}
                    onChange={e => setLecheEnteraLitros(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                {renderRanchoEnteraField()}
                {renderPipaEnteraField()}
              </div>
            ) : (
              /* Cheese lines layout (Entera + Descremada con Rancho y Pipa + Rendimientos Tina) */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-sky-50/50 border border-sky-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Leche Entera Recibida (Litros)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lecheEnteraLitros}
                      onChange={e => setLecheEnteraLitros(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {renderRanchoEnteraField()}
                  {renderPipaEnteraField()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Leche Descremada Recibida (Litros)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lecheDescremadaLitros}
                      onChange={e => setLecheDescremadaLitros(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Rancho de Procedencia
                    </label>
                    <input
                      type="text"
                      value={ranchoDescremada}
                      onChange={e => setRanchoDescremada(e.target.value)}
                      placeholder="Ej. Rancho La Joya"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pipa / Identificador
                    </label>
                    <input
                      type="text"
                      value={pipaDescremada}
                      onChange={e => setPipaDescremada(e.target.value)}
                      placeholder="Ej. Pipa #01"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Tina Yields: Kg, Suero, Sobrante y Merma */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                    Rendimientos de Tina y Proceso
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <label className="block text-xs font-bold text-emerald-900 mb-1">
                        KG Obtenidos en Tina
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={kgObtenidos}
                        onChange={e => setKgObtenidos(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-sm font-black text-emerald-800 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                      <label className="block text-xs font-bold text-amber-900 mb-1">
                        Suero Obtenido (Litros)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={sueroObtenido}
                        onChange={e => setSueroObtenido(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-black text-amber-800 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sobrante (Kg)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={sobrante}
                        onChange={e => setSobrante(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-400"
                      />
                    </div>

                    <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200">
                      <label className="block text-xs font-bold text-rose-800 mb-1">
                        Merma (Kg)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={merma}
                        onChange={e => setMerma(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-sm font-bold text-rose-800 focus:ring-2 focus:ring-rose-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Descremado y Termo (Solo para Línea Descremado) */}
          {selectedLine === 'descremado_pasteurizado' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>3. Producto Obtenido (Descremado / Pasteurizado)</span>
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Leche Descremada (Lts)</label>
                    <input
                      type="number"
                      step="any"
                      value={lecheDescremadaLitros}
                      onChange={e => setLecheDescremadaLitros(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Leche Entera (Lts)</label>
                    <input
                      type="number"
                      step="any"
                      value={lecheEnteraLitros}
                      onChange={e => setLecheEnteraLitros(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Crema Natural (Kg/Lts)</label>
                    <input
                      type="number"
                      step="any"
                      value={cremaNatural}
                      onChange={e => setCremaNatural(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Sobrantes</label>
                    <input
                      type="number"
                      step="any"
                      value={sobrante}
                      onChange={e => setSobrante(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Merma</label>
                    <input
                      type="number"
                      step="any"
                      value={merma}
                      onChange={e => setMerma(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Formulado</label>
                    <input
                      type="number"
                      step="any"
                      value={formulado}
                      onChange={e => setFormulado(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Termo Balance */}
              <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-cyan-600" />
                  <span>4. Control de Existencia en Termo</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Existencia Inicial (Lts)</label>
                    <input
                      type="number"
                      step="any"
                      value={termoInicial}
                      onChange={e => setTermoInicial(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                    <label className="block text-xs font-bold text-amber-900 mb-1">Litros Utilizados del Termo</label>
                    <input
                      type="number"
                      step="any"
                      value={termoUtilizados}
                      onChange={e => setTermoUtilizados(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-bold text-amber-800"
                    />
                  </div>

                  <div className="p-3.5 bg-sky-50 rounded-xl border border-sky-200">
                    <label className="block text-xs font-bold text-sky-900 mb-1">Litros Enviados al Termo</label>
                    <input
                      type="number"
                      step="any"
                      value={termoEnviados}
                      onChange={e => setTermoEnviados(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-sky-300 rounded-xl p-2 text-xs font-bold text-sky-800"
                    />
                  </div>

                  <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200">
                    <label className="block text-xs font-bold text-indigo-900 mb-1">Existencia Cierre del Día (Lts)</label>
                    <input
                      type="number"
                      step="any"
                      value={termoCierre}
                      onChange={e => setTermoCierre(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Auto-calculado"
                      className="w-full bg-white border border-indigo-300 rounded-xl p-2 text-xs font-black text-indigo-800"
                    />
                    <span className="text-[10px] text-indigo-600 block mt-1 font-semibold">
                      = Inicial - Utilizados + Enviados
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Insumos de Formulación (Para las 4 líneas de queso) */}
          {insumosList.length > 0 && (
            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-amber-600" />
                  <span>3. Insumos y Productos Utilizados (Formulación)</span>
                </h2>
                <span className="text-xs text-slate-400 font-semibold">
                  {insumosList.length} insumos de la hoja física
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {insumosList.map(insumo => (
                  <div key={insumo} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
                    <label className="block text-[11px] font-bold text-slate-700 truncate mb-1" title={insumo}>
                      {insumo}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={insumosValues[insumo] ?? ''}
                      onChange={e => handleInsumoChange(insumo, e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observaciones & Guardar */}
          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              Observaciones y Notas del Turno
            </h2>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Detalles sobre temperatura, incidencias, anomalías en pipa o ranchos..."
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 mb-4"
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Limpiar Formulario
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs md:text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Guardando y Sincronizando...'
                    : `Guardar Reporte Diario de ${currentLine.name}`}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ============================================================ */}
      {/* TAB 2: BITÁCORA E HISTORIAL */}
      {/* ============================================================ */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>Bitácora de Reportes: {currentLine.name}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Historial de reportes capturados y sincronizados con Google Sheets
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={historyFilterDate}
                onChange={e => setHistoryFilterDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700"
                placeholder="Filtrar por fecha"
              />
              {historyFilterDate && (
                <button
                  onClick={() => setHistoryFilterDate('')}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Cargando bitácora de la línea...</span>
            </div>
          ) : reportsHistory.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">No hay reportes registrados aún para {currentLine.name}</p>
              <p className="text-xs text-slate-400 mt-1">Usa la pestaña "Nuevo Reporte Diario" para capturar la jornada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportsHistory
                .filter(r => !historyFilterDate || r.fecha === historyFilterDate)
                .map(report => {
                  const isExpanded = expandedReportId === report.id;
                  const totalLeche = (Number(report.lecheEnteraLitros) || 0) + (Number(report.lecheDescremadaLitros) || 0);

                  return (
                    <div
                      key={report.id}
                      className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors"
                    >
                      <div
                        onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                        className="p-4 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">
                            {report.fecha}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              {report.lineNombre}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Resp: {report.recibio || report.operador || 'Operador'} | Recepción: {report.horaRecepcion || '--:--'} a {report.horaFinalizacion || '--:--'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {totalLeche > 0 && (
                            <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                              🥛 {totalLeche} Lts
                            </span>
                          )}
                          {report.kgObtenidos != null && (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              ⚖️ {report.kgObtenidos} Kg Tina
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="p-4 bg-white border-t border-slate-100 space-y-3 text-xs">
                          {/* Raw Data Breakdown */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="p-2.5 bg-slate-50 rounded-lg">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Leche Entera</span>
                              <span className="font-bold text-slate-800">{report.lecheEnteraLitros || 0} Lts</span>
                              {(report.ranchoEntera || report.pipaEntera) && (
                                <span className="block text-[10px] text-slate-500 truncate">
                                  {[report.ranchoEntera, report.pipaEntera].filter(Boolean).join(' - ')}
                                </span>
                              )}
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-lg">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Leche Descremada</span>
                              <span className="font-bold text-slate-800">{report.lecheDescremadaLitros || 0} Lts</span>
                              {(report.ranchoDescremada || report.pipaDescremada) && (
                                <span className="block text-[10px] text-slate-500 truncate">
                                  {[report.ranchoDescremada, report.pipaDescremada].filter(Boolean).join(' - ')}
                                </span>
                              )}
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-lg">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Suero Obtenido</span>
                              <span className="font-bold text-slate-800">{report.sueroObtenido || 0} Lts</span>
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-lg">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Merma / Sobrante</span>
                              <span className="font-bold text-slate-800">
                                M: {report.merma || 0} kg | S: {report.sobrante || 0} kg
                              </span>
                            </div>
                          </div>

                          {/* Termo if Descremado */}
                          {report.lineId === 'descremado_pasteurizado' && (
                            <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div><span className="text-[10px] text-cyan-800 font-bold block">Termo Inicial:</span> {report.termoInicial || 0} Lts</div>
                              <div><span className="text-[10px] text-cyan-800 font-bold block">Termo Utilizado:</span> {report.termoUtilizados || 0} Lts</div>
                              <div><span className="text-[10px] text-cyan-800 font-bold block">Termo Enviado:</span> {report.termoEnviados || 0} Lts</div>
                              <div><span className="text-[10px] text-cyan-800 font-bold block">Termo Cierre:</span> {report.termoCierre || 0} Lts</div>
                            </div>
                          )}

                          {/* Empaque breakdown */}
                          {report.empaque && Object.keys(report.empaque).length > 0 && (
                            <div>
                              <span className="font-bold text-slate-700 block mb-1">Producto Empacado:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(report.empaque).map(([prod, det]: any) => (
                                  <span key={prod} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-[11px] font-medium">
                                    {prod}: <strong>{det.piezas} pz</strong> ({det.kgTotal} kg)
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Insumos breakdown */}
                          {report.insumos && Object.keys(report.insumos).length > 0 && (
                            <div>
                              <span className="font-bold text-slate-700 block mb-1">Insumos Formulación:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(report.insumos)
                                  .filter(([_, v]) => v !== '' && v !== null && Number(v) > 0)
                                  .map(([k, v]: any) => (
                                    <span key={k} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                                      {k}: <strong>{v}</strong>
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}

                          {report.notas && (
                            <p className="text-slate-600 bg-amber-50/50 p-2 rounded border border-amber-100 italic">
                              Notas: {report.notas}
                            </p>
                          )}

                          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                            <span>ID: {report.id}</span>
                            {(role === 'admin' || role === 'gerencia' || role === 'supervisor_produccion') && (
                              <button
                                onClick={() => handleDeleteReport(report.id)}
                                className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar reporte local</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

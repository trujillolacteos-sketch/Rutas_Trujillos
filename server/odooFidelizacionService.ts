import { executeKw } from './odoo';
import { syncRoutePlanToGoogleSheet } from './routePlansSheetService';

export function normalizeDay(name: string): string | null {
  const n = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (n === 'lunes') return 'Lunes';
  if (n === 'martes') return 'Martes';
  if (n === 'miercoles') return 'Miércoles';
  if (n === 'jueves') return 'Jueves';
  if (n === 'viernes') return 'Viernes';
  if (n === 'sabado' || n === 'sabados') return 'Sábado';
  if (n === 'domingo') return 'Domingo';
  return null;
}

export const DAYS_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export interface FidelizacionCandidate {
  clientId: number;
  clientName: string;
  rawTags: string[];
  assignedDays: string[];
  visitFrequency: number;
  matchedInApp: boolean;
  routeId?: number;
}

export interface FidelizacionReport {
  totalPartnersWithTags: number;
  matchedWithDaysCount: number;
  matchedWithoutDaysCount: number;
  notInStateCount: number;
  breakdown: Record<string, number>;
  sampleCandidates: FidelizacionCandidate[];
}

/**
 * Obtiene la previsualización de clientes y días a fidelizar desde las etiquetas de Odoo (category_id)
 */
export async function getOdooTagsFidelizacionPreview(stateClients: any[]): Promise<FidelizacionReport> {
  const clientMap = new Map<number, any>();
  stateClients.forEach(c => clientMap.set(c.id, c));

  const cats = await executeKw("res.partner.category", "search_read", [[]], { fields: ["id", "name"] });
  const catMap: Record<number, string> = {};
  for (const c of cats) catMap[c.id] = c.name;

  const domain = [[["category_id", "!=", false]]];
  const kw = { fields: ["id", "name", "category_id"], limit: 2500 };
  const partners = await executeKw("res.partner", "search_read", domain, kw);

  let matchedWithDaysCount = 0;
  let matchedWithoutDaysCount = 0;
  let notInStateCount = 0;
  const breakdown: Record<string, number> = {};
  const sampleCandidates: FidelizacionCandidate[] = [];

  for (const p of partners) {
    const rawTagNames = (p.category_id || []).map((id: number) => catMap[id] || '').filter(Boolean);
    const detectedDays: string[] = [];

    rawTagNames.forEach((tn: string) => {
      const d = normalizeDay(tn);
      if (d && !detectedDays.includes(d)) detectedDays.push(d);
    });

    const inState = clientMap.has(p.id);
    if (!inState) {
      notInStateCount++;
      continue;
    }

    if (detectedDays.length > 0) {
      matchedWithDaysCount++;
      detectedDays.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));
      const groupKey = `${detectedDays.length} visita(s): ${detectedDays.join(', ')}`;
      breakdown[groupKey] = (breakdown[groupKey] || 0) + 1;

      if (sampleCandidates.length < 50) {
        sampleCandidates.push({
          clientId: p.id,
          clientName: p.name,
          rawTags: rawTagNames,
          assignedDays: detectedDays,
          visitFrequency: detectedDays.length,
          matchedInApp: true
        });
      }
    } else {
      matchedWithoutDaysCount++;
    }
  }

  return {
    totalPartnersWithTags: partners.length,
    matchedWithDaysCount,
    matchedWithoutDaysCount,
    notInStateCount,
    breakdown,
    sampleCandidates
  };
}

/**
 * Ejecuta por única ocasión la importación y fidelización de días y cantidad de surtido desde Odoo,
 * y luego recalcula las rutas y respalda en Google Sheets.
 */
export async function executeOdooTagsFidelizacion(
  loadStateFn: () => any,
  saveStateFn: (st: any) => void,
  triggerSyncFn: () => Promise<any>
) {
  console.log('[odooFidelizacionService] Iniciando fidelización masiva de clientes desde etiquetas de Odoo...');
  const state = loadStateFn();
  const preview = await getOdooTagsFidelizacionPreview(state.clients || []);

  const cats = await executeKw("res.partner.category", "search_read", [[]], { fields: ["id", "name"] });
  const catMap: Record<number, string> = {};
  for (const c of cats) catMap[c.id] = c.name;

  const domain = [[["category_id", "!=", false]]];
  const kw = { fields: ["id", "name", "category_id"], limit: 2500 };
  const partners = await executeKw("res.partner", "search_read", domain, kw);

  if (!state.clientOverrides) state.clientOverrides = {};
  const clientById = new Map<number, any>();
  (state.clients || []).forEach((c: any) => clientById.set(c.id, c));

  let updatedCount = 0;

  for (const p of partners) {
    const rawTagNames = (p.category_id || []).map((id: number) => catMap[id] || '').filter(Boolean);
    const detectedDays: string[] = [];

    rawTagNames.forEach((tn: string) => {
      const d = normalizeDay(tn);
      if (d && !detectedDays.includes(d)) detectedDays.push(d);
    });

    if (detectedDays.length === 0) continue;
    if (!clientById.has(p.id)) continue;

    detectedDays.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));
    const primaryDay = detectedDays[0];
    const freq = detectedDays.length;

    // Actualizar cliente en state.clients
    const cl = clientById.get(p.id);
    cl.permanentDays = detectedDays;
    cl.permanentDay = primaryDay;
    cl.assignedDays = detectedDays;
    cl.assignedDay = primaryDay;
    cl.visitFrequency = freq;

    // Actualizar en state.clientOverrides
    state.clientOverrides[p.id] = {
      ...(state.clientOverrides[p.id] || {}),
      permanentDays: detectedDays,
      permanentDay: primaryDay,
      assignedDays: detectedDays,
      assignedDay: primaryDay,
      visitFrequency: freq
    };

    updatedCount++;
  }

  state.odooTagsFidelizacionAppliedAt = new Date().toISOString();
  state.odooTagsFidelizacionCount = updatedCount;
  saveStateFn(state);

  console.log(`[odooFidelizacionService] ${updatedCount} clientes fidelizados con sus días y cantidad de surtido. Recalculando rutas...`);

  // Recalcular rutas automáticamente considerando los nuevos clientes fidelizados
  const recalculatedState = await triggerSyncFn();

  // Respaldo asíncrono a Google Sheets
  syncRoutePlanToGoogleSheet(recalculatedState).catch(e => {
    console.error('[odooFidelizacionService] Error respaldando nuevo plan a Google Sheets:', e.message);
  });

  console.log(`[odooFidelizacionService] ¡Proceso completado exitosamente! Rutas recalculadas para ${updatedCount} clientes fidelizados.`);

  return {
    success: true,
    appliedAt: state.odooTagsFidelizacionAppliedAt,
    fidelizedCount: updatedCount,
    breakdown: preview.breakdown
  };
}

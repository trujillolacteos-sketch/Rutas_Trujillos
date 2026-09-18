import fs from 'fs';
import { executeKw } from './odoo';
import { db } from '../src/db/index.ts';
import { commissions } from '../src/db/schema.ts';
import { inArray } from 'drizzle-orm';
import cron from 'node-cron';

const STORE_FILE = 'data_store.json';

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isCustomerAccountPayment(paymentMethod: any) {
  if (!paymentMethod) return false;

  // Odoo devuelve Many2one como [id, nombre].
  const methodName = Array.isArray(paymentMethod)
    ? paymentMethod[1]
    : paymentMethod;

  const normalized = normalizeText(methodName);

  // Contempla Odoo en inglés y español.
  return (
    normalized.includes('customer account') ||
    normalized.includes('cuenta de cliente') ||
    normalized.includes('cuenta del cliente') ||
    normalized.includes('cuenta cliente')
  );
}

function getCommissionSettings() {
  let rateCompany = 0.01;
  let ratePerson = 0.02;
  let adjustmentMultiplier = 1;
  let clientOverrides: Record<string, any> = {};

  try {
    if (fs.existsSync(STORE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      clientOverrides = state.clientOverrides || {};

      if (state.settings) {
        if (typeof state.settings.commissionRateCompany === 'number') {
          rateCompany = state.settings.commissionRateCompany / 100;
        }
        if (typeof state.settings.commissionRatePerson === 'number') {
          ratePerson = state.settings.commissionRatePerson / 100;
        }
        if (
          typeof state.settings.commissionAdjustmentMultiplier === 'number' &&
          Number.isFinite(state.settings.commissionAdjustmentMultiplier) &&
          state.settings.commissionAdjustmentMultiplier >= 0
        ) {
          adjustmentMultiplier = state.settings.commissionAdjustmentMultiplier;
        }
      }
    }
  } catch (e) {
    console.error('No se pudieron leer los ajustes de comisión:', e);
  }

  return { rateCompany, ratePerson, adjustmentMultiplier, clientOverrides };
}

const COMMISSIONS_FILE = 'commissions_store.json';

export function loadLocalCommissions(): any[] {
  if (fs.existsSync(COMMISSIONS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(COMMISSIONS_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading commissions_store.json:', e);
    }
  }
  return [];
}

export function saveLocalCommissions(records: any[]) {
  try {
    fs.writeFileSync(COMMISSIONS_FILE, JSON.stringify(records, null, 2));
  } catch (e) {
    console.error('Error saving commissions_store.json:', e);
  }
}

// Sync every 15 minutes
export function startOdooSync() {
  cron.schedule('*/15 * * * *', async () => {
    console.log('Running Odoo Sync...');
    try {
      await syncCommissions();
    } catch (e) {
      console.error('Error in Odoo sync:', e);
    }
  });
}

export async function syncCommissions() {
  const dateAgo = new Date();
  dateAgo.setDate(dateAgo.getDate() - 100);
  const dateString = dateAgo.toISOString().split('T')[0] + ' 00:00:00';

  const orders = await executeKw(
    'pos.order',
    'search_read',
    [[['date_order', '>=', dateString]]],
    {
      fields: [
        'id',
        'name',
        'date_order',
        'partner_id',
        'config_id',
        'amount_total',
        'payment_ids',
        'state',
      ],
      limit: 5000,
    },
  );

  // Sólo consideramos ventas POS operativas. Evitamos borradores/cancelaciones.
  const validOrders = (orders || []).filter((o: any) => {
    const state = normalizeText(o.state);
    return state !== 'draft' && state !== 'cancel' && state !== 'cancelled';
  });

  // Identifica ventas a crédito / Cuenta de cliente.
  const allPaymentIds = validOrders.flatMap((o: any) => o.payment_ids || []);
  const creditOrderIds = new Set<number>();

  if (allPaymentIds.length > 0) {
    const payments = await executeKw(
      'pos.payment',
      'search_read',
      [[['id', 'in', allPaymentIds]]],
      { fields: ['id', 'payment_method_id', 'pos_order_id'] },
    );

    for (const p of payments || []) {
      if (isCustomerAccountPayment(p.payment_method_id) && p.pos_order_id) {
        creditOrderIds.add(p.pos_order_id[0]);
      }
    }
  }

  // Sólo una venta POS con cliente puede generar comisión.
  const partnerIds = new Set<number>();
  for (const o of validOrders) {
    if (o.partner_id) partnerIds.add(o.partner_id[0]);
  }

  const partnersMap = new Map<number, any>();
  if (partnerIds.size > 0) {
    const partners = await executeKw(
      'res.partner',
      'search_read',
      [[['id', 'in', Array.from(partnerIds)]]],
      { fields: ['id', 'name', 'company_type', 'is_company'] },
    );

    for (const p of partners || []) {
      partnersMap.set(p.id, p);
    }
  }
  // Leemos registros existentes para NO perder una liquidación manual al sincronizar.
  const existingByOrderId = new Map<number, any>();
  const orderIds = validOrders.map((o: any) => o.id);
  let dbAvailable = true;

  if (orderIds.length > 0) {
    try {
      const existing = await db
        .select()
        .from(commissions)
        .where(inArray(commissions.orderId, orderIds));

      for (const row of existing) existingByOrderId.set(row.orderId, row);
    } catch (dbErr) {
      dbAvailable = false;
      const localExisting = loadLocalCommissions();
      for (const row of localExisting) existingByOrderId.set(row.orderId, row);
    }
  }

  const {
    rateCompany,
    ratePerson,
    adjustmentMultiplier,
    clientOverrides,
  } = getCommissionSettings();

  const newRecords: any[] = [];

  for (const o of validOrders) {
    // Regla 1: venta POS sin cliente = NO comisión.
    if (!o.partner_id) continue;

    const pId = o.partner_id[0];
    const partner = partnersMap.get(pId);
    if (!partner) continue;

    const overrideType = clientOverrides?.[pId]?.clientType || null;
    const isCompany = overrideType
      ? overrideType === 'company'
      : partner.company_type === 'company' || partner.is_company;

    const baseRate = isCompany ? rateCompany : ratePerson;
    const effectiveRate = baseRate * adjustmentMultiplier;
    const commissionAmount = Number(o.amount_total || 0) * effectiveRate;

    const isCredit = creditOrderIds.has(o.id);
    const previous = existingByOrderId.get(o.id);

    // Regla 2: contado queda cubierto de inmediato.
    // Crédito queda pendiente hasta que se liquide.
    // Si ya fue liquidado manualmente, una sincronización posterior NO lo revierte.
    const isLiquidated = !isCredit || previous?.isLiquidated === true;

    newRecords.push({
      orderId: o.id,
      orderName: o.name,
      routeId: o.config_id ? o.config_id[0] : 0,
      clientId: pId,
      clientName: partner.name,
      clientType: isCompany ? 'company' : 'person',
      orderTotal: Number(o.amount_total || 0),
      commissionAmount,
      commissionRate: effectiveRate,
      isPaid: previous?.isPaid ?? false,
      isLiquidated,
      dateOrder: new Date(o.date_order),
    });
  }

  if (dbAvailable) {
    try {
      for (const record of newRecords) {
        await db
          .insert(commissions)
          .values(record)
          .onConflictDoUpdate({
            target: commissions.orderId,
            set: {
              routeId: record.routeId,
              clientId: record.clientId,
              clientType: record.clientType,
              commissionAmount: record.commissionAmount,
              commissionRate: record.commissionRate,
              clientName: record.clientName,
              orderTotal: record.orderTotal,
              isLiquidated: record.isLiquidated,
            },
          });
      }
    } catch (dbErr) {
      console.warn("DB save skipped for commissions (offline mode):", dbErr);
    }
  }

  // Always keep local commissions_store.json updated as reliable storage or fallback
  const localMap = new Map<number, any>();
  const currentLocal = loadLocalCommissions();
  for (const c of currentLocal) localMap.set(c.orderId, c);
  for (const r of newRecords) {
    const prev = localMap.get(r.orderId);
    localMap.set(r.orderId, {
      ...r,
      id: prev?.id || r.orderId,
      dateOrder: r.dateOrder instanceof Date ? r.dateOrder.toISOString() : r.dateOrder,
    });
  }
  saveLocalCommissions(Array.from(localMap.values()));
}

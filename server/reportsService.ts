import { executeKw } from './odoo';

export interface ReportKPIs {
  totalSales: number;
  totalPieces: number;
  totalOrders: number;
  ticketAvgAmount: number;
  ticketAvgPieces: number;
}

export interface ComparisonKPIs {
  current: ReportKPIs;
  previousPeriod: ReportKPIs;
  samePeriodLastYear: ReportKPIs;
  growthVsPrevious: {
    salesPct: number;
    salesDiff: number;
    piecesPct: number;
    piecesDiff: number;
    ordersPct: number;
    ordersDiff: number;
    ticketAmountPct: number;
    ticketPiecesPct: number;
  };
  growthVsLastYear: {
    salesPct: number;
    salesDiff: number;
    piecesPct: number;
    piecesDiff: number;
    ordersPct: number;
    ordersDiff: number;
    ticketAmountPct: number;
    ticketPiecesPct: number;
  };
}

export interface ChartDataPoint {
  label: string;
  dateKey: string;
  totalSales: number;
  totalPieces: number;
  orders: number;
  ticketAvgAmount: number;
  ticketAvgPieces: number;
}

export interface TopItem {
  id: number;
  name: string;
  pieces: number;
  amount: number;
  avgPrice: number;
  orderCount?: number;
}

export interface SalesReportResponse {
  periodType: 'weekly' | 'monthly' | 'yearly';
  periodLabel: string;
  currentRange: { start: string; end: string };
  previousRange: { start: string; end: string };
  lastYearRange: { start: string; end: string };
  kpis: ComparisonKPIs;
  dualAxisChart: ChartDataPoint[];
  comparisonSalesChart: {
    label: string;
    actual: number;
    anterior: number;
    anoPasado: number;
  }[];
  topProducts: {
    byAmount: TopItem[];
    byPieces: TopItem[];
  };
  topClients: {
    byAmount: TopItem[];
    byPieces: TopItem[];
  };
}

// In-memory cache with 5-minute TTL
const reportCache = new Map<string, { data: SalesReportResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function pad(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getWeekNumber(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  startOfYear.setHours(0, 0, 0, 0);
  const pastDaysOfYear = Math.round((date.getTime() - startOfYear.getTime()) / 86400000);
  return Math.floor((pastDaysOfYear + startOfYear.getDay()) / 7) + 1;
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getYearRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function calcGrowth(curr: number, prev: number) {
  const diff = curr - prev;
  const pct = prev > 0 ? (diff / prev) * 100 : (curr > 0 ? 100 : 0);
  return {
    diff: Math.round(diff * 100) / 100,
    pct: Math.round(pct * 10) / 10,
  };
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export async function getSalesReport(
  type: 'weekly' | 'monthly' | 'yearly',
  targetDateStr?: string,
  routeId?: number
): Promise<SalesReportResponse> {
  const targetDate = targetDateStr ? new Date(targetDateStr + (targetDateStr.includes('T') ? '' : 'T12:00:00')) : new Date();
  const cacheKey = `${type}_${formatDateStr(targetDate)}_${routeId || 'all'}`;

  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  let currStart: Date, currEnd: Date;
  let prevStart: Date, prevEnd: Date;
  let lastYearStart: Date, lastYearEnd: Date;
  let periodLabel = '';

  if (type === 'weekly') {
    const range = getWeekRange(targetDate);
    currStart = range.start;
    currEnd = range.end;

    // Previous week
    prevStart = new Date(currStart);
    prevStart.setDate(prevStart.getDate() - 7);
    prevEnd = new Date(currEnd);
    prevEnd.setDate(prevEnd.getDate() - 7);

    // Same week last year (52 weeks ago)
    lastYearStart = new Date(currStart);
    lastYearStart.setDate(lastYearStart.getDate() - 364);
    lastYearEnd = new Date(currEnd);
    lastYearEnd.setDate(lastYearEnd.getDate() - 364);

    periodLabel = `Semana ${getWeekNumber(currStart)} (${pad(currStart.getDate())} ${MONTH_NAMES[currStart.getMonth()].slice(0, 3)} - ${pad(currEnd.getDate())} ${MONTH_NAMES[currEnd.getMonth()].slice(0, 3)} ${currEnd.getFullYear()})`;
  } else if (type === 'monthly') {
    const range = getMonthRange(targetDate);
    currStart = range.start;
    currEnd = range.end;

    // Previous month
    const prevMonthDate = new Date(currStart.getFullYear(), currStart.getMonth() - 1, 15);
    const prevRange = getMonthRange(prevMonthDate);
    prevStart = prevRange.start;
    prevEnd = prevRange.end;

    // Same month last year
    const lastYearDate = new Date(currStart.getFullYear() - 1, currStart.getMonth(), 15);
    const lastYearRange = getMonthRange(lastYearDate);
    lastYearStart = lastYearRange.start;
    lastYearEnd = lastYearRange.end;

    periodLabel = `${MONTH_NAMES[currStart.getMonth()]} ${currStart.getFullYear()}`;
  } else {
    // Yearly
    const range = getYearRange(targetDate);
    currStart = range.start;
    currEnd = range.end;

    // Previous year
    const prevYearDate = new Date(currStart.getFullYear() - 1, 5, 15);
    const prevRange = getYearRange(prevYearDate);
    prevStart = prevRange.start;
    prevEnd = prevRange.end;

    // 2 years ago
    const lastYearDate = new Date(currStart.getFullYear() - 2, 5, 15);
    const lastYearRange = getYearRange(lastYearDate);
    lastYearStart = lastYearRange.start;
    lastYearEnd = lastYearRange.end;

    periodLabel = `Año ${currStart.getFullYear()}`;
  }

  // Build Odoo domains
  const buildOrderDomain = (start: Date, end: Date) => {
    const d: any[] = [
      ['date_order', '>=', `${formatDateStr(start)} 00:00:00`],
      ['date_order', '<=', `${formatDateStr(end)} 23:59:59`],
      ['state', 'not in', ['draft', 'cancel']],
    ];
    if (routeId) {
      d.push(['config_id', '=', routeId]);
    }
    return d;
  };

  const buildLineDomain = (start: Date, end: Date) => {
    return [
      ['create_date', '>=', `${formatDateStr(start)} 00:00:00`],
      ['create_date', '<=', `${formatDateStr(end)} 23:59:59`],
    ];
  };

  let response: SalesReportResponse;

  if (type === 'yearly') {
    // Specialized high-performance logic for yearly aggregations
    // 1. Order aggregates
    const [currAgg, prevAgg, lastYearAgg] = await Promise.all([
      executeKw('pos.order', 'read_group', [buildOrderDomain(currStart, currEnd), ['amount_total:sum'], []]),
      executeKw('pos.order', 'read_group', [buildOrderDomain(prevStart, prevEnd), ['amount_total:sum'], []]),
      executeKw('pos.order', 'read_group', [buildOrderDomain(lastYearStart, lastYearEnd), ['amount_total:sum'], []]),
    ]);

    // 2. Piece aggregates
    const [currLineAgg, prevLineAgg, lastYearLineAgg] = await Promise.all([
      executeKw('pos.order.line', 'read_group', [buildLineDomain(currStart, currEnd), ['qty:sum'], []]),
      executeKw('pos.order.line', 'read_group', [buildLineDomain(prevStart, prevEnd), ['qty:sum'], []]),
      executeKw('pos.order.line', 'read_group', [buildLineDomain(lastYearStart, lastYearEnd), ['qty:sum'], []]),
    ]);

    // 3. Monthly breakdowns for charts
    const [currMonthsOrders, prevMonthsOrders, lastYearMonthsOrders, currMonthsLines] = await Promise.all([
      executeKw('pos.order', 'read_group', [buildOrderDomain(currStart, currEnd), ['amount_total:sum'], ['date_order:month']]),
      executeKw('pos.order', 'read_group', [buildOrderDomain(prevStart, prevEnd), ['amount_total:sum'], ['date_order:month']]),
      executeKw('pos.order', 'read_group', [buildOrderDomain(lastYearStart, lastYearEnd), ['amount_total:sum'], ['date_order:month']]),
      executeKw('pos.order.line', 'read_group', [buildLineDomain(currStart, currEnd), ['qty:sum'], ['create_date:month']]),
    ]);

    // 4. Top 10 products and clients
    const [topProductsByAmountRes, topProductsByPiecesRes, topClientsByAmountRes] = await Promise.all([
      executeKw('pos.order.line', 'read_group', [
        buildLineDomain(currStart, currEnd),
        ['qty:sum', 'price_subtotal_incl:sum'],
        ['product_id'],
        0,
        10,
        'price_subtotal_incl desc'
      ]),
      executeKw('pos.order.line', 'read_group', [
        buildLineDomain(currStart, currEnd),
        ['qty:sum', 'price_subtotal_incl:sum'],
        ['product_id'],
        0,
        10,
        'qty desc'
      ]),
      executeKw('pos.order', 'read_group', [
        [...buildOrderDomain(currStart, currEnd), ['partner_id', '!=', false]],
        ['amount_total:sum'],
        ['partner_id'],
        0,
        10,
        'amount_total desc'
      ]),
    ]);

    const currTotalSales = currAgg?.[0]?.amount_total || 0;
    const currOrderCount = currAgg?.[0]?.__count || 0;
    const currTotalPieces = currLineAgg?.[0]?.qty || 0;

    const prevTotalSales = prevAgg?.[0]?.amount_total || 0;
    const prevOrderCount = prevAgg?.[0]?.__count || 0;
    const prevTotalPieces = prevLineAgg?.[0]?.qty || 0;

    const lastYearTotalSales = lastYearAgg?.[0]?.amount_total || 0;
    const lastYearOrderCount = lastYearAgg?.[0]?.__count || 0;
    const lastYearTotalPieces = lastYearLineAgg?.[0]?.qty || 0;

    const currTicketAmount = currOrderCount > 0 ? currTotalSales / currOrderCount : 0;
    const prevTicketAmount = prevOrderCount > 0 ? prevTotalSales / prevOrderCount : 0;
    const lastYearTicketAmount = lastYearOrderCount > 0 ? lastYearTotalSales / lastYearOrderCount : 0;

    const currTicketPieces = currOrderCount > 0 ? currTotalPieces / currOrderCount : 0;
    const prevTicketPieces = prevOrderCount > 0 ? prevTotalPieces / prevOrderCount : 0;
    const lastYearTicketPieces = lastYearOrderCount > 0 ? lastYearTotalPieces / lastYearOrderCount : 0;

    // Build 12-month dual axis chart
    const dualAxisChart: ChartDataPoint[] = [];
    const comparisonSalesChart: { label: string; actual: number; anterior: number; anoPasado: number }[] = [];

    // Map month index (0-11)
    const monthSalesMap: Record<number, { amount: number; count: number }> = {};
    (currMonthsOrders || []).forEach((m: any) => {
      const fromStr = m.__range?.['date_order:month']?.from || '';
      if (fromStr) {
        const monthIdx = parseInt(fromStr.split('-')[1], 10) - 1;
        monthSalesMap[monthIdx] = { amount: m.amount_total || 0, count: m.date_order_count || m.__count || 0 };
      }
    });

    const monthPiecesMap: Record<number, number> = {};
    (currMonthsLines || []).forEach((m: any) => {
      const fromStr = m.__range?.['create_date:month']?.from || '';
      if (fromStr) {
        const monthIdx = parseInt(fromStr.split('-')[1], 10) - 1;
        monthPiecesMap[monthIdx] = m.qty || 0;
      }
    });

    const prevMonthSalesMap: Record<number, number> = {};
    (prevMonthsOrders || []).forEach((m: any) => {
      const fromStr = m.__range?.['date_order:month']?.from || '';
      if (fromStr) {
        const monthIdx = parseInt(fromStr.split('-')[1], 10) - 1;
        prevMonthSalesMap[monthIdx] = m.amount_total || 0;
      }
    });

    const lyMonthSalesMap: Record<number, number> = {};
    (lastYearMonthsOrders || []).forEach((m: any) => {
      const fromStr = m.__range?.['date_order:month']?.from || '';
      if (fromStr) {
        const monthIdx = parseInt(fromStr.split('-')[1], 10) - 1;
        lyMonthSalesMap[monthIdx] = m.amount_total || 0;
      }
    });

    for (let i = 0; i < 12; i++) {
      const sales = monthSalesMap[i]?.amount || 0;
      const count = monthSalesMap[i]?.count || 0;
      const pieces = monthPiecesMap[i] || 0;
      const key = `${currStart.getFullYear()}-${pad(i + 1)}`;

      dualAxisChart.push({
        label: MONTH_NAMES[i],
        dateKey: key,
        totalSales: Math.round(sales * 100) / 100,
        totalPieces: Math.round(pieces),
        orders: count,
        ticketAvgAmount: count > 0 ? Math.round((sales / count) * 100) / 100 : 0,
        ticketAvgPieces: count > 0 ? Math.round((pieces / count) * 10) / 10 : 0,
      });

      comparisonSalesChart.push({
        label: MONTH_NAMES[i].slice(0, 3),
        actual: Math.round(sales),
        anterior: Math.round(prevMonthSalesMap[i] || 0),
        anoPasado: Math.round(lyMonthSalesMap[i] || 0),
      });
    }

    const formatTopProduct = (item: any): TopItem => ({
      id: item.product_id ? item.product_id[0] : 0,
      name: item.product_id ? item.product_id[1] : 'Desconocido',
      pieces: Math.round(item.qty || 0),
      amount: Math.round((item.price_subtotal_incl || 0) * 100) / 100,
      avgPrice: item.qty > 0 ? Math.round(((item.price_subtotal_incl || 0) / item.qty) * 100) / 100 : 0,
      orderCount: item.product_id_count || 0,
    });

    const formatTopClient = (item: any): TopItem => ({
      id: item.partner_id ? item.partner_id[0] : 0,
      name: item.partner_id ? item.partner_id[1] : 'Desconocido',
      pieces: 0,
      amount: Math.round((item.amount_total || 0) * 100) / 100,
      avgPrice: 0,
      orderCount: item.partner_id_count || item.__count || 0,
    });

    response = {
      periodType: 'yearly',
      periodLabel,
      currentRange: { start: formatDateStr(currStart), end: formatDateStr(currEnd) },
      previousRange: { start: formatDateStr(prevStart), end: formatDateStr(prevEnd) },
      lastYearRange: { start: formatDateStr(lastYearStart), end: formatDateStr(lastYearEnd) },
      kpis: {
        current: {
          totalSales: Math.round(currTotalSales * 100) / 100,
          totalPieces: Math.round(currTotalPieces),
          totalOrders: currOrderCount,
          ticketAvgAmount: Math.round(currTicketAmount * 100) / 100,
          ticketAvgPieces: Math.round(currTicketPieces * 10) / 10,
        },
        previousPeriod: {
          totalSales: Math.round(prevTotalSales * 100) / 100,
          totalPieces: Math.round(prevTotalPieces),
          totalOrders: prevOrderCount,
          ticketAvgAmount: Math.round(prevTicketAmount * 100) / 100,
          ticketAvgPieces: Math.round(prevTicketPieces * 10) / 10,
        },
        samePeriodLastYear: {
          totalSales: Math.round(lastYearTotalSales * 100) / 100,
          totalPieces: Math.round(lastYearTotalPieces),
          totalOrders: lastYearOrderCount,
          ticketAvgAmount: Math.round(lastYearTicketAmount * 100) / 100,
          ticketAvgPieces: Math.round(lastYearTicketPieces * 10) / 10,
        },
        growthVsPrevious: {
          salesPct: calcGrowth(currTotalSales, prevTotalSales).pct,
          salesDiff: calcGrowth(currTotalSales, prevTotalSales).diff,
          piecesPct: calcGrowth(currTotalPieces, prevTotalPieces).pct,
          piecesDiff: calcGrowth(currTotalPieces, prevTotalPieces).diff,
          ordersPct: calcGrowth(currOrderCount, prevOrderCount).pct,
          ordersDiff: calcGrowth(currOrderCount, prevOrderCount).diff,
          ticketAmountPct: calcGrowth(currTicketAmount, prevTicketAmount).pct,
          ticketPiecesPct: calcGrowth(currTicketPieces, prevTicketPieces).pct,
        },
        growthVsLastYear: {
          salesPct: calcGrowth(currTotalSales, lastYearTotalSales).pct,
          salesDiff: calcGrowth(currTotalSales, lastYearTotalSales).diff,
          piecesPct: calcGrowth(currTotalPieces, lastYearTotalPieces).pct,
          piecesDiff: calcGrowth(currTotalPieces, lastYearTotalPieces).diff,
          ordersPct: calcGrowth(currOrderCount, lastYearOrderCount).pct,
          ordersDiff: calcGrowth(currOrderCount, lastYearOrderCount).diff,
          ticketAmountPct: calcGrowth(currTicketAmount, lastYearTicketAmount).pct,
          ticketPiecesPct: calcGrowth(currTicketPieces, lastYearTicketPieces).pct,
        },
      },
      dualAxisChart,
      comparisonSalesChart,
      topProducts: {
        byAmount: (topProductsByAmountRes || []).map(formatTopProduct),
        byPieces: (topProductsByPiecesRes || []).map(formatTopProduct),
      },
      topClients: {
        byAmount: (topClientsByAmountRes || []).map(formatTopClient),
        byPieces: (topClientsByAmountRes || []).map(formatTopClient),
      },
    };
  } else {
    // Weekly or Monthly
    // 1. Query current orders with search_read (fast for 1 week/month)
    const currOrders = await executeKw('pos.order', 'search_read', [buildOrderDomain(currStart, currEnd)], {
      fields: ['id', 'name', 'date_order', 'amount_total', 'partner_id', 'config_id'],
      limit: 3000,
    });

    // 2. Query previous and last year aggregates using read_group (instantaneous)
    const [prevAgg, lastYearAgg, prevLineAgg, lastYearLineAgg] = await Promise.all([
      executeKw('pos.order', 'read_group', [buildOrderDomain(prevStart, prevEnd), ['amount_total:sum'], []]),
      executeKw('pos.order', 'read_group', [buildOrderDomain(lastYearStart, lastYearEnd), ['amount_total:sum'], []]),
      executeKw('pos.order.line', 'read_group', [buildLineDomain(prevStart, prevEnd), ['qty:sum'], []]),
      executeKw('pos.order.line', 'read_group', [buildLineDomain(lastYearStart, lastYearEnd), ['qty:sum'], []]),
    ]);

    const currOrderIds = (currOrders || []).map((o: any) => o.id);

    // 3. Lines & top products for current period
    const [currLinesByOrder, topProductsByAmount, topProductsByPieces] = await Promise.all([
      currOrderIds.length > 0
        ? executeKw('pos.order.line', 'read_group', [
            [['order_id', 'in', currOrderIds]],
            ['qty:sum', 'price_subtotal_incl:sum'],
            ['order_id'],
          ])
        : [],
      currOrderIds.length > 0
        ? executeKw('pos.order.line', 'read_group', [
            [['order_id', 'in', currOrderIds]],
            ['qty:sum', 'price_subtotal_incl:sum'],
            ['product_id'],
            0,
            10,
            'price_subtotal_incl desc',
          ])
        : [],
      currOrderIds.length > 0
        ? executeKw('pos.order.line', 'read_group', [
            [['order_id', 'in', currOrderIds]],
            ['qty:sum', 'price_subtotal_incl:sum'],
            ['product_id'],
            0,
            10,
            'qty desc',
          ])
        : [],
    ]);

    // Map order pieces for current period
    const piecesByOrder: Record<number, number> = {};
    let currTotalPieces = 0;
    (currLinesByOrder || []).forEach((l: any) => {
      if (l.order_id) {
        const q = l.qty || 0;
        piecesByOrder[l.order_id[0]] = q;
        currTotalPieces += q;
      }
    });

    const prevTotalPieces = prevLineAgg?.[0]?.qty || 0;
    const lastYearTotalPieces = lastYearLineAgg?.[0]?.qty || 0;

    const currTotalSales = (currOrders || []).reduce((acc: number, o: any) => acc + (o.amount_total || 0), 0);
    const prevTotalSales = prevAgg?.[0]?.amount_total || 0;
    const lastYearTotalSales = lastYearAgg?.[0]?.amount_total || 0;

    const currOrderCount = (currOrders || []).length;
    const prevOrderCount = prevAgg?.[0]?.__count || 0;
    const lastYearOrderCount = lastYearAgg?.[0]?.__count || 0;

    const currTicketAmount = currOrderCount > 0 ? currTotalSales / currOrderCount : 0;
    const prevTicketAmount = prevOrderCount > 0 ? prevTotalSales / prevOrderCount : 0;
    const lastYearTicketAmount = lastYearOrderCount > 0 ? lastYearTotalSales / lastYearOrderCount : 0;

    const currTicketPieces = currOrderCount > 0 ? currTotalPieces / currOrderCount : 0;
    const prevTicketPieces = prevOrderCount > 0 ? prevTotalPieces / prevOrderCount : 0;
    const lastYearTicketPieces = lastYearOrderCount > 0 ? lastYearTotalPieces / lastYearOrderCount : 0;

    // Dual-axis chart
    const chartIntervals: Map<string, { label: string; dateKey: string; totalSales: number; totalPieces: number; orders: number }> = new Map();

    if (type === 'weekly') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(currStart);
        d.setDate(d.getDate() + i);
        const key = formatDateStr(d);
        const dayName = DAY_NAMES[d.getDay()];
        chartIntervals.set(key, {
          label: `${dayName} ${pad(d.getDate())}`,
          dateKey: key,
          totalSales: 0,
          totalPieces: 0,
          orders: 0,
        });
      }
    } else {
      // monthly
      const daysInMonth = currEnd.getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(currStart.getFullYear(), currStart.getMonth(), i);
        const key = formatDateStr(d);
        chartIntervals.set(key, {
          label: `${pad(i)} ${MONTH_NAMES[currStart.getMonth()].slice(0, 3)}`,
          dateKey: key,
          totalSales: 0,
          totalPieces: 0,
          orders: 0,
        });
      }
    }

    (currOrders || []).forEach((o: any) => {
      const dStr = (o.date_order || '').split(' ')[0];
      const item = chartIntervals.get(dStr);
      if (item) {
        item.orders += 1;
        item.totalSales += (o.amount_total || 0);
        item.totalPieces += (piecesByOrder[o.id] || 0);
      }
    });

    const dualAxisChart: ChartDataPoint[] = Array.from(chartIntervals.values()).map(it => ({
      label: it.label,
      dateKey: it.dateKey,
      totalSales: Math.round(it.totalSales * 100) / 100,
      totalPieces: Math.round(it.totalPieces),
      orders: it.orders,
      ticketAvgAmount: it.orders > 0 ? Math.round((it.totalSales / it.orders) * 100) / 100 : 0,
      ticketAvgPieces: it.orders > 0 ? Math.round((it.totalPieces / it.orders) * 10) / 10 : 0,
    }));

    // Comparison chart
    const comparisonSalesChart: { label: string; actual: number; anterior: number; anoPasado: number }[] = [];

    // Query daily or weekly aggregates for comparison
    if (type === 'weekly') {
      const [prevDaysRes, lyDaysRes] = await Promise.all([
        executeKw('pos.order', 'read_group', [buildOrderDomain(prevStart, prevEnd), ['amount_total:sum'], ['date_order:day']]),
        executeKw('pos.order', 'read_group', [buildOrderDomain(lastYearStart, lastYearEnd), ['amount_total:sum'], ['date_order:day']]),
      ]);

      const prevDayMap: Record<number, number> = {};
      (prevDaysRes || []).forEach((d: any) => {
        const fromStr = d.__range?.['date_order:day']?.from || '';
        if (fromStr) {
          const dt = new Date(fromStr.replace(' ', 'T'));
          const dayIdx = (dt.getDay() + 6) % 7; // Monday = 0
          prevDayMap[dayIdx] = (prevDayMap[dayIdx] || 0) + (d.amount_total || 0);
        }
      });

      const lyDayMap: Record<number, number> = {};
      (lyDaysRes || []).forEach((d: any) => {
        const fromStr = d.__range?.['date_order:day']?.from || '';
        if (fromStr) {
          const dt = new Date(fromStr.replace(' ', 'T'));
          const dayIdx = (dt.getDay() + 6) % 7; // Monday = 0
          lyDayMap[dayIdx] = (lyDayMap[dayIdx] || 0) + (d.amount_total || 0);
        }
      });

      const daysArr = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      for (let i = 0; i < 7; i++) {
        const curD = new Date(currStart); curD.setDate(curD.getDate() + i);
        const curKey = formatDateStr(curD);
        const curSum = (currOrders || []).filter((o: any) => o.date_order?.startsWith(curKey)).reduce((acc: number, o: any) => acc + (o.amount_total || 0), 0);

        comparisonSalesChart.push({
          label: daysArr[i],
          actual: Math.round(curSum),
          anterior: Math.round(prevDayMap[i] || 0),
          anoPasado: Math.round(lyDayMap[i] || 0),
        });
      }
    } else {
      // Monthly 4-week breakdown
      const [prevWeeksRes, lyWeeksRes] = await Promise.all([
        executeKw('pos.order', 'read_group', [buildOrderDomain(prevStart, prevEnd), ['amount_total:sum'], ['date_order:day']]),
        executeKw('pos.order', 'read_group', [buildOrderDomain(lastYearStart, lastYearEnd), ['amount_total:sum'], ['date_order:day']]),
      ]);

      const curWeekTotals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      (currOrders || []).forEach((o: any) => {
        const dayNum = parseInt(o.date_order?.split(' ')[0]?.split('-')[2] || '1', 10);
        const w = Math.min(4, Math.floor((dayNum - 1) / 7) + 1);
        curWeekTotals[w] = (curWeekTotals[w] || 0) + (o.amount_total || 0);
      });

      const prevWeekTotals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      (prevWeeksRes || []).forEach((d: any) => {
        const fromStr = d.__range?.['date_order:day']?.from || '';
        if (fromStr) {
          const dayNum = parseInt(fromStr.split('-')[2]?.split(' ')[0] || '1', 10);
          const w = Math.min(4, Math.floor((dayNum - 1) / 7) + 1);
          prevWeekTotals[w] = (prevWeekTotals[w] || 0) + (d.amount_total || 0);
        }
      });

      const lyWeekTotals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      (lyWeeksRes || []).forEach((d: any) => {
        const fromStr = d.__range?.['date_order:day']?.from || '';
        if (fromStr) {
          const dayNum = parseInt(fromStr.split('-')[2]?.split(' ')[0] || '1', 10);
          const w = Math.min(4, Math.floor((dayNum - 1) / 7) + 1);
          lyWeekTotals[w] = (lyWeekTotals[w] || 0) + (d.amount_total || 0);
        }
      });

      for (let w = 1; w <= 4; w++) {
        comparisonSalesChart.push({
          label: `Semana ${w}`,
          actual: Math.round(curWeekTotals[w] || 0),
          anterior: Math.round(prevWeekTotals[w] || 0),
          anoPasado: Math.round(lyWeekTotals[w] || 0),
        });
      }
    }

    const formatTopItem = (item: any): TopItem => ({
      id: item.product_id ? item.product_id[0] : 0,
      name: item.product_id ? item.product_id[1] : 'Desconocido',
      pieces: Math.round(item.qty || 0),
      amount: Math.round((item.price_subtotal_incl || 0) * 100) / 100,
      avgPrice: item.qty > 0 ? Math.round(((item.price_subtotal_incl || 0) / item.qty) * 100) / 100 : 0,
      orderCount: item.product_id_count || 0,
    });

    const clientsMap = new Map<number, { id: number; name: string; pieces: number; amount: number; orderCount: number }>();
    (currOrders || []).forEach((o: any) => {
      if (o.partner_id && o.partner_id[0]) {
        const cId = o.partner_id[0];
        const cName = o.partner_id[1];
        const prev = clientsMap.get(cId) || { id: cId, name: cName, pieces: 0, amount: 0, orderCount: 0 };
        prev.amount += (o.amount_total || 0);
        prev.pieces += (piecesByOrder[o.id] || 0);
        prev.orderCount += 1;
        clientsMap.set(cId, prev);
      }
    });

    const clientsArr = Array.from(clientsMap.values());
    const topClientsByAmount: TopItem[] = [...clientsArr]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        name: c.name,
        pieces: Math.round(c.pieces),
        amount: Math.round(c.amount * 100) / 100,
        avgPrice: c.pieces > 0 ? Math.round((c.amount / c.pieces) * 100) / 100 : 0,
        orderCount: c.orderCount,
      }));

    const topClientsByPieces: TopItem[] = [...clientsArr]
      .sort((a, b) => b.pieces - a.pieces)
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        name: c.name,
        pieces: Math.round(c.pieces),
        amount: Math.round(c.amount * 100) / 100,
        avgPrice: c.pieces > 0 ? Math.round((c.amount / c.pieces) * 100) / 100 : 0,
        orderCount: c.orderCount,
      }));

    response = {
      periodType: type,
      periodLabel,
      currentRange: { start: formatDateStr(currStart), end: formatDateStr(currEnd) },
      previousRange: { start: formatDateStr(prevStart), end: formatDateStr(prevEnd) },
      lastYearRange: { start: formatDateStr(lastYearStart), end: formatDateStr(lastYearEnd) },
      kpis: {
        current: {
          totalSales: Math.round(currTotalSales * 100) / 100,
          totalPieces: Math.round(currTotalPieces),
          totalOrders: currOrderCount,
          ticketAvgAmount: Math.round(currTicketAmount * 100) / 100,
          ticketAvgPieces: Math.round(currTicketPieces * 10) / 10,
        },
        previousPeriod: {
          totalSales: Math.round(prevTotalSales * 100) / 100,
          totalPieces: Math.round(prevTotalPieces),
          totalOrders: prevOrderCount,
          ticketAvgAmount: Math.round(prevTicketAmount * 100) / 100,
          ticketAvgPieces: Math.round(prevTicketPieces * 10) / 10,
        },
        samePeriodLastYear: {
          totalSales: Math.round(lastYearTotalSales * 100) / 100,
          totalPieces: Math.round(lastYearTotalPieces),
          totalOrders: lastYearOrderCount,
          ticketAvgAmount: Math.round(lastYearTicketAmount * 100) / 100,
          ticketAvgPieces: Math.round(lastYearTicketPieces * 10) / 10,
        },
        growthVsPrevious: {
          salesPct: calcGrowth(currTotalSales, prevTotalSales).pct,
          salesDiff: calcGrowth(currTotalSales, prevTotalSales).diff,
          piecesPct: calcGrowth(currTotalPieces, prevTotalPieces).pct,
          piecesDiff: calcGrowth(currTotalPieces, prevTotalPieces).diff,
          ordersPct: calcGrowth(currOrderCount, prevOrderCount).pct,
          ordersDiff: calcGrowth(currOrderCount, prevOrderCount).diff,
          ticketAmountPct: calcGrowth(currTicketAmount, prevTicketAmount).pct,
          ticketPiecesPct: calcGrowth(currTicketPieces, prevTicketPieces).pct,
        },
        growthVsLastYear: {
          salesPct: calcGrowth(currTotalSales, lastYearTotalSales).pct,
          salesDiff: calcGrowth(currTotalSales, lastYearTotalSales).diff,
          piecesPct: calcGrowth(currTotalPieces, lastYearTotalPieces).pct,
          piecesDiff: calcGrowth(currTotalPieces, lastYearTotalPieces).diff,
          ordersPct: calcGrowth(currOrderCount, lastYearOrderCount).pct,
          ordersDiff: calcGrowth(currOrderCount, lastYearOrderCount).diff,
          ticketAmountPct: calcGrowth(currTicketAmount, lastYearTicketAmount).pct,
          ticketPiecesPct: calcGrowth(currTicketPieces, lastYearTicketPieces).pct,
        },
      },
      dualAxisChart,
      comparisonSalesChart,
      topProducts: {
        byAmount: (topProductsByAmount || []).map(formatTopItem),
        byPieces: (topProductsByPieces || []).map(formatTopItem),
      },
      topClients: {
        byAmount: topClientsByAmount,
        byPieces: topClientsByPieces,
      },
    };
  }

  // Cache response
  reportCache.set(cacheKey, { data: response, timestamp: Date.now() });

  return response;
}

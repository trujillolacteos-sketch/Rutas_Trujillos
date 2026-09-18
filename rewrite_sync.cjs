const fs = require('fs');

const odooSyncPath = 'server/odooSync.ts';
let code = fs.readFileSync(odooSyncPath, 'utf8');

// Add payment methods fetching
const oldFetchOrders = `  const orders = await executeKw(
    "pos.order",
    "search_read",
    [[["date_order", ">=", dateString]]], // Removing state filter because operational sale is not tied to financial payment
    {
      fields: ["id", "name", "date_order", "partner_id", "config_id", "amount_total", "payment_ids"],
      limit: 5000 
    }
  );

  const newRecords: any[] = [];
  const partnerIds = new Set<number>();

  for (const o of orders) {
    if (!o.partner_id) continue; // No client attached
    partnerIds.add(o.partner_id[0]);
  }`;

const newFetchOrders = `  const orders = await executeKw(
    "pos.order",
    "search_read",
    [[["date_order", ">=", dateString]]], // Removing state filter because operational sale is not tied to financial payment
    {
      fields: ["id", "name", "date_order", "partner_id", "config_id", "amount_total", "payment_ids", "state"],
      limit: 5000 
    }
  );

  // Fetch all payments to identify if it's credit (Customer Account)
  const allPaymentIds = orders.flatMap(o => o.payment_ids || []);
  let creditOrderIds = new Set<number>();
  if (allPaymentIds.length > 0) {
    const payments = await executeKw("pos.payment", "search_read", [[["id", "in", allPaymentIds]]], {
      fields: ["id", "payment_method_id", "pos_order_id"]
    });
    for (const p of payments) {
      // 3 is the default ID for "Customer Account" in Odoo POS
      if (p.payment_method_id && p.payment_method_id[1] && p.payment_method_id[1].toLowerCase().includes('customer account')) {
         creditOrderIds.add(p.pos_order_id[0]);
      }
    }
  }

  const newRecords: any[] = [];
  const partnerIds = new Set<number>();

  for (const o of orders) {
    if (!o.partner_id) continue; // No client attached
    partnerIds.add(o.partner_id[0]);
  }`;

code = code.replace(oldFetchOrders, newFetchOrders);

const oldPush = `      commissionAmount: cAmount,
      commissionRate: cRate,
      dateOrder: o.date_order,
      isPaid: false
    });`;

const newPush = `      commissionAmount: cAmount,
      commissionRate: cRate,
      dateOrder: o.date_order,
      isPaid: false,
      isLiquidated: !creditOrderIds.has(o.id)
    });`;

code = code.replace(oldPush, newPush);

fs.writeFileSync(odooSyncPath, code);
console.log('Patched odooSync.ts');

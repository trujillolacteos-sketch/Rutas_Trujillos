const fs = require('fs');

// 1. Update schema.ts
let schema = fs.readFileSync('src/db/schema.ts', 'utf8');
if (!schema.includes('isLiquidated')) {
  schema = schema.replace(
    /isPaid: boolean\('is_paid'\)\.default\(false\),/,
    "isPaid: boolean('is_paid').default(false),\n  isLiquidated: boolean('is_liquidated').default(true),"
  );
  fs.writeFileSync('src/db/schema.ts', schema);
  console.log('Patched schema.ts');
}

// 2. Update odooSync.ts
let sync = fs.readFileSync('server/odooSync.ts', 'utf8');

if (!sync.includes('isLiquidated')) {
  // Update fields to include 'state'
  sync = sync.replace(
    /fields: \["id", "name", "date_order", "partner_id", "config_id", "amount_total", "payment_ids"\]/,
    'fields: ["id", "name", "date_order", "partner_id", "config_id", "amount_total", "payment_ids", "state"]'
  );
  
  // We need to fetch pos.payment to know if it's Customer Account (method_id = 3)
  // Let's rewrite the sync loop slightly or fetch payment_ids for all orders.
  
  // First, we need to add the query for payments if there are payment_ids
  // Let's insert it before inserting into the DB.
  
  const insertRegex = /for \(const o of orders\) \{[\s\S]*?newRecords\.push\(\{[\s\S]*?\}\);/m;
  const match = sync.match(insertRegex);
  if (match) {
    const loopCode = match[0];
    const replacedLoop = loopCode.replace(
      /newRecords\.push\(\{/,
      `
    // Check if the order has Customer Account payment method (ID 3 in Odoo usually)
    // If we don't have the exact method, we can assume if state is 'done' and it has payments, maybe we just set isLiquidated = true for now,
    // BUT the user specifically wants to exclude credit. We will query payments below or simply assume: 
    // Actually, in the loop, let's fetch payments if we can, but a batch fetch is better.
    // Instead of patching heavily here, I'll rewrite the Odoo sync file.
      newRecords.push({`
    );
  }
}

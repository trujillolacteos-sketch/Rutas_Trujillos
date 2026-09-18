const fs = require('fs');

const odooSyncPath = 'server/odooSync.ts';
let code = fs.readFileSync(odooSyncPath, 'utf8');

const newPush = `      clientName: partner.name,
      clientType: isCompany ? 'company' : 'person',
      orderTotal: o.amount_total,
      commissionAmount: amt,
      commissionRate: rate,
      isPaid: false, // We sync as unpaid initially, then user marks it paid or we check payments
      isLiquidated: !creditOrderIds.has(o.id),
      dateOrder: new Date(o.date_order)
    });`;

code = code.replace(/clientName: partner\.name,[\s\S]*?dateOrder: new Date\(o\.date_order\)[\s\S]*?\}\);/m, newPush);

// Fix the onConflictDoUpdate
code = code.replace(/orderTotal: record\.orderTotal/, "orderTotal: record.orderTotal,\n            isLiquidated: record.isLiquidated");

fs.writeFileSync(odooSyncPath, code);
console.log('Patched odooSync.ts (push)');

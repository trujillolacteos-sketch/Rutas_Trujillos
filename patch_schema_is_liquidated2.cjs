const fs = require('fs');
let schema = fs.readFileSync('src/db/schema.ts', 'utf8');
if (!schema.includes('isLiquidated')) {
  schema = schema.replace(
    /isPaid: boolean\('is_paid'\)\.notNull\(\)\.default\(false\),/,
    "isPaid: boolean('is_paid').notNull().default(false),\n  isLiquidated: boolean('is_liquidated').notNull().default(true),"
  );
  fs.writeFileSync('src/db/schema.ts', schema);
  console.log('Patched schema.ts correctly');
}

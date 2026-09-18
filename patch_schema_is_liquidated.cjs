const fs = require('fs');
let schema = fs.readFileSync('src/db/schema.ts', 'utf8');
if (!schema.includes('isLiquidated')) {
  schema = schema.replace(
    /isPaid: boolean\('is_paid'\)\.default\(false\),/,
    "isPaid: boolean('is_paid').default(false),\n  isLiquidated: boolean('is_liquidated').default(true),"
  );
  fs.writeFileSync('src/db/schema.ts', schema);
  console.log('Patched schema.ts');
}

import { executeKw } from './server/odoo.ts';

async function check() {
  const fields = await executeKw(
    "res.partner",
    "fields_get",
    [],
    { attributes: ["string", "type"] }
  );
  console.log(Object.keys(fields).filter(k => k.includes('type') || k.includes('company') || k.includes('category') || k.includes('tax') || k.includes('rfc') || k.includes('vat')));
  
  const sample = await executeKw(
    "res.partner",
    "search_read",
    [],
    { limit: 1 }
  );
  console.log("Sample partner:", sample[0]);
  process.exit(0);
}
check();

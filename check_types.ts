import { executeKw } from './server/odoo.ts';

async function check() {
  const partners = await executeKw(
    "res.partner",
    "search_read",
    [],
    { fields: ["id", "name", "company_type", "is_company"] }
  );
  
  const comp = partners.filter(p => p.company_type === 'company' || p.is_company);
  console.log("Found companies:", comp.length);
  if (comp.length > 0) {
    console.log(comp.slice(0, 5));
  }
  process.exit(0);
}
check();

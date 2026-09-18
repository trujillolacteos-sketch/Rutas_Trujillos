import { executeKw } from './server/odoo.ts';

async function check() {
  const partners = await executeKw(
    "res.partner",
    "search_read",
    [[["company_type", "=", "company"]]],
    { fields: ["id", "name", "company_type", "is_company"], limit: 10 }
  );
  console.log("Companies:", partners.length);
  console.log(partners);
  process.exit(0);
}
check();

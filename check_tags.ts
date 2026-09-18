import { executeKw } from './server/odoo.ts';

async function check() {
  const partners = await executeKw(
    "res.partner",
    "search_read",
    [[["category_id", "!=", false]]],
    { fields: ["id", "name", "category_id"], limit: 5 }
  );
  console.log("Partners with tags:", partners);
  
  const tags = await executeKw(
    "res.partner.category",
    "search_read",
    [],
    { fields: ["id", "name"], limit: 20 }
  );
  console.log("All tags:", tags);
  
  process.exit(0);
}
check();

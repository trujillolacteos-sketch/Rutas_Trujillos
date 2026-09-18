import { executeKw } from './server/odoo.ts';

async function check() {
  const tags = await executeKw("res.partner.category", "search_read", [], { fields: ["id", "name"] });
  console.log("Partner tags:", tags);
  process.exit(0);
}
check();

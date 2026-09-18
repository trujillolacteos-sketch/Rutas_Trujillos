import { executeKw } from './server/odoo.ts';

async function check() {
  const pl = await executeKw("product.pricelist", "search_read", [], { fields: ["id", "name"] });
  console.log("Pricelists:", pl);
  process.exit(0);
}
check();

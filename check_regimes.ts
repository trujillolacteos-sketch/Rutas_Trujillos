import { executeKw } from './server/odoo.ts';

async function check() {
  const partners = await executeKw(
    "res.partner",
    "search_read",
    [],
    { fields: ["id", "name", "l10n_mx_edi_fiscal_regime"], limit: 50 }
  );
  const regimes = [...new Set(partners.map(p => p.l10n_mx_edi_fiscal_regime))];
  console.log("Regimes:", regimes);
  process.exit(0);
}
check();

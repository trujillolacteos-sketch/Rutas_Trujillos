import { db } from './src/db/index.ts';
import { commissions } from './src/db/schema.ts';

async function check() {
  const data = await db.select().from(commissions);
  console.log("Total commissions:", data.length);
  process.exit(0);
}
check();

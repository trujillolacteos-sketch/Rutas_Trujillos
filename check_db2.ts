import { db } from './src/db/index.ts';
import { commissions } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function check() {
  const data = await db.select().from(commissions).where(eq(commissions.clientType, 'company'));
  console.log("Companies in commissions DB:", data.length);
  process.exit(0);
}
check();

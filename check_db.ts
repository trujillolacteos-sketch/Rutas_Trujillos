import { db } from './src/db/index.ts';
import { commissions } from './src/db/schema.ts';

async function run() {
  const data = await db.select().from(commissions).limit(3);
  console.log("Data:", data.map(d => d.dateOrder));
  process.exit(0);
}
run();

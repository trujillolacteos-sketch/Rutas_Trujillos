import { db } from './src/db/index.ts';
import { commissions } from './src/db/schema.ts';
async function run() {
  const data = await db.select().from(commissions).limit(5);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
run();

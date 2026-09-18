import { db } from './src/db/index.ts';
import { users } from './src/db/schema.ts';

async function run() {
  const data = await db.select().from(users);
  console.log(data);
  process.exit(0);
}
run();

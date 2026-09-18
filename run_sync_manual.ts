import { syncCommissions } from './server/odooSync.ts';

async function main() {
  console.log("Starting sync...");
  try {
    await syncCommissions();
    console.log("Sync complete!");
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();

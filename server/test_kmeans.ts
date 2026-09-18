import fs from 'fs';
import { generateMasterPlan } from './algorithm';

const db = JSON.parse(fs.readFileSync('../data_store.json', 'utf8'));

// Instead of modifying algorithm.ts again, I can just log the sizes of 'unassignedColonias' inside algorithm.

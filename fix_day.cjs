const fs = require('fs');
let content = fs.readFileSync('server/algorithm.ts', 'utf8');

// Replace loadScore and geoPenalty weighting
content = content.replace(
  "const score = geoPenalty * 150 + loadScore * 500;",
  "const score = (geoPenalty * 100) + (loadScore * 2000);"
);
// Use power of 3 for load score variance
content = content.replace(
  "const loadScore = tempLoads.reduce((sum, val) => sum + Math.pow(val - idealDayLoad, 2), 0);",
  "const loadScore = tempLoads.reduce((sum, val) => sum + Math.pow(Math.abs(val - idealDayLoad), 3), 0);"
);

// Increase the fallback max load so it doesn't fail as often, and raise absoluteMaxLoad slightly
content = content.replace(
  "const absoluteMaxLoad = Math.max(20, Math.ceil(idealDayLoad * 1.35));",
  "const absoluteMaxLoad = Math.max(30, Math.ceil(idealDayLoad * 1.50));"
);

fs.writeFileSync('server/algorithm.ts', content);
console.log('Fixed day assignment loads');

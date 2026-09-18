const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');
const errRegex = /const isMassive = block\.cost > dynamicTargetCost \* 0\.7;/m;
const fix = `const isMassive = block.cost > dynamicTargetCost * 0.7;
      console.log('City:', block.city, 'Cost:', block.cost, 'isMassive:', isMassive, 'DynamicTarget:', dynamicTargetCost);`;
code = code.replace(errRegex, fix);

const errRegex2 = /if \(excess > shortfall\) \{/m;
const fix2 = `if (excess > shortfall) {
                      console.log('Cutting route at cost', routeCosts[currentRIdx], 'for col cost', col.cost);`;
code = code.replace(errRegex2, fix2);

fs.writeFileSync('server/algorithm.ts', code);

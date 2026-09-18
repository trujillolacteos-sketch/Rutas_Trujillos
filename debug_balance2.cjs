const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const regex = /cityBlocks\.forEach\(block => \{[\s\S]*?\}\);/;

const newLogic = `cityBlocks.forEach(block => {
      // Allow splitting any block if it's large or if it's the hub
      const isMassive = block.cost > dynamicTargetCost * 0.4 || block.city.includes('San Juan');
      
      if (isMassive) {
          block.colonias.forEach(col => {
              if (currentRIdx < k - 1 && routeCosts[currentRIdx] > 0) {
                  const currentWithNew = routeCosts[currentRIdx] + col.cost;
                  const shortfall = dynamicTargetCost - routeCosts[currentRIdx];
                  const excess = currentWithNew - dynamicTargetCost;
                  if (currentWithNew > MAX_ALLOWED || (excess > shortfall && routeCosts[currentRIdx] >= MIN_ALLOWED)) {
                      remainingTotalCost -= routeCosts[currentRIdx];
                      remainingRoutesCount--;
                      dynamicTargetCost = remainingTotalCost / remainingRoutesCount;
                      currentRIdx++;
                  }
              }
              col.clients.forEach(c => {
                  c.assignedRouteId = activeRoutes[currentRIdx].id;
                  routeAssignments[currentRIdx].push(c);
                  routeCosts[currentRIdx] += c.cost;
              });
          });
      } else {
          if (currentRIdx < k - 1 && routeCosts[currentRIdx] > 0) {
              const currentWithNew = routeCosts[currentRIdx] + block.cost;
              const shortfall = dynamicTargetCost - routeCosts[currentRIdx];
              const excess = currentWithNew - dynamicTargetCost;
              if (currentWithNew > MAX_ALLOWED || (excess > shortfall && routeCosts[currentRIdx] >= MIN_ALLOWED) || excess > shortfall + (MAX_ALLOWED - globalTargetCost) * 0.5) {
                  remainingTotalCost -= routeCosts[currentRIdx];
                  remainingRoutesCount--;
                  dynamicTargetCost = remainingTotalCost / remainingRoutesCount;
                  currentRIdx++;
              }
          }
          block.colonias.forEach(col => {
              col.clients.forEach(c => {
                  c.assignedRouteId = activeRoutes[currentRIdx].id;
                  routeAssignments[currentRIdx].push(c);
                  routeCosts[currentRIdx] += c.cost;
              });
          });
      }
  });`;

code = code.replace(regex, newLogic);
fs.writeFileSync('server/algorithm.ts', code);
console.log('Done replacement debug 2');

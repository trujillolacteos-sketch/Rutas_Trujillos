const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const regex = /let cityBlocks = \[\];[\s\S]*?routeAssignments\.forEach\(/;

const newLogic = `let cityBlocks = [];
  let currentBlock = null;
  unassignedColonias.forEach(col => {
      if (!currentBlock || currentBlock.city !== col.city) {
          if (currentBlock) cityBlocks.push(currentBlock);
          currentBlock = { city: col.city, colonias: [], cost: 0 };
      }
      currentBlock.colonias.push(col);
      currentBlock.cost += col.cost;
  });
  if (currentBlock) cityBlocks.push(currentBlock);

  const globalTargetCost = totalCost / k;
  const MAX_ALLOWED = globalTargetCost * 1.15;
  const MIN_ALLOWED = globalTargetCost * 0.85;
  
  // console.log('DEBUG: globalTargetCost=', globalTargetCost, 'MAX_ALLOWED=', MAX_ALLOWED, 'MIN_ALLOWED=', MIN_ALLOWED);

  cityBlocks.forEach(block => {
      const isMassive = block.cost > dynamicTargetCost * 0.7;
      // console.log('DEBUG: Processing block', block.city, 'cost=', block.cost, 'isMassive=', isMassive);
      
      if (isMassive) {
          block.colonias.forEach(col => {
              if (currentRIdx < k - 1 && routeCosts[currentRIdx] > 0) {
                  const currentWithNew = routeCosts[currentRIdx] + col.cost;
                  const shortfall = dynamicTargetCost - routeCosts[currentRIdx];
                  const excess = currentWithNew - dynamicTargetCost;
                  if (currentWithNew > MAX_ALLOWED || (excess > shortfall && routeCosts[currentRIdx] >= MIN_ALLOWED)) {
                      // console.log('DEBUG: Switching route on massive block! Route', currentRIdx, 'ends at', routeCosts[currentRIdx]);
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
                  // console.log('DEBUG: Switching route! Route', currentRIdx, 'ends at', routeCosts[currentRIdx]);
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
      // console.log('DEBUG: After block', block.city, 'current Route', currentRIdx, 'cost=', routeCosts[currentRIdx]);
  });

  // console.log('DEBUG: Final Route Costs:', routeCosts);

  let allVisits = [];
  routeAssignments.forEach(`;

code = code.replace(regex, newLogic);
fs.writeFileSync('server/algorithm.ts', code);
console.log('Done replacement debug');

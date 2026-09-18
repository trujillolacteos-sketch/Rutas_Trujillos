const fs = require('fs');
let code = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

// The original availableWeeks calculation:
//   const availableWeeks = new Set<string>();
//   availableWeeks.add("Semana Actual");
//   if (state.trackingLogs) {
//     state.trackingLogs.forEach(l => { ... })

// Let's replace the whole top block
const replaceFrom = `  const availableWeeks = new Set<string>();`;
const replaceTo = `  const weeksList = Array.from(availableWeeks);`;

const newCodeBlock = `  const availableWeeks = new Set<string>();
  const currentWeekNum = getWeekNumber(new Date());
  
  if (state.trackingLogs) {
    state.trackingLogs.forEach(l => {
        availableWeeks.add("Semana " + getWeekNumber(l.timestamp));
    });
  } else {
    availableWeeks.add("Semana " + currentWeekNum);
  }
  
  let weeksList = Array.from(availableWeeks).sort((a, b) => parseInt(b.split(" ")[1]) - parseInt(a.split(" ")[1]));
  if (weeksList.length === 0) weeksList.push("Semana " + currentWeekNum);`;

code = code.replace(
  /const availableWeeks = new Set<string>\(\);\s*availableWeeks\.add\("Semana Actual"\);\s*if \(state\.trackingLogs\) \{[\s\S]*?const weeksList = Array\.from\(availableWeeks\);/,
  newCodeBlock
);

// Fix the selectedWeek state default
code = code.replace(
  /const \[selectedWeek, setSelectedWeek\] = useState<string>\("Semana Actual"\);/,
  `const [selectedWeek, setSelectedWeek] = useState<string>("Semana " + getWeekNumber(new Date()));`
);

// Fix the filtering logic
code = code.replace(
  /const d = new Date\(l\.timestamp\);[\s\S]*?if \(selectedWeek !== logWeekStr\) return false;/m,
  `const logWeekStr = "Semana " + getWeekNumber(l.timestamp);
    if (selectedWeek !== logWeekStr) return false;`
);

fs.writeFileSync('src/components/ReportsView.tsx', code);
console.log('Patched ReportsView week logic');

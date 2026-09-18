const fs = require('fs');

const file = 'src/components/CommissionsView.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /if \(selectedWeek && selectedWeek !== "ALL" && week !== selectedWeek\) return acc;/,
  `if (selectedWeek && selectedWeek !== "ALL" && week !== selectedWeek && c.isLiquidated !== false) return acc;`
);

fs.writeFileSync(file, code);
console.log('Patched CommissionsView table pending credits');

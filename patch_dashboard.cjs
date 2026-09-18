const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regex = /const getWeekNumber = \([\s\S]*?^\s*\};\n/m;
const funcCode = `const getWeekNumber = (d: string | Date | number) => {
    if (!d) return 0;
    try {
      const date = typeof d === 'string' && !d.includes('T') ? new Date(d + 'T00:00:00') : new Date(d);
      date.setHours(0, 0, 0, 0);
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      const pastDaysOfYear = Math.round((date.getTime() - startOfYear.getTime()) / 86400000);
      return Math.floor((pastDaysOfYear + startOfYear.getDay()) / 7) + 1;
    } catch {
      return 0;
    }
  };\n`;

code = code.replace(regex, funcCode);
fs.writeFileSync('src/components/DashboardView.tsx', code);
console.log('Patched DashboardView');

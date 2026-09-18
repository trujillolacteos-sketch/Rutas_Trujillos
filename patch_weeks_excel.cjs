const fs = require('fs');

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
};`;

function patchFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  
  // Replace existing getWeekNumber
  const regex = /const getWeekNumber = \([\s\S]*?^\};/m;
  if (code.match(regex)) {
    code = code.replace(regex, funcCode);
  } else {
    // If it's ReportsView, it might not have getWeekNumber yet, we'll inject it.
    if (!code.includes('const getWeekNumber')) {
      code = code.replace('export default function ', funcCode + '\n\nexport default function ');
    }
  }
  
  fs.writeFileSync(file, code);
  console.log('Patched', file);
}

patchFile('src/components/CommissionsView.tsx');
patchFile('src/components/DashboardView.tsx');
patchFile('src/components/ReportsView.tsx');

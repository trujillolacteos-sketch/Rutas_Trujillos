const fs = require('fs');

const file = 'src/components/CommissionsView.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix selectedWeek default
code = code.replace(
  /const \[selectedWeek, setSelectedWeek\] = useState<string>\("Semana 31"\); \/\/ Requested by user/,
  `const currentWeekStr = "Semana " + getWeekNumber(new Date());
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStr);`
);

// 2. Add current week to weeks list if missing
const weeksMemoRegex = /const weeks = useMemo\(\(\) => \{([\s\S]*?)return Array\.from\(w\)\.sort\(\(a, b\) => parseInt\(b\.split\(" "\)\[1\]\) - parseInt\(a\.split\(" "\)\[1\]\)\);\n  \}, \[commissions\]\);/;
code = code.replace(weeksMemoRegex, (match, body) => {
  return `const weeks = useMemo(() => {${body}
    w.add(currentWeekStr);
    return Array.from(w).sort((a, b) => parseInt(b.split(" ")[1]) - parseInt(a.split(" ")[1]));
  }, [commissions]);`;
});

fs.writeFileSync(file, code);
console.log('Patched CommissionsView default week');

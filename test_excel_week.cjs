function excelWeekNum(d) {
  // Try parsing the date, treat it as local or UTC based on format, but typically we want the local date representation.
  const date = typeof d === 'string' && !d.includes('Z') ? new Date(d + 'T00:00:00') : new Date(d);
  
  // Set to midnight local time to avoid timezone shifts
  date.setHours(0, 0, 0, 0);
  
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  startOfYear.setHours(0, 0, 0, 0);
  
  const pastDaysOfYear = Math.round((date.getTime() - startOfYear.getTime()) / 86400000);
  
  // Excel's week 1 is the week containing Jan 1st.
  // Week starts on Sunday.
  const startDay = startOfYear.getDay(); // 0 = Sunday
  
  const weekNum = Math.floor((pastDaysOfYear + startDay) / 7) + 1;
  return weekNum;
}

console.log('2026-01-01', excelWeekNum('2026-01-01')); // 1
console.log('2026-01-03', excelWeekNum('2026-01-03')); // 1
console.log('2026-01-04 (Sun)', excelWeekNum('2026-01-04')); // 2
console.log('2026-08-01', excelWeekNum('2026-08-01')); // Aug 1 is Saturday -> 31
console.log('2026-08-02', excelWeekNum('2026-08-02')); // Aug 2 is Sunday -> 32

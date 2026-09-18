const fs = require('fs');
let code = fs.readFileSync('src/components/PlannerView.tsx', 'utf8');

const oldCheck = `          if (activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0) {
            const dist = getDistance(coords[0], coords[1], activeVisit.lat, activeVisit.lng);
            setDistanceToNext(dist);

            if (dist < 0.15 && (!reachedVisit || reachedVisit.id !== activeVisit.id)) {
              setReachedVisit(activeVisit);
            }
          } else {
            setDistanceToNext(null);
          }`;

const newCheck = `          if (activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0) {
            const dist = getDistance(coords[0], coords[1], activeVisit.lat, activeVisit.lng);
            setDistanceToNext(dist);
          } else {
            setDistanceToNext(null);
          }`;

code = code.replace(oldCheck, newCheck);

const separateEffect = `
  useEffect(() => {
    if (userLocation && activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0) {
      const dist = getDistance(userLocation[0], userLocation[1], activeVisit.lat, activeVisit.lng);
      setDistanceToNext(dist);
      
      // Auto check-in by proximity
      if (dist < 0.15 && (!reachedVisit || reachedVisit.id !== activeVisit.id)) {
        setReachedVisit(activeVisit);
      }
    } else {
      setDistanceToNext(null);
    }
  }, [userLocation, activeVisit?.id, activeVisit?.lat, activeVisit?.lng, reachedVisit?.id]);
`;

if (!code.includes('Auto check-in by proximity')) {
    code = code.replace(
        '  const handleStatusChange = async',
        separateEffect + '\n  const handleStatusChange = async'
    );
}

fs.writeFileSync('src/components/PlannerView.tsx', code);

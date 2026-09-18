const fs = require('fs');
let code = fs.readFileSync('src/components/PlannerView.tsx', 'utf8');

const oldEffect = `  useEffect(() => {
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
  }, [userLocation, activeVisit?.id, activeVisit?.lat, activeVisit?.lng, reachedVisit?.id]);`;

const newEffect = `  const [processedVisits, setProcessedVisits] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userLocation && activeVisit && activeVisit.lat !== 0 && activeVisit.lng !== 0) {
      const dist = getDistance(userLocation[0], userLocation[1], activeVisit.lat, activeVisit.lng);
      setDistanceToNext(dist);
      
      // Auto check-in by proximity
      if (dist < 0.15 && !processedVisits.has(activeVisit.id) && (!reachedVisit || reachedVisit.id !== activeVisit.id)) {
        setReachedVisit(activeVisit);
      }
    } else {
      setDistanceToNext(null);
    }
  }, [userLocation, activeVisit?.id, activeVisit?.lat, activeVisit?.lng, reachedVisit?.id, processedVisits]);`;

code = code.replace(oldEffect, newEffect);

const oldButton = `            <button
              onClick={() => {
                handleStatusChange(reachedVisit, 'VISITADO');
                setReachedVisit(null);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
            >`;

const newButton = `            <button
              onClick={() => {
                setProcessedVisits(prev => new Set(prev).add(reachedVisit.id));
                handleStatusChange(reachedVisit, 'VISITADO');
                setReachedVisit(null);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
            >`;

code = code.replace(oldButton, newButton);

const oldClose = `            <button
              onClick={() => setReachedVisit(null)}
              className="w-full text-slate-400 hover:text-slate-600 font-bold py-2"
            >`;

const newClose = `            <button
              onClick={() => {
                setProcessedVisits(prev => new Set(prev).add(reachedVisit.id));
                setReachedVisit(null);
              }}
              className="w-full text-slate-400 hover:text-slate-600 font-bold py-2"
            >`;

code = code.replace(oldClose, newClose);

fs.writeFileSync('src/components/PlannerView.tsx', code);

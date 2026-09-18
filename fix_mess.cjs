const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const regex = /for \(let p of availablePatterns\) \{[\s\S]*?lastDays = bestPattern;/;

const cleanBlock = `for (let p of availablePatterns) {
            let overfill = 0;
            let continuityPenalty = 0;
            let balanceScore = 0;
            
            for (let d of p) {
                let projectedLoad = dayLoads[d] + 1;
                if (projectedLoad > idealDayLoad) {
                    overfill += (projectedLoad - idealDayLoad);
                }
                
                balanceScore += Math.pow(dayLoads[d], 2) * 2.0; 

                if (!lastDays.includes(d)) {
                    continuityPenalty += 50;
                }
                
                if (dayCities[d].has(c.city)) {
                    continuityPenalty -= 500; // Fuerte bonificación por agrupar la misma ciudad
                } else if (dayCities[d].size > 0) {
                    // Penalización base por mezclar ciudades
                    continuityPenalty += 400; 
                    
                    let isSJ = false;
                    dayCities[d].forEach(city => {
                        if (city.includes('San Juan') || c.city.includes('San Juan')) {
                            isSJ = true;
                        }
                    });

                    // Toleramos más si se mezcla con San Juan (Hub principal)
                    if (isSJ) {
                        continuityPenalty -= 250; 
                    }
                    
                    dayCities[d].forEach(city => {
                        if (cityCenters[city] && cityCenters[c.city]) {
                            let dist = Math.sqrt(Math.pow(cityCenters[city].lat - cityCenters[c.city].lat, 2) + Math.pow(cityCenters[city].lng - cityCenters[c.city].lng, 2)) * 111;
                            continuityPenalty += dist * 5; 
                        }
                        
                        if (!city.includes('San Juan') && !c.city.includes('San Juan')) {
                            // Nunca mezclar dos municipios foráneos grandes
                            if (cityCountsInRoute[city] >= 10 || cityCountsInRoute[c.city] >= 10) {
                                continuityPenalty += 1000;
                            }
                        }
                    });
                }
            }
            
            const currentScore = (overfill * 2000) + balanceScore + continuityPenalty;
            if (currentScore < bestScore) {
                bestScore = currentScore;
                bestPattern = p;
            }
        }
        lastDays = bestPattern;`;

code = code.replace(regex, cleanBlock);
fs.writeFileSync('server/algorithm.ts', code);
console.log('Cleaned mess!');

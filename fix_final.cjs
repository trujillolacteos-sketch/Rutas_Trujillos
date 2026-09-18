const fs = require('fs');
let code = fs.readFileSync('server/algorithm.ts', 'utf8');

const regex = /balanceScore \+\= Math\.pow\(dayLoads\[d\], 2\) \* 2\.5;[\s\S]*?continuityPenalty \+\= 1500;[\s\S]*?\}\);\s*\}/;

const newLogic = `balanceScore += Math.pow(dayLoads[d], 2) * 2.0; 

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
                }`;

code = code.replace(regex, newLogic);
fs.writeFileSync('server/algorithm.ts', code);
console.log('Done');

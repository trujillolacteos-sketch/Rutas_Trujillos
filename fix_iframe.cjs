const fs = require('fs');
let code = fs.readFileSync('src/components/ActiveTripView.tsx', 'utf8');

const regex = /<iframe[\s\S]*?<\/iframe>/;

const replacement = `<a 
                  href={\`https://www.google.com/maps/dir/?api=1&origin=\${state.config.cedis.lat},\${state.config.cedis.lng}&destination=\${activeClient.latitud},\${activeClient.longitud}&travelmode=driving\`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex-1 relative block bg-slate-100 overflow-hidden group cursor-pointer"
                >
                  <div className="absolute inset-0 bg-blue-900/10 group-hover:bg-blue-900/20 transition-colors z-10 flex items-center justify-center">
                    <div className="bg-white text-blue-700 px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 transform group-hover:scale-105 transition-transform">
                      <Navigation className="w-5 h-5" />
                      Iniciar Viaje en GPS Nativo
                    </div>
                  </div>
                  <iframe
                    title={\`Google Map showing \${activeClient.nombre}\`}
                    src={
                      mapViewMode === "route"
                        ? \`https://maps.google.com/maps?saddr=\${state.config.cedis.lat},\${state.config.cedis.lng}&daddr=\${activeClient.latitud},\${activeClient.longitud}&t=&z=12&output=embed\`
                        : \`https://maps.google.com/maps?q=\${activeClient.latitud},\${activeClient.longitud}&t=&z=15&ie=UTF8&iwloc=&output=embed\`
                    }
                    className="w-full h-full border-0 pointer-events-none"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  ></iframe>
                </a>`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/ActiveTripView.tsx', code, 'utf8');
  console.log("Updated active trip iframe!");
} else {
  console.log("Regex not found!");
}

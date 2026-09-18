const fs = require('fs');
let code = fs.readFileSync('src/components/ActiveTripView.tsx', 'utf8');

const regex = /<a[\s\S]*?className="w-full flex-1 relative block bg-slate-100 overflow-hidden group cursor-pointer"[\s\S]*?<\/a>/;

const replacement = `<iframe
                    title={\`Google Map showing \${activeClient.nombre}\`}
                    src={
                      mapViewMode === "route"
                        ? \`https://maps.google.com/maps?saddr=\${state.config.cedis.lat},\${state.config.cedis.lng}&daddr=\${activeClient.latitud},\${activeClient.longitud}&t=&z=12&output=embed\`
                        : \`https://maps.google.com/maps?q=\${activeClient.latitud},\${activeClient.longitud}&t=&z=15&ie=UTF8&iwloc=&output=embed\`
                    }
                    className="w-full flex-1 border-0"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  ></iframe>`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/ActiveTripView.tsx', code, 'utf8');
  console.log("Fixed iframe interactivity!");
} else {
  console.log("Regex not found!");
}

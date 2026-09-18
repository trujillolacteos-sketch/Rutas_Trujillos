const fs = require('fs');
let code = fs.readFileSync('src/components/ActiveTripView.tsx', 'utf8');

const regex = /<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">[\s\S]*?Estaba Cerrado\s*<\/button>\s*<\/div>/g;

const replacement = `<button
                    onClick={() => {
                      handleStatusChange(activeVisit.id, "SURTIDO");
                      showNotification("Visita registrada con éxito. Siguiente parada.", "success");
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all cursor-pointer border bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Siguiente Parada (Surtido)
                  </button>`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/ActiveTripView.tsx', code, 'utf8');
  console.log("Updated active trip buttons!");
} else {
  console.log("Regex not found!");
}

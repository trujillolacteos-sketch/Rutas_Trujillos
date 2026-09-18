const fs = require('fs');
let code = fs.readFileSync('src/components/ActiveTripView.tsx', 'utf8');

let regex = /<h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Registrar Estado de la Visita<\/h4>[\s\S]*?(?=\{\/\* Client Detailed Inspection)/;

let replacement = `<h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Progreso de Viaje</h4>
                  
                  <button
                    onClick={() => {
                      handleStatusChange(activeVisit.id, "SURTIDO");
                      showNotification("Visita registrada con éxito. Siguiente parada.", "success");
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Siguiente Parada
                  </button>

                  {activeVisit.estado !== "PENDIENTE" && (
                    <button
                      onClick={() => handleStatusChange(activeVisit.id, "PENDIENTE")}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-xl transition-all cursor-pointer mt-2"
                    >
                      Deshacer y Restaurar Cliente
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
`;

code = code.replace(/<h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Registrar Estado de la Visita<\/h4>[\s\S]*?(?=\{\/\* Client Detailed Inspection)/, ''); // Clear old stuff, wait, the closing tags are tricky.

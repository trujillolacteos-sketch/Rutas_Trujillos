const fs = require('fs');
const path = 'src/components/ClientsView.tsx';
let code = fs.readFileSync(path, 'utf8');

const anchor = `      )}

      {/* Client Profile / Edit Modal */}`;

const newTabs = `      )}

      {activeTab === 'missing' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="p-6 border-b border-slate-100 bg-amber-50">
            <h3 className="text-lg font-bold text-amber-900">Clientes sin GPS</h3>
            <p className="text-amber-700 text-sm">Estos clientes no se pueden planificar en las rutas.</p>
          </div>
          <div className="overflow-y-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold">Cliente</th>
                  <th className="px-6 py-3 font-semibold text-right">Volumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invalidClients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedClient(client); setEditFreq(client.visitFrequency); setEditIsActive(client.isActive !== false); setEditAssignedRouteId(client.assignedRouteId || 'none'); }}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-500">{client.city}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-slate-700">\${(client.salesVolume || 0).toLocaleString()}</p>
                    </td>
                  </tr>
                ))}
                {invalidClients.length === 0 && (
                   <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500">No hay clientes sin GPS</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'duplicates' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="p-6 border-b border-slate-100 bg-rose-50">
            <h3 className="text-lg font-bold text-rose-900">Posibles Duplicados (Misma coordenada)</h3>
          </div>
          <div className="overflow-y-auto p-4 space-y-4">
            {duplicatedGroups.length === 0 ? (
               <div className="text-center py-8 text-slate-500">No se detectaron duplicados.</div>
            ) : (
               duplicatedGroups.map((group, idx) => (
                 <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                   <p className="text-xs font-bold text-slate-500 mb-2">Ubicación: {group[0].lat.toFixed(4)}, {group[0].lng.toFixed(4)}</p>
                   <div className="space-y-2">
                     {group.map(c => (
                        <div key={c.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-300" onClick={() => { setSelectedClient(c); setEditFreq(c.visitFrequency); setEditIsActive(c.isActive !== false); setEditAssignedRouteId(c.assignedRouteId || 'none'); }}>
                           <div>
                              <p className="text-sm font-bold text-slate-800">{c.name}</p>
                              <p className="text-xs text-slate-500">ID: {c.id}</p>
                           </div>
                           <p className="text-sm font-bold text-slate-600">\${(c.salesVolume || 0).toLocaleString()}</p>
                        </div>
                     ))}
                   </div>
                 </div>
               ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'isolated' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="p-6 border-b border-slate-100 bg-purple-50">
            <h3 className="text-lg font-bold text-purple-900">Zonas Aisladas</h3>
            <p className="text-purple-700 text-sm">Ciudades o zonas con un solo cliente.</p>
          </div>
          <div className="overflow-y-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold">Cliente</th>
                  <th className="px-6 py-3 font-semibold">Zona Única</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isolatedZones.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedClient(client); setEditFreq(client.visitFrequency); setEditIsActive(client.isActive !== false); setEditAssignedRouteId(client.assignedRouteId || 'none'); }}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{client.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-purple-700 bg-purple-100 inline-block px-2 py-1 rounded-md">{client.city?.trim() || 'Desconocido'}</p>
                    </td>
                  </tr>
                ))}
                {isolatedZones.length === 0 && (
                   <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500">No hay zonas aisladas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client Profile / Edit Modal */}`;

if (code.includes(anchor)) {
    code = code.replace(anchor, newTabs);
    fs.writeFileSync(path, code);
    console.log('Successfully added missing tabs.');
} else {
    console.log('Could not find anchor to inject missing tabs.');
}

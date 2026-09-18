import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import { Users, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { AppState } from '../types';

export default function UsersManagement({ state, setState }: { state: AppState, setState: any }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ username: '', role: 'operator', password: '' });
  const [isAdding, setIsAdding] = useState(false);
  
  const users = state.users || [];

  const handleAdd = async () => {
    if (!editForm.username || !editForm.password) return;
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        setState((prev: AppState) => ({ ...prev, users: [...(prev.users || []), data.user] }));
        setIsAdding(false);
        setEditForm({ username: '', role: 'operator', password: '' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        setState((prev: AppState) => ({
          ...prev,
          users: prev.users.map((u: any) => u.id === id ? data.user : u)
        }));
        setEditingId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
      const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setState((prev: AppState) => ({
          ...prev,
          users: prev.users.filter((u: any) => u.id !== id)
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({ username: user.username, role: user.role, password: user.password });
    setIsAdding(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Gestión de Usuarios
        </h3>
        <button 
          onClick={() => { setIsAdding(true); setEditingId(null); setEditForm({ username: '', role: 'operator', password: '' }); }}
          className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Administra permisos y accesos.</p>
      
      <div className="space-y-3">
        {isAdding && (
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-wrap gap-2 items-center">
            <input 
              type="text" 
              placeholder="Usuario" 
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm flex-1 min-w-[120px]"
              value={editForm.username}
              onChange={e => setEditForm({...editForm, username: e.target.value})}
            />
            <select 
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm flex-1 min-w-[120px]"
              value={editForm.role}
              onChange={e => setEditForm({...editForm, role: e.target.value})}
            >
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="operator">Ruta / Operador</option>
            </select>
            <input 
              type="text" 
              placeholder="Contraseña" 
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm flex-1 min-w-[120px]"
              value={editForm.password}
              onChange={e => setEditForm({...editForm, password: e.target.value})}
            />
            <div className="flex gap-1">
              <button onClick={handleAdd} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Check className="w-4 h-4" /></button>
              <button onClick={() => setIsAdding(false)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {users.map((u: any) => (
          <div key={u.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-wrap gap-2 items-center justify-between">
            {editingId === u.id ? (
              <>
                <input 
                  type="text" 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm flex-1 min-w-[120px]"
                  value={editForm.username}
                  onChange={e => setEditForm({...editForm, username: e.target.value})}
                />
                <select 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm flex-1 min-w-[120px]"
                  value={editForm.role}
                  onChange={e => setEditForm({...editForm, role: e.target.value})}
                >
                  <option value="admin">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="operator">Ruta / Operador</option>
                </select>
                <input 
                  type="text" 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm flex-1 min-w-[120px]"
                  value={editForm.password}
                  onChange={e => setEditForm({...editForm, password: e.target.value})}
                />
                <div className="flex gap-1">
                  <button onClick={() => handleUpdate(u.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"><X className="w-4 h-4" /></button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 text-sm">{u.username}</div>
                  <div className="text-xs text-slate-500 capitalize">{u.role} • {u.password ? '••••••••' : 'Sin contraseña'}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(u)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(u.id)} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg" disabled={u.role === 'admin' && users.filter((x: any) => x.role === 'admin').length === 1} title={u.role === 'admin' && users.filter((x: any) => x.role === 'admin').length === 1 ? 'No puedes eliminar el último administrador' : ''}><Trash2 className="w-4 h-4" /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

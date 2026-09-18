const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// We need to completely rewrite the login portion of App.tsx
// Let's first extract the head and the render method up to the return.

code = code.replace(
  /\/\*[\s\S]*?const handleSignOut = \(\) => { logout\(\); };/m,
  `
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedUsername = loginForm.username.trim().replace(/[\\x00-\\x1F\\x7F]/g, '');
    const sanitizedPassword = loginForm.password.trim();

    if (!sanitizedUsername || !sanitizedPassword) {
      setLoginError('Por favor, completa ambos campos.');
      return;
    }

    const usersList = state?.users || [];
    const foundUser = usersList.find((u: any) => u.username === sanitizedUsername && u.password === sanitizedPassword);
    
    if (foundUser) {
      const userInfo = { username: foundUser.username, role: foundUser.role };
      setUser(userInfo);
      localStorage.setItem('offline_user', JSON.stringify(userInfo));
      setLoginError('');
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  useEffect(() => {
    if (token && fbUser) {
      fetch('/api/auth/role', { headers: { Authorization: 'Bearer ' + token }})
      .then(r => r.json())
      .then(d => {
         const r = d.role || 'user';
         const userInfo = { username: fbUser.email, role: r };
         setUser(userInfo);
         localStorage.setItem('offline_user', JSON.stringify(userInfo));
      });
    }
  }, [token, fbUser]);

  const handleSignOut = () => {
    logout();
    setUser(null);
    localStorage.removeItem('offline_user');
  };

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const isOperator = user?.role === 'operator';
  const role = user?.role || 'user';
`
);

// Now fix the login form rendering
code = code.replace(
  `  if (!fbUser || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
              <Route className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2 tracking-tight text-slate-900">Routing Intelligence</h1>
          <p className="text-sm text-slate-500 text-center mb-8">Inicia sesión para ingresar</p>
          <div className="space-y-4 text-center">
     <button onClick={login} className="w-full py-3.5 mt-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm">Ingresar con Google</button>
  </div>
        </motion.div>
      </div>
    );
  }`,
  `  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
              <Route className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2 tracking-tight text-slate-900">Routing Intelligence</h1>
          <p className="text-sm text-slate-500 text-center mb-8">Inicia sesión para ingresar</p>
          
          <form onSubmit={handleLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ruta / Operador</label>
              <select 
                value={loginForm.username} 
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="" disabled>Selecciona tu ruta</option>
                {(state?.users || []).map((u: any) => (
                  <option key={u.id} value={u.username}>{u.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Contraseña</label>
              <input 
                type="password"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                placeholder="Ingresa tu contraseña"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm font-medium text-center">{loginError}</p>}
            <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm">Ingresar a mi Ruta</button>
          </form>

          <div className="relative mb-6">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
             <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-400 font-medium uppercase tracking-widest">Administración</span></div>
          </div>

          <div className="space-y-4 text-center">
            <button type="button" onClick={login} className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2">
               Supervisión (Google)
            </button>
          </div>
        </motion.div>
      </div>
    );
  }`
);

fs.writeFileSync('src/App.tsx', code);

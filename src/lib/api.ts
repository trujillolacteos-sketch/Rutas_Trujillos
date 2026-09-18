import { auth } from './firebase';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
  const options = init ? { ...init } : {};
  
  const addToken = async (force) => {
    if (auth?.currentUser) {
      try {
        const freshToken = await auth.currentUser.getIdToken(force);
        const headers = new Headers(options.headers || {});
        headers.set('Authorization', `Bearer ${freshToken}`);
        options.headers = headers;
      } catch (error: any) {
        if (error && error.message === 'Failed to fetch') return;
        console.error('Error attaching fresh token:', error);
      }
    }
  };

  if (url.startsWith('/api/')) {
    await addToken(false);
  }
  
  try {
    let res = await fetch(input, options);
    if (res.status === 401 && url.startsWith('/api/')) {
       await addToken(true);
       res = await fetch(input, options);
       if (res.status === 401 && typeof window !== 'undefined') {
           window.location.reload();
       }
    }
    return res;
  } catch (error: any) {
    if (error && error.message === 'Failed to fetch') {
      // Gracefully handle network disconnects so we don't spam the console with unhandled rejections
      return new Response(JSON.stringify({ success: false, error: 'Offline' }), { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    throw error;
  }
}

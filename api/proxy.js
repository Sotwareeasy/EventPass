const routes = new Map([
  ['eventos', ['GET']], ['usuarios', ['POST']], ['usuarios/me', ['GET', 'PATCH', 'DELETE']],
  ['auth/login', ['POST']], ['auth/logout', ['POST']], ['auth/sesion', ['GET']],
  ['telegram/codigo', ['POST']], ['telegram/vinculacion', ['GET']],
  ['inscripciones', ['GET', 'POST', 'PATCH']], ['inscripciones/cancelar', ['POST']],
  ['soporte', ['POST']], ['checkin', ['POST']],
]);
export function resolveTarget(path, method, base, chat) {
  if (!routes.get(path)?.includes(method)) return null;
  if (path === 'soporte') return chat ? new URL(chat) : null;
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Invalid origin');
  return new URL('/webhook/eventpass/' + path, origin);
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (status, message) => res.status(status).json({ok:false,error:{codigo:'PROXY_ERROR',mensaje:message}});
  const path = typeof req.query.path === 'string' ? req.query.path : '';
  if (!routes.get(path)?.includes(req.method)) return fail(405, 'Ruta o método no permitido.');
  if (!process.env.N8N_BASE_URL || (path === 'soporte' && !process.env.N8N_CHAT_URL)) return fail(503, 'Servicio pendiente de configuración.');
  try {
    const target = resolveTarget(path, req.method, process.env.N8N_BASE_URL, process.env.N8N_CHAT_URL);
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path') for (const entry of Array.isArray(value) ? value : [value]) target.searchParams.append(key, String(entry));
    }
    const headers = {'Accept':'application/json', 'ngrok-skip-browser-warning':'1'};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    let body;
    if (req.method !== 'GET') {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      if (Buffer.byteLength(body) > 16384) return fail(413, 'Solicitud demasiado grande.');
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(target, {method:req.method, headers, body, redirect:'manual', signal:AbortSignal.timeout(55000)});
    const text = await response.text();
    if (!response.headers.get('content-type')?.includes('application/json')) return fail(502, 'El servicio devolvió una respuesta inesperada.');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(response.status).send(text);
  } catch { return fail(502, 'No se pudo contactar con EventPass. Comprueba tu conexión e inténtalo más tarde.'); }
}

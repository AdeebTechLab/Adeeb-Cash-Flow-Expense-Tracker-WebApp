const skippedResponseHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

export default async function handler(req, res) {
  const backendUrl = String(process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (!backendUrl) {
    return res.status(500).json({ message: 'BACKEND_URL is not configured on Vercel.' });
  }

  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined && !['host', 'connection', 'content-length', 'origin'].includes(name.toLowerCase())) {
        headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    const method = req.method || 'GET';
    const hasBody = !['GET', 'HEAD'].includes(method);
    const upstream = await fetch(`${backendUrl}${req.url}`, {
      method,
      headers,
      body: hasBody && req.body !== undefined
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : undefined,
      redirect: 'manual',
    });

    upstream.headers.forEach((value, name) => {
      if (!skippedResponseHeaders.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') {
        res.setHeader(name, value);
      }
    });

    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) res.setHeader('set-cookie', cookies);
    else if (upstream.headers.get('set-cookie')) res.setHeader('set-cookie', upstream.headers.get('set-cookie'));

    const body = Buffer.from(await upstream.arrayBuffer());
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error('Render proxy error:', error);
    return res.status(502).json({ message: 'The backend is temporarily unavailable.' });
  }
}

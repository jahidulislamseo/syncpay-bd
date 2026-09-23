let serverPromise = null;

async function getServer() {
  if (!serverPromise) {
    serverPromise = (async () => {
      const mod = await import('../dist/index.js');
      const s = mod.default || mod;
      await s.ready();
      return s;
    })();
  }
  return await serverPromise;
}

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade']);

export default async function handler(req, res) {
  try {
    const server = await getServer();

    // In Vercel rewrites, destination rewrite rewrites req.url to /api/index.js
    // Extract genuine requested URI from x-matched-path header
    let targetUrl = req.headers['x-matched-path'] || req.url || '/';
    if (targetUrl === '/api/index.js' || targetUrl.startsWith('/api/index.js?')) {
      targetUrl = req.headers['x-matched-path'] || '/';
    }

    let payload = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      payload = Buffer.concat(chunks);
    }

    const response = await server.inject({
      method: req.method,
      url: targetUrl,
      headers: req.headers,
      payload,
    });

    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined && !HOP_BY_HOP.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    res.end(response.rawPayload);
  } catch (err) {
    console.error('Vercel API Gateway Error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Internal Gateway Error',
          message: err && err.message ? err.message : String(err),
        })
      );
    }
  }
}

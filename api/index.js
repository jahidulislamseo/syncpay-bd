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

export default async function handler(req, res) {
  try {
    const server = await getServer();

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
      url: req.url,
      headers: req.headers,
      payload,
    });

    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
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

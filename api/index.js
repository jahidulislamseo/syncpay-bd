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
    server.server.emit('request', req, res);
  } catch (err) {
    console.error('Vercel API Gateway Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Internal Gateway Error',
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : undefined,
      })
    );
  }
}

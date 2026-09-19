import server from '../dist/index.js';

export default async function handler(req, res) {
  try {
    await server.ready();
    server.server.emit('request', req, res);
  } catch (err) {
    console.error('Vercel API Gateway Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Gateway Error', message: String(err) }));
  }
}

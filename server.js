const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'PartID API Proxy running', key_set: !!process.env.ANTHROPIC_API_KEY });
});

// Fetch external image server-side with fallback strategies
app.get('/fetch-image', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url param' });
  let lastErr = null;
  const headers = [
    { 'User-Agent': 'Mozilla/5.0 (compatible; PartID/1.0)' },
    { 'User-Agent': 'Mozilla/5.0', 'Referer': (() => { try { return new URL(url).origin; } catch(e) { return ''; } })() },
    {}
  ];
  for (const h of headers) {
    try {
      const response = await fetch(url, { headers: h });
      if (!response.ok) { lastErr = 'HTTP ' + response.status; continue; }
      const ct = response.headers.get('content-type') || 'image/jpeg';
      const buf = await response.arrayBuffer();
      if (buf.byteLength === 0) { lastErr = 'Empty body'; continue; }
      return res.json({ base64: Buffer.from(buf).toString('base64'), contentType: ct, size: buf.byteLength });
    } catch(e) { lastErr = e.message; }
  }
  res.status(500).json({ error: lastErr || 'All strategies failed' });
});

// Anthropic proxy
app.post('/identify', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { type: 'config_error', message: 'ANTHROPIC_API_KEY not set on server' } });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch(err) {
    res.status(500).json({ error: { type: 'proxy_error', message: err.message } });
  }
});

app.listen(PORT, () => console.log('PartID proxy on port ' + PORT + ' | key: ' + !!process.env.ANTHROPIC_API_KEY));

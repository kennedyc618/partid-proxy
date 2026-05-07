const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'PartID API Proxy running',
    key_set: !!process.env.ANTHROPIC_API_KEY,
  });
});

// Fetch and compress an external image server-side (avoids browser CORS)
app.get('/fetch-image', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url param' });
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(404).json({ error: 'Image fetch failed: ' + response.status });
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.json({ base64, contentType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy to Anthropic API
app.post('/identify', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: { type: 'config_error', message: 'ANTHROPIC_API_KEY not set on server' }
    });
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { type: 'proxy_error', message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`PartID proxy running on port ${PORT}`);
  console.log(`API key set: ${!!process.env.ANTHROPIC_API_KEY}`);
});

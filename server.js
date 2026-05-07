const http = require('http');

let latestSignal = null;
const signals = [];

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(signal) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const isBull = signal.signal && signal.signal.includes('BULL');
  const emoji = isBull ? '🟢' : '🔴';
  const stage = signal.signal.includes('ENTRY') ? '🚀 ENTRY — TRADE NOW' : signal.signal.includes('RETRACE') ? '⚡ Price back at level — get ready' : '📍 Indication fired — bias confirmed';
  const msg = `${emoji} CCT SIGNAL\n\nPair: ${signal.sym}\nSignal: ${signal.signal}\nPrice: ${signal.close}\nStage: ${stage}\nTime: ${signal.time}`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
    });
  } catch (e) { console.error('Telegram error:', e.message); }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CCT Webhook Server running');
    return;
  }

  if (req.method === 'GET' && req.url === '/signals') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ latest: latestSignal, all: signals.slice(-50) }));
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const signal = {
          sym: data.sym || 'UNKNOWN',
          signal: data.signal || 'UNKNOWN',
          close: data.close || 0,
          time: data.time || new Date().toISOString(),
          received: new Date().toISOString()
        };
        latestSignal = signal;
        signals.push(signal);
        if (signals.length > 100) signals.shift();
        console.log(`Signal: ${signal.sym} ${signal.signal} @ ${signal.close}`);
        await sendTelegram(signal);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, signal }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CCT server running on port ${PORT}`));

const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const app = express();
app.use(cors());
app.use(express.json());

let sock = null;
let qrCodeData = null;
let isReady = false;

app.get('/status', (req, res) => res.json({ connected: isReady }));

app.get('/qr', async (req, res) => {
  if (isReady) return res.json({ status: 'connected' });
  if (qrCodeData) return res.json({ status: 'pending', qr: qrCodeData });
  res.json({ status: 'initializing' });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html><html><head><title>Techtaire WA Server</title>
    <meta http-equiv="refresh" content="5">
    <style>
      body{font-family:Arial;text-align:center;padding:40px;background:#f0f0f0;}
      h1{color:#25D366;}
      .status{font-size:18px;margin:20px;padding:10px 20px;border-radius:8px;display:inline-block;}
      .connected{background:#25D366;color:white;}
      .pending{background:#FFA500;color:white;}
      .init{background:#999;color:white;}
    </style>
    </head><body>
    <h1>Techtaire WhatsApp Server</h1>
    ${isReady
      ? `<div class="status connected">✅ WhatsApp Connected!</div>`
      : qrCodeData
        ? `<div class="status pending">Scan QR Code</div><br><img src="${qrCodeData}" width="280"/>`
        : `<div class="status init">Initializing... Please wait</div>`
    }
    </body></html>
  `);
});

app.post('/send', async (req, res) => {
  if (!isReady) return res.status(400).json({ error: 'WhatsApp not connected' });
  const { phone, message } = req.body;
  try {
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/bulk-send', async (req, res) => {
  if (!isReady) return res.status(400).json({ error: 'WhatsApp not connected' });
  const { phones, message } = req.body;
  if (!phones || !Array.isArray(phones)) return res.status(400).json({ error: 'Phones array required' });
  let sent = 0;
  for (let i = 0; i < phones.length; i++) {
    try {
      const jid = phones[i].replace(/\D/g, '') + '@s.whatsapp.net';
      await sock.sendMessage(jid, { text: message });
      sent++;
      console.log(`Sent ${sent}/${phones.length}`);
      if (sent % 20 === 0) {
        const delay = Math.floor(Math.random() * 30000) + 30000;
        console.log(`Waiting ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
  res.json({ success: true, total: phones.length, sent });
});

async function startClient() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Techtaire', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = await qrcode.toDataURL(qr);
      isReady = false;
      console.log('QR Generated ✅');
    }

    if (connection === 'open') {
      isReady = true;
      qrCodeData = null;
      console.log('WhatsApp Connected! ✅');
    }

    if (connection === 'close') {
      isReady = false;
      qrCodeData = null;
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
        : true;
      console.log('Disconnected. Reconnecting:', shouldReconnect);
      if (shouldReconnect) setTimeout(startClient, 5000);
    }
  });
}

startClient();

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

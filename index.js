const express = require('express');
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let client;
let qrCodeData = null;
let isReady = false;

// ROOT ROUTE
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Techtaire WhatsApp Server</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #f0f0f0; }
          h1 { color: #25D366; }
          img { margin-top: 20px; border: 3px solid #25D366; border-radius: 12px; }
          .status { font-size: 18px; margin: 20px; padding: 10px 20px; border-radius: 8px; display: inline-block; }
          .connected { background: #25D366; color: white; }
          .pending { background: #FFA500; color: white; }
          .init { background: #999; color: white; }
        </style>
      </head>
      <body>
        <h1>🚀 Techtaire WhatsApp Server</h1>
        ${isReady
          ? `<div class="status connected">✅ WhatsApp Connected!</div>`
          : qrCodeData
            ? `<div class="status pending">📱 Scan QR Code with WhatsApp</div>
               <br><img src="${qrCodeData}" width="280" height="280" />`
            : `<div class="status init">⏳ Initializing... Please wait (page auto-refreshes)</div>`
        }
      </body>
    </html>
  `);
});

// QR ROUTE (API ke liye bhi rakha)
app.get('/qr', async (req, res) => {
  if (isReady) return res.json({ status: 'connected' });
  if (qrCodeData) return res.json({ status: 'pending', qr: qrCodeData });
  res.json({ status: 'initializing' });
});

// STATUS ROUTE
app.get('/status', (req, res) => {
  res.json({ connected: isReady });
});

// SEND MESSAGE
app.post('/send', async (req, res) => {
  if (!isReady) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  const { phone, message } = req.body;
  try {
    const number = phone.replace(/\D/g, '');
    const chatId = number + '@c.us';
    await client.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// START WHATSAPP CLIENT
function startClient() {
  client = new Client({
    authStrategy: new NoAuth(),  // ✅ Railway ke liye NoAuth (LocalAuth filesystem chahta hai)
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    isReady = false;
    qrCodeData = await qrcode.toDataURL(qr);
    console.log('✅ QR Code generated — open browser to scan');
  });

  client.on('ready', () => {
    isReady = true;
    qrCodeData = null;
    console.log('✅ WhatsApp Connected!');
  });

  client.on('auth_failure', () => {
    console.log('❌ Auth failed. Restarting...');
    isReady = false;
    qrCodeData = null;
    setTimeout(startClient, 5000);
  });

  client.on('disconnected', () => {
    isReady = false;
    qrCodeData = null;
    console.log('❌ WhatsApp Disconnected. Restarting in 5s...');
    setTimeout(startClient, 5000);
  });

  client.initialize();
}

startClient();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

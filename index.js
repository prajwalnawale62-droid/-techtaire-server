const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let client;
let qrCodeData = null;
let isReady = false;

app.get('/', (req, res) => {
  res.json({ status: 'TechTaire Server Running' });
});

app.get('/qr', async (req, res) => {
  if (isReady) return res.json({ status: 'connected' });
  if (qrCodeData) return res.json({ status: 'pending', qr: qrCodeData });
  res.json({ status: 'initializing' });
});

app.get('/status', (req, res) => {
  res.json({ connected: isReady });
});

app.post('/send', async (req, res) => {
  if (!isReady) return res.status(400).json({ error: 'WhatsApp not connected' });
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

function startClient() {
  client = new Client({
    authStrategy: new LocalAuth(),
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
      ],
    }
  });

  client.on('qr', async (qr) => {
    isReady = false;
    qrCodeData = await qrcode.toDataURL(qr);
    console.log('QR Code generated');
  });

  client.on('ready', () => {
    isReady = true;
    qrCodeData = null;
    console.log('WhatsApp Connected!');
  });

  client.on('disconnected', () => {
    isReady = false;
    startClient();
  });

  client.initialize();
}

startClient();

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

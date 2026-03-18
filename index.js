const express = require('express');
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Multi-user clients store
const clients = {};

function getOrCreateClient(userId) {
  if (clients[userId]) return clients[userId];

  const clientData = {
    client: null,
    qrCode: null,
    isReady: false
  };

  const client = new Client({
    authStrategy: new NoAuth(),
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
    clientData.isReady = false;
    clientData.qrCode = await qrcode.toDataURL(qr);
    console.log(`✅ QR generated for: ${userId}`);
  });

  client.on('ready', () => {
    clientData.isReady = true;
    clientData.qrCode = null;
    console.log(`✅ Connected for: ${userId}`);
  });

  client.on('auth_failure', () => {
    clientData.isReady = false;
    clientData.qrCode = null;
    console.log(`❌ Auth failed for: ${userId}`);
    delete clients[userId];
  });

  client.on('disconnected', () => {
    clientData.isReady = false;
    clientData.qrCode = null;
    console.log(`❌ Disconnected for: ${userId}`);
    delete clients[userId];
  });

  client.initialize();
  clientData.client = client;
  clients[userId] = clientData;

  return clientData;
}

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
          .status { font-size: 18px; margin: 20px; padding: 10px 20px; border-radius: 8px; display: inline-block; background: #25D366; color: white; }
        </style>
      </head>
      <body>
        <h1>🚀 Techtaire WhatsApp Server</h1>
        <div class="status">✅ Server Running</div>
        <p>Active Users: ${Object.keys(clients).length}</p>
      </body>
    </html>
  `);
});

// QR ROUTE
app.get('/qr', async (req, res) => {
  const userId = req.query.userId || req.query.email || 'default';
  const clientData = getOrCreateClient(userId);

  if (clientData.isReady) return res.json({ status: 'connected' });
  if (clientData.qrCode) return res.json({ status: 'pending', qr: clientData.qrCode });
  res.json({ status: 'initializing' });
});

// STATUS ROUTE
app.get('/status', (req, res) => {
  const userId = req.query.userId || req.query.email || 'default';

  if (!clients[userId]) {
    return res.json({ connected: false });
  }

  res.json({ connected: clients[userId].isReady });
});

// SINGLE MESSAGE SEND
app.post('/send', async (req, res) => {
  const { phone, message, userId, email } = req.body;
  const uid = userId || email || 'default';

  if (!clients[uid] || !clients[uid].isReady) {
    return res.status(400).json({ error: 'WhatsApp not connected for this user' });
  }

  try {
    const number = phone.replace(/\D/g, '');
    const chatId = number + '@c.us';
    await clients[uid].client.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BULK MESSAGE SEND
app.post('/bulk-send', async (req, res) => {
  const { phones, message, userId, email } = req.body;
  const uid = userId || email || 'default';

  if (!clients[uid] || !clients[uid].isReady) {
    return res.status(400).json({ error: 'WhatsApp not connected for this user' });
  }

  if (!phones || !Array.isArray(phones)) {
    return res.status(400).json({ error: 'Phones array required' });
  }

  let sent = 0;

  for (let i = 0; i < phones.length; i++) {
    try {
      const number = phones[i].replace(/\D/g, '');
      const chatId = number + '@c.us';
      await clients[uid].client.sendMessage(chatId, message);
      sent++;
      console.log(`[${uid}] Sent ${sent}/${phones.length}`);

      // Har 20 messages ke baad pause
      if (sent % 20 === 0) {
        const delay = Math.floor(Math.random() * 30000) + 30000;
        console.log(`[${uid}] Waiting ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (err) {
      console.log(`[${uid}] Error:`, err.message);
    }
  }

  res.json({
    success: true,
    total: phones.length,
    sent: sent
  });
});

// DISCONNECT
app.post('/disconnect', async (req, res) => {
  const { userId, email } = req.body;
  const uid = userId || email || 'default';

  if (clients[uid]) {
    try {
      await clients[uid].client.destroy();
    } catch (e) {}
    delete clients[uid];
  }
  res.json({ success: true });
});

// ACTIVE USERS LIST
app.get('/users', (req, res) => {
  const userList = Object.keys(clients).map(uid => ({
    userId: uid,
    connected: clients[uid].isReady
  }));
  res.json({ activeUsers: userList.length, users: userList });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

const express = require('express');
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// 3 users ka data
const users = {};

function createClient(userId) {
  const client = new Client({
    authStrategy: new NoAuth(),
    puppeteer: {
      executablePath: '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ]
    }
  });

  users[userId] = {
    client,
    qrCodeData: null,
    isReady: false
  };

  client.on('qr', async (qr) => {
    users[userId].qrCodeData = await qrcode.toDataURL(qr);
    users[userId].isReady = false;
    console.log(`QR generated for user: ${userId}`);
  });

  client.on('ready', () => {
    users[userId].isReady = true;
    users[userId].qrCodeData = null;
    console.log(`Connected: ${userId}`);
  });

  client.on('auth_failure', () => {
    users[userId].isReady = false;
    users[userId].qrCodeData = null;
    console.log(`Auth failed: ${userId} — restarting`);
    setTimeout(() => createClient(userId), 5000);
  });

  client.on('disconnected', () => {
    users[userId].isReady = false;
    users[userId].qrCodeData = null;
    console.log(`Disconnected: ${userId} — restarting`);
    setTimeout(() => createClient(userId), 5000);
  });

  client.initialize();
}

// 3 users start karo
createClient('user1');
createClient('user2');
createClient('user3');

// Status check
app.get('/status', (req, res) => {
  const { userId } = req.query;
  if (!userId || !users[userId]) return res.status(400).json({ error: 'Invalid userId' });
  res.json({ connected: users[userId].isReady });
});

// QR fetch
app.get('/qr', async (req, res) => {
  const { userId } = req.query;
  if (!userId || !users[userId]) return res.status(400).json({ error: 'Invalid userId' });
  const user = users[userId];
  if (user.isReady) return res.json({ status: 'connected' });
  if (user.qrCodeData) return res.json({ status: 'pending', qr: user.qrCodeData });
  res.json({ status: 'initializing' });
});

// Single send
app.post('/send', async (req, res) => {
  const { userId, phone, message } = req.body;
  if (!userId || !users[userId]) return res.status(400).json({ error: 'Invalid userId' });
  if (!users[userId].isReady) return res.status(400).json({ error: 'WhatsApp not connected' });
  try {
    const number = phone.replace(/\D/g, '');
    const chatId = number + '@c.us';
    await users[userId].client.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk send
app.post('/bulk-send', async (req, res) => {
  const { userId, phones, message } = req.body;
  if (!userId || !users[userId]) return res.status(400).json({ error: 'Invalid userId' });
  if (!users[userId].isReady) return res.status(400).json({ error: 'WhatsApp not connected' });
  if (!phones || !Array.isArray(phones)) return res.status(400).json({ error: 'Phones array required' });

  let sent = 0;
  const batchSize = 20;

  for (let i = 0; i < phones.length; i++) {
    try {
      const number = phones[i].replace(/\D/g, '');
      const chatId = number + '@c.us';
      await users[userId].client.sendMessage(chatId, message);
      sent++;
      console.log(`User ${userId} sent ${sent}/${phones.length}`);

      if (sent % batchSize === 0) {
        const delay = Math.floor(Math.random() * 5000) + 10000;
        console.log(`Waiting ${delay / 1000} seconds...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
  res.json({ success: true, total: phones.length, sent });
});

// Dashboard
app.get('/', (req, res) => {
  const userCards = ['user1', 'user2', 'user3'].map(uid => {
    const u = users[uid];
    return `
      <div style="border:2px solid #25D366;border-radius:12px;padding:20px;margin:10px;">
        <h2>${uid}</h2>
        ${u.isReady
          ? `<div class="status connected">✅ Connected</div>`
          : u.qrCodeData
            ? `<div class="status pending">Scan QR</div><br><img src="${u.qrCodeData}" width="200"/>`
            : `<div class="status init">Initializing...</div>`
        }
      </div>`;
  }).join('');

  res.send(`<!DOCTYPE html><html><head><title>Techtaire WA Server</title>
    <meta http-equiv="refresh" content="5">
    <style>
      body{font-family:Arial;text-align:center;padding:40px;background:#f0f0f0;}
      h1{color:#25D366;}
      .status{font-size:16px;margin:10px;padding:8px 16px;border-radius:8px;display:inline-block;}
      .connected{background:#25D366;color:white;}
      .pending{background:#FFA500;color:white;}
      .init{background:#999;color:white;}
      .grid{display:flex;justify-content:center;flex-wrap:wrap;}
    </style></head><body>
    <h1>Techtaire WhatsApp Server</h1>
    <div class="grid">${userCards}</div>
    </body></html>`);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

**API calls mein ab `userId` bhejna hoga:**
```
GET /status?userId=user1
GET /qr?userId=user1
POST /send → { userId: "user1", phone: "...", message: "..." }
POST /bulk-send → { userId: "user1", phones: [...], message: "..." }

const express = require('express');
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Store per-user clients
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

// ROOT
app.get('/', (req, res) => {
  const userList = Object.keys(clients).map(uid => ({
    userId: uid,
    connected: clients[uid].isReady
  }));
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Techtaire WhatsApp Server</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #f0f0f0; }
          h1 { color: #25D366; }
          .status { font-size: 18px; margin: 10px; padding: 10px 20px; border-radius: 8px; display: inline-block; background: #25D366; color: white; }
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
app.get('/status', async (req, res) => {
  const userId = req.query.userId || req.query.email || 'default';

  if (!clients[userId]) {
    return res.json({ connected: false });
  }

  res.json({ connected: clients[userId].isReady });
});

// SEND MESSAGE
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

// ACTIVE USERS LIST (Admin ke liye)
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
```

---

**GitHub par kaise update karo:**

1. GitHub → `techtaire-server` repo kholo
2. `index.js` file click karo
3. **Edit (pencil) button** click karo
4. Pura purana code delete karo
5. Upar wala naya code paste karo
6. **Commit changes** click karo

Railway auto-deploy karega! ✅

---

**Phir Google AI Studio mein yeh prompt do** frontend update ke liye:
```
Update all WhatsApp server API calls to include user email:

1. /qr calls — add ?email=${user.email} as query param
2. /status calls — add ?email=${user.email} as query param  
3. /send calls — add email: user.email in request body

Server URL is: https://techtaire-server-production-ad0b.up.railway.app

This ensures each user has their own WhatsApp session.

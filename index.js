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

function startClient() {

client = new Client({
authStrategy: new LocalAuth({
clientId: "techtaire-session"
}),
puppeteer: {
executablePath: process.env.CHROME_BIN || '/usr/bin/chromium',
args: [
'--no-sandbox',
'--disable-setuid-sandbox',
'--disable-dev-shm-usage',
'--disable-gpu'
]
}
});

client.on('qr', async (qr) => {
isReady = false;
qrCodeData = await qrcode.toDataURL(qr);
console.log("QR RECEIVED");
});

client.on('authenticated', () => {
console.log("Authenticated");
});

client.on('ready', () => {
console.log("WhatsApp READY");
isReady = true;
qrCodeData = null;
});

client.on('change_state', state => {
console.log("STATE:", state);

if(state === "UNPAIRED" || state === "CONFLICT"){
isReady = false;
}
});

client.on('disconnected', reason => {
console.log("Disconnected:", reason);

isReady = false;
qrCodeData = null;

setTimeout(() => {
startClient();
},5000);
});

client.initialize();
}

startClient();

app.get('/qr',(req,res)=>{
if(isReady) return res.json({status:"connected"});
if(qrCodeData) return res.json({status:"pending",qr:qrCodeData});
res.json({status:"initializing"});
});

app.get('/status',(req,res)=>{
res.json({connected:isReady});
});

app.post('/send', async(req,res)=>{

if(!isReady){
return res.status(400).json({error:"WhatsApp not connected"});
}

const {phone,message} = req.body;

try{

const number = phone.replace(/\D/g,'');
const chatId = number + "@c.us";

await client.sendMessage(chatId,message);

res.json({success:true});

}catch(err){

res.status(500).json({error:err.message});

}

});

app.post('/bulk-send', async(req,res)=>{

if(!isReady){
return res.status(400).json({error:"WhatsApp not connected"});
}

const {phones,message} = req.body;

let sent = 0;

for(let i=0;i<phones.length;i++){

try{

const number = phones[i].replace(/\D/g,'');
const chatId = number + "@c.us";

await client.sendMessage(chatId,message);

sent++;

await new Promise(r=>setTimeout(r,3000));

}catch(err){

console.log(err.message);

}

}

res.json({
success:true,
total:phones.length,
sent
});

});

const PORT = process.env.PORT || 8080;

app.listen(PORT,()=>{
console.log("Server running on",PORT);
});

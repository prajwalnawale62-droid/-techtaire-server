const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");

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
headless: true,
executablePath: process.env.CHROME_BIN || "/usr/bin/chromium",

args: [
"--no-sandbox",
"--disable-setuid-sandbox",
"--disable-dev-shm-usage",
"--disable-accelerated-2d-canvas",
"--no-first-run",
"--no-zygote",
"--disable-gpu",
"--single-process"
],

timeout: 120000

}

});

client.on("qr", async (qr) => {

console.log("QR GENERATED");

qrCodeData = await qrcode.toDataURL(qr);
isReady = false;

});

client.on("authenticated", () => {
console.log("AUTHENTICATED");
});

client.on("ready", () => {

console.log("WHATSAPP READY");

isReady = true;
qrCodeData = null;

});

client.on("auth_failure", () => {

console.log("AUTH FAILURE");

restartClient();

});

client.on("disconnected", (reason) => {

console.log("DISCONNECTED:", reason);

restartClient();

});

client.initialize();
}

function restartClient(){

isReady = false;
qrCodeData = null;

try{
client.destroy();
}catch(e){}

setTimeout(()=>{
startClient();
},5000);

}

startClient();


/* FORCE STATE CHECK */

setInterval(async ()=>{

try{

if(!client) return;

const state = await client.getState();

if(state !== "CONNECTED"){

console.log("FORCE DETECT LOGOUT:",state);

restartClient();

}

}catch(e){

console.log("STATE CHECK ERROR");

}

},15000);



app.get("/",(req,res)=>{
res.send("Techtaire WhatsApp Server Running");
});


app.get("/qr",(req,res)=>{

if(isReady){

return res.json({
status:"connected"
});

}

if(qrCodeData){

return res.json({
status:"pending",
qr:qrCodeData
});

}

res.json({
status:"initializing"
});

});


app.get("/status",async(req,res)=>{

try{

if(!client){

return res.json({
connected:false
});

}

const state = await client.getState();

res.json({
connected: state === "CONNECTED",
state
});

}catch{

res.json({
connected:false
});

}

});


app.post("/send", async(req,res)=>{

if(!isReady){

return res.status(400).json({
error:"WhatsApp not connected"
});

}

const { phone , message } = req.body;

try{

const number = phone.replace(/\D/g,"");

const chatId = number + "@c.us";

await client.sendMessage(chatId,message);

res.json({
success:true
});

}catch(err){

res.status(500).json({
error:err.message
});

}

});


app.post("/bulk-send", async(req,res)=>{

if(!isReady){

return res.status(400).json({
error:"WhatsApp not connected"
});

}

const { phones , message } = req.body;

let sent = 0;

for(const p of phones){

try{

const number = p.replace(/\D/g,"");
const chatId = number + "@c.us";

await client.sendMessage(chatId,message);

sent++;

await new Promise(r=>setTimeout(r,3000));

}catch(e){

console.log(e.message);

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

console.log("Server running",PORT);

});

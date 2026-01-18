const mineflayer = require('mineflayer');
const { OpenAI } = require('openai');
const express = require('express');

// 1. WEB SERVER: Keeps the hosting platform from sleeping
const app = express();
app.get('/', (req, res) => res.send('AI Bot is running 24/7'));
app.listen(3000, () => console.log('Web status page ready.'));

// 2. AI CONFIG: Uses your API Key from Environment Variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

// 3. BOT CONFIG: Replace with your actual server IP
const bot = mineflayer.createBot({
  host: 'ADHOLOKAM-III.aternos.me', // <-- Put your server address here
  port: 49728,                  // <-- Put your port here (usually 25565)
  username: 'AI_Player_Bot',
  version: false,               // Auto-detects Minecraft version
  auth: 'offline'               // Required for Aternos/Cracked servers
});

// 4. AI CHAT LOGIC: Responds like a human
bot.on('chat', async (username, message) => {
  if (username === bot.username) return; // Ignore own messages

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // 2026 standard model
      messages: [
        { role: "system", content: "You are a friendly Minecraft player. Keep responses short and fun." },
        { role: "user", content: `${username} says: ${message}` }
      ],
    });

    const reply = response.choices[0].message.content;
    bot.chat(reply);
  } catch (err) {
    console.log("AI Error: ", err.message);
  }
});

// 5. ANTI-AFK & AUTO-RESTART
bot.on('spawn', () => {
  console.log('Bot joined the server!');
  setInterval(() => {
    bot.swingArm(); // Move every 30s so you don't get kicked
  }, 30000);
});

bot.on('end', () => {
  console.log('Bot disconnected. Restarting in 5 seconds...');
  setTimeout(() => process.exit(), 5000); // Forces hosting to restart the script
});

bot.on('error', (err) => console.log('Runtime Error:', err));

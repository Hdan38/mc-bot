const mineflayer = require('mineflayer');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const bot = mineflayer.createBot({ host: 'YOUR_SERVER_IP', username: 'AI_Player' });

bot.on('chat', async (username, message) => {
  if (username === bot.username) return;

  // AI generates a response based on chat
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: `You are a Minecraft player named AI_Player. ${username} said: ${message}` }],
  });

  bot.chat(response.choices[0].message.content);
});

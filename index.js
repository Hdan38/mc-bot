'use strict';

// Mineflayer creates and controls the Minecraft bot.
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const http = require('http');

// -----------------------------------------------------------------------------
// 1) CONFIGURATION
// Change these values before deploying.
// You can also set them as environment variables on Render/Railway/Replit.
// -----------------------------------------------------------------------------
const CONFIG = {
  host: process.env.MC_HOST || 'ADHOLOKAM-III.aternos.me',
  port: Number(process.env.MC_PORT || 49728),
  username: process.env.MC_USERNAME || 'AFK_Helper_Bot',
  auth: process.env.MC_AUTH || 'offline', // Use "microsoft" for premium accounts.
  version: process.env.MC_VERSION || false, // false = auto-detect
  reconnectDelayMs: Number(process.env.RECONNECT_DELAY_MS || 5000),
  antiAfkIntervalMs: Number(process.env.ANTI_AFK_INTERVAL_MS || 8000),
};

// -----------------------------------------------------------------------------
// 2) OPTIONAL HEALTH WEB SERVER
// Many free hosts expect your app to listen on a web port.
// This keeps the service "alive" and gives a quick status endpoint.
// -----------------------------------------------------------------------------
const webPort = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'mineflayer-bot' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Minecraft bot service is running.');
});

server.listen(webPort, () => {
  console.log(`[WEB] Health server listening on port ${webPort}`);
});

// -----------------------------------------------------------------------------
// 3) BOT LIFECYCLE STATE
// We store references so we can reconnect cleanly and stop intervals when needed.
// -----------------------------------------------------------------------------
let bot;
let antiAfkTimer = null;
let reconnectTimer = null;
const shownHelpCodes = new Set();

function clearTimers() {
  if (antiAfkTimer) {
    clearInterval(antiAfkTimer);
    antiAfkTimer = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return; // Avoid multiple reconnect loops.

  console.log(`[RECONNECT] Attempting reconnect in ${CONFIG.reconnectDelayMs}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, CONFIG.reconnectDelayMs);
}

function printJoinTroubleshooting(err) {
  if (!err || !err.code) return;
  if (shownHelpCodes.has(err.code)) return;

  shownHelpCodes.add(err.code);

  if (err.code === 'ENETUNREACH' || err.code === 'EHOSTUNREACH') {
    console.log('[HELP] Network route to the Minecraft server is unreachable from this machine.');
    console.log('[HELP] Start the bot on a host/VPS with outbound TCP access to Minecraft ports.');
  }

  if (err.code === 'ECONNREFUSED') {
    console.log('[HELP] Connection refused: the server may be offline, sleeping, or not accepting this port.');
  }

  if (err.code === 'ETIMEDOUT') {
    console.log('[HELP] Connection timed out: the server may be overloaded/offline or blocked by firewall rules.');
  }
}

// -----------------------------------------------------------------------------
// 4) CREATE AND CONFIGURE THE BOT
// -----------------------------------------------------------------------------
function createBot() {
  clearTimers();

  console.log(`[BOT] Connecting to ${CONFIG.host}:${CONFIG.port} as "${CONFIG.username}"...`);
  console.log('[BOT] Tip: If your server is cracked/offline-mode, keep MC_AUTH=offline.');

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: CONFIG.auth,
    version: CONFIG.version,
  });

  bot.loadPlugin(pathfinder);

  // Fires when bot fully joins the game world.
  bot.once('spawn', () => {
    console.log('[BOT] Connected and spawned in-game.');

    // Set movement settings for pathfinder (needed for !follow).
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);

    // Basic anti-AFK: every few seconds, do one random movement/jump action.
    antiAfkTimer = setInterval(() => {
      if (!bot || !bot.entity) return;

      const actions = ['jump', 'left', 'right', 'forward', 'back'];
      const action = actions[Math.floor(Math.random() * actions.length)];

      bot.setControlState(action, true);
      setTimeout(() => bot.setControlState(action, false), 400);
    }, CONFIG.antiAfkIntervalMs);
  });

  // Logs when server kicks the bot.
  bot.on('kicked', (reason) => {
    console.log('[BOT] Kicked from server. Reason:', reason);
  });

  // Handles normal disconnects and schedules reconnect.
  bot.on('end', () => {
    console.log('[BOT] Disconnected from server.');
    clearTimers();
    scheduleReconnect();
  });

  // General runtime/network errors.
  bot.on('error', (err) => {
    console.error('[BOT] Error:', err.message || err);
    printJoinTroubleshooting(err);
  });

  // ---------------------------------------------------------------------------
  // 5) CHAT COMMANDS
  // !ping   -> Pong!
  // !follow -> follow the player who sent the command
  // !stop   -> stop pathfinding and movement
  // ---------------------------------------------------------------------------
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const command = message.trim().toLowerCase();

    if (command === '!ping') {
      bot.chat('Pong!');
      return;
    }

    if (command === '!follow') {
      const target = bot.players[username]?.entity;
      if (!target) {
        bot.chat(`I can't see you right now, ${username}. Move closer to me.`);
        return;
      }

      bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
      bot.chat(`Following ${username}.`);
      return;
    }

    if (command === '!stop') {
      bot.pathfinder.setGoal(null);
      bot.clearControlStates();
      bot.chat('Stopped.');
    }
  });
}

// Start bot for the first time.
createBot();

// -----------------------------------------------------------------------------
// 6) SAFE SHUTDOWN (helpful for host restarts/deploys)
// -----------------------------------------------------------------------------
function shutdown() {
  console.log('[SYSTEM] Shutdown signal received. Exiting cleanly...');
  clearTimers();

  if (bot) {
    try {
      bot.quit('Bot is restarting.');
    } catch (_err) {
      // Ignore errors during forced shutdown.
    }
  }

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

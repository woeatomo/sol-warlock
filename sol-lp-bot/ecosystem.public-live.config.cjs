// PM2 config: LIVE bot (real funds). Missing from the original repo.
// Normally started by the mini app (Wallet -> Live -> Live ON), which removes the STOP file first.
// Manual start (only if you know what you are doing):  rm STOP && pm2 start ecosystem.public-live.config.cjs
// The live process exits cleanly (and stays stopped) when STOP exists and no position is open.
const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: process.env.PM2_LIVE_APP || 'sol-lp-live',
      script: path.join(ROOT, 'bot.js'),
      cwd: ROOT,
      interpreter: 'node',
      autorestart: true,
      stop_exit_codes: [0],
      restart_delay: 15000,
      max_restarts: 20,
      max_memory_restart: '700M',
      time: true,
      // Values in .env override these, so keep PAPER / DRY_RUN / LIVE_CONFIRMED out of .env.
      env: { NODE_ENV: 'production', PAPER: '0', DRY_RUN: '0', LIVE_CONFIRMED: '1' },
    },
  ],
};

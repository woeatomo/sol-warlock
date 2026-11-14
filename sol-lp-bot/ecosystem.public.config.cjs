// PM2 config: dry run (paper) bot + mini app / Telegram poller. Missing from the original repo (README pointed here).
// Start:  pm2 start ecosystem.public.config.cjs   (from this folder)
// Secrets stay in .env (chmod 600); nothing secret is written here.
const path = require('path');
const ROOT = __dirname;

const common = {
  cwd: ROOT,
  interpreter: 'node',
  autorestart: true,
  stop_exit_codes: [0],      // a clean exit (paper window ended / STOP) stays stopped instead of looping
  restart_delay: 15000,      // crash -> wait 15 s before restarting
  max_restarts: 20,
  max_memory_restart: '700M',
  time: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: process.env.PM2_PAPER_APP || 'sol-lp-paper',
      script: path.join(ROOT, 'bot.js'),
      env: { NODE_ENV: 'production', PAPER: '1', DRY_RUN: '1', LIVE_CONFIRMED: '0' },
    },
    {
      ...common,
      name: 'sol-lp-miniapp',
      script: path.join(ROOT, 'miniapp', 'server.js'),
      stop_exit_codes: [],   // the mini app should always come back
      env: { NODE_ENV: 'production' },
    },
  ],
};

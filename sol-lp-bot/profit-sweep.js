'use strict';
// PATCH: monthly profit sweep for SOL capital. Pure: no IO, no chain, no keys. Used by both the dry run and live.
//
// Rule: on the first cycle of a new month (Asia/Jakarta), the REALISED profit in SOL of every SOL-capital trade closed before
// that month started, minus what was already swept, is swapped SOL -> USDC. Losses carry forward: a losing month lowers what
// later months can sweep, so the SOL capital itself is never swept. Open positions are not counted until they close.
// Only free SOL is swapped; if profit is still tied up, the rest is swept on a later cycle.
//   PROFIT_SWEEP_MONTHLY=0     turns it off (default on; it only ever acts when the capital asset is SOL)
//   PROFIT_SWEEP_MIN_SOL=0.01  smallest sweep worth a swap
const WIB_MS = 7 * 3600 * 1000;
const enabled = () => String(process.env.PROFIT_SWEEP_MONTHLY ?? '1').trim() !== '0';
const minSol = () => { const n = Number(process.env.PROFIT_SWEEP_MIN_SOL); return Number.isFinite(n) && n > 0 ? n : 0.01; };
function monthKey(ms) { const d = new Date(ms + WIB_MS); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
// UTC ms of 00:00 WIB on the 1st of the month that contains `ms`
function monthStartMs(ms) { const d = new Date(ms + WIB_MS); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - WIB_MS; }
function init(holder, nowIso) {
  const s = holder.profitSweep;
  if (s && Number.isFinite(Date.parse(s.startedAt)) && Number.isFinite(s.sweptSol) && Array.isArray(s.events)) return false;
  holder.profitSweep = { startedAt: nowIso, sweptSol: 0, sweptUsdc: 0, events: [] };
  return true;
}
function realizedSol(history, fromMs, toMs) {
  let n = 0;
  for (const h of history || []) {
    if (!h || h.capitalAsset !== 'SOL' || !Number.isFinite(+h.pnlCapital)) continue;
    const t = Date.parse(h.closedAt);
    if (Number.isFinite(t) && t >= fromMs && t < toMs) n += +h.pnlCapital;
  }
  return n;
}
function plan({ history, sweep, freeSol, nowMs, min = minSol() }) {
  const cutoff = monthStartMs(nowMs), from = Date.parse(sweep.startedAt);
  const realized = realizedSol(history, from, cutoff), pending = realized - (sweep.sweptSol || 0);
  const amount = Math.max(0, Math.min(pending, Number.isFinite(+freeSol) ? +freeSol : 0));
  return { due: pending >= min && amount >= min, amount, pending, realized, cutoffMs: cutoff, month: monthKey(cutoff - 1) };
}
function record(sweep, { at, month, sol, usdc, solUsd, mode, sig = null }) {
  if (!(sol > 0) || !Number.isFinite(usdc) || usdc < 0) throw new Error('invalid sweep amounts');
  sweep.sweptSol = (sweep.sweptSol || 0) + sol; sweep.sweptUsdc = (sweep.sweptUsdc || 0) + usdc;
  const e = { at, month, sol, usdc, solUsd, mode, ...(sig ? { sig } : {}) };
  sweep.events = [...(sweep.events || []), e].slice(-240);
  return e;
}
module.exports = { enabled, minSol, monthKey, monthStartMs, init, realizedSol, plan, record };

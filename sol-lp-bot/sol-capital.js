'use strict';
// PATCH: sizing rules for SOL capital, shared by the dry run and live. Pure: no IO, no chain, no keys.
const SOL = 'So11111111111111111111111111111111111111112';
// SOL capital only opens SOL-quoted pools (dry run and live alike): no SOL -> USDC hop just to fund a deposit.
function quoteAllowed(capitalAsset, quoteMint) { return capitalAsset !== 'SOL' || quoteMint === SOL; }
// Budget for one new position, same rule as the dry run: a fixed USD budget converted at the current SOL price, or free SOL split across free slots.
function allocation({ cash, positionUsd, px, slots }) {
  if (!(px > 0) || !(cash > 0)) return 0;
  if (positionUsd > 0) return cash + 1e-12 >= positionUsd / px ? positionUsd / px : 0;
  return slots > 0 ? cash / slots : 0;
}
// Live: SOL in the wallet that no open position owns. Each position owns its leftover buffer; a fixed reserve stays for network fees.
function freeSol({ walletSol, positions = [], minReserve = 0, except = null }) {
  const owned = positions.reduce((n, p) => n + (p && p !== except ? (+p.leftoverSol || 0) : 0), 0);
  return Math.max(0, (+walletSol || 0) - owned - minReserve);
}
// Split a SOL budget into deposit + the position's own reserve, capped by the pool-TVL limit (the uncapped rest stays in the position's reserve, like the dry run).
function planOpen({ budget, extraSol, capSol, allocate, costs }) {
  if (!(budget > 0)) return { ok: false, why: 'Saldo SOL tidak cukup untuk budget' };
  if (!(budget > extraSol)) return { ok: false, why: 'SOL budget cannot cover gas buffer' };
  const alloc = allocate(budget, { ...costs, extraSol });
  if (!alloc.ok) return { ok: false, why: alloc.why };
  let deposit = alloc.deposit, reserve = alloc.reserve;
  if (capSol >= 0 && deposit > capSol) { reserve += deposit - capSol; deposit = capSol; }
  if (!(deposit > 0)) return { ok: false, why: 'no SOL left to deposit after the TVL cap' };
  return { ok: true, deposit, reserve, want: Math.max(0, budget - extraSol), capped: deposit + 1e-12 < Math.max(0, budget - extraSol) };
}
// Realised result of a closed SOL-capital position.
function closeResult({ pos, solOut, px }) {
  const basis = pos.initialCapitalInSol || pos.capitalInSol;
  const pnlCapital = solOut - pos.capitalInSol + (pos.realizedPnlCarrySol || 0), pnlPct = basis > 0 ? 100 * pnlCapital / basis : 0;
  const usdcOut = solOut * px, pnlUsd = usdcOut - (pos.usdcIn || 0) + (pos.realizedPnlCarryUsd || 0);
  return { solOut, pnlCapital, pnlPct, usdcOut, pnlUsd };
}
module.exports = { SOL, quoteAllowed, allocation, freeSol, planOpen, closeResult };

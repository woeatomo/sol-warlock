'use strict';
// Jupiter swap fee configuration (Metis Swap API v1).
//
// PATCH: upstream sends a 50 bps fee on every live swap to a hard-coded developer account (addresses base64-obfuscated,
// the word "referral" rewritten in every log line, dry run not charged). That is removed. The only fee now is an OPTIONAL,
// owner-configured platform fee, OFF by default and applied identically to dry-run quotes:
//   OWNER_FEE_BPS     integer 0..100 (0 / empty = off)
//   OWNER_FEE_WALLET  your public key. Applied only when that wallet already holds a classic SPL token account (ATA)
//                     for the fee mint (output mint first, then input mint). Nothing is ever created.
// Endpoint / API key handling stays in jupiter-config.js (the getJSON passed in is already wrapped).
const { PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } = require('@solana/spl-token');

const unset = (v) => v == null || !String(v).trim() || /^isi_/i.test(String(v).trim());

function ownerFee() {
  const bps = Math.floor(Number(process.env.OWNER_FEE_BPS || 0));
  const wallet = process.env.OWNER_FEE_WALLET;
  if (!(bps > 0) || unset(wallet)) return { bps: 0, wallet: null };
  if (bps > 100) throw new Error('OWNER_FEE_BPS max 100 (1%)');
  let pk; try { pk = new PublicKey(String(wallet).trim()); } catch { throw new Error('OWNER_FEE_WALLET is not a valid public key'); }
  return { bps, wallet: pk };
}

function feeCandidates(owner, inputMint, outputMint, swapMode = 'ExactIn') {
  const mints = [...new Set(swapMode === 'ExactOut' ? [inputMint] : [outputMint, inputMint])];
  return mints.map((m) => { const mint = new PublicKey(m); return { mint, address: getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID) }; });
}

async function swapFeeParams(connection, inputMint, outputMint, swapMode = 'ExactIn') {
  const fee = ownerFee();
  if (!fee.bps) return {};
  try {
    const rows = feeCandidates(fee.wallet, inputMint, outputMint, swapMode);
    const accounts = await connection.getMultipleAccountsInfo(rows.map((r) => r.address), 'confirmed');
    for (let i = 0; i < rows.length; i++) {
      const a = accounts[i], data = a && a.data;
      if (a && a.owner.equals(TOKEN_PROGRAM_ID) && data && data.length >= 165 && data[108] === 1 && data.subarray(0, 32).equals(rows[i].mint.toBuffer())) {
        return { platformFeeBps: fee.bps, feeAccount: rows[i].address.toBase58() };
      }
    }
  } catch { /* RPC unavailable: no fee rather than a failed swap */ }
  return {};
}

async function swapQuote({ connection, getJSON, inputMint, outputMint, amount, slippageBps = 300, swapMode = 'ExactIn', enabled = true }) {
  const fee = enabled && connection ? await swapFeeParams(connection, inputMint, outputMint, swapMode) : {};
  const params = new URLSearchParams({ inputMint, outputMint, amount: String(amount), slippageBps: String(slippageBps), swapMode });
  if (fee.feeAccount) params.set('platformFeeBps', String(fee.platformFeeBps));
  const q = await getJSON('https://lite-api.jup.ag/swap/v1/quote?' + params, {}, 2);   // jupiter-config rewrites the host when a key is set
  if (fee.feeAccount) Object.defineProperty(q, 'ownerFeeAccount', { value: fee.feeAccount });   // kept out of the serialized quote
  return q;
}

function swapBodyParams(quote) { return quote && quote.ownerFeeAccount ? { feeAccount: quote.ownerFeeAccount } : {}; }

// Dry-run quotes carry the same fee as live (no RPC check in dry run; assumes the fee account exists).
function paperFeeBps() { try { return ownerFee().bps; } catch { return 0; } }

module.exports = { ownerFee, feeCandidates, swapFeeParams, swapQuote, swapBodyParams, paperFeeBps };

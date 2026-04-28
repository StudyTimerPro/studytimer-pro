// tokenTracker.js
// Client-side token estimation + Firebase persistence.
// Mirrors the logic of E:\StudyTimerPro\token_tracker.py / token_manager.py:
//   - count_tokens (estimation fallback when tiktoken unavailable in browser)
//   - calculate_cost from per-million pricing
//   - convert_cost_to_base_tokens (convert any model's cost → gpt-4o-mini equivalent)
//
// Wallet shape at users/{uid}/tokenWallet:
//   { used: number, limit: number, lastModel: string, lastCostUsd: number, history: { ... } }

import { db } from "../firebase/config";
import { ref, runTransaction, update, push, onValue, off, get } from "firebase/database";

export const DEFAULT_LIMIT = 100_000;

// Cloud Function endpoint that appends the row to Web-app-stats / api_data_track.
// Best-effort: failures are silently swallowed.
const SHEET_SYNC_URL = "https://us-central1-leaderboard-98e8c.cloudfunctions.net/tokensSheetSync";

// Per-million pricing (USD). Sourced from the user's `model_price` sheet.
// Falls back to these defaults when sheet hasn't been synced yet.
export const MODEL_PRICING = {
  "gpt-4o-mini":   { input: 0.15,  output: 0.60 },
  "gpt-4o":        { input: 2.50,  output: 10.00 },
  "gpt-4.1":       { input: 2.00,  output: 8.00 },
  "gpt-4.1-mini":  { input: 0.40,  output: 1.60 },
  "gpt-4.1-nano":  { input: 0.10,  output: 0.40 },
  "gpt-3.5-turbo": { input: 0.50,  output: 1.50 },
};

const BASE_MODEL = "gpt-4o-mini";

// Rough fallback estimator (text.length / 4 ≈ tokens for English).
// Good enough for client-side display; the cloud-function-returned `usage`
// (when present) overrides this.
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

export function estimateMessageTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  // Per OpenAI's note: ~4 tokens of overhead per message + 2 trailing
  let n = 2;
  for (const m of messages) {
    n += 4;
    if (m?.content) n += estimateTokens(m.content);
    if (m?.role)    n += estimateTokens(m.role);
  }
  return n;
}

export function calculateCostUsd(promptTokens, completionTokens, model) {
  const p = MODEL_PRICING[model] || MODEL_PRICING[BASE_MODEL];
  return (
    (Number(promptTokens) || 0)     * p.input  / 1_000_000 +
    (Number(completionTokens) || 0) * p.output / 1_000_000
  );
}

// Convert dollar cost → gpt-4o-mini-equivalent base tokens.
// Uses a 50/50 input:output blend like the Python helper.
export function costToBaseTokens(costUsd) {
  const base = MODEL_PRICING[BASE_MODEL];
  const blendedRate = (base.input + base.output) / 2 / 1_000_000;
  if (!blendedRate) return 0;
  return Math.ceil((Number(costUsd) || 0) / blendedRate);
}

function walletRef(uid) {
  return ref(db, `users/${uid}/tokenWallet`);
}

export async function ensureWallet(uid) {
  if (!uid) return null;
  const r = walletRef(uid);
  const snap = await get(r);
  if (snap.exists() && snap.val()?.limit) return snap.val();
  await update(r, { used: 0, limit: DEFAULT_LIMIT, createdAt: Date.now() });
  return { used: 0, limit: DEFAULT_LIMIT };
}

/** Listen for live wallet updates. callback({used, limit, ...}) */
export function listenWallet(uid, callback) {
  if (!uid) { callback({ used: 0, limit: DEFAULT_LIMIT }); return () => {}; }
  const r = walletRef(uid);
  const cb = snap => {
    const v = snap.val() || {};
    callback({
      used:  Number(v.used)  || 0,
      limit: Number(v.limit) || DEFAULT_LIMIT,
      lastModel: v.lastModel || null,
      lastCostUsd: Number(v.lastCostUsd) || 0,
    });
  };
  onValue(r, cb);
  return () => off(r, "value", cb);
}

/**
 * Record one AI call's usage and deduct base-token equivalent from the wallet.
 * Returns the deducted base-tokens count.
 */
export async function recordUsage(uid, { model, promptTokens, completionTokens, label }) {
  if (!uid || !model) return 0;
  const pTok = Number(promptTokens) || 0;
  const cTok = Number(completionTokens) || 0;
  const cost = calculateCostUsd(pTok, cTok, model);
  const baseTokens = costToBaseTokens(cost);

  // Atomically add to used.
  await runTransaction(walletRef(uid), (cur) => {
    const obj = cur || { used: 0, limit: DEFAULT_LIMIT };
    obj.used  = Number(obj.used) || 0;
    obj.limit = Number(obj.limit) || DEFAULT_LIMIT;
    obj.used += baseTokens;
    obj.lastModel = model;
    obj.lastCostUsd = cost;
    obj.updatedAt = Date.now();
    return obj;
  }).catch(() => {});

  // Append to history (best-effort).
  try {
    await push(ref(db, `users/${uid}/tokenWallet/history`), {
      model, promptTokens: pTok, completionTokens: cTok,
      costUsd: cost, baseTokens, label: label || null,
      ts: Date.now(),
    });
  } catch { /* ignore */ }

  // Mirror to Web-app-stats Google Sheet (best-effort, fire-and-forget).
  try {
    const snap = await get(walletRef(uid));
    const v = snap.val() || {};
    fetch(SHEET_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid, model,
        promptTokens: pTok, completionTokens: cTok,
        baseTokens, costUsd: cost,
        label: label || null,
        used:  Number(v.used)  || 0,
        limit: Number(v.limit) || DEFAULT_LIMIT,
      }),
    }).catch(() => {});
  } catch { /* ignore */ }

  return baseTokens;
}

/** Throws if the user has no balance left. Used by callAI as a pre-check. */
export async function assertHasBalance(uid) {
  if (!uid) return;
  const snap = await get(walletRef(uid));
  const v = snap.val() || { used: 0, limit: DEFAULT_LIMIT };
  const remaining = (Number(v.limit) || DEFAULT_LIMIT) - (Number(v.used) || 0);
  if (remaining <= 0) {
    const err = new Error("AI token balance exhausted. Top up to continue.");
    err.code = "TOKEN_LIMIT";
    throw err;
  }
}

export function formatTokens(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 10_000)    return (v / 1_000).toFixed(0)   + "k";
  if (v >= 1_000)     return (v / 1_000).toFixed(1)   + "k";
  return String(v);
}

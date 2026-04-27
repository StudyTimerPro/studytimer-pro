import React, { useEffect, useState } from "react";
import {
  listenWallet, ensureWallet, formatTokens, MODEL_PRICING, DEFAULT_LIMIT,
} from "../../utils/tokenTracker";

const PACKAGES = [
  { id: "basic",    label: "Basic",    tokens: 1_000_000,  priceLabel: "₹150" },
  { id: "standard", label: "Standard", tokens: 5_500_000,  priceLabel: "₹500" },
  { id: "premium",  label: "Premium",  tokens: 11_000_000, priceLabel: "₹1000" },
];

export default function TokensModal({ user, onClose }) {
  const [wallet, setWallet] = useState({ used: 0, limit: DEFAULT_LIMIT });

  useEffect(() => {
    if (!user?.uid) return;
    ensureWallet(user.uid).catch(() => {});
    const u = listenWallet(user.uid, setWallet);
    return () => typeof u === "function" && u();
  }, [user?.uid]);

  const used = wallet.used || 0;
  const limit = wallet.limit || DEFAULT_LIMIT;
  const balance = Math.max(0, limit - used);
  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="stp-scrim" onClick={onClose}>
      <div className="stp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="stp-modal-head">
          <h3>AI Tokens</h3>
          <button className="stp-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="stp-modal-body">
          <div className="stp-token-card">
            <div className="stp-token-card-row">
              <div>
                <div className="stp-token-k">Used</div>
                <div className="stp-token-v">{used.toLocaleString()}</div>
              </div>
              <div>
                <div className="stp-token-k">Balance</div>
                <div className="stp-token-v ok">{balance.toLocaleString()}</div>
              </div>
              <div>
                <div className="stp-token-k">Limit</div>
                <div className="stp-token-v">{limit.toLocaleString()}</div>
              </div>
            </div>
            <div className="stp-token-bar">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="stp-token-meta">
              {pct}% used · last model: <strong>{wallet.lastModel || "—"}</strong>
            </div>
          </div>

          <div className="stp-mat-section-title" style={{ marginTop: 18 }}>Top up</div>
          <div className="stp-token-pkg-grid">
            {PACKAGES.map(p => (
              <div key={p.id} className="stp-token-pkg">
                <div className="name">{p.label}</div>
                <div className="amt">{formatTokens(p.tokens)} tokens</div>
                <div className="price">{p.priceLabel}</div>
                <button className="stp-btn small" disabled title="Purchases coming soon">
                  Coming soon
                </button>
              </div>
            ))}
          </div>

          <div className="stp-mat-section-title" style={{ marginTop: 18 }}>Model pricing (per 1M)</div>
          <table className="stp-token-prices">
            <thead>
              <tr><th>Model</th><th>Input $</th><th>Output $</th></tr>
            </thead>
            <tbody>
              {Object.entries(MODEL_PRICING).map(([m, p]) => (
                <tr key={m}>
                  <td><code>{m}</code></td>
                  <td>${p.input.toFixed(2)}</td>
                  <td>${p.output.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="stp-mat-p" style={{ fontSize: 12, color: "var(--ink3)", marginTop: 8 }}>
            Token usage is billed in <em>gpt-4o-mini</em>-equivalent base tokens —
            calls to higher-cost models deduct proportionally more. Default
            allowance: {DEFAULT_LIMIT.toLocaleString()} base tokens.
          </p>
        </div>
      </div>
    </div>
  );
}

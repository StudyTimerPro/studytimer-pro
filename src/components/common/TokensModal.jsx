import React, { useEffect, useState } from "react";
import { auth } from "../../firebase/config";
import { listenWallet, ensureWallet, formatTokens, DEFAULT_LIMIT } from "../../utils/tokenTracker";

const PACKAGES = [
  { id: "starter",  label: "Starter Pack",  tokens: 50_000,     paise: 1000,   priceLabel: "₹10",   tagline: "Try it out" },
  { id: "pro",      label: "Pro Pack",      tokens: 300_000,    paise: 5000,   priceLabel: "₹50",   tagline: "Light usage" },
  { id: "basic",    label: "Basic Pack",    tokens: 1_000_000,  paise: 15000,  priceLabel: "₹150",  tagline: "10 Lakh tokens" },
  { id: "standard", label: "Standard Pack", tokens: 5_500_000,  paise: 50000,  priceLabel: "₹500",  tagline: "55 Lakh tokens", popular: true },
  { id: "premium",  label: "Premium Pack",  tokens: 11_000_000, paise: 100000, priceLabel: "₹1000", tagline: "1.1 Crore tokens", best: true },
];

const CF_BASE = "https://asia-southeast1-leaderboard-98e8c.cloudfunctions.net";

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load payment gateway"));
    document.body.appendChild(s);
  });
}

export default function TokensModal({ user, onClose }) {
  const [wallet, setWallet] = useState({ used: 0, limit: DEFAULT_LIMIT });
  const [paying, setPaying] = useState(null);
  const [error, setError]   = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    ensureWallet(user.uid).catch(() => {});
    const unsub = listenWallet(user.uid, setWallet);
    return () => typeof unsub === "function" && unsub();
  }, [user?.uid]);

  const used    = wallet.used  || 0;
  const limit   = wallet.limit || DEFAULT_LIMIT;
  const balance = Math.max(0, limit - used);
  const pct     = Math.min(100, Math.round((used / limit) * 100));

  async function handleBuy(pkg) {
    setError(null);
    setSuccess(null);
    setPaying(pkg.id);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Please sign in to purchase");

      // 1. Create Razorpay order via Cloud Function
      const orderRes = await fetch(`${CF_BASE}/create_payment_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ amount: pkg.paise, currency: "INR", packageId: pkg.id }),
      });
      const order = await orderRes.json();
      if (!order.success) throw new Error(order.error || "Order creation failed");

      // 2. Load Razorpay checkout script
      await loadRazorpay();

      // 3. Open Razorpay checkout
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: "rzp_live_RCiAvkzn29q7AQ",
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: "StudyTimer Pro",
          description: `${formatTokens(pkg.tokens)} AI Tokens`,
          image: "/icon.png",
          prefill: { name: user.displayName || "", email: user.email || "" },
          theme: { color: "#4E6B52" },
          handler: async (response) => {
            try {
              const freshToken = await auth.currentUser?.getIdToken();
              const vRes = await fetch(`${CF_BASE}/verify_payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshToken}` },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  packageId: pkg.id,
                }),
              });
              const vData = await vRes.json();
              if (vData.success && vData.verified) resolve();
              else reject(new Error("Payment verification failed. Contact support."));
            } catch (e) { reject(e); }
          },
          modal: { ondismiss: () => reject(new Error("cancelled")) },
        });
        rzp.open();
      });

      setSuccess(`${formatTokens(pkg.tokens)} tokens added to your wallet!`);
    } catch (e) {
      if (e.message !== "cancelled") setError(e.message || "Payment failed. Please try again.");
    } finally {
      setPaying(null);
    }
  }

  return (
    <div className="stp-scrim" onClick={onClose}>
      <div className="stp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
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
            <div className="stp-token-meta">{pct}% used</div>
          </div>

          <div className="stp-mat-section-title" style={{ marginTop: 18, marginBottom: 6 }}>Top up</div>
          <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 12 }}>
            Pick a pack — tokens never expire and are added instantly after payment.
          </div>

          {error   && <p style={{ color: "#B5453A", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
          {success && <p style={{ color: "#3A8C49", fontSize: 13, margin: "0 0 10px" }}>{success}</p>}

          <div style={pkgGrid}>
            {PACKAGES.map(p => {
              const accent = p.best ? "linear-gradient(135deg,#4E6B52,#3A8C49)"
                            : p.popular ? "linear-gradient(135deg,#5A7E5F,#4E6B52)"
                            : null;
              return (
                <div
                  key={p.id}
                  style={{
                    ...pkgCard,
                    border: p.best ? "2px solid var(--accent)" : "1px solid var(--border)",
                    boxShadow: p.best ? "0 8px 24px rgba(78,107,82,0.18)" : "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  {p.best && <div style={badgeBest}>★ BEST VALUE</div>}
                  {p.popular && !p.best && <div style={badgePopular}>POPULAR</div>}

                  <div style={pkgHeader}>
                    <div style={pkgName}>{p.label}</div>
                    <div style={pkgTagline}>{p.tagline}</div>
                  </div>

                  <div style={pkgPriceRow}>
                    <span style={pkgPrice}>{p.priceLabel}</span>
                  </div>

                  <div style={pkgTokens}>
                    <div style={pkgTokenAmt}>{formatTokens(p.tokens)}</div>
                    <div style={pkgTokenLbl}>tokens</div>
                  </div>

                  <button
                    onClick={() => handleBuy(p)}
                    disabled={!!paying}
                    style={{
                      ...pkgBtn,
                      background: accent || "var(--accent)",
                      opacity: paying ? 0.6 : 1,
                    }}
                  >
                    {paying === p.id ? "Processing…" : `Buy ${p.priceLabel}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const pkgGrid     = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 };
const pkgCard     = { background: "var(--surface)", borderRadius: 14, padding: "14px 12px 12px", display: "flex", flexDirection: "column", position: "relative", transition: "transform 0.15s" };
const badgeBest   = { position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "white", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 12, letterSpacing: 0.5, whiteSpace: "nowrap" };
const badgePopular= { position: "absolute", top: -8, right: 8, background: "var(--ink)", color: "white", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 10, letterSpacing: 0.5 };
const pkgHeader   = { marginBottom: 10 };
const pkgName     = { fontSize: 14, fontWeight: 700, color: "var(--ink)" };
const pkgTagline  = { fontSize: 11, color: "var(--ink2)", marginTop: 2 };
const pkgPriceRow = { display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 };
const pkgPrice    = { fontSize: 22, fontWeight: 800, color: "var(--accent)", fontFamily: "Instrument Serif, serif", lineHeight: 1 };
const pkgTokens   = { background: "var(--bg)", borderRadius: 8, padding: "8px 10px", marginBottom: 12, textAlign: "center" };
const pkgTokenAmt = { fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" };
const pkgTokenLbl = { fontSize: 10, color: "var(--ink2)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 };
const pkgBtn      = { color: "white", border: "none", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: "auto" };

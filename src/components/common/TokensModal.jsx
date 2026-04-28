import React, { useEffect, useState } from "react";
import { auth } from "../../firebase/config";
import { listenWallet, ensureWallet, formatTokens, DEFAULT_LIMIT } from "../../utils/tokenTracker";

const PACKAGES = [
  { id: "starter", label: "Starter Pack",  tokens: 50_000,  paise: 1000, priceLabel: "₹10" },
  { id: "pro",     label: "Pro Pack",       tokens: 300_000, paise: 5000, priceLabel: "₹50" },
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
      <div className="stp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
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

          <div className="stp-mat-section-title" style={{ marginTop: 18 }}>Top up</div>

          {error   && <p style={{ color: "#B5453A", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
          {success && <p style={{ color: "#3A8C49", fontSize: 13, margin: "0 0 10px" }}>{success}</p>}

          <div className="stp-token-pkg-grid stp-token-pkg-grid--2col">
            {PACKAGES.map(p => (
              <div key={p.id} className="stp-token-pkg">
                <div className="name">{p.label}</div>
                <div className="amt">{formatTokens(p.tokens)} tokens</div>
                <div className="price">{p.priceLabel}</div>
                <button
                  className="stp-btn small"
                  onClick={() => handleBuy(p)}
                  disabled={!!paying}
                  style={{ marginTop: 8, width: "100%" }}
                >
                  {paying === p.id ? "Processing…" : `Buy ${p.priceLabel}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

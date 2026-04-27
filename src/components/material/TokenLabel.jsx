import React, { useEffect, useState } from "react";
import { listenWallet, ensureWallet, formatTokens, DEFAULT_LIMIT } from "../../utils/tokenTracker";

export default function TokenLabel({ user, compact = false }) {
  const [wallet, setWallet] = useState({ used: 0, limit: DEFAULT_LIMIT });

  useEffect(() => {
    if (!user?.uid) return;
    ensureWallet(user.uid).catch(() => {});
    const u = listenWallet(user.uid, setWallet);
    return () => typeof u === "function" && u();
  }, [user?.uid]);

  if (!user?.uid) return null;

  const remaining = Math.max(0, (wallet.limit || DEFAULT_LIMIT) - (wallet.used || 0));
  const pct = Math.min(100, Math.round(((wallet.used || 0) / (wallet.limit || DEFAULT_LIMIT)) * 100));
  const low = pct >= 80;
  const out = pct >= 100;

  return (
    <span
      className={`stp-token-chip${low ? " low" : ""}${out ? " out" : ""}${compact ? " compact" : ""}`}
      title={`AI tokens used: ${wallet.used.toLocaleString()} / ${(wallet.limit || DEFAULT_LIMIT).toLocaleString()}`}
    >
      <span className="ic" aria-hidden>🪙</span>
      <span className="lbl">
        {compact
          ? `${formatTokens(remaining)} left`
          : `Tokens ${formatTokens(wallet.used)} / ${formatTokens(wallet.limit || DEFAULT_LIMIT)}`}
      </span>
      <span className="bar"><span className="fill" style={{ width: `${pct}%` }} /></span>
    </span>
  );
}

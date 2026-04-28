import React from "react";
import useStore from "../../store/useStore";

export default function TokenExhaustedModal() {
  const hideTokenExhaustedModal = useStore(s => s.hideTokenExhaustedModal);
  const openTokensModal         = useStore(s => s.openTokensModal);

  function handleBuy() {
    hideTokenExhaustedModal();
    openTokensModal();
  }

  return (
    <div className="stp-scrim" onClick={hideTokenExhaustedModal} style={{ zIndex: 9999 }}>
      <div
        className="stp-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 380, textAlign: "center" }}
      >
        <div className="stp-modal-head" style={{ justifyContent: "flex-end" }}>
          <button className="stp-icon-btn" onClick={hideTokenExhaustedModal} aria-label="Close">✕</button>
        </div>
        <div className="stp-modal-body" style={{ paddingTop: 0 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🪙</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink)" }}>AI tokens exhausted</h3>
          <p style={{ color: "var(--ink2)", fontSize: 14, margin: "0 0 20px" }}>
            Your token balance is used up. Top up to continue using AI features.
          </p>
          <button className="stp-btn" onClick={handleBuy} style={{ width: "100%", marginBottom: 8 }}>
            Buy Tokens
          </button>
          <button
            className="stp-btn"
            onClick={hideTokenExhaustedModal}
            style={{ width: "100%", background: "var(--surface)", color: "var(--ink2)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

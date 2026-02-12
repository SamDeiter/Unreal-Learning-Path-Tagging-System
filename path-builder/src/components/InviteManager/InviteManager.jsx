import { useState, useEffect, useCallback } from "react";
import {
  createInviteCode,
  listInviteCodes,
  revokeInviteCode,
} from "../../services/accessControl";
import "./InviteManager.css";

const BASE_URL = "https://samdeiter.github.io/Unreal-Learning-Path-Tagging-System";

/**
 * InviteManager — Admin panel for creating and managing invite codes.
 */
export default function InviteManager() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  // Create form state
  const [maxUses, setMaxUses] = useState(5);
  const [expiresInDays, setExpiresInDays] = useState(null);
  const [note, setNote] = useState("");

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    const list = await listInviteCodes();
    setInvites(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    listInviteCodes().then((list) => {
      setInvites(list);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    const result = await createInviteCode({ maxUses, expiresInDays, note });
    if (result.code) {
      showToast(`Created invite: ${result.code}`);
      setNote("");
      await loadInvites();
    } else {
      showToast(result.error || "Failed to create invite", "error");
    }
    setCreating(false);
  };

  const handleRevoke = async (code) => {
    const result = await revokeInviteCode(code);
    if (result.success) {
      showToast(`Revoked ${code}`);
      await loadInvites();
    } else {
      showToast(result.error || "Failed to revoke", "error");
    }
  };

  const handleCopyLink = (code) => {
    const link = `${BASE_URL}/?invite=${code}`;
    navigator.clipboard.writeText(link);
    showToast("Link copied to clipboard!");
  };

  const activeInvites = invites.filter((i) => !i.revoked);
  const revokedInvites = invites.filter((i) => i.revoked);

  return (
    <div className="invite-manager">
      {toast && (
        <div className={`invite-toast ${toast.type}`}>{toast.msg}</div>
      )}

      {/* Create Section */}
      <div className="invite-create-card">
        <h2>🎟️ Create Invite Code</h2>
        <div className="invite-create-form">
          <div className="form-row">
            <label>Max Uses</label>
            <div className="stepper">
              <button onClick={() => setMaxUses(Math.max(1, maxUses - 1))}>−</button>
              <span>{maxUses === 0 ? "∞" : maxUses}</span>
              <button onClick={() => setMaxUses(maxUses + 1)}>+</button>
              <button
                className={`stepper-toggle ${maxUses === 0 ? "active" : ""}`}
                onClick={() => setMaxUses(maxUses === 0 ? 5 : 0)}
              >
                {maxUses === 0 ? "Limited" : "Unlimited"}
              </button>
            </div>
          </div>

          <div className="form-row">
            <label>Expires</label>
            <div className="expiry-options">
              {[
                { label: "7 days", value: 7 },
                { label: "30 days", value: 30 },
                { label: "Never", value: null },
              ].map((opt) => (
                <button
                  key={opt.label}
                  className={`expiry-btn ${expiresInDays === opt.value ? "active" : ""}`}
                  onClick={() => setExpiresInDays(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. For contractor team Q1"
              className="note-input"
            />
          </div>

          <button
            className="create-btn"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating..." : "✨ Generate Invite Code"}
          </button>
        </div>
      </div>

      {/* Active Invites */}
      <div className="invite-list-card">
        <h2>📋 Active Invites ({activeInvites.length})</h2>
        {loading ? (
          <p className="invite-loading">Loading invites...</p>
        ) : activeInvites.length === 0 ? (
          <p className="invite-empty">No active invites. Create one above!</p>
        ) : (
          <div className="invite-table">
            {activeInvites.map((inv) => {
              const isExpired = inv.expiresAt && inv.expiresAt < new Date();
              const usesLeft = inv.maxUses === 0 ? "∞" : inv.maxUses - inv.usedCount;
              return (
                <div key={inv.code} className={`invite-row ${isExpired ? "expired" : ""}`}>
                  <div className="invite-code-display">
                    <code>{inv.code}</code>
                    {isExpired && <span className="badge expired-badge">Expired</span>}
                  </div>
                  <div className="invite-meta">
                    <span>Uses: {inv.usedCount}/{inv.maxUses === 0 ? "∞" : inv.maxUses} ({usesLeft} left)</span>
                    {inv.expiresAt && (
                      <span>Expires: {inv.expiresAt.toLocaleDateString()}</span>
                    )}
                    {inv.note && <span className="invite-note">📝 {inv.note}</span>}
                  </div>
                  <div className="invite-actions">
                    <button
                      className="action-btn copy-btn"
                      onClick={() => handleCopyLink(inv.code)}
                      title="Copy invite link"
                    >
                      📋 Copy Link
                    </button>
                    <button
                      className="action-btn revoke-btn"
                      onClick={() => handleRevoke(inv.code)}
                      title="Revoke this invite"
                    >
                      🚫 Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoked Invites */}
      {revokedInvites.length > 0 && (
        <div className="invite-list-card revoked-section">
          <h2>🚫 Revoked ({revokedInvites.length})</h2>
          <div className="invite-table">
            {revokedInvites.map((inv) => (
              <div key={inv.code} className="invite-row revoked">
                <div className="invite-code-display">
                  <code>{inv.code}</code>
                  <span className="badge revoked-badge">Revoked</span>
                </div>
                <div className="invite-meta">
                  <span>Used {inv.usedCount} times</span>
                  {inv.note && <span className="invite-note">📝 {inv.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

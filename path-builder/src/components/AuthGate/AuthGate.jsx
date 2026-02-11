import { useState, useEffect, useCallback } from "react";
import {
  signInWithGoogle,
  signOutUser,
  onAuthChange,
} from "../../services/googleAuthService";
import {
  isAuthorized,
  isEpicEmployee,
  consumeInvite,
  getInviteFromUrl,
  clearInviteFromUrl,
} from "../../services/accessControl";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import "./AuthGate.css";

/**
 * AuthGate — Wraps the entire app behind Google SSO.
 *
 * Access control:
 *   1. @epicgames.com → auto-admitted
 *   2. Firestore allowlist (via invite codes)
 *   3. Everyone else → access denied
 */
export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const allowed = await isAuthorized(firebaseUser);
          setAuthorized(allowed);
          if (!allowed) {
            // Check for invite code in URL
            const urlInvite = getInviteFromUrl();
            if (urlInvite) {
              setInviteCode(urlInvite);
              // Auto-consume URL invite
              const result = await consumeInvite(urlInvite, firebaseUser.email);
              if (result.success) {
                setAuthorized(true);
                clearInviteFromUrl();
              } else {
                setInviteError(result.error);
              }
            }
          }
        } catch {
          setAuthorized(false);
        }
      } else {
        setAuthorized(false);
        // Pre-fill invite code from URL even before sign-in
        const urlInvite = getInviteFromUrl();
        if (urlInvite) setInviteCode(urlInvite);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthError(null);
    const { error } = await signInWithGoogle();
    if (error) setAuthError(error);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setAuthorized(false);
    setAuthError(null);
    setInviteError(null);
  }, []);

  const handleInviteSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!inviteCode.trim()) return;
      setInviteLoading(true);
      setInviteError(null);

      if (!user) {
        // Need to sign in first
        const { error } = await signInWithGoogle();
        if (error) {
          setInviteError(error);
          setInviteLoading(false);
          return;
        }
        // onAuthChange will handle the rest with URL invite
        setInviteLoading(false);
        return;
      }

      const result = await consumeInvite(inviteCode.trim(), user.email);
      if (result.success) {
        setAuthorized(true);
        clearInviteFromUrl();
      } else {
        setInviteError(result.error);
      }
      setInviteLoading(false);
    },
    [inviteCode, user]
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="auth-gate-loading">
        <LoadingSpinner />
      </div>
    );
  }

  // ── Not signed in ──
  if (!user) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <div className="auth-gate-logo">🎮</div>
          <h1 className="auth-gate-title">UE5 Learning Path Builder</h1>
          <p className="auth-gate-subtitle">
            Internal tool for Unreal Engine learning path creation and tag management.
          </p>

          <button className="auth-gate-google-btn" onClick={handleSignIn}>
            <svg viewBox="0 0 24 24" width="20" height="20" className="google-icon">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          {authError && <p className="auth-gate-error">{authError}</p>}

          <div className="auth-gate-divider">
            <span>or enter invite code</span>
          </div>

          <form className="auth-gate-invite-form" onSubmit={handleInviteSubmit}>
            <input
              type="text"
              placeholder="INVITE-CODE"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="auth-gate-invite-input"
            />
            <button
              type="submit"
              className="auth-gate-invite-btn"
              disabled={inviteLoading || !inviteCode.trim()}
            >
              {inviteLoading ? "Validating..." : "Use Invite"}
            </button>
          </form>

          {inviteError && <p className="auth-gate-error">{inviteError}</p>}

          <p className="auth-gate-footer">
            Epic Games employees can sign in directly.
            <br />
            External users need an invite link.
          </p>
        </div>
      </div>
    );
  }

  // ── Signed in but not authorized ──
  if (!authorized) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <div className="auth-gate-logo">🔒</div>
          <h1 className="auth-gate-title">Access Restricted</h1>
          <p className="auth-gate-subtitle">
            Signed in as <strong>{user.email}</strong>
          </p>
          <p className="auth-gate-message">
            {isEpicEmployee(user.email)
              ? "Verifying your access..."
              : "This tool is restricted to Epic Games employees. If you have an invite code, enter it below."}
          </p>

          <form className="auth-gate-invite-form" onSubmit={handleInviteSubmit}>
            <input
              type="text"
              placeholder="INVITE-CODE"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="auth-gate-invite-input"
            />
            <button
              type="submit"
              className="auth-gate-invite-btn"
              disabled={inviteLoading || !inviteCode.trim()}
            >
              {inviteLoading ? "Validating..." : "Use Invite"}
            </button>
          </form>

          {inviteError && <p className="auth-gate-error">{inviteError}</p>}

          <button className="auth-gate-signout-btn" onClick={handleSignOut}>
            Sign out and try a different account
          </button>
        </div>
      </div>
    );
  }

  // ── Authorized — render app with sign-out control ──
  return (
    <div className="auth-gate-authorized">
      <div className="auth-gate-user-bar">
        <div className="auth-gate-user-info">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              className="auth-gate-avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="auth-gate-user-name">
            {user.displayName || user.email}
          </span>
        </div>
        <button className="auth-gate-signout-small" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
      {children}
    </div>
  );
}

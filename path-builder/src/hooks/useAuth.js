/**
 * useAuth — Encapsulates Firebase auth listener, user state, and admin claims.
 *
 * Returns:
 *   currentUser  — Firebase User | null
 *   userIsAdmin  — boolean (derived from custom claims)
 *   authLoading  — boolean (true until first auth state resolves)
 */
import { useState, useEffect } from "react";
import { onAuthChange } from "../services/googleAuthService";
import { isAdmin } from "../services/accessControl";
import { IS_E2E } from "../services/e2eBypass";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(
    IS_E2E
      ? {
          uid: "e2e_mock_uid",
          email: "e2e@example.com",
          displayName: "E2E User",
          photoURL: "https://avatar.vercel.sh/e2e",
        }
      : null
  );
  const [userIsAdmin, setUserIsAdmin] = useState(IS_E2E);
  // In E2E mode, skip the auth flow entirely — start as "loaded"
  const [authLoading, setAuthLoading] = useState(!IS_E2E);

  useEffect(() => {
    if (IS_E2E) return;

    const unsub = onAuthChange(async (u) => {
      setCurrentUser(u);
      if (u) {
        const adminStatus = await isAdmin();
        setUserIsAdmin(adminStatus);
      } else {
        setUserIsAdmin(false);
      }
      setAuthLoading(false);
    });

    return unsub;
  }, []);

  return { currentUser, userIsAdmin, authLoading };
}

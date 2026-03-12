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
  const [currentUser, setCurrentUser] = useState(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (IS_E2E) {
      setAuthLoading(false);
      return;
    }

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

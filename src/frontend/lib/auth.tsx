"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { apiClient, setOnUnauthorized } from "@/lib/api";
import type { UserRead } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────

interface AuthState {
    user: UserRead | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null);

// ── Cookie helpers ────────────────────────────────────────────────────

/**
 * Returns true when the backend's readable `csrf_token` cookie is present.
 * Because the JWT lives in an HttpOnly cookie we cannot inspect it directly;
 * the presence of `csrf_token` is our proxy for "a session exists".
 */
function hasCsrfCookie(): boolean {
    if (typeof document === "undefined") return false;
    return document.cookie
        .split("; ")
        .some((row) => row.startsWith("csrf_token="));
}

// ── Provider ──────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserRead | null>(null);
    const [loading, setLoading] = useState(true);

    // ── Logout ────────────────────────────────────────────────────────
    const logout = useCallback(async () => {
        try {
            // Ask the backend to clear the HttpOnly JWT cookie.
            await apiClient.logout();
        } catch {
            // Even if the network call fails, clear local state so the
            // user is not stuck in a broken authenticated state.
        } finally {
            setUser(null);
        }
    }, []);

    // ── Login ─────────────────────────────────────────────────────────
    const login = useCallback(async (email: string, password: string) => {
        // The backend sets the HttpOnly JWT cookie + the readable
        // csrf_token cookie in its response — no token in body.
        await apiClient.login(email, password);
        // Fetch the user profile now that the session cookies are set.
        const me = await apiClient.getMe();
        setUser(me);
    }, []);

    // ── Session rehydration on mount ──────────────────────────────────
    useEffect(() => {
        // Fast path: if there is no csrf_token cookie there is no active
        // session — skip the network round-trip entirely.
        if (!hasCsrfCookie()) {
            setLoading(false);
            return;
        }

        // Validate the session by calling /auth/me.  The browser will
        // automatically include the HttpOnly JWT cookie because we set
        // credentials: "include" in the API client.
        apiClient
            .getMe()
            .then(setUser)
            .catch(() => {
                // 401 or network error — treat as logged out.
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, []);

    // ── Global 401 handler ────────────────────────────────────────────
    useEffect(() => {
        // Any 401 from any API call triggers an immediate logout so the
        // app never stays in a half-authenticated state.
        setOnUnauthorized(() => {
            setUser(null);
        });
        return () => setOnUnauthorized(null);
    }, []);

    // ── Context value ─────────────────────────────────────────────────
    const value = useMemo<AuthState>(
        () => ({ user, loading, login, logout }),
        [user, loading, login, logout],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

// ── Hooks ─────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}

/**
 * @deprecated Token-based auth has been replaced with cookie-based auth.
 * This shim exists only to avoid breaking call sites during the migration.
 * Remove it once all consumers have been updated to drop the token argument.
 */
export function ensureToken(_token?: string | null): string {
    // The token is now managed entirely by the browser cookie jar.
    // Return an empty string so existing callers compile without errors;
    // the actual credential is sent automatically via credentials: "include".
    return "";
}

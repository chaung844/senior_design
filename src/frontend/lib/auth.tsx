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

const TOKEN_KEY = "matcha_access_token";
const AUTH_COOKIE = "matcha_logged_in";

interface AuthState {
    user: UserRead | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

function setAuthCookie(hasToken: boolean): void {
    if (typeof document === "undefined") return;
    if (hasToken) {
        document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Strict; max-age=86400`;
    } else {
        document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
    }
}

function setStoredToken(token: string | null): void {
    if (typeof window === "undefined") return;
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
    setAuthCookie(!!token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserRead | null>(null);
    const [token, setTokenState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const setToken = useCallback((value: string | null) => {
        setTokenState(value);
        setStoredToken(value);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
    }, [setToken]);

    const login = useCallback(
        async (email: string, password: string) => {
            const { access_token } = await apiClient.login(email, password);
            setToken(access_token);
            const me = await apiClient.getMe(access_token);
            setUser(me);
        },
        [setToken]
    );

    useEffect(() => {
        const stored = getStoredToken();
        if (!stored) {
            setLoading(false);
            return;
        }
        setTokenState(stored);
        setAuthCookie(true);
        apiClient
            .getMe(stored)
            .then(setUser)
            .catch(() => setToken(null))
            .finally(() => setLoading(false));
    }, [setToken]);

    useEffect(() => {
        setOnUnauthorized(logout);
        return () => setOnUnauthorized(null);
    }, [logout]);

    const value = useMemo<AuthState>(
        () => ({ user, token, loading, login, logout }),
        [user, token, loading, login, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}

export function ensureToken(token: string | null): string {
    if (!token) throw new Error("Not authenticated");
    return token;
}

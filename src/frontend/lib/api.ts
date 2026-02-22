/**
 * API client for the Matcha backend.
 * Uses NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
 */

export interface UserRead {
    user_id: number;
    name: string;
    email: string;
    role: "admin" | "developer" | "viewer";
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Token {
    access_token: string;
    token_type: string;
}

function getBaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_API_URL;
    if (!url) {
        throw new Error("NEXT_PUBLIC_API_URL is not set");
    }
    return url.replace(/\/$/, "");
}

async function request<T>(
    path: string,
    options: RequestInit & { token?: string | null } = {}
): Promise<T> {
    const { token, ...init } = options;
    const headers = new Headers(init.headers);
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(`${getBaseUrl()}${path}`, { ...init, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail =
            typeof body.detail === "string"
                ? body.detail
                : Array.isArray(body.detail)
                  ? body.detail.map((d: { msg?: string }) => d.msg ?? "").join(", ")
                  : "Request failed";
        throw new Error(detail || res.statusText);
    }
    return res.json() as Promise<T>;
}

/**
 * Login with email and password.
 * Backend expects OAuth2 form-encoded body (username = email, password).
 */
export async function login(
    email: string,
    password: string
): Promise<Token> {
    const body = new URLSearchParams({
        username: email.trim().toLowerCase(),
        password,
    });
    return request<Token>("/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });
}

/**
 * Get the currently authenticated user (requires valid token).
 */
export async function getMe(token: string): Promise<UserRead> {
    return request<UserRead>("/auth/me", { token });
}

/**
 * Get a user by ID (public endpoint; no auth required per backend).
 */
export async function getUser(userId: number, token?: string | null): Promise<UserRead> {
    return request<UserRead>(`/users/${userId}`, { token });
}

export const apiClient = {
    login,
    getMe,
    getUser,
};

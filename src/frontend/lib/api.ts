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

// Document upload (presigned URL S3 pattern)
export type DocumentType = "receipt" | "bank_statement";
export type DocumentStatus =
    | "pending_upload"
    | "pending_processing"
    | "processing"
    | "parsed"
    | "failed";

export interface DocumentUploadRequest {
    file_name: string;
    file_type: string;
    document_type: DocumentType;
}

export interface DocumentUploadResponse {
    upload_url: string;
    document_id: number;
    s3_key: string;
}

export interface DocumentConfirmResponse {
    document_id: number;
    status: DocumentStatus;
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

/**
 * Request a presigned S3 upload URL for a document (requires auth).
 */
export async function requestUploadUrl(
    token: string,
    body: DocumentUploadRequest
): Promise<DocumentUploadResponse> {
    return request<DocumentUploadResponse>("/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

/**
 * Upload a file directly to S3 using a presigned PUT URL.
 * No auth header; the URL is pre-signed.
 */
export async function uploadFileToS3(
    presignedUrl: string,
    file: File
): Promise<void> {
    const res = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
    });
    if (!res.ok) {
        throw new Error(res.statusText || "S3 upload failed");
    }
}

/**
 * Confirm that a document was uploaded and enqueue it for processing (requires auth).
 */
export async function confirmUpload(
    token: string,
    documentId: number
): Promise<DocumentConfirmResponse> {
    return request<DocumentConfirmResponse>(
        `/documents/${documentId}/confirm-upload`,
        { method: "POST", token }
    );
}

export const apiClient = {
    login,
    getMe,
    getUser,
    requestUploadUrl,
    uploadFileToS3,
    confirmUpload,
};

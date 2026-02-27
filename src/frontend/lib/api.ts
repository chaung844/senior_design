/**
 * API client for the Matcha backend.
 * Uses NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
 */

import type {
    Token,
    UserRead,
    UserCreate,
    UserUpdate,
    UserListResponse,
    DocumentUploadRequest,
    DocumentUploadResponse,
    DocumentConfirmResponse,
    DocumentRead,
    DocumentListResponse,
    DocumentListParams,
    FileUrlResponse,
    ReceiptRead,
    ReceiptUpdate,
    ReceiptListResponse,
    ReceiptListParams,
    BankStatementRead,
    BankStatementDetailRead,
    BankStatementListResponse,
    BankStatementListParams,
    BankStatementLineRead,
    BankStatementLineUpdate,
    BankStatementLineListResponse,
    BankStatementLineListParams,
    AccountBookCreate,
    AccountBookUpdate,
    AccountBookRead,
    AccountBookListResponse,
    AccountBookListParams,
    MemberRead,
    MemberListResponse,
    MemberAdd,
    UserRole,
} from "@/lib/types";

// ── Internals ────────────────────────────────────────────────────────

let _onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: (() => void) | null) {
    _onUnauthorized = callback;
}

function getBaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_API_URL;
    if (!url) {
        throw new Error("NEXT_PUBLIC_API_URL is not set");
    }
    return url.replace(/\/$/, "");
}

async function baseFetch(
    path: string,
    options: RequestInit & { token?: string | null } = {},
): Promise<Response> {
    const { token, ...init } = options;
    const headers = new Headers(init.headers);
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(`${getBaseUrl()}${path}`, { ...init, headers });
    if (res.status === 401 && token) {
        _onUnauthorized?.();
        throw new Error("Session expired");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail =
            typeof body.detail === "string"
                ? body.detail
                : Array.isArray(body.detail)
                    ? body.detail
                        .map((d: { msg?: string }) => d.msg ?? "")
                        .join(", ")
                    : "Request failed";
        throw new Error(detail || res.statusText);
    }
    return res;
}

async function request<T>(
    path: string,
    options: RequestInit & { token?: string | null } = {},
): Promise<T> {
    const res = await baseFetch(path, options);
    return res.json() as Promise<T>;
}

async function requestNoContent(
    path: string,
    options: RequestInit & { token?: string | null } = {},
): Promise<void> {
    await baseFetch(path, options);
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null,
    );
    if (entries.length === 0) return "";
    return "?" + new URLSearchParams(
        entries.map(([k, v]) => [k, String(v)]),
    ).toString();
}

// ── Auth (Tier 1) ───────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<Token> {
    const body = new URLSearchParams({
        username: email.trim().toLowerCase(),
        password,
    });
    return request<Token>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
}

export async function getMe(token: string): Promise<UserRead> {
    return request<UserRead>("/auth/me", { token });
}

export async function getUser(
    userId: number,
    token?: string | null,
): Promise<UserRead> {
    return request<UserRead>(`/users/${userId}`, { token });
}

// ── Document Upload (Tier 1) ────────────────────────────────────────

export async function requestUploadUrl(
    token: string,
    body: DocumentUploadRequest,
): Promise<DocumentUploadResponse> {
    return request<DocumentUploadResponse>("/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

export async function uploadFileToS3(
    presignedUrl: string,
    file: File,
): Promise<void> {
    const res = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
    });
    if (!res.ok) {
        throw new Error(res.statusText || "S3 upload failed");
    }
}

export async function confirmUpload(
    token: string,
    documentId: number,
): Promise<DocumentConfirmResponse> {
    return request<DocumentConfirmResponse>(
        `/documents/${documentId}/confirm-upload`,
        { method: "POST", token },
    );
}

// ── Documents (Tier 2) ──────────────────────────────────────────────

export async function listDocuments(
    token: string,
    params: DocumentListParams = {},
): Promise<DocumentListResponse> {
    const query = qs({
        status: params.status,
        document_type: params.document_type,
        account_id: params.account_id,
        offset: params.offset,
        limit: params.limit,
    });
    return request<DocumentListResponse>(`/documents${query}`, { token });
}

export async function getDocument(
    token: string,
    documentId: number,
): Promise<DocumentRead> {
    return request<DocumentRead>(`/documents/${documentId}`, { token });
}

export async function deleteDocument(
    token: string,
    documentId: number,
): Promise<void> {
    return requestNoContent(`/documents/${documentId}`, {
        method: "DELETE",
        token,
    });
}

// ── Receipts (Tier 3) ───────────────────────────────────────────────

export async function listReceipts(
    token: string,
    params: ReceiptListParams = {},
): Promise<ReceiptListResponse> {
    const query = qs({
        match_status: params.match_status,
        account_id: params.account_id,
        offset: params.offset,
        limit: params.limit,
    });
    return request<ReceiptListResponse>(`/receipts${query}`, { token });
}

export async function getReceipt(
    token: string,
    receiptId: number,
): Promise<ReceiptRead> {
    return request<ReceiptRead>(`/receipts/${receiptId}`, { token });
}

export async function updateReceipt(
    token: string,
    receiptId: number,
    body: ReceiptUpdate,
): Promise<ReceiptRead> {
    return request<ReceiptRead>(`/receipts/${receiptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

export async function getReceiptFileUrl(
    token: string,
    receiptId: number,
): Promise<FileUrlResponse> {
    return request<FileUrlResponse>(`/receipts/${receiptId}/file-url`, {
        token,
    });
}

// ── Bank Statements (Tier 3) ────────────────────────────────────────

export async function listStatements(
    token: string,
    params: BankStatementListParams = {},
): Promise<BankStatementListResponse> {
    const query = qs({
        account_id: params.account_id,
        offset: params.offset,
        limit: params.limit,
    });
    return request<BankStatementListResponse>(`/statements${query}`, { token });
}

export async function getStatement(
    token: string,
    statementId: number,
): Promise<BankStatementDetailRead> {
    return request<BankStatementDetailRead>(`/statements/${statementId}`, {
        token,
    });
}

export async function listStatementLines(
    token: string,
    statementId: number,
    params: BankStatementLineListParams = {},
): Promise<BankStatementLineListResponse> {
    const query = qs({
        match_status: params.match_status,
        offset: params.offset,
        limit: params.limit,
    });
    return request<BankStatementLineListResponse>(
        `/statements/${statementId}/lines${query}`,
        { token },
    );
}

export async function updateStatementLine(
    token: string,
    statementId: number,
    lineId: number,
    body: BankStatementLineUpdate,
): Promise<BankStatementLineRead> {
    return request<BankStatementLineRead>(
        `/statements/${statementId}/lines/${lineId}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            token,
        },
    );
}

export async function getStatementFileUrl(
    token: string,
    statementId: number,
): Promise<FileUrlResponse> {
    return request<FileUrlResponse>(`/statements/${statementId}/file-url`, {
        token,
    });
}

// ── Account Books (Tier 5) ──────────────────────────────────────────

export async function listAccounts(
    token: string,
    params: AccountBookListParams = {},
): Promise<AccountBookListResponse> {
    const query = qs({ offset: params.offset, limit: params.limit });
    return request<AccountBookListResponse>(`/accounts${query}`, { token });
}

export async function getAccount(
    token: string,
    accountId: number,
): Promise<AccountBookRead> {
    return request<AccountBookRead>(`/accounts/${accountId}`, { token });
}

export async function createAccount(
    token: string,
    body: AccountBookCreate,
): Promise<AccountBookRead> {
    return request<AccountBookRead>("/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

export async function updateAccount(
    token: string,
    accountId: number,
    body: AccountBookUpdate,
): Promise<AccountBookRead> {
    return request<AccountBookRead>(`/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

export async function deleteAccount(
    token: string,
    accountId: number,
): Promise<void> {
    return requestNoContent(`/accounts/${accountId}`, {
        method: "DELETE",
        token,
    });
}

// ── Account Members (Tier 5) ────────────────────────────────────────

export async function listAccountMembers(
    token: string,
    accountId: number,
): Promise<MemberListResponse> {
    return request<MemberListResponse>(`/accounts/${accountId}/members`, {
        token,
    });
}

export async function addAccountMember(
    token: string,
    accountId: number,
    body: MemberAdd,
): Promise<MemberRead> {
    return request<MemberRead>(`/accounts/${accountId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

export async function removeAccountMember(
    token: string,
    accountId: number,
    userId: number,
): Promise<void> {
    return requestNoContent(`/accounts/${accountId}/members/${userId}`, {
        method: "DELETE",
        token,
    });
}

// ── Admin Users (Tier 5) ────────────────────────────────────────────

export async function listAdminUsers(
    token: string,
    params: {
        role?: UserRole;
        is_active?: boolean;
        offset?: number;
        limit?: number;
    } = {},
): Promise<UserListResponse> {
    const query = qs({
        role: params.role,
        is_active: params.is_active,
        offset: params.offset,
        limit: params.limit,
    });
    return request<UserListResponse>(`/admin/users${query}`, { token });
}

export async function createAdminUser(
    token: string,
    body: UserCreate,
): Promise<UserRead> {
    return request<UserRead>("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

export async function getAdminUser(
    token: string,
    userId: number,
): Promise<UserRead> {
    return request<UserRead>(`/admin/users/${userId}`, { token });
}

export async function updateAdminUser(
    token: string,
    userId: number,
    body: UserUpdate,
): Promise<UserRead> {
    return request<UserRead>(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        token,
    });
}

export async function deactivateAdminUser(
    token: string,
    userId: number,
): Promise<void> {
    return requestNoContent(`/admin/users/${userId}`, {
        method: "DELETE",
        token,
    });
}

// ── Convenience barrel export ───────────────────────────────────────

export const apiClient = {
    // Auth
    login,
    getMe,
    getUser,
    // Document upload
    requestUploadUrl,
    uploadFileToS3,
    confirmUpload,
    // Documents
    listDocuments,
    getDocument,
    deleteDocument,
    // Receipts
    listReceipts,
    getReceipt,
    updateReceipt,
    getReceiptFileUrl,
    // Statements
    listStatements,
    getStatement,
    listStatementLines,
    updateStatementLine,
    getStatementFileUrl,
    // Accounts
    listAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    // Account members
    listAccountMembers,
    addAccountMember,
    removeAccountMember,
    // Admin users
    listAdminUsers,
    createAdminUser,
    getAdminUser,
    updateAdminUser,
    deactivateAdminUser,
};

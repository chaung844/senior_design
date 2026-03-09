/**
 * API client for the Matcha backend.
 * Uses NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
 *
 * Authentication is fully cookie-based:
 *  - The backend sets the JWT in an HttpOnly cookie automatically.
 *  - `credentials: "include"` is set on every request so the browser
 *    sends that cookie cross-origin.
 *  - For state-changing methods (POST / PUT / PATCH / DELETE) we read the
 *    `csrf_token` cookie (readable by JS) and forward it as the
 *    `X-CSRF-Token` header (Double Submit Cookie pattern).
 */

import type {
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
    BankStatementUpdate,
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
    JobStatusResponse,
    ReconciliationStartRequest,
    ReconciliationStartResponse,
    ReconciliationMatchListResponse,
    ManualMatchCreate,
    ManualMatchCreateResponse,
    DeleteMatchResponse,
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

/**
 * Reads a single cookie value by name from document.cookie.
 * Returns null when running server-side or when the cookie is absent.
 */
function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/** Methods that modify server state and therefore require a CSRF token. */
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function baseFetch(
    path: string,
    options: RequestInit = {},
): Promise<Response> {
    const method = (options.method ?? "GET").toUpperCase();
    const headers = new Headers(options.headers);

    // Attach CSRF token for every state-changing request.
    if (CSRF_METHODS.has(method)) {
        const csrfToken = getCookie("csrf_token");
        if (csrfToken) {
            headers.set("X-CSRF-Token", csrfToken);
        }
    }

    const res = await fetch(`${getBaseUrl()}${path}`, {
        ...options,
        headers,
        // Always send cookies cross-origin so the HttpOnly JWT cookie
        // (and the csrf_token cookie) are included in every request.
        credentials: "include",
    });

    if (res.status === 401) {
        _onUnauthorized?.();
        throw new Error("Invalid Credentials");
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await baseFetch(path, options);
    return res.json() as Promise<T>;
}

async function requestNoContent(
    path: string,
    options: RequestInit = {},
): Promise<void> {
    await baseFetch(path, options);
}

function qs(
    params: Record<string, string | number | boolean | undefined | null>,
): string {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null,
    );
    if (entries.length === 0) return "";
    return (
        "?" +
        new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
    );
}

// ── Auth (Tier 1) ───────────────────────────────────────────────────

/**
 * Sends credentials to the login endpoint.
 * The backend responds by setting an HttpOnly JWT cookie and a readable
 * `csrf_token` cookie — no token is returned in the response body.
 */
export async function login(email: string, password: string): Promise<void> {
    const body = new URLSearchParams({
        username: email.trim().toLowerCase(),
        password,
    });
    await requestNoContent("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
}

/**
 * Calls the logout endpoint so the backend can clear the HttpOnly cookie.
 */
export async function logout(): Promise<void> {
    await requestNoContent("/auth/logout", { method: "POST" });
}

/**
 * Returns the currently authenticated user, or throws on 401.
 * Used on initial page load to rehydrate auth state from the session cookie.
 */
export async function getMe(): Promise<UserRead> {
    return request<UserRead>("/auth/me");
}

export async function getUser(userId: number): Promise<UserRead> {
    return request<UserRead>(`/users/${userId}`);
}

// ── Document Upload (Tier 1) ────────────────────────────────────────

export async function requestUploadUrl(
    body: DocumentUploadRequest,
): Promise<DocumentUploadResponse> {
    return request<DocumentUploadResponse>("/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function uploadFileToS3(
    presignedUrl: string,
    file: File,
): Promise<void> {
    // Direct S3 upload — credentials must NOT be included here since it's
    // a third-party URL and would break CORS preflight.
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
    documentId: number,
    statementId?: number,
): Promise<DocumentConfirmResponse> {
    const query = qs({ statement_id: statementId });
    return request<DocumentConfirmResponse>(
        `/documents/${documentId}/confirm-upload${query}`,
        { method: "POST" },
    );
}

// ── Documents (Tier 2) ──────────────────────────────────────────────

export async function listDocuments(
    params: DocumentListParams = {},
): Promise<DocumentListResponse> {
    const query = qs({
        status: params.status,
        document_type: params.document_type,
        account_id: params.account_id,
        offset: params.offset,
        limit: params.limit,
    });
    return request<DocumentListResponse>(`/documents${query}`);
}

export async function getDocument(documentId: number): Promise<DocumentRead> {
    return request<DocumentRead>(`/documents/${documentId}`);
}

export async function deleteDocument(documentId: number): Promise<void> {
    return requestNoContent(`/documents/${documentId}`, {
        method: "DELETE",
    });
}

// ── Receipts (Tier 3) ───────────────────────────────────────────────

export async function listReceipts(
    params: ReceiptListParams = {},
): Promise<ReceiptListResponse> {
    const query = qs({
        match_status: params.match_status,
        account_id: params.account_id,
        statement_id: params.statement_id,
        offset: params.offset,
        limit: params.limit,
    });
    return request<ReceiptListResponse>(`/receipts${query}`);
}

export async function getReceipt(receiptId: number): Promise<ReceiptRead> {
    return request<ReceiptRead>(`/receipts/${receiptId}`);
}

export async function updateReceipt(
    receiptId: number,
    body: ReceiptUpdate,
): Promise<ReceiptRead> {
    return request<ReceiptRead>(`/receipts/${receiptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function getReceiptFileUrl(
    receiptId: number,
): Promise<FileUrlResponse> {
    return request<FileUrlResponse>(`/receipts/${receiptId}/file-url`);
}

// ── Bank Statements (Tier 3) ────────────────────────────────────────

export async function listStatements(
    params: BankStatementListParams = {},
): Promise<BankStatementListResponse> {
    const query = qs({
        account_id: params.account_id,
        offset: params.offset,
        limit: params.limit,
    });
    return request<BankStatementListResponse>(`/statements${query}`);
}

export async function getStatement(
    statementId: number,
): Promise<BankStatementDetailRead> {
    return request<BankStatementDetailRead>(`/statements/${statementId}`);
}

export async function listStatementLines(
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
    );
}

export async function updateStatementLine(
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
        },
    );
}

export async function updateStatement(
    statementId: number,
    body: BankStatementUpdate,
): Promise<BankStatementRead> {
    return request<BankStatementRead>(`/statements/${statementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function getStatementFileUrl(
    statementId: number,
): Promise<FileUrlResponse> {
    return request<FileUrlResponse>(`/statements/${statementId}/file-url`);
}

// ── Account Books (Tier 5) ──────────────────────────────────────────

export async function listAccounts(
    params: AccountBookListParams = {},
): Promise<AccountBookListResponse> {
    const query = qs({ offset: params.offset, limit: params.limit });
    return request<AccountBookListResponse>(`/accounts${query}`);
}

export async function getAccount(accountId: number): Promise<AccountBookRead> {
    return request<AccountBookRead>(`/accounts/${accountId}`);
}

export async function createAccount(
    body: AccountBookCreate,
): Promise<AccountBookRead> {
    return request<AccountBookRead>("/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function updateAccount(
    accountId: number,
    body: AccountBookUpdate,
): Promise<AccountBookRead> {
    return request<AccountBookRead>(`/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function deleteAccount(accountId: number): Promise<void> {
    return requestNoContent(`/accounts/${accountId}`, {
        method: "DELETE",
    });
}

// ── Jobs ─────────────────────────────────────────────────────────────

/**
 * Polls the status of a specific job (parsing or reconciliation).
 * Used by the floating job-status widget to track progress.
 */
export async function getJobStatus(jobId: number): Promise<JobStatusResponse> {
    return request<JobStatusResponse>(`/jobs/${jobId}/status`);
}

// ── Reconciliation (Tier 4) ─────────────────────────────────────────

/**
 * Creates a reconciliation job and immediately runs the matching algorithm
 * for the given account + statement in a single call.
 * Returns the job id, terminal status, and a summary of matched lines.
 */
export async function startReconciliation(
    body: ReconciliationStartRequest,
): Promise<ReconciliationStartResponse> {
    return request<ReconciliationStartResponse>("/reconciliation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

/**
 * Manually create a match between a statement line and one or more receipts.
 * match_type defaults to "manual" when omitted.
 */
export async function createManualMatch(
    body: ManualMatchCreate,
): Promise<ManualMatchCreateResponse> {
    return request<ManualMatchCreateResponse>("/reconciliation/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}
/**
 * List reconciliation matches for a specific statement line.
 * Returns all match rows (with match_id) so the dialog can offer remove actions.
 */
export async function listMatchesByLine(
    lineId: number,
): Promise<ReconciliationMatchListResponse> {
    return request<ReconciliationMatchListResponse>(
        `/reconciliation/matches?line_id=${lineId}&limit=100`,
    );
}
/**
 * Remove an existing reconciliation match by match_id.
 * Resets line and receipt match_status to "unmatched" when no other matches remain.
 */
export async function deleteMatch(
    matchId: number,
): Promise<DeleteMatchResponse> {
    return request<DeleteMatchResponse>(`/reconciliation/matches/${matchId}`, {
        method: "DELETE",
    });
}

// ── Account Members (Tier 5) ────────────────────────────────────────

export async function lookupUserByEmail(email: string): Promise<UserRead> {
    const query = qs({ email });
    return request<UserRead>(`/accounts/members/lookup${query}`);
}

export async function listAccountMembers(
    accountId: number,
): Promise<MemberListResponse> {
    return request<MemberListResponse>(`/accounts/${accountId}/members`);
}

export async function addAccountMember(
    accountId: number,
    body: MemberAdd,
): Promise<MemberRead> {
    return request<MemberRead>(`/accounts/${accountId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function removeAccountMember(
    accountId: number,
    userId: number,
): Promise<void> {
    return requestNoContent(`/accounts/${accountId}/members/${userId}`, {
        method: "DELETE",
    });
}

// ── Admin Users (Tier 5) ────────────────────────────────────────────

export async function listAdminUsers(
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
    return request<UserListResponse>(`/admin/users${query}`);
}

export async function createAdminUser(body: UserCreate): Promise<UserRead> {
    return request<UserRead>("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function getAdminUser(userId: number): Promise<UserRead> {
    return request<UserRead>(`/admin/users/${userId}`);
}

export async function updateAdminUser(
    userId: number,
    body: UserUpdate,
): Promise<UserRead> {
    return request<UserRead>(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function deactivateAdminUser(userId: number): Promise<void> {
    return requestNoContent(`/admin/users/${userId}`, {
        method: "DELETE",
    });
}

// ── Convenience barrel export ───────────────────────────────────────

export const apiClient = {
    // Auth
    login,
    logout,
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
    lookupUserByEmail,
    listAccountMembers,
    addAccountMember,
    removeAccountMember,
    // Jobs
    getJobStatus,
    // Reconciliation
    startReconciliation,
    listMatchesByLine,
    createManualMatch,
    deleteMatch,
    // Admin users
    listAdminUsers,
    createAdminUser,
    getAdminUser,
    updateAdminUser,
    deactivateAdminUser,
};

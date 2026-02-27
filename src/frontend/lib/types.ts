/**
 * API response types mirroring the FastAPI backend Pydantic schemas.
 * All field names use snake_case to match the JSON returned by the API.
 */

// ── Enums ────────────────────────────────────────────────────────────

export type MatchStatus =
    | "unmatched"
    | "perfect_matched"
    | "bundle_matched"
    | "manual";

export type UserRole = "admin" | "developer" | "viewer";

export type AccountType = "checking" | "credit_card";

export type DocumentType = "receipt" | "bank_statement";

export type DocumentStatus =
    | "pending_upload"
    | "pending_processing"
    | "processing"
    | "parsed"
    | "failed";

export type AccountBookRole = "owner" | "viewer";

export type JobStatus =
    | "pending"
    | "processing"
    | "reconciling"
    | "completed"
    | "failed";

// ── Paginated response wrapper ───────────────────────────────────────

export interface PaginatedParams {
    offset?: number;
    limit?: number;
}

// ── Users ────────────────────────────────────────────────────────────

export interface UserRead {
    user_id: number;
    name: string;
    email: string;
    role: UserRole;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserCreate {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
}

export interface UserUpdate {
    name?: string;
    email?: string;
    role?: UserRole;
    is_active?: boolean;
    new_password?: string;
}

export interface UserListResponse {
    users: UserRead[];
    total: number;
    offset: number;
    limit: number;
}

// ── Documents (Tier 2) ──────────────────────────────────────────────

export interface DocumentUploadRequest {
    file_name: string;
    file_type: string;
    document_type: DocumentType;
    account_id?: number | null;
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

export interface DocumentRead {
    document_id: number;
    file_name: string;
    document_type: DocumentType;
    s3_key: string;
    status: DocumentStatus;
    error_message: string | null;
    account_id: number | null;
    receipt_id: number | null;
    statement_id: number | null;
    created_at: string;
    updated_at: string;
}

export interface DocumentListResponse {
    documents: DocumentRead[];
    total: number;
    offset: number;
    limit: number;
}

export interface DocumentListParams extends PaginatedParams {
    status?: DocumentStatus;
    document_type?: DocumentType;
    account_id?: number;
}

export interface FileUrlResponse {
    url: string;
    expires_in: number;
}

// ── Receipts (Tier 3) ───────────────────────────────────────────────

export interface ReceiptRead {
    receipt_id: number;
    vendor: string;
    invoice_number: string | null;
    billing_date: string;
    charged_amount: number;
    currency: string;
    description: string | null;
    expense_type: string | null;
    match_status: MatchStatus;
    created_at: string;
    document_id: number | null;
    file_name: string | null;
}

export interface ReceiptUpdate {
    vendor?: string;
    invoice_number?: string;
    billing_date?: string;
    charged_amount?: number;
    currency?: string;
    description?: string;
    expense_type?: string;
}

export interface ReceiptListResponse {
    receipts: ReceiptRead[];
    total: number;
    offset: number;
    limit: number;
}

export interface ReceiptListParams extends PaginatedParams {
    match_status?: MatchStatus;
    account_id?: number;
}

// ── Bank Statements (Tier 3) ────────────────────────────────────────

export interface BankStatementRead {
    statement_id: number;
    account_id: number;
    month: number;
    year: number;
    account_number_last4: string;
    total_amount: number;
    currency: string;
    created_at: string;
    document_id: number | null;
    file_name: string | null;
    line_count: number;
}

export interface BankStatementDetailRead extends BankStatementRead {
    lines: BankStatementLineRead[];
}

export interface BankStatementListResponse {
    statements: BankStatementRead[];
    total: number;
    offset: number;
    limit: number;
}

export interface BankStatementListParams extends PaginatedParams {
    account_id?: number;
}

export interface BankStatementLineRead {
    line_id: number;
    statement_id: number;
    line_number: number;
    reference_number: string;
    transaction_date: string;
    posting_date: string;
    description: string;
    vendor: string;
    mcc: string | null;
    charge: number;
    currency: string;
    match_status: MatchStatus;
    created_at: string;
}

export interface BankStatementLineUpdate {
    description?: string;
    vendor?: string;
    charge?: number;
    transaction_date?: string;
    posting_date?: string;
    mcc?: string;
}

export interface BankStatementLineListResponse {
    lines: BankStatementLineRead[];
    total: number;
    offset: number;
    limit: number;
}

export interface BankStatementLineListParams extends PaginatedParams {
    match_status?: MatchStatus;
}

// ── Account Books (Tier 5) ──────────────────────────────────────────

export interface AccountBookCreate {
    bank_name: string;
    account_name: string;
    account_type?: AccountType;
    currency?: string;
    account_number_last4: string;
}

export interface AccountBookUpdate {
    bank_name?: string;
    account_name?: string;
    account_type?: AccountType;
    currency?: string;
    account_number_last4?: string;
}

export interface AccountBookRead {
    account_id: number;
    bank_name: string;
    account_name: string;
    account_type: AccountType;
    currency: string;
    account_number_last4: string;
    user_id: number;
    created_at: string;
    updated_at: string;
    member_count: number;
}

export interface AccountBookListResponse {
    accounts: AccountBookRead[];
    total: number;
    offset: number;
    limit: number;
}

export interface AccountBookListParams extends PaginatedParams {}

// ── Account Book Members (Tier 5) ───────────────────────────────────

export interface MemberRead {
    id: number;
    account_id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    role: AccountBookRole;
    created_at: string;
}

export interface MemberAdd {
    user_id: number;
}

export interface MemberListResponse {
    members: MemberRead[];
    total: number;
}

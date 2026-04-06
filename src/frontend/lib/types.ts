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

/** Bank statement lifecycle (server-driven archival). */
export type StatementStatus = "active" | "archived";

export type DocumentType = "receipt" | "bank_statement";

export type DocumentStatus =
    | "pending_upload"
    | "pending_processing"
    | "processing"
    | "parsed"
    | "failed";

export type JobStatus =
    | "pending"
    | "processing"
    | "reconciling"
    | "completed"
    | "failed";

export type JobType = "parsing" | "reconciliation";

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
    created_by_user_id?: number | null;
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
    job_id: number | null;
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
    statement_id: number | null;
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
    statement_id?: number;
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
    status: StatementStatus;
    archived_at: string | null;
    created_at: string;
    document_id: number | null;
    file_name: string | null;
    line_count: number;
    matched_count: number;
    unmatched_count: number;
    match_rate: number;
    reconciled: boolean;
}

export interface BankStatementDetailRead extends BankStatementRead {
    lines: BankStatementLineRead[];
}

export interface BankStatementUpdate {
    month?: number;
    year?: number;
    account_number_last4?: string;
    currency?: string;
    total_amount?: number;
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

export interface BankStatementLineCreate {
    transaction_date: string;
    posting_date: string;
    description: string;
    vendor: string;
    charge: number;
    currency?: string;
    mcc?: string;
    reference_number?: string;
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
    /** Months after statement period end before auto-archive (default 18 on server). */
    archive_after_months?: number;
}

export interface AccountBookUpdate {
    bank_name?: string;
    account_name?: string;
    account_type?: AccountType;
    currency?: string;
    account_number_last4?: string;
    archive_after_months?: number;
}

export interface AccountBookRead {
    account_id: number;
    bank_name: string;
    account_name: string;
    account_type: AccountType;
    currency: string;
    account_number_last4: string;
    archive_after_months: number;
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

export interface AccountBookListParams extends PaginatedParams {
    /** Developer only: restrict to tenant books (provisioned users + own books). */
    provisioned_tenant_only?: boolean;
}

export interface AdminUserListParams extends PaginatedParams {
    role?: UserRole;
    is_active?: boolean;
    /** Only users created by the current developer. */
    provisioned_by_me?: boolean;
}

// ── Account Book Members (Tier 5) ───────────────────────────────────

export interface MemberRead {
    id: number;
    account_id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    created_at: string;
}

export interface MemberAdd {
    user_id: number;
}

export interface MemberListResponse {
    members: MemberRead[];
    total: number;
}

// ── Jobs ─────────────────────────────────────────────────────────────

export interface JobStatusDocument {
    document_id: number;
    file_name: string;
    document_type: DocumentType;
    status: DocumentStatus;
}

export interface JobStatusResponse {
    job_id: number;
    status: JobStatus;
    job_type: JobType;
    documents: JobStatusDocument[];
}

// ── Reconciliation (Tier 4) ─────────────────────────────────────────
export interface ReconciliationMatchListResponse {
    matches: ReconciliationMatchRead[];
    total: number;
    offset: number;
    limit: number;
}

export interface ReconciliationMatchRead {
    match_id: number;
    job_id: number | null;
    line_id: number;
    receipt_id: number;
    match_type: MatchStatus;
    matched_at: string;
}

export interface ManualMatchCreate {
    line_id: number;
    receipt_ids: number[];
    match_type?: MatchStatus;
}

export interface ManualMatchCreateResponse {
    created: number;
    match_type: string;
}

export interface DeleteMatchResponse {
    deleted: number;
}

export interface ReconciliationConfig {
    max_date_window: number;
    confidence_threshold: number;
    bundle_vendor_threshold: number;
    max_bundle_size: number;
}

export interface ReconciliationStartRequest {
    account_id: number;
    statement_id: number;
    config?: ReconciliationConfig;
}

export interface ReconciliationSummary {
    total_lines: number;
    matched: number;
    unmatched: number;
    bundle_matched: number;
}

export interface ReconciliationStartResponse {
    job_id: number;
    status: string;
    summary: ReconciliationSummary | null;
}

// ── Reconciliation AI Summary ────────────────────────────────────────

export interface CandidateReceiptDetail {
    receipt_id: number;
    vendor: string;
    charged_amount: string;
    billing_date: string;
    confidence: number;
    rejection_reasons: string[];
}

export interface ReconciliationLineSummaryRead {
    id: number;
    job_id: number;
    line_id: number;
    statement_id: number;
    line_vendor: string;
    line_charge: string;
    line_date: string;
    line_description: string;
    top_candidates: CandidateReceiptDetail[];
    ai_analysis: string;
    created_at: string;
}

export interface ReconciliationAISummaryResponse {
    job_id: number;
    statement_id: number;
    summaries: ReconciliationLineSummaryRead[];
    total: number;
}

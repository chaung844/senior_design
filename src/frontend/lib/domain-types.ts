/**
 * Frontend domain types and formatting utilities.
 *
 * These types represent the view-layer shape used by dashboard components.
 * Real data is fetched via API hooks (hooks/use-accounts.ts, etc.) and
 * transformed into these types by lib/transforms.ts.
 */

// ── Domain types ─────────────────────────────────────────────────────

export type Transaction = {
    id: string;
    date: string;
    description: string;
    reference: string;
    debit: number | null;
    credit: number | null;
    balance: number;
    category: string;
    matched: boolean;
    matchConfidence: number | null;
    matchedWith: string | null;
};

export type MonthData = {
    month: number;
    label: string;
    transactions: Transaction[];
    totalDebit: number;
    totalCredit: number;
    openingBalance: number;
    closingBalance: number;
    matchedCount: number;
    unmatchedCount: number;
    matchRate: number;
    statementCount: number;
    reconciled: boolean;
};

export type YearData = {
    year: number;
    months: MonthData[];
    totalDebit: number;
    totalCredit: number;
    openingBalance: number;
    closingBalance: number;
    overallMatchRate: number;
    totalTransactions: number;
    totalMatched: number;
    totalUnmatched: number;
};

export type AccountBook = {
    id: string;
    name: string;
    bankName: string;
    accountNumber: string;
    currency: string;
    years: YearData[];
    createdAt: string;
    lastUpdated: string;
};

// ── Selection (navigation state) ─────────────────────────────────────

export type SelectionLevel = "account" | "year" | "month";

export type Selection = {
    accountId: string;
    year: number | null;
    month: number | null;
    level: SelectionLevel;
};

// ── Formatting utilities ─────────────────────────────────────────────

export function formatCurrency(
    amount: number,
    currency: string = "USD",
): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatNumber(n: number): string {
    return new Intl.NumberFormat("en-US").format(n);
}

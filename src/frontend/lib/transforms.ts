/**
 * Pure transformation functions that convert API response types
 * (snake_case, flat/relational) into the frontend view types
 * (camelCase, hierarchical) used by dashboard components.
 */

import type {
    AccountBookRead,
    BankStatementRead,
    BankStatementLineRead,
    BankStatementDetailRead,
    MatchStatus,
} from "@/lib/types";
import type {
    AccountBook,
    YearData,
    MonthData,
    Transaction,
} from "@/lib/domain-types";
import { MONTH_LABELS, RECONCILE_THRESHOLD } from "@/lib/constants";

// ── Statement Line → Transaction ─────────────────────────────────────

function isMatchedStatus(status: MatchStatus): boolean {
    return status !== "unmatched";
}

function matchConfidenceFromStatus(status: MatchStatus): number | null {
    switch (status) {
        case "perfect_matched":
            return 100;
        case "bundle_matched":
            return 85;
        case "manual":
            return 100;
        case "unmatched":
            return null;
    }
}

export function lineToTransaction(line: BankStatementLineRead): Transaction {
    const charge = Number(line.charge);
    const isDebit = charge > 0;
    return {
        id: String(line.line_id),
        date: line.transaction_date,
        description: line.description,
        reference: line.reference_number,
        debit: isDebit ? charge : null,
        credit: isDebit ? null : Math.abs(charge),
        balance: 0, // running balance is computed after sorting
        vendor: line.vendor,
        matched: isMatchedStatus(line.match_status),
        matchConfidence: matchConfidenceFromStatus(line.match_status),
        matchedWith: isMatchedStatus(line.match_status)
            ? `match-${line.line_id}`
            : null,
    };
}

// ── Statement Detail → MonthData ─────────────────────────────────────

export function statementToMonthData(
    statement: BankStatementDetailRead,
): MonthData {
    const transactions = (statement.lines ?? []).map(lineToTransaction);

    transactions.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = 0;
    for (const txn of transactions) {
        if (txn.debit) runningBalance -= txn.debit;
        if (txn.credit) runningBalance += txn.credit;
        txn.balance = Math.round(runningBalance * 100) / 100;
    }

    const totalDebit = transactions.reduce((sum, t) => sum + (t.debit ?? 0), 0);
    const totalCredit = transactions.reduce(
        (sum, t) => sum + (t.credit ?? 0),
        0,
    );
    const matchedCount = transactions.filter((t) => t.matched).length;
    const unmatchedCount = transactions.length - matchedCount;
    const matchRate =
        transactions.length > 0
            ? Math.round((matchedCount / transactions.length) * 1000) / 10
            : 0;
    const now = new Date();
    const isInPast =
        new Date(statement.year, statement.month - 1) <
        new Date(now.getFullYear(), now.getMonth());

    const totalAmount = Number(statement.total_amount);
    const closingBalance =
        transactions.length > 0
            ? transactions[transactions.length - 1].balance
            : totalAmount;

    return {
        month: statement.month,
        label: MONTH_LABELS[statement.month - 1] ?? `Month ${statement.month}`,
        transactions,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        openingBalance: 0,
        closingBalance: Math.round(closingBalance * 100) / 100,
        matchedCount,
        unmatchedCount,
        matchRate,
        statementCount: transactions.length,
        reconciled: isInPast && matchRate >= RECONCILE_THRESHOLD,
        isStatementArchived: statement.status === "archived",
    };
}

// ── Statements list → MonthData summary (without full transactions) ──

export function statementSummaryToMonthData(
    stmt: BankStatementRead,
): MonthData {
    const totalAmount = Number(stmt.total_amount);
    // Use backend-computed counts and match_rate directly — they are
    // authoritative since the backend iterates actual line.match_status values.
    const matchedCount = stmt.matched_count ?? 0;
    const unmatchedCount = stmt.unmatched_count ?? stmt.line_count;
    const matchRate =
        stmt.match_rate ??
        (stmt.line_count > 0
            ? Math.round((matchedCount / stmt.line_count) * 1000) / 10
            : 0);
    // Guard future months: a month whose period hasn't closed yet should
    // never appear as fully reconciled in the sidebar / year dashboard.
    const now = new Date();
    const isInPast =
        new Date(stmt.year, stmt.month - 1) <
        new Date(now.getFullYear(), now.getMonth());
    // `stmt.reconciled` is computed by the backend's model_validator using the
    // same RECONCILE_THRESHOLD; we only add the isInPast guard on top.
    const reconciled =
        isInPast && (stmt.reconciled ?? matchRate >= RECONCILE_THRESHOLD);
    return {
        month: stmt.month,
        label: MONTH_LABELS[stmt.month - 1] ?? `Month ${stmt.month}`,
        transactions: [],
        totalDebit: totalAmount > 0 ? totalAmount : 0,
        totalCredit: totalAmount < 0 ? Math.abs(totalAmount) : 0,
        openingBalance: 0,
        closingBalance: totalAmount,
        matchedCount,
        unmatchedCount,
        matchRate,
        statementCount: stmt.line_count,
        reconciled,
        isStatementArchived: stmt.status === "archived",
    };
}

// ── Statements grouped by year → YearData ────────────────────────────

export function statementsToYearData(
    year: number,
    statements: BankStatementRead[],
): YearData {
    const yearStatements = statements
        .filter((s) => s.year === year)
        .sort((a, b) => a.month - b.month);

    const months = yearStatements.map(statementSummaryToMonthData);

    // Propagate opening/closing balances across months
    for (let i = 0; i < months.length; i++) {
        if (i > 0) {
            months[i].openingBalance = months[i - 1].closingBalance;
        }
    }

    const totalDebit = months.reduce((sum, m) => sum + m.totalDebit, 0);
    const totalCredit = months.reduce((sum, m) => sum + m.totalCredit, 0);
    const totalTransactions = months.reduce(
        (sum, m) => sum + m.statementCount,
        0,
    );
    const totalMatched = months.reduce((sum, m) => sum + m.matchedCount, 0);
    const totalUnmatched = months.reduce((sum, m) => sum + m.unmatchedCount, 0);
    const overallMatchRate =
        totalTransactions > 0
            ? Math.round((totalMatched / totalTransactions) * 1000) / 10
            : 0;

    const openingBalance = months.length > 0 ? months[0].openingBalance : 0;

    return {
        year,
        months,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        openingBalance,
        closingBalance:
            months.length > 0 ? months[months.length - 1].closingBalance : 0,
        overallMatchRate,
        totalTransactions,
        totalMatched,
        totalUnmatched,
    };
}

// ── AccountBookRead + statements → AccountBook ───────────────────────

export function apiAccountToAccountBook(
    account: AccountBookRead,
    accountStatements: BankStatementRead[],
): AccountBook {
    const yearSet = new Set(accountStatements.map((s) => s.year));
    const years = Array.from(yearSet)
        .sort((a, b) => a - b)
        .map((year) => statementsToYearData(year, accountStatements));

    return {
        id: String(account.account_id),
        name: account.account_name,
        bankName: account.bank_name,
        accountNumber: `****${account.account_number_last4}`,
        currency: account.currency,
        years,
        createdAt: account.created_at,
        lastUpdated: account.updated_at,
    };
}

// ── Batch convert accounts (pre-groups statements to avoid O(n*m)) ──

export function apiAccountsToAccountBooks(
    accounts: AccountBookRead[],
    statements: BankStatementRead[],
): AccountBook[] {
    const grouped = new Map<number, BankStatementRead[]>();
    for (const s of statements) {
        const list = grouped.get(s.account_id);
        if (list) {
            list.push(s);
        } else {
            grouped.set(s.account_id, [s]);
        }
    }
    return accounts.map((acct) =>
        apiAccountToAccountBook(acct, grouped.get(acct.account_id) ?? []),
    );
}

import type { Selection } from "@/lib/mock-data";

const DASHBOARD_BASE = "/dashboard";

/**
 * Build the dashboard path for a given selection.
 * Examples:
 *   account level  → /dashboard/acc-1
 *   year level     → /dashboard/acc-1/2024
 *   month level    → /dashboard/acc-1/2024/3
 */
export function selectionToPath(selection: Selection): string {
    const { accountId, year, month, level } = selection;
    if (level === "month" && year !== null && month !== null) {
        return `${DASHBOARD_BASE}/${accountId}/${year}/${month}`;
    }
    if (level === "year" && year !== null) {
        return `${DASHBOARD_BASE}/${accountId}/${year}`;
    }
    return `${DASHBOARD_BASE}/${accountId}`;
}

export type ParsedDashboardPath = {
    accountId: string | null;
    year: number | null;
    month: number | null;
};

/**
 * Parse /dashboard/... pathname into accountId, year, and month.
 * Returns nulls for missing or invalid segments.
 */
export function parseDashboardPath(pathname: string): ParsedDashboardPath {
    const prefix = DASHBOARD_BASE;
    if (!pathname.startsWith(prefix)) {
        return { accountId: null, year: null, month: null };
    }
    const rest = pathname.slice(prefix.length).replace(/^\//, "");
    const segments = rest ? rest.split("/") : [];
    const accountId =
        segments.length >= 1 && segments[0] !== "" ? segments[0] : null;
    const yearNum =
        segments.length >= 2 ? parseInt(segments[1], 10) : NaN;
    const year = Number.isNaN(yearNum) ? null : yearNum;
    const monthNum =
        segments.length >= 3 ? parseInt(segments[2], 10) : NaN;
    const month = Number.isNaN(monthNum) ? null : monthNum;
    return { accountId, year, month };
}

/**
 * Build Selection from parsed path (for layout/sidebar).
 * Uses first account as fallback when path is just /dashboard.
 */
export function pathToSelection(
    pathname: string,
    firstAccountId: string,
): Selection {
    const { accountId, year, month } = parseDashboardPath(pathname);
    const accountIdResolved = accountId ?? firstAccountId;
    if (month !== null && year !== null) {
        return {
            accountId: accountIdResolved,
            year,
            month,
            level: "month",
        };
    }
    if (year !== null) {
        return {
            accountId: accountIdResolved,
            year,
            month: null,
            level: "year",
        };
    }
    return {
        accountId: accountIdResolved,
        year: null,
        month: null,
        level: "account",
    };
}

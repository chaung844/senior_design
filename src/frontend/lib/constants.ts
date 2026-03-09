import type { ChartConfig } from "@/components/ui/chart";

/** A month is considered "reconciled" when its match rate meets or exceeds this percentage. */
export const RECONCILE_THRESHOLD = 90;

/** Default fetch limit for list endpoints. Increase or implement cursor pagination when data exceeds this. */
export const DEFAULT_LIST_LIMIT = 100;

export const MONTH_LABELS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export const reconciliationChartConfig = {
    matched: {
        label: "Matched",
        color: "var(--chart-1)",
    },
    unmatched: {
        label: "Unmatched",
        color: "var(--chart-4)",
    },
} satisfies ChartConfig;

export function getMatchRateBadgeVariant(
    rate: number,
): "default" | "secondary" | "destructive" {
    if (rate >= 90) return "default";
    if (rate >= 70) return "secondary";
    return "destructive";
}

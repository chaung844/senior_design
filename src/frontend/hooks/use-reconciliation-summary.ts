"use client";

import { useQuery } from "@tanstack/react-query";
import { getReconciliationAISummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { reconciliationKeys } from "@/hooks/use-reconciliation";

export const reconciliationSummaryKeys = {
    aiSummary: (statementId: number) =>
        [...reconciliationKeys.all, "ai-summary", statementId] as const,
};

/**
 * Fetches the AI-generated reconciliation summary for unmatched lines
 * from the most recent reconciliation run on a given statement.
 *
 * Enabled only when a valid statementId is provided and the user is
 * authenticated. The data is treated as relatively stable (staleTime 30s)
 * since it only changes when a new reconciliation job runs.
 */
export function useReconciliationAISummary(statementId: number | null) {
    const { user } = useAuth();
    return useQuery({
        queryKey: reconciliationSummaryKeys.aiSummary(statementId!),
        queryFn: () => getReconciliationAISummary(statementId!),
        enabled: statementId !== null && !!user,
        staleTime: 30_000,
    });
}

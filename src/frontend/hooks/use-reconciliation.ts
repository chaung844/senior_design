"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { startReconciliation } from "@/lib/api";
import { useJobStatus } from "@/hooks/use-job-status";
import { accountKeys } from "@/hooks/use-accounts";
import { statementKeys } from "@/hooks/use-statements";
import { receiptKeys } from "@/hooks/use-receipts";
import { documentKeys } from "@/hooks/use-documents";
import type { ReconciliationStartResponse } from "@/lib/types";
import { createManualMatch, deleteMatch, listMatchesByLine } from "@/lib/api";
import type { ManualMatchCreate } from "@/lib/types";

// ── Hook ──────────────────────────────────────────────────────────────

/**
 * Mutation hook for starting a reconciliation job.
 *
 * - Calls `POST /reconciliation/start` with `{ account_id, statement_id }`.
 * - Automatically registers the returned `job_id` with the floating
 *   `JobStatusProvider` so the progress widget tracks it.
 * - Invalidates accounts, statements, receipts and documents queries on
 *   success so the dashboard reflects the updated match statuses.
 *
 * Usage:
 * ```ts
 * const { startReconciliation, isPending } = useStartReconciliation();
 * await startReconciliation({ accountId: 1, statementId: 42, label: "Jan 2024" });
 * ```
 */
export function useStartReconciliation() {
    const { trackJob } = useJobStatus();
    const qc = useQueryClient();

    const mutation = useMutation<
        ReconciliationStartResponse,
        Error,
        { accountId: number; statementId: number; label?: string }
    >({
        mutationFn: ({ accountId, statementId }) =>
            startReconciliation({
                account_id: accountId,
                statement_id: statementId,
            }),
        onSuccess: (data, vars) => {
            // Register the job with the floating status widget so it is
            // polled and its progress shown — even though the job is often
            // already terminal (completed/failed) by the time this callback
            // fires, the widget handles that gracefully and shows the final
            // status before auto-dismissing after its linger period.
            const label = vars.label
                ? `Reconciling ${vars.label}`
                : "Reconciliation";
            trackJob(data.job_id, "reconciliation", label);

            // Refresh all related caches so the dashboard reflects the
            // new match statuses immediately.
            qc.invalidateQueries({ queryKey: accountKeys.all });
            qc.invalidateQueries({ queryKey: statementKeys.all });
            qc.invalidateQueries({ queryKey: receiptKeys.all });
            qc.invalidateQueries({ queryKey: documentKeys.all });
        },
    });

    const run = useCallback(
        (params: { accountId: number; statementId: number; label?: string }) =>
            mutation.mutateAsync(params),
        [mutation],
    );

    return {
        /** Trigger the reconciliation run. Returns a promise that resolves with
         *  the backend response or rejects with the API error. */
        startReconciliation: run,
        /** True while the POST request is in-flight. */
        isPending: mutation.isPending,
        /** The error thrown by the last failed run, or null. */
        error: mutation.error,
        /** Reset the mutation state (clears error / data). */
        reset: mutation.reset,
        /** Full TanStack Query mutation object for advanced use. */
        mutation,
    };
}

/**
 * Mutation hook for manually linking a statement line to one or more receipts.
 *
 * On success, invalidates statements, receipts, and accounts so that
 * match statuses refresh across the dashboard immediately.
 *
 * Usage:
 * ```ts
 * const createMatch = useCreateManualMatch(statementId);
 * await createMatch.mutateAsync({ line_id, receipt_ids: [rid] });
 * ```
 */
export function useCreateManualMatch(statementId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: ManualMatchCreate) => createManualMatch(body),
        onSuccess: (_data, vars) => {
            // Invalidate the matches-by-line query so the receipt match
            // pane refreshes immediately (e.g. badge, linked count, button
            // state all reflect the new match).
            qc.invalidateQueries({
                queryKey: reconciliationKeys.matchesByLine(vars.line_id),
            });
            qc.invalidateQueries({
                queryKey: statementKeys.detail(statementId),
            });
            qc.invalidateQueries({
                queryKey: statementKeys.lines(statementId),
            });
            qc.invalidateQueries({ queryKey: statementKeys.all });
            qc.invalidateQueries({ queryKey: receiptKeys.all });
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

/**
 * Mutation hook for removing an existing reconciliation match by its match_id.
 *
 * On success, the backend resets match_status on both the line and receipt to
 * "unmatched" (when no other matches remain). The same query invalidation as
 * useCreateManualMatch is applied so the UI stays in sync.
 *
 * Usage:
 * ```ts
 * const removeMatch = useDeleteMatch(statementId);
 * await removeMatch.mutateAsync(matchId);
 * ```
 */
export function useDeleteMatch(statementId: number, lineId?: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (matchId: number) => deleteMatch(matchId),
        onSuccess: (_data, vars) => {
            if (lineId !== undefined) {
                qc.invalidateQueries({
                    queryKey: reconciliationKeys.matchesByLine(lineId),
                });
            }
            qc.invalidateQueries({
                queryKey: statementKeys.detail(statementId),
            });
            qc.invalidateQueries({
                queryKey: statementKeys.lines(statementId),
            });
            qc.invalidateQueries({ queryKey: statementKeys.all });
            qc.invalidateQueries({ queryKey: receiptKeys.all });
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

// ── Query keys ────────────────────────────────────────────────────────

export const reconciliationKeys = {
    all: ["reconciliation"] as const,
    matchesByLine: (lineId: number) =>
        [...reconciliationKeys.all, "matches", "line", lineId] as const,
};

/**
 * Query hook that returns all existing reconciliation matches for a single
 * statement line.  Used by the statement-line detail dialog to display which
 * receipts are currently linked and to supply match_ids for removal.
 *
 * Usage:
 * ```ts
 * const { data } = useMatchesByLine(lineId);
 * // data.matches → ReconciliationMatchRead[]
 * ```
 */
export function useMatchesByLine(lineId: number | null) {
    return useQuery({
        queryKey: reconciliationKeys.matchesByLine(lineId!),
        queryFn: () => listMatchesByLine(lineId!),
        enabled: lineId !== null,
        staleTime: 0, // always re-fetch when the dialog opens
    });
}

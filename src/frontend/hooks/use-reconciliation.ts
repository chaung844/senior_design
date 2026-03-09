"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { startReconciliation } from "@/lib/api";
import { useJobStatus } from "@/hooks/use-job-status";
import { accountKeys } from "@/hooks/use-accounts";
import { statementKeys } from "@/hooks/use-statements";
import { receiptKeys } from "@/hooks/use-receipts";
import { documentKeys } from "@/hooks/use-documents";
import type { ReconciliationStartResponse } from "@/lib/types";

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
            const label =
                vars.label
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

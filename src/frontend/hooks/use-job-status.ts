"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getJobStatus } from "@/lib/api";
import type { JobStatus, JobStatusResponse, JobType } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { accountKeys } from "@/hooks/use-accounts";
import { statementKeys } from "@/hooks/use-statements";
import { receiptKeys } from "@/hooks/use-receipts";
import { documentKeys } from "@/hooks/use-documents";
import { reconciliationKeys } from "@/hooks/use-reconciliation";

// ── Types ─────────────────────────────────────────────────────────────

export interface TrackedJob {
    jobId: number;
    jobType: JobType;
    status: JobStatus;
    /** Total documents associated with this job (for parsing progress). */
    totalDocuments: number;
    /** Number of documents that have finished parsing (status = "parsed"). */
    parsedDocuments: number;
    /** Human-readable label shown in the UI. */
    label: string;
    /** Timestamp when the job was registered for tracking. */
    addedAt: number;
    /** Full response from the last poll, if available. */
    lastResponse: JobStatusResponse | null;
}

interface JobStatusContextValue {
    /** All jobs currently being tracked (active + recently completed). */
    jobs: TrackedJob[];
    /** Register a new job to be polled. */
    trackJob: (jobId: number, jobType: JobType, label?: string) => void;
    /** Stop tracking a specific job (e.g. user dismisses it). */
    dismissJob: (jobId: number) => void;
    /** Dismiss all completed/failed jobs. */
    dismissCompleted: () => void;
    /** Whether the floating widget should be visible. */
    hasActiveJobs: boolean;
    /** Whether any jobs are currently in a non-terminal state. */
    hasInProgressJobs: boolean;
    /** Whether the panel is expanded by the user. */
    isExpanded: boolean;
    /** Toggle panel expansion. */
    toggleExpanded: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────

const TERMINAL_STATUSES: Set<JobStatus> = new Set(["completed", "failed"]);
const POLL_INTERVAL_MS = 3_000;
const COMPLETED_LINGER_MS = 15_000;
const SESSION_STORAGE_KEY = "matcha_tracked_jobs";

function isTerminal(status: JobStatus): boolean {
    return TERMINAL_STATUSES.has(status);
}

function computeParsedCount(response: JobStatusResponse): number {
    return response.documents.filter((d) => d.status === "parsed").length;
}

// ── sessionStorage persistence helpers ───────────────────────────────

/**
 * Read persisted jobs from sessionStorage. Returns an empty array on any
 * error (SSR, storage unavailable, malformed JSON).
 * Jobs that have already passed their linger window are dropped so they
 * don't flash briefly before the auto-remove effect fires.
 */
function loadPersistedJobs(): TrackedJob[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return [];
        const parsed: TrackedJob[] = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const now = Date.now();
        return parsed.filter((job) => {
            // Always keep in-progress jobs.
            if (!isTerminal(job.status)) return true;
            // Drop terminal jobs whose linger window has already expired.
            return now - job.addedAt < COMPLETED_LINGER_MS;
        });
    } catch {
        return [];
    }
}

/** Persist the current job list to sessionStorage. */
function persistJobs(jobs: TrackedJob[]): void {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify(jobs),
        );
    } catch {
        // Storage quota exceeded or access denied — silently ignore.
    }
}

/** Remove the persisted job list from sessionStorage. */
function clearPersistedJobs(): void {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
        // Silently ignore.
    }
}

// ── Context ───────────────────────────────────────────────────────────

const JobStatusContext = createContext<JobStatusContextValue | null>(null);

export { JobStatusContext };

// ── Provider hook ─────────────────────────────────────────────────────

export function useJobStatusProvider(): JobStatusContextValue {
    const { user } = useAuth();
    const qc = useQueryClient();

    // Initialise from sessionStorage synchronously so the widget is visible
    // immediately on reload without waiting for any effect to fire.
    const [jobs, setJobs] = useState<TrackedJob[]>(() => loadPersistedJobs());
    const [isExpanded, setIsExpanded] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Persist jobs to sessionStorage on every change ────────────────
    useEffect(() => {
        if (jobs.length === 0) {
            clearPersistedJobs();
        } else {
            persistJobs(jobs);
        }
    }, [jobs]);

    // ── Track a new job ───────────────────────────────────────────────
    const trackJob = useCallback(
        (jobId: number, jobType: JobType, label?: string) => {
            setJobs((prev) => {
                if (prev.some((j) => j.jobId === jobId)) return prev;
                const newJob: TrackedJob = {
                    jobId,
                    jobType,
                    status: "pending",
                    totalDocuments: jobType === "parsing" ? 1 : 0,
                    parsedDocuments: 0,
                    label:
                        label ??
                        (jobType === "parsing"
                            ? "Parsing document"
                            : "Reconciliation"),
                    addedAt: Date.now(),
                    lastResponse: null,
                };
                return [...prev, newJob];
            });
            // Auto-expand when a new job is added.
            setIsExpanded(true);
        },
        [],
    );

    // ── Dismiss a single job ──────────────────────────────────────────
    const dismissJob = useCallback((jobId: number) => {
        setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
    }, []);

    // ── Dismiss all completed/failed ──────────────────────────────────
    const dismissCompleted = useCallback(() => {
        setJobs((prev) => prev.filter((j) => !isTerminal(j.status)));
    }, []);

    // ── Toggle expansion ──────────────────────────────────────────────
    const toggleExpanded = useCallback(() => {
        setIsExpanded((prev) => !prev);
    }, []);

    // ── Polling logic ─────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        const activeJobs = jobs.filter((j) => !isTerminal(j.status));
        if (activeJobs.length === 0) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        async function poll() {
            const activeIds = jobs
                .filter((j) => !isTerminal(j.status))
                .map((j) => j.jobId);

            if (activeIds.length === 0) return;

            const results = await Promise.allSettled(
                activeIds.map((id) => getJobStatus(id)),
            );

            const resultByJobId = new Map<number, PromiseSettledResult<JobStatusResponse>>();
            for (let i = 0; i < activeIds.length; i += 1) {
                resultByJobId.set(activeIds[i], results[i]);
            }

            const polledStatuses: Array<{
                jobId: number;
                status: JobStatus | "poll_failed";
            }> = results.map((result, index) => {
                if (result.status === "rejected") {
                    return { jobId: activeIds[index], status: "poll_failed" };
                }
                return {
                    jobId: result.value.job_id,
                    status: result.value.status,
                };
            });

            const anyNewlyCompleted = results.some(
                (result) =>
                    result.status === "fulfilled" &&
                    isTerminal(result.value.status),
            );

            setJobs((prev) =>
                prev.map((job) => {
                    if (isTerminal(job.status)) return job;

                    const result = resultByJobId.get(job.jobId);
                    if (!result) return job;
                    if (result.status === "rejected") {
                        // Polling failed (e.g. 404 — job no longer exists).
                        // Mark as failed rather than leaving it in-progress forever.
                        return { ...job, status: "failed" as JobStatus };
                    }

                    const response = result.value;

                    return {
                        ...job,
                        status: response.status,
                        totalDocuments:
                            response.documents.length || job.totalDocuments,
                        parsedDocuments: computeParsedCount(response),
                        lastResponse: response,
                    };
                }),
            );

            // Invalidate related queries so the dashboard reflects the
            // latest state once jobs finish.
            if (anyNewlyCompleted) {
                qc.invalidateQueries({ queryKey: documentKeys.all });
                qc.invalidateQueries({ queryKey: accountKeys.all });
                qc.invalidateQueries({ queryKey: statementKeys.all });
                qc.invalidateQueries({ queryKey: receiptKeys.all });
                qc.invalidateQueries({ queryKey: reconciliationKeys.all });
            }
        }

        // Poll immediately on mount / when active job set changes, then repeat.
        poll();
        intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
        // Re-create the interval only when the set of active job IDs changes,
        // not on every state update, to avoid runaway effect loops.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        user,
        // Stable key derived from the currently active job IDs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        jobs
            .filter((j) => !isTerminal(j.status))
            .map((j) => j.jobId)
            .join(","),
        qc,
    ]);

    // ── Auto-remove terminal jobs after their linger period ────────────
    useEffect(() => {
        const terminalJobs = jobs.filter((j) => isTerminal(j.status));
        if (terminalJobs.length === 0) return;

        const timer = setTimeout(() => {
            setJobs((prev) => {
                const now = Date.now();
                return prev.filter((j) => {
                    if (!isTerminal(j.status)) return true;
                    return now - j.addedAt < COMPLETED_LINGER_MS;
                });
            });
        }, COMPLETED_LINGER_MS);

        return () => clearTimeout(timer);
    }, [jobs]);

    // ── Derived state ─────────────────────────────────────────────────
    const hasActiveJobs = jobs.length > 0;
    const hasInProgressJobs = jobs.some((j) => !isTerminal(j.status));

    return useMemo(
        () => ({
            jobs,
            trackJob,
            dismissJob,
            dismissCompleted,
            hasActiveJobs,
            hasInProgressJobs,
            isExpanded,
            toggleExpanded,
        }),
        [
            jobs,
            trackJob,
            dismissJob,
            dismissCompleted,
            hasActiveJobs,
            hasInProgressJobs,
            isExpanded,
            toggleExpanded,
        ],
    );
}

// ── Consumer hook ─────────────────────────────────────────────────────

export function useJobStatus(): JobStatusContextValue {
    const ctx = useContext(JobStatusContext);
    if (!ctx) {
        throw new Error("useJobStatus must be used within a JobStatusProvider");
    }
    return ctx;
}

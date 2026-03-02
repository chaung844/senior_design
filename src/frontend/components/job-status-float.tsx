"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useJobStatus, type TrackedJob } from "@/hooks/use-job-status";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Cancel01Icon,
    Tick02Icon,
    Alert02Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    Loading03Icon,
    File01Icon,
    ArrowDataTransferHorizontalIcon,
} from "@hugeicons/core-free-icons";
import type { JobStatus } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────

function statusLabel(status: JobStatus): string {
    switch (status) {
        case "pending":
            return "Pending";
        case "processing":
            return "Processing";
        case "reconciling":
            return "Reconciling";
        case "completed":
            return "Completed";
        case "failed":
            return "Failed";
        default:
            return status;
    }
}

function statusColor(status: JobStatus): string {
    switch (status) {
        case "completed":
            return "text-primary";
        case "failed":
            return "text-destructive";
        case "pending":
            return "text-muted-foreground";
        default:
            return "text-foreground";
    }
}

function badgeVariant(
    status: JobStatus,
): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
        case "completed":
            return "default";
        case "failed":
            return "destructive";
        case "pending":
            return "outline";
        default:
            return "secondary";
    }
}

function isTerminal(status: JobStatus): boolean {
    return status === "completed" || status === "failed";
}

// ── Single Job Row ────────────────────────────────────────────────────

interface JobRowProps {
    job: TrackedJob;
    onDismiss: (jobId: number) => void;
}

function JobRow({ job, onDismiss }: JobRowProps) {
    const isParsing = job.jobType === "parsing";
    const isReconciliation = job.jobType === "reconciliation";
    const terminal = isTerminal(job.status);
    const inProgress = !terminal;

    // Progress percentage for parsing jobs
    const progressPercent =
        isParsing && job.totalDocuments > 0
            ? Math.round((job.parsedDocuments / job.totalDocuments) * 100)
            : null;

    // For reconciliation, show status-based progress
    const reconProgressPercent = isReconciliation
        ? job.status === "completed"
            ? 100
            : job.status === "reconciling" || job.status === "processing"
              ? 50
              : job.status === "pending"
                ? 10
                : 0
        : null;

    const displayPercent = progressPercent ?? reconProgressPercent;

    return (
        <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-border last:border-b-0">
            <div className="flex items-center gap-2">
                {/* Icon */}
                <div
                    className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full",
                        terminal
                            ? job.status === "completed"
                                ? "bg-primary/10"
                                : "bg-destructive/10"
                            : "bg-muted",
                    )}
                >
                    {isParsing && (
                        <HugeiconsIcon
                            icon={File01Icon}
                            strokeWidth={2}
                            className={cn("size-3", statusColor(job.status))}
                        />
                    )}
                    {isReconciliation && (
                        <HugeiconsIcon
                            icon={ArrowDataTransferHorizontalIcon}
                            strokeWidth={2}
                            className={cn("size-3", statusColor(job.status))}
                        />
                    )}
                </div>

                {/* Label + status */}
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">
                        {job.label}
                    </p>
                </div>

                {/* Status badge */}
                <Badge
                    variant={badgeVariant(job.status)}
                    className="text-[9px] h-4 px-1.5 shrink-0"
                >
                    {job.status === "completed" && (
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            strokeWidth={2.5}
                            className="size-2.5"
                        />
                    )}
                    {job.status === "failed" && (
                        <HugeiconsIcon
                            icon={Alert02Icon}
                            strokeWidth={2}
                            className="size-2.5"
                        />
                    )}
                    {inProgress && (
                        <span
                            className="size-2.5 shrink-0 border-[1.5px] border-current border-t-transparent rounded-full animate-spin"
                            aria-hidden
                        />
                    )}
                    {statusLabel(job.status)}
                </Badge>

                {/* Dismiss button (only for terminal jobs) */}
                {terminal && (
                    <button
                        type="button"
                        onClick={() => onDismiss(job.jobId)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        aria-label="Dismiss"
                    >
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            strokeWidth={2}
                            className="size-3"
                        />
                    </button>
                )}
            </div>

            {/* Progress info */}
            <div className="flex items-center gap-2">
                {isParsing && (
                    <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                        {job.parsedDocuments}/{job.totalDocuments} parsed
                    </span>
                )}
                {isReconciliation && inProgress && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        {job.status === "reconciling"
                            ? "Matching transactions…"
                            : "Preparing…"}
                    </span>
                )}
                {isReconciliation && job.status === "completed" && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        Matching complete
                    </span>
                )}
                {displayPercent !== null && (
                    <div className="flex-1">
                        <Progress value={displayPercent} className="h-1" />
                    </div>
                )}
                {displayPercent !== null && (
                    <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 w-7 text-right">
                        {displayPercent}%
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Summary Bar (collapsed state) ─────────────────────────────────────

interface SummaryBarProps {
    jobs: TrackedJob[];
}

function SummaryBar({ jobs }: SummaryBarProps) {
    const inProgress = jobs.filter((j) => !isTerminal(j.status));
    const completed = jobs.filter((j) => j.status === "completed");
    const failed = jobs.filter((j) => j.status === "failed");

    const parsingJobs = inProgress.filter((j) => j.jobType === "parsing");
    const reconJobs = inProgress.filter((j) => j.jobType === "reconciliation");

    const parts: string[] = [];

    if (parsingJobs.length > 0) {
        // Include completed parsing jobs in the totals so that as individual
        // documents finish and their job moves to "completed", the denominator
        // and numerator stay consistent (e.g. "Parsing 1/12 · 1 done" instead
        // of "Parsing 0/11 · 1 done").
        const allParsingJobs = jobs.filter((j) => j.jobType === "parsing");
        const totalDocs = allParsingJobs.reduce(
            (sum, j) => sum + j.totalDocuments,
            0,
        );
        const parsedDocs = allParsingJobs.reduce(
            (sum, j) => sum + j.parsedDocuments,
            0,
        );
        parts.push(`Parsing ${parsedDocs}/${totalDocs}`);
    }

    if (reconJobs.length > 0) {
        parts.push(
            `${reconJobs.length} reconciliation${reconJobs.length > 1 ? "s" : ""}`,
        );
    }

    if (completed.length > 0) {
        parts.push(`${completed.length} done`);
    }

    if (failed.length > 0) {
        parts.push(`${failed.length} failed`);
    }

    return (
        <div className="flex items-center gap-2 text-[11px]">
            {inProgress.length > 0 && (
                <span
                    className="size-3 shrink-0 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin"
                    aria-hidden
                />
            )}
            {inProgress.length === 0 && completed.length > 0 && (
                <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2.5}
                    className="size-3 text-primary shrink-0"
                />
            )}
            {inProgress.length === 0 &&
                completed.length === 0 &&
                failed.length > 0 && (
                    <HugeiconsIcon
                        icon={Alert02Icon}
                        strokeWidth={2}
                        className="size-3 text-destructive shrink-0"
                    />
                )}
            <span className="text-foreground font-medium truncate">
                {parts.join(" · ") || "No active jobs"}
            </span>
        </div>
    );
}

// ── Main Floating Widget ──────────────────────────────────────────────

export function JobStatusFloat() {
    const {
        jobs,
        dismissJob,
        dismissCompleted,
        hasActiveJobs,
        hasInProgressJobs,
        isExpanded,
        toggleExpanded,
    } = useJobStatus();

    if (!hasActiveJobs) return null;

    const completedCount = jobs.filter((j) => isTerminal(j.status)).length;

    return (
        <div
            className={cn(
                "fixed bottom-4 right-4 z-50 w-80 overflow-hidden",
                "border border-border bg-card text-card-foreground shadow-lg",
                "transition-all duration-200 ease-in-out",
            )}
        >
            {/* Header bar — always visible */}
            <button
                type="button"
                onClick={toggleExpanded}
                className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2",
                    "bg-muted/50 hover:bg-muted transition-colors",
                    "border-b border-border",
                    "cursor-pointer select-none",
                )}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className={cn(
                            "size-3.5 shrink-0 text-primary",
                            hasInProgressJobs && "animate-spin",
                        )}
                    />
                    <span className="text-xs font-medium truncate">
                        Jobs{" "}
                        <span className="text-muted-foreground font-normal">
                            ({jobs.length})
                        </span>
                    </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {completedCount > 0 && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                dismissCompleted();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    dismissCompleted();
                                }
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
                        >
                            Clear
                        </span>
                    )}
                    <HugeiconsIcon
                        icon={isExpanded ? ArrowDown01Icon : ArrowUp01Icon}
                        strokeWidth={2}
                        className="size-3.5 text-muted-foreground"
                    />
                </div>
            </button>

            {/* Collapsed summary */}
            {!isExpanded && (
                <div className="px-3 py-2">
                    <SummaryBar jobs={jobs} />
                </div>
            )}

            {/* Expanded job list */}
            {isExpanded && (
                <div className="max-h-64 overflow-y-auto">
                    {jobs.length === 0 ? (
                        <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                            No active jobs
                        </div>
                    ) : (
                        jobs.map((job) => (
                            <JobRow
                                key={job.jobId}
                                job={job}
                                onDismiss={dismissJob}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

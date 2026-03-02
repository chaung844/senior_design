"use client";

import { useCallback, useMemo } from "react";
import { useDocumentUpload } from "@/hooks/use-document-upload";
import { useJobStatus } from "@/hooks/use-job-status";
import type { DocumentType } from "@/lib/types";
import type { UploadFileResult } from "@/hooks/use-document-upload";

/**
 * A thin wrapper around `useDocumentUpload` that automatically registers
 * every parsing job returned by the confirm-upload endpoint with the
 * floating job-status tracker.
 *
 * Drop-in replacement for `useDocumentUpload` — same API surface, same
 * return shape. The only difference is that successful uploads whose
 * confirm response includes a `job_id` are automatically tracked in the
 * `JobStatusProvider` so the floating widget can poll their progress.
 *
 * Usage:
 * ```ts
 * const { uploadFiles, isUploading, results, reset } =
 *     useTrackedDocumentUpload("bank_statement", accountId);
 * ```
 */
export function useTrackedDocumentUpload(
    documentType: DocumentType,
    accountId?: number,
    statementId?: number,
) {
    const { trackJob } = useJobStatus();

    const onJobCreated = useCallback(
        (jobId: number, fileName: string) => {
            trackJob(jobId, "parsing", `Parsing ${fileName}`);
        },
        [trackJob],
    );

    const options = useMemo(() => ({ onJobCreated }), [onJobCreated]);

    const { uploadFiles, isUploading, results, reset } = useDocumentUpload(
        documentType,
        accountId,
        statementId,
        options,
    );

    return { uploadFiles, isUploading, results, reset } as {
        uploadFiles: (files: File[]) => Promise<UploadFileResult[]>;
        isUploading: boolean;
        results: UploadFileResult[];
        reset: () => void;
    };
}

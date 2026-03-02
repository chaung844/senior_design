"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { DocumentType } from "@/lib/types";
import { accountKeys } from "@/hooks/use-accounts";
import { statementKeys } from "@/hooks/use-statements";
import { receiptKeys } from "@/hooks/use-receipts";
import { documentKeys } from "@/hooks/use-documents";

export type UploadFileStatus =
    | "pending"
    | "uploading"
    | "confirming"
    | "done"
    | "error";

export interface UploadFileResult {
    file: File;
    status: UploadFileStatus;
    error?: string;
    /** The job_id returned by the confirm-upload endpoint, if any. */
    jobId?: number;
}

export interface UseDocumentUploadOptions {
    /** Called for each file after confirm-upload succeeds, with the job_id created by the backend. */
    onJobCreated?: (jobId: number, fileName: string) => void;
}

export function useDocumentUpload(
    documentType: DocumentType,
    accountId?: number,
    statementId?: number,
    options?: UseDocumentUploadOptions,
) {
    const qc = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [results, setResults] = useState<UploadFileResult[]>([]);

    const reset = useCallback(() => {
        setResults([]);
    }, []);

    const uploadFiles = useCallback(
        async (files: File[]): Promise<UploadFileResult[]> => {
            setIsUploading(true);
            const initial: UploadFileResult[] = files.map((file) => ({
                file,
                status: "pending" as const,
            }));
            setResults(initial);

            const outcome: UploadFileResult[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileType = file.type || "application/octet-stream";

                const setStatus = (
                    status: UploadFileStatus,
                    error?: string,
                    jobId?: number,
                ) => {
                    setResults((prev) => {
                        const next = [...prev];
                        next[i] = { file, status, error, jobId };
                        return next;
                    });
                };

                try {
                    setStatus("uploading");
                    const { upload_url, document_id } =
                        await apiClient.requestUploadUrl({
                            file_name: file.name,
                            file_type: fileType,
                            document_type: documentType,
                            account_id: accountId,
                        });

                    await apiClient.uploadFileToS3(upload_url, file);

                    setStatus("confirming");
                    const confirmResult = await apiClient.confirmUpload(
                        document_id,
                        statementId,
                    );

                    const jobId = confirmResult.job_id ?? undefined;

                    setStatus("done", undefined, jobId);
                    outcome.push({ file, status: "done", jobId });

                    // Notify the caller so it can register the job for
                    // status tracking (e.g. in the floating job widget).
                    if (jobId !== undefined && options?.onJobCreated) {
                        options.onJobCreated(jobId, file.name);
                    }
                } catch (err) {
                    const message =
                        err instanceof Error ? err.message : "Upload failed";
                    setStatus("error", message);
                    outcome.push({ file, status: "error", error: message });
                }
            }

            setIsUploading(false);

            qc.invalidateQueries({ queryKey: documentKeys.all });
            qc.invalidateQueries({ queryKey: accountKeys.all });
            qc.invalidateQueries({ queryKey: statementKeys.all });
            qc.invalidateQueries({ queryKey: receiptKeys.all });

            return outcome;
        },
        [documentType, accountId, statementId, qc, options],
    );

    return { uploadFiles, isUploading, results, reset };
}

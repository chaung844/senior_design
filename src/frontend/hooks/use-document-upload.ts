"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { DocumentType } from "@/lib/types";
import { useAuth } from "@/lib/auth";
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
}

export function useDocumentUpload(
    documentType: DocumentType,
    accountId?: number,
) {
    const { token } = useAuth();
    const qc = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [results, setResults] = useState<UploadFileResult[]>([]);

    const reset = useCallback(() => {
        setResults([]);
    }, []);

    const uploadFiles = useCallback(
        async (files: File[]): Promise<UploadFileResult[]> => {
            if (!token) {
                const err = new Error("Not authenticated");
                const errorResults: UploadFileResult[] = files.map((file) => ({
                    file,
                    status: "error" as const,
                    error: err.message,
                }));
                setResults(errorResults);
                return errorResults;
            }

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
                ) => {
                    setResults((prev) => {
                        const next = [...prev];
                        next[i] = { file, status, error };
                        return next;
                    });
                };

                try {
                    setStatus("uploading");
                    const { upload_url, document_id } =
                        await apiClient.requestUploadUrl(token, {
                            file_name: file.name,
                            file_type: fileType,
                            document_type: documentType,
                            account_id: accountId,
                        });

                    await apiClient.uploadFileToS3(upload_url, file);

                    setStatus("confirming");
                    await apiClient.confirmUpload(token, document_id);

                    setStatus("done");
                    outcome.push({ file, status: "done" });
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
        [token, documentType, accountId, qc],
    );

    return { uploadFiles, isUploading, results, reset };
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDocuments, getDocument, deleteDocument } from "@/lib/api";
import type { DocumentListParams } from "@/lib/types";
import { accountKeys } from "@/hooks/use-accounts";
import { statementKeys } from "@/hooks/use-statements";
import { receiptKeys } from "@/hooks/use-receipts";

export const documentKeys = {
    all: ["documents"] as const,
    list: (params?: DocumentListParams) =>
        [...documentKeys.all, "list", params] as const,
    detail: (id: number) => [...documentKeys.all, "detail", id] as const,
};

export function useDocuments(params: DocumentListParams = {}) {
    return useQuery({
        queryKey: documentKeys.list(params),
        queryFn: () => listDocuments(params),
    });
}

export function useDocument(documentId: number | null) {
    return useQuery({
        queryKey: documentKeys.detail(documentId!),
        queryFn: () => getDocument(documentId!),
        enabled: documentId !== null,
    });
}

export function useDeleteDocument() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (documentId: number) => deleteDocument(documentId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: documentKeys.all });
            qc.invalidateQueries({ queryKey: accountKeys.all });
            qc.invalidateQueries({ queryKey: statementKeys.all });
            qc.invalidateQueries({ queryKey: receiptKeys.all });
        },
    });
}

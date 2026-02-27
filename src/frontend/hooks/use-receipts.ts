"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, ensureToken } from "@/lib/auth";
import {
    listReceipts,
    getReceipt,
    updateReceipt,
    getReceiptFileUrl,
} from "@/lib/api";
import type { ReceiptListParams, ReceiptUpdate } from "@/lib/types";
import { accountKeys } from "@/hooks/use-accounts";

export const receiptKeys = {
    all: ["receipts"] as const,
    list: (params?: ReceiptListParams) =>
        [...receiptKeys.all, "list", params] as const,
    detail: (id: number) => [...receiptKeys.all, "detail", id] as const,
    fileUrl: (id: number) => [...receiptKeys.all, "file-url", id] as const,
};

export function useReceipts(params: ReceiptListParams = {}) {
    const { token } = useAuth();
    return useQuery({
        queryKey: receiptKeys.list(params),
        queryFn: () => listReceipts(ensureToken(token), params),
        enabled: !!token,
    });
}

export function useReceipt(receiptId: number | null) {
    const { token } = useAuth();
    return useQuery({
        queryKey: receiptKeys.detail(receiptId!),
        queryFn: () => getReceipt(ensureToken(token), receiptId!),
        enabled: !!token && receiptId !== null,
    });
}

export function useUpdateReceipt() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            receiptId,
            body,
        }: {
            receiptId: number;
            body: ReceiptUpdate;
        }) => updateReceipt(ensureToken(token), receiptId, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: receiptKeys.all });
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

export function useReceiptFileUrl(receiptId: number | null) {
    const { token } = useAuth();
    return useQuery({
        queryKey: receiptKeys.fileUrl(receiptId!),
        queryFn: () => getReceiptFileUrl(ensureToken(token), receiptId!),
        enabled: !!token && receiptId !== null,
        staleTime: 55 * 60 * 1000,
    });
}

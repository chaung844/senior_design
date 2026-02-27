"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listStatements,
    getStatement,
    listStatementLines,
    updateStatementLine,
    getStatementFileUrl,
} from "@/lib/api";
import type {
    BankStatementListParams,
    BankStatementLineListParams,
    BankStatementLineUpdate,
} from "@/lib/types";
import { accountKeys } from "@/hooks/use-accounts";
import { DEFAULT_LIST_LIMIT } from "@/lib/constants";

export const statementKeys = {
    all: ["statements"] as const,
    list: (accountId?: number) =>
        [...statementKeys.all, "list", accountId] as const,
    detail: (id: number) => [...statementKeys.all, "detail", id] as const,
    lines: (statementId: number, params?: BankStatementLineListParams) =>
        [...statementKeys.all, "lines", statementId, params] as const,
    fileUrl: (id: number) => [...statementKeys.all, "file-url", id] as const,
};

export function useStatements(accountId?: number) {
    return useQuery({
        queryKey: statementKeys.list(accountId),
        queryFn: () =>
            listStatements({
                account_id: accountId,
                limit: DEFAULT_LIST_LIMIT,
            }),
    });
}

export function useStatement(statementId: number | null) {
    return useQuery({
        queryKey: statementKeys.detail(statementId!),
        queryFn: () => getStatement(statementId!),
        enabled: statementId !== null,
    });
}

export function useStatementLines(
    statementId: number | null,
    params: BankStatementLineListParams = {},
) {
    return useQuery({
        queryKey: statementKeys.lines(statementId!, params),
        queryFn: () => listStatementLines(statementId!, params),
        enabled: statementId !== null,
    });
}

export function useUpdateStatementLine() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            statementId,
            lineId,
            body,
        }: {
            statementId: number;
            lineId: number;
            body: BankStatementLineUpdate;
        }) => updateStatementLine(statementId, lineId, body),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({
                queryKey: statementKeys.detail(vars.statementId),
            });
            qc.invalidateQueries({
                queryKey: statementKeys.lines(vars.statementId),
            });
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

export function useStatementFileUrl(statementId: number | null) {
    return useQuery({
        queryKey: statementKeys.fileUrl(statementId!),
        queryFn: () => getStatementFileUrl(statementId!),
        enabled: statementId !== null,
        staleTime: 55 * 60 * 1000, // presigned URL valid ~1hr
    });
}

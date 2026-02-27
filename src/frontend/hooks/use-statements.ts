"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, ensureToken } from "@/lib/auth";
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
    const { token } = useAuth();
    return useQuery({
        queryKey: statementKeys.list(accountId),
        queryFn: () =>
            listStatements(ensureToken(token), {
                account_id: accountId,
                limit: DEFAULT_LIST_LIMIT,
            }),
        enabled: !!token,
    });
}

export function useStatement(statementId: number | null) {
    const { token } = useAuth();
    return useQuery({
        queryKey: statementKeys.detail(statementId!),
        queryFn: () => getStatement(ensureToken(token), statementId!),
        enabled: !!token && statementId !== null,
    });
}

export function useStatementLines(
    statementId: number | null,
    params: BankStatementLineListParams = {},
) {
    const { token } = useAuth();
    return useQuery({
        queryKey: statementKeys.lines(statementId!, params),
        queryFn: () => listStatementLines(ensureToken(token), statementId!, params),
        enabled: !!token && statementId !== null,
    });
}

export function useUpdateStatementLine() {
    const { token } = useAuth();
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
        }) => updateStatementLine(ensureToken(token), statementId, lineId, body),
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
    const { token } = useAuth();
    return useQuery({
        queryKey: statementKeys.fileUrl(statementId!),
        queryFn: () => getStatementFileUrl(ensureToken(token), statementId!),
        enabled: !!token && statementId !== null,
        staleTime: 55 * 60 * 1000, // presigned URL valid ~1hr
    });
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
    listAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    listStatements,
} from "@/lib/api";
import type { AccountBookCreate, AccountBookUpdate } from "@/lib/types";
import {
    apiAccountToAccountBook,
    apiAccountsToAccountBooks,
} from "@/lib/transforms";
import { DEFAULT_LIST_LIMIT } from "@/lib/constants";

export const accountKeys = {
    all: ["accounts"] as const,
    list: () => [...accountKeys.all, "list"] as const,
    detail: (id: number) => [...accountKeys.all, "detail", id] as const,
    withStatements: () => [...accountKeys.all, "with-statements"] as const,
};

export function useAccounts() {
    const { user } = useAuth();
    return useQuery({
        queryKey: accountKeys.list(),
        queryFn: () => listAccounts({ limit: DEFAULT_LIST_LIMIT }),
        enabled: !!user,
    });
}

export function useAccount(accountId: number | null) {
    const { user } = useAuth();
    return useQuery({
        queryKey: accountKeys.detail(accountId!),
        queryFn: () => getAccount(accountId!),
        enabled: !!user && accountId !== null,
    });
}

/**
 * Fetches all accounts with their statements, then transforms into
 * the frontend AccountBook[] shape used by sidebar and dashboard.
 */
export function useAccountBooks() {
    const { user } = useAuth();
    return useQuery({
        queryKey: accountKeys.withStatements(),
        queryFn: async () => {
            const [accountsRes, statementsRes] = await Promise.all([
                listAccounts({ limit: DEFAULT_LIST_LIMIT }),
                listStatements({ limit: DEFAULT_LIST_LIMIT }),
            ]);
            return apiAccountsToAccountBooks(
                accountsRes.accounts,
                statementsRes.statements,
            );
        },
        enabled: !!user,
    });
}

/**
 * Fetches a single account with its statements and transforms into
 * the frontend AccountBook shape.
 */
export function useAccountBook(accountId: number | null) {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...accountKeys.detail(accountId!), "book"],
        queryFn: async () => {
            const [account, statementsRes] = await Promise.all([
                getAccount(accountId!),
                listStatements({
                    account_id: accountId!,
                    limit: DEFAULT_LIST_LIMIT,
                }),
            ]);
            return apiAccountToAccountBook(account, statementsRes.statements);
        },
        enabled: !!user && accountId !== null,
    });
}

export function useCreateAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AccountBookCreate) => createAccount(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

export function useUpdateAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            accountId,
            body,
        }: {
            accountId: number;
            body: AccountBookUpdate;
        }) => updateAccount(accountId, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

export function useDeleteAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (accountId: number) => deleteAccount(accountId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

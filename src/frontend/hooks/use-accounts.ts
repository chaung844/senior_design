"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, ensureToken } from "@/lib/auth";
import {
    listAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    listStatements,
} from "@/lib/api";
import type {
    AccountBookCreate,
    AccountBookUpdate,
    AccountBookRead,
    BankStatementRead,
} from "@/lib/types";
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
    const { token } = useAuth();
    return useQuery({
        queryKey: accountKeys.list(),
        queryFn: () => listAccounts(ensureToken(token), { limit: DEFAULT_LIST_LIMIT }),
        enabled: !!token,
    });
}

export function useAccount(accountId: number | null) {
    const { token } = useAuth();
    return useQuery({
        queryKey: accountKeys.detail(accountId!),
        queryFn: () => getAccount(ensureToken(token), accountId!),
        enabled: !!token && accountId !== null,
    });
}

/**
 * Fetches all accounts with their statements, then transforms into
 * the frontend AccountBook[] shape used by sidebar and dashboard.
 */
export function useAccountBooks() {
    const { token } = useAuth();
    return useQuery({
        queryKey: accountKeys.withStatements(),
        queryFn: async () => {
            const [accountsRes, statementsRes] = await Promise.all([
                listAccounts(ensureToken(token), { limit: DEFAULT_LIST_LIMIT }),
                listStatements(ensureToken(token), { limit: DEFAULT_LIST_LIMIT }),
            ]);
            return apiAccountsToAccountBooks(
                accountsRes.accounts,
                statementsRes.statements,
            );
        },
        enabled: !!token,
    });
}

/**
 * Fetches a single account with its statements and transforms into
 * the frontend AccountBook shape.
 */
export function useAccountBook(accountId: number | null) {
    const { token } = useAuth();
    return useQuery({
        queryKey: [...accountKeys.detail(accountId!), "book"],
        queryFn: async () => {
            const [account, statementsRes] = await Promise.all([
                getAccount(ensureToken(token), accountId!),
                listStatements(ensureToken(token), {
                    account_id: accountId!,
                    limit: DEFAULT_LIST_LIMIT,
                }),
            ]);
            return apiAccountToAccountBook(account, statementsRes.statements);
        },
        enabled: !!token && accountId !== null,
    });
}

export function useCreateAccount() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AccountBookCreate) => createAccount(ensureToken(token), body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

export function useUpdateAccount() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            accountId,
            body,
        }: {
            accountId: number;
            body: AccountBookUpdate;
        }) => updateAccount(ensureToken(token), accountId, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

export function useDeleteAccount() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (accountId: number) => deleteAccount(ensureToken(token), accountId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: accountKeys.all });
        },
    });
}

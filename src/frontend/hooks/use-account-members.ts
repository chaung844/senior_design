"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, ensureToken } from "@/lib/auth";
import {
    listAccountMembers,
    addAccountMember,
    removeAccountMember,
} from "@/lib/api";
import type { MemberAdd } from "@/lib/types";

export const memberKeys = {
    all: ["account-members"] as const,
    list: (accountId: number) =>
        [...memberKeys.all, "list", accountId] as const,
};

export function useAccountMembers(accountId: number | null) {
    const { token } = useAuth();
    return useQuery({
        queryKey: memberKeys.list(accountId!),
        queryFn: () => listAccountMembers(ensureToken(token), accountId!),
        enabled: !!token && accountId !== null,
    });
}

export function useAddAccountMember() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            accountId,
            body,
        }: {
            accountId: number;
            body: MemberAdd;
        }) => addAccountMember(ensureToken(token), accountId, body),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({
                queryKey: memberKeys.list(vars.accountId),
            });
        },
    });
}

export function useRemoveAccountMember() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            accountId,
            userId,
        }: {
            accountId: number;
            userId: number;
        }) => removeAccountMember(ensureToken(token), accountId, userId),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({
                queryKey: memberKeys.list(vars.accountId),
            });
        },
    });
}

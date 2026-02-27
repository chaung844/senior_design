"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, ensureToken } from "@/lib/auth";
import {
    listAdminUsers,
    createAdminUser,
    getAdminUser,
    updateAdminUser,
    deactivateAdminUser,
} from "@/lib/api";
import type { UserCreate, UserUpdate, UserRole } from "@/lib/types";

export const adminUserKeys = {
    all: ["admin-users"] as const,
    list: (params?: { role?: UserRole; is_active?: boolean }) =>
        [...adminUserKeys.all, "list", params] as const,
    detail: (id: number) => [...adminUserKeys.all, "detail", id] as const,
};

export function useAdminUsers(
    params: { role?: UserRole; is_active?: boolean } = {},
) {
    const { token } = useAuth();
    return useQuery({
        queryKey: adminUserKeys.list(params),
        queryFn: () => listAdminUsers(ensureToken(token), params),
        enabled: !!token,
    });
}

export function useAdminUser(userId: number | null) {
    const { token } = useAuth();
    return useQuery({
        queryKey: adminUserKeys.detail(userId!),
        queryFn: () => getAdminUser(ensureToken(token), userId!),
        enabled: !!token && userId !== null,
    });
}

export function useCreateAdminUser() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UserCreate) => createAdminUser(ensureToken(token), body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminUserKeys.all });
        },
    });
}

export function useUpdateAdminUser() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            userId,
            body,
        }: {
            userId: number;
            body: UserUpdate;
        }) => updateAdminUser(ensureToken(token), userId, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminUserKeys.all });
        },
    });
}

export function useDeactivateAdminUser() {
    const { token } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId: number) => deactivateAdminUser(ensureToken(token), userId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminUserKeys.all });
        },
    });
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listAdminUsers,
    createAdminUser,
    getAdminUser,
    updateAdminUser,
    deactivateAdminUser,
} from "@/lib/api";
import type { AdminUserListParams, UserCreate, UserUpdate } from "@/lib/types";

export const adminUserKeys = {
    all: ["admin-users"] as const,
    list: (params?: AdminUserListParams) =>
        [...adminUserKeys.all, "list", params] as const,
    detail: (id: number) => [...adminUserKeys.all, "detail", id] as const,
};

export function useAdminUsers(params: AdminUserListParams = {}) {
    return useQuery({
        queryKey: adminUserKeys.list(params),
        queryFn: () => listAdminUsers(params),
    });
}

export function useAdminUser(userId: number | null) {
    return useQuery({
        queryKey: adminUserKeys.detail(userId!),
        queryFn: () => getAdminUser(userId!),
        enabled: userId !== null,
    });
}

export function useCreateAdminUser() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UserCreate) => createAdminUser(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminUserKeys.all });
        },
    });
}

export function useUpdateAdminUser() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, body }: { userId: number; body: UserUpdate }) =>
            updateAdminUser(userId, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminUserKeys.all });
        },
    });
}

export function useDeactivateAdminUser() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId: number) => deactivateAdminUser(userId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminUserKeys.all });
        },
    });
}

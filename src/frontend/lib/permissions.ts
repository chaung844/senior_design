import type { UserRead } from "@/lib/types";

/** True when the signed-in user has the application viewer (read-only) role. */
export function isViewerRole(user: UserRead | null | undefined): boolean {
    return user?.role === "viewer";
}

/** True when the user may mutate domain data (not a read-only viewer). */
export function canMutateData(user: UserRead | null | undefined): boolean {
    return !!user && user.role !== "viewer";
}

/** Matches backend POST /accounts — admin and developer only. */
export function canCreateAccountBook(user: UserRead | null | undefined): boolean {
    return user?.role === "admin" || user?.role === "developer";
}

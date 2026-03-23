"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { JobStatusFloat } from "@/components/job-status-float";
import { JobStatusProvider } from "@/lib/job-status-provider";
import { DeveloperConsoleShell } from "@/components/developer-console-shell";
import { useAuth } from "@/lib/auth";
import { pathToSelection, selectionToPath } from "@/lib/dashboard-routes";
import { accountKeys, useAccountBooks } from "@/hooks/use-accounts";
import { listAccounts } from "@/lib/api";
import { MONTH_LABELS } from "@/lib/constants";
import {
    canCreateAccountBook,
    isDeveloperRole,
    isViewerRole,
} from "@/lib/permissions";
import { ViewerModeBanner } from "@/components/viewer-mode-banner";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const isGlobalAdminRoute = pathname.startsWith("/dashboard/global-admin");

    const { data: accountBooks, isLoading: accountsLoading } = useAccountBooks(
        { enabled: !!user && !isGlobalAdminRoute },
    );

    const { data: peekAccounts } = useQuery({
        queryKey: [...accountKeys.list(), "peek-first"] as const,
        queryFn: () => listAccounts({ limit: 1 }),
        enabled: !!user && isGlobalAdminRoute,
    });

    const firstAccountId = accountBooks?.[0]?.id ?? "";
    const reconciliationHref =
        peekAccounts?.accounts[0]?.account_id != null
            ? `/dashboard/${peekAccounts.accounts[0].account_id}`
            : "/dashboard";

    const selection = React.useMemo(
        () => pathToSelection(pathname, firstAccountId),
        [pathname, firstAccountId],
    );

    const handleSelectionChange = React.useCallback(
        (newSelection: Parameters<typeof selectionToPath>[0]) => {
            router.push(selectionToPath(newSelection));
        },
        [router],
    );

    React.useEffect(() => {
        if (!authLoading && !accountsLoading && !user) {
            router.replace("/auth/login");
        }
    }, [authLoading, accountsLoading, user, router]);

    React.useEffect(() => {
        if (
            !authLoading &&
            user &&
            isGlobalAdminRoute &&
            !isDeveloperRole(user)
        ) {
            router.replace("/dashboard");
        }
    }, [authLoading, user, isGlobalAdminRoute, router]);

    const waitAccounts = !isGlobalAdminRoute && accountsLoading;

    if (authLoading || waitAccounts) {
        return (
            <div className="flex h-dvh items-center justify-center">
                <Skeleton className="h-8 w-48" />
            </div>
        );
    }
    if (!user) {
        return null;
    }

    if (isGlobalAdminRoute) {
        if (!isDeveloperRole(user)) {
            return (
                <div className="flex h-dvh items-center justify-center">
                    <Skeleton className="h-8 w-48" />
                </div>
            );
        }
        return (
            <TooltipProvider>
                <JobStatusProvider>
                    <DeveloperConsoleShell reconciliationHref={reconciliationHref}>
                        <main className="p-6">
                            <ErrorBoundary>{children}</ErrorBoundary>
                        </main>
                    </DeveloperConsoleShell>
                </JobStatusProvider>
            </TooltipProvider>
        );
    }

    const account = accountBooks?.find((a) => a.id === selection.accountId);

    const handleBackToAccount = () => {
        router.push(
            selectionToPath({
                accountId: selection.accountId,
                year: null,
                month: null,
                level: "account",
            }),
        );
    };

    const handleBackToYear = () => {
        if (selection.year === null) return;
        router.push(
            selectionToPath({
                accountId: selection.accountId,
                year: selection.year,
                month: null,
                level: "year",
            }),
        );
    };

    function renderBreadcrumb() {
        const parts: React.ReactNode[] = [];

        parts.push(
            <button
                key="account"
                type="button"
                onClick={handleBackToAccount}
                className={`text-xs transition-colors ${
                    selection.level === "account"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                {account?.name ?? "Account"}
            </button>,
        );

        if (selection.year !== null) {
            parts.push(
                <span key="sep1" className="text-muted-foreground/50 text-xs">
                    /
                </span>,
            );
            parts.push(
                <button
                    key="year"
                    type="button"
                    onClick={handleBackToYear}
                    className={`text-xs font-mono transition-colors ${
                        selection.level === "year"
                            ? "text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {selection.year}
                </button>,
            );
        }

        if (selection.month !== null && selection.year !== null) {
            const monthLabel =
                MONTH_LABELS[selection.month - 1] ?? `Month ${selection.month}`;
            parts.push(
                <span key="sep2" className="text-muted-foreground/50 text-xs">
                    /
                </span>,
            );
            parts.push(
                <span
                    key="month"
                    className="text-xs text-foreground font-medium"
                >
                    {monthLabel}
                </span>,
            );
        }

        return <div className="flex items-center gap-1.5">{parts}</div>;
    }

    return (
        <TooltipProvider>
            <JobStatusProvider>
                <SidebarProvider>
                    <AppSidebar
                        accountBooks={accountBooks ?? []}
                        selection={selection}
                        onSelectionChange={handleSelectionChange}
                        canCreateAccount={canCreateAccountBook(user)}
                    />
                    <SidebarInset className="h-dvh overflow-y-auto">
                        <div className="sticky top-0 z-20 shrink-0 bg-background">
                            {isViewerRole(user) && <ViewerModeBanner />}
                            <header className="flex h-10 items-center gap-2 border-b px-4">
                                <SidebarTrigger className="-ml-1" />
                                <Separator
                                    orientation="vertical"
                                    className="mr-1 data-vertical:h-4 data-vertical:self-center"
                                />
                                {renderBreadcrumb()}
                            </header>
                        </div>
                        <main className="p-6">
                            <ErrorBoundary>{children}</ErrorBoundary>
                        </main>
                    </SidebarInset>
                </SidebarProvider>
                <JobStatusFloat />
            </JobStatusProvider>
        </TooltipProvider>
    );
}

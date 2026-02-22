"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";
import {
    pathToSelection,
    selectionToPath,
} from "@/lib/dashboard-routes";
import { accountBooks, getAccountBook, getMonthData } from "@/lib/mock-data";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const firstAccountId = accountBooks[0]?.id ?? "";

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
        if (authLoading) return;
        if (!user) router.replace("/auth/login");
    }, [user, authLoading, router]);

    if (authLoading) {
        return (
            <div className="flex h-dvh items-center justify-center">
                <Skeleton className="h-8 w-48" />
            </div>
        );
    }
    if (!user) {
        return null;
    }

    const account = getAccountBook(selection.accountId);

    const handleBackToAccount = () => {
        router.push(selectionToPath({
            accountId: selection.accountId,
            year: null,
            month: null,
            level: "account",
        }));
    };

    const handleBackToYear = () => {
        if (selection.year === null) return;
        router.push(selectionToPath({
            accountId: selection.accountId,
            year: selection.year,
            month: null,
            level: "year",
        }));
    };

    function renderBreadcrumb() {
        const parts: React.ReactNode[] = [];

        parts.push(
            <button
                key="account"
                type="button"
                onClick={handleBackToAccount}
                className={`text-xs transition-colors ${selection.level === "account"
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
                    className={`text-xs font-mono transition-colors ${selection.level === "year"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    {selection.year}
                </button>,
            );
        }

        if (selection.month !== null && selection.year !== null) {
            const monthData = getMonthData(
                selection.accountId,
                selection.year,
                selection.month,
            );
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
                    {monthData?.label ?? `Month ${selection.month}`}
                </span>,
            );
        }

        return <div className="flex items-center gap-1.5">{parts}</div>;
    }

    return (
        <TooltipProvider>
            <SidebarProvider>
                <AppSidebar
                    selection={selection}
                    onSelectionChange={handleSelectionChange}
                />
                <SidebarInset className="h-dvh overflow-y-auto">
                    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-20 bg-background">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-1 data-vertical:h-4 data-vertical:self-center"
                        />
                        {renderBreadcrumb()}
                    </header>
                    <main className="p-6">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </TooltipProvider>
    );
}

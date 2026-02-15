"use client";

import * as React from "react";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardAccount } from "@/components/dashboard-account";
import { DashboardYear } from "@/components/dashboard-year";
import { DashboardMonth } from "@/components/dashboard-month";
import {
    type Selection,
    accountBooks,
    getAccountBook,
    getYearData,
    getMonthData,
} from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Page() {
    const [selection, setSelection] = React.useState<Selection>({
        accountId: accountBooks[0].id,
        year: null,
        month: null,
        level: "account",
    });

    const account = getAccountBook(selection.accountId);

    const handleYearClick = (year: number) => {
        setSelection({
            accountId: selection.accountId,
            year,
            month: null,
            level: "year",
        });
    };

    const handleMonthClick = (month: number) => {
        if (selection.year === null) return;
        setSelection({
            accountId: selection.accountId,
            year: selection.year,
            month,
            level: "month",
        });
    };

    const handleBackToAccount = () => {
        setSelection({
            accountId: selection.accountId,
            year: null,
            month: null,
            level: "account",
        });
    };

    const handleBackToYear = () => {
        setSelection({
            accountId: selection.accountId,
            year: selection.year,
            month: null,
            level: "year",
        });
    };

    function renderBreadcrumb() {
        const parts: React.ReactNode[] = [];

        parts.push(
            <button
                key="account"
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

    function renderContent() {
        if (!account) {
            return (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    Account not found.
                </div>
            );
        }

        if (
            selection.level === "month" &&
            selection.year !== null &&
            selection.month !== null
        ) {
            const monthData = getMonthData(
                selection.accountId,
                selection.year,
                selection.month,
            );
            if (!monthData) {
                return (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                        Month data not found.
                    </div>
                );
            }
            return (
                <DashboardMonth
                    account={account}
                    yearValue={selection.year}
                    monthData={monthData}
                    onBack={handleBackToYear}
                />
            );
        }

        if (selection.level === "year" && selection.year !== null) {
            const yearData = getYearData(selection.accountId, selection.year);
            if (!yearData) {
                return (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                        Year data not found.
                    </div>
                );
            }
            return (
                <DashboardYear
                    account={account}
                    yearData={yearData}
                    onMonthClick={handleMonthClick}
                    onBack={handleBackToAccount}
                />
            );
        }

        return (
            <DashboardAccount account={account} onYearClick={handleYearClick} />
        );
    }

    return (
        <TooltipProvider>
            <SidebarProvider>
                <AppSidebar
                    selection={selection}
                    onSelectionChange={setSelection}
                />
                <SidebarInset>
                    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-1 data-vertical:h-4 data-vertical:self-center"
                        />
                        {renderBreadcrumb()}
                    </header>
                    <ScrollArea className="flex-1">
                        <main className="p-6">{renderContent()}</main>
                    </ScrollArea>
                </SidebarInset>
            </SidebarProvider>
        </TooltipProvider>
    );
}

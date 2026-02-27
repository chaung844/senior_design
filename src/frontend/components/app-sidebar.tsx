"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarSeparator,
} from "@/components/ui/sidebar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import type { AccountBook, Selection } from "@/lib/domain-types";
import { getMatchRateBadgeVariant } from "@/lib/constants";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowRight01Icon,
    BankIcon,
    Calendar01Icon,
    Calendar03Icon,
    DashboardSquare01Icon,
    Tick02Icon,
    Alert02Icon,
    LogoutIcon,
} from "@hugeicons/core-free-icons";

interface AppSidebarProps {
    accountBooks: AccountBook[];
    selection: Selection;
    onSelectionChange: (selection: Selection) => void;
}

export function AppSidebar({
    accountBooks,
    selection,
    onSelectionChange,
}: AppSidebarProps) {
    const router = useRouter();
    const { logout } = useAuth();
    const currentAccount = accountBooks.find(
        (a) => a.id === selection.accountId,
    );

    const handleLogout = async () => {
        await logout();
        router.replace("/auth/login");
    };

    const handleAccountChange = (accountId: string) => {
        onSelectionChange({
            accountId,
            year: null,
            month: null,
            level: "account",
        });
    };

    const handleYearClick = (year: number) => {
        onSelectionChange({
            accountId: selection.accountId,
            year,
            month: null,
            level: "year",
        });
    };

    const handleMonthClick = (year: number, month: number) => {
        onSelectionChange({
            accountId: selection.accountId,
            year,
            month,
            level: "month",
        });
    };

    const handleOverviewClick = () => {
        onSelectionChange({
            accountId: selection.accountId,
            year: null,
            month: null,
            level: "account",
        });
    };

    return (
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-2 px-2 py-1">
                    <HugeiconsIcon
                        icon={BankIcon}
                        strokeWidth={2}
                        className="size-5 text-primary"
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-tight">
                            Matcha
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            Reconciliation System
                        </span>
                    </div>
                </div>
                <SidebarSeparator className="mx-0 data-horizontal:w-auto" />
                <div className="px-2 pt-1">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                        Account Book
                    </label>
                    <Select
                        value={selection.accountId}
                        onValueChange={handleAccountChange}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                            {accountBooks.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                    <span className="truncate">
                                        {account.name}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {currentAccount && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>{currentAccount.bankName}</span>
                            <span>·</span>
                            <span className="font-mono">
                                {currentAccount.accountNumber}
                            </span>
                            <span>·</span>
                            <span>{currentAccount.currency}</span>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarSeparator className="data-horizontal:w-auto" />

            <SidebarContent>
                <ScrollArea className="flex-1">
                    <SidebarGroup>
                        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        onClick={handleOverviewClick}
                                        isActive={selection.level === "account"}
                                        tooltip="Account Overview"
                                    >
                                        <HugeiconsIcon
                                            icon={DashboardSquare01Icon}
                                            strokeWidth={2}
                                            className="size-4"
                                        />
                                        <span>Overview</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>

                    <SidebarGroup>
                        <SidebarGroupLabel>Bank Statements</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {currentAccount?.years
                                    .slice()
                                    .sort((a, b) => b.year - a.year)
                                    .map((yearData) => (
                                        <Collapsible
                                            key={yearData.year}
                                            defaultOpen={
                                                yearData.year === selection.year
                                            }
                                            className="group/collapsible"
                                        >
                                            <SidebarMenuItem>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuButton
                                                        onClick={() =>
                                                            handleYearClick(
                                                                yearData.year,
                                                            )
                                                        }
                                                        isActive={
                                                            selection.level ===
                                                                "year" &&
                                                            selection.year ===
                                                                yearData.year
                                                        }
                                                        tooltip={`Year ${yearData.year}`}
                                                    >
                                                        <HugeiconsIcon
                                                            icon={
                                                                ArrowRight01Icon
                                                            }
                                                            strokeWidth={2}
                                                            className="size-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90"
                                                        />
                                                        <HugeiconsIcon
                                                            icon={
                                                                Calendar01Icon
                                                            }
                                                            strokeWidth={2}
                                                            className="size-4"
                                                        />
                                                        <span className="font-mono">
                                                            {yearData.year}
                                                        </span>
                                                        <Badge
                                                            variant={getMatchRateBadgeVariant(
                                                                yearData.overallMatchRate,
                                                            )}
                                                            className="ml-auto text-[9px] h-4 px-1"
                                                        >
                                                            {
                                                                yearData.overallMatchRate
                                                            }
                                                            %
                                                        </Badge>
                                                    </SidebarMenuButton>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <SidebarMenuSub>
                                                        {yearData.months.map(
                                                            (monthData) => (
                                                                <SidebarMenuSubItem
                                                                    key={
                                                                        monthData.month
                                                                    }
                                                                >
                                                                    <SidebarMenuSubButton
                                                                        onClick={() =>
                                                                            handleMonthClick(
                                                                                yearData.year,
                                                                                monthData.month,
                                                                            )
                                                                        }
                                                                        isActive={
                                                                            selection.level ===
                                                                                "month" &&
                                                                            selection.year ===
                                                                                yearData.year &&
                                                                            selection.month ===
                                                                                monthData.month
                                                                        }
                                                                    >
                                                                        <HugeiconsIcon
                                                                            icon={
                                                                                Calendar03Icon
                                                                            }
                                                                            strokeWidth={
                                                                                2
                                                                            }
                                                                            className="size-3.5"
                                                                        />
                                                                        <span className="text-xs">
                                                                            {
                                                                                monthData.label
                                                                            }
                                                                        </span>
                                                                        <span className="ml-auto flex items-center gap-1">
                                                                            {monthData.reconciled ? (
                                                                                <HugeiconsIcon
                                                                                    icon={
                                                                                        Tick02Icon
                                                                                    }
                                                                                    strokeWidth={
                                                                                        2.5
                                                                                    }
                                                                                    className="size-3 text-primary"
                                                                                />
                                                                            ) : (
                                                                                <HugeiconsIcon
                                                                                    icon={
                                                                                        Alert02Icon
                                                                                    }
                                                                                    strokeWidth={
                                                                                        2
                                                                                    }
                                                                                    className="size-3 text-muted-foreground"
                                                                                />
                                                                            )}
                                                                            <span className="text-[10px] font-mono text-muted-foreground">
                                                                                {
                                                                                    monthData.statementCount
                                                                                }
                                                                            </span>
                                                                        </span>
                                                                    </SidebarMenuSubButton>
                                                                </SidebarMenuSubItem>
                                                            ),
                                                        )}
                                                    </SidebarMenuSub>
                                                </CollapsibleContent>
                                            </SidebarMenuItem>
                                        </Collapsible>
                                    ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </ScrollArea>
            </SidebarContent>

            <SidebarSeparator className="data-horizontal:w-auto" />

            <SidebarFooter>
                <div className="px-2 py-1 space-y-2">
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>Last synced</span>
                        <span className="font-mono">
                            {currentAccount?.lastUpdated ?? "—"}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-muted-foreground"
                        onClick={handleLogout}
                    >
                        <HugeiconsIcon
                            icon={LogoutIcon}
                            strokeWidth={2}
                            className="size-4"
                        />
                        Log out
                    </Button>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

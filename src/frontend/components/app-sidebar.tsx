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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import type { AccountBook, Selection } from "@/lib/domain-types";
import { getMatchRateBadgeVariant } from "@/lib/constants";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowRight01Icon,
    Calendar01Icon,
    Calendar03Icon,
    DashboardSquare01Icon,
    Tick02Icon,
    Alert02Icon,
    LogoutIcon,
    UserIcon,
    Mail01Icon,
    ShieldUserIcon,
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
    const { logout, user } = useAuth();
    const [profileOpen, setProfileOpen] = React.useState(false);
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
                    <svg
                        viewBox="622.48 382.02 204.04 157.96"
                        width="28"
                        height="22"
                        fill="currentColor"
                        className="text-primary shrink-0"
                        aria-label="Matcha logo"
                    >
                        <path d="M642.48 392.02 L701.52 392.02 C701.52 392.02, 711.52 392.02, 711.52 402.02 L711.52 442.02 C711.52 442.02, 711.52 452.02, 721.52 452.02 L727.48 452.02 C727.48 452.02, 737.48 452.02, 737.48 442.02 L737.48 403.02 C737.48 403.02, 737.48 393.02, 747.48 393.02 L806.52 393.02 C806.52 393.02, 816.52 393.02, 816.52 403.02 L816.52 460.98 C816.52 460.98, 816.52 470.98, 806.52 470.98 L756.52 470.98 C756.52 470.98, 746.52 470.98, 746.52 480.98 L746.52 519.98 C746.52 519.98, 746.52 529.98, 736.52 529.98 L677.48 529.98 C677.48 529.98, 667.48 529.98, 667.48 519.98 L667.48 479.98 C667.48 479.98, 667.48 469.98, 657.48 469.98 L642.48 469.98 C642.48 469.98, 632.48 469.98, 632.48 459.98 L632.48 402.02 C632.48 402.02, 632.48 392.02, 642.48 392.02" />
                    </svg>
                    <div className="flex flex-col ml-2">
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
                    {/*<div className="text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>Last synced</span>
                        <span className="font-mono">
                            {currentAccount?.lastUpdated ?? "—"}
                        </span>
                    </div>*/}

                    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 text-muted-foreground"
                            >
                                <HugeiconsIcon
                                    icon={UserIcon}
                                    strokeWidth={2}
                                    className="size-4 shrink-0"
                                />
                                <span className="truncate">
                                    {user?.name ?? "Account"}
                                </span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xs">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                                        <HugeiconsIcon
                                            icon={UserIcon}
                                            strokeWidth={2}
                                            className="size-4 text-primary"
                                        />
                                    </div>
                                    <span>{user?.name ?? "—"}</span>
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-3 pt-1">
                                <div className="flex items-start gap-3">
                                    <HugeiconsIcon
                                        icon={Mail01Icon}
                                        strokeWidth={2}
                                        className="size-4 text-muted-foreground mt-0.5 shrink-0"
                                    />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Email
                                        </span>
                                        <span className="text-xs font-mono break-all">
                                            {user?.email ?? "—"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <HugeiconsIcon
                                        icon={ShieldUserIcon}
                                        strokeWidth={2}
                                        className="size-4 text-muted-foreground mt-0.5 shrink-0"
                                    />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Role
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="w-fit capitalize text-[10px] px-1.5 py-0"
                                        >
                                            {user?.role ?? "—"}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <HugeiconsIcon
                                        icon={Calendar03Icon}
                                        strokeWidth={2}
                                        className="size-4 text-muted-foreground mt-0.5 shrink-0"
                                    />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Member since
                                        </span>
                                        <span className="text-xs font-mono">
                                            {user?.created_at
                                                ? new Date(
                                                      user.created_at,
                                                  ).toLocaleDateString(
                                                      undefined,
                                                      {
                                                          year: "numeric",
                                                          month: "long",
                                                          day: "numeric",
                                                      },
                                                  )
                                                : "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={async () => {
                                        setProfileOpen(false);
                                        await handleLogout();
                                    }}
                                >
                                    <HugeiconsIcon
                                        icon={LogoutIcon}
                                        strokeWidth={2}
                                        className="size-4"
                                    />
                                    Log out
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

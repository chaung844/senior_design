"use client";

import * as React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    type AccountBook,
    type YearData,
    formatCurrency,
    formatNumber,
} from "@/lib/mock-data";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowDown02Icon,
    ArrowUp02Icon,
    Analytics02Icon,
    Tick02Icon,
    Alert02Icon,
    Calendar03Icon,
    MoneyReceiveSquareIcon,
    MoneySendSquareIcon,
    BarChartIcon,
    ArrowLeft01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

interface DashboardYearProps {
    account: AccountBook;
    yearData: YearData;
    onMonthClick: (month: number) => void;
    onBack: () => void;
}

export function DashboardYear({
    account,
    yearData,
    onMonthClick,
    onBack,
}: DashboardYearProps) {
    const months = yearData.months.slice().sort((a, b) => a.month - b.month);
    const reconciledMonths = months.filter((m) => m.reconciled).length;
    const totalMonths = months.length;

    // Find best and worst months
    const bestMonth = months.reduce(
        (best, m) => (m.matchRate > best.matchRate ? m : best),
        months[0],
    );
    const worstMonth = months.reduce(
        (worst, m) => (m.matchRate < worst.matchRate ? m : worst),
        months[0],
    );

    // Calculate average transactions per month
    const avgTransactions =
        totalMonths > 0
            ? Math.round(yearData.totalTransactions / totalMonths)
            : 0;

    // Net flow
    const netFlow = yearData.totalCredit - yearData.totalDebit;

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon-sm" onClick={onBack}>
                        <HugeiconsIcon
                            icon={ArrowLeft01Icon}
                            strokeWidth={2}
                            className="size-4"
                        />
                    </Button>
                    <h1 className="text-lg font-semibold tracking-tight">
                        {account.name}
                        <span className="text-muted-foreground ml-2 font-mono">
                            {yearData.year}
                        </span>
                    </h1>
                    <Badge variant="outline" className="font-mono text-[10px]">
                        {account.currency}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground pl-9">
                    {account.bankName} · {account.accountNumber} · Monthly
                    breakdown for {yearData.year}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Total Transactions */}
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            <span className="flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={BarChartIcon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Transactions
                            </span>
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold tabular-nums">
                            {formatNumber(yearData.totalTransactions)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[11px] text-muted-foreground">
                            ~{formatNumber(avgTransactions)} per month avg
                        </div>
                    </CardContent>
                </Card>

                {/* Match Rate */}
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            <span className="flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={Analytics02Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Match Rate
                            </span>
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold tabular-nums">
                            {yearData.overallMatchRate}%
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1.5">
                            <Progress
                                value={yearData.overallMatchRate}
                                className="h-1.5"
                            />
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="text-primary">
                                    {formatNumber(yearData.totalMatched)}{" "}
                                    matched
                                </span>
                                <span>·</span>
                                <span>
                                    {formatNumber(yearData.totalUnmatched)}{" "}
                                    unmatched
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Net Flow */}
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            <span className="flex items-center gap-1.5">
                                {netFlow >= 0 ? (
                                    <HugeiconsIcon
                                        icon={MoneyReceiveSquareIcon}
                                        strokeWidth={2}
                                        className="size-3.5"
                                    />
                                ) : (
                                    <HugeiconsIcon
                                        icon={MoneySendSquareIcon}
                                        strokeWidth={2}
                                        className="size-3.5"
                                    />
                                )}
                                Net Flow
                            </span>
                        </CardDescription>
                        <CardTitle
                            className={`text-2xl font-bold tabular-nums ${
                                netFlow >= 0
                                    ? "text-primary"
                                    : "text-destructive"
                            }`}
                        >
                            {netFlow >= 0 ? "+" : ""}
                            {formatCurrency(netFlow, account.currency)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[11px] text-muted-foreground">
                            Credits minus debits
                        </div>
                    </CardContent>
                </Card>

                {/* Reconciliation Progress */}
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            <span className="flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={Tick02Icon}
                                    strokeWidth={2.5}
                                    className="size-3.5"
                                />
                                Reconciled
                            </span>
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold tabular-nums">
                            {reconciledMonths}
                            <span className="text-base font-normal text-muted-foreground">
                                /{totalMonths}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1.5">
                            <Progress
                                value={
                                    totalMonths > 0
                                        ? (reconciledMonths / totalMonths) * 100
                                        : 0
                                }
                                className="h-1.5"
                            />
                            <div className="text-[11px] text-muted-foreground">
                                months fully reconciled
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Highlights Row */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card size="sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-1.5 text-sm">
                            <HugeiconsIcon
                                icon={ArrowUp02Icon}
                                strokeWidth={2}
                                className="size-4 text-primary"
                            />
                            Best Match Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {bestMonth && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xl font-bold tabular-nums text-primary">
                                        {bestMonth.matchRate}%
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {bestMonth.label} ·{" "}
                                        {formatNumber(bestMonth.statementCount)}{" "}
                                        transactions
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onMonthClick(bestMonth.month)
                                    }
                                    className="text-xs"
                                >
                                    View
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card size="sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-1.5 text-sm">
                            <HugeiconsIcon
                                icon={ArrowDown02Icon}
                                strokeWidth={2}
                                className="size-4 text-destructive"
                            />
                            Needs Attention
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {worstMonth && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xl font-bold tabular-nums">
                                        {worstMonth.matchRate}%
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {worstMonth.label} ·{" "}
                                        {formatNumber(
                                            worstMonth.unmatchedCount,
                                        )}{" "}
                                        unmatched
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onMonthClick(worstMonth.month)
                                    }
                                    className="text-xs"
                                >
                                    Review
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Breakdown Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Monthly Breakdown</CardTitle>
                    <CardDescription>
                        Reconciliation status per month for {yearData.year}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">
                                    Statements
                                </TableHead>
                                <TableHead className="text-right">
                                    Matched
                                </TableHead>
                                <TableHead className="text-right">
                                    Unmatched
                                </TableHead>
                                <TableHead>Match Rate</TableHead>
                                <TableHead className="text-right">
                                    Debits
                                </TableHead>
                                <TableHead className="text-right">
                                    Credits
                                </TableHead>
                                <TableHead className="text-right">
                                    Opening
                                </TableHead>
                                <TableHead className="text-right">
                                    Closing
                                </TableHead>
                                <TableHead className="text-center">
                                    Status
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {months.map((monthData) => (
                                <TableRow
                                    key={monthData.month}
                                    className="cursor-pointer"
                                    onClick={() =>
                                        onMonthClick(monthData.month)
                                    }
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <HugeiconsIcon
                                                icon={Calendar03Icon}
                                                strokeWidth={2}
                                                className="size-3.5 text-muted-foreground"
                                            />
                                            <span className="font-medium">
                                                {monthData.label}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatNumber(monthData.statementCount)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-primary">
                                        {formatNumber(monthData.matchedCount)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatNumber(monthData.unmatchedCount)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 min-w-[120px]">
                                            <Progress
                                                value={monthData.matchRate}
                                                className="h-1 flex-1"
                                            />
                                            <Badge
                                                variant={
                                                    monthData.matchRate >= 90
                                                        ? "default"
                                                        : monthData.matchRate >=
                                                            70
                                                          ? "secondary"
                                                          : "destructive"
                                                }
                                                className="text-[10px] h-4 px-1.5 tabular-nums"
                                            >
                                                {monthData.matchRate}%
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-mono text-xs">
                                        {formatCurrency(
                                            monthData.totalDebit,
                                            account.currency,
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-mono text-xs">
                                        {formatCurrency(
                                            monthData.totalCredit,
                                            account.currency,
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-mono text-xs">
                                        {formatCurrency(
                                            monthData.openingBalance,
                                            account.currency,
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-mono text-xs">
                                        {formatCurrency(
                                            monthData.closingBalance,
                                            account.currency,
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {monthData.reconciled ? (
                                            <Badge
                                                variant="default"
                                                className="text-[10px] h-4 px-1.5"
                                            >
                                                <HugeiconsIcon
                                                    icon={Tick02Icon}
                                                    strokeWidth={2.5}
                                                    className="size-2.5 mr-0.5"
                                                />
                                                Done
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] h-4 px-1.5 text-muted-foreground"
                                            >
                                                <HugeiconsIcon
                                                    icon={Alert02Icon}
                                                    strokeWidth={2}
                                                    className="size-2.5 mr-0.5"
                                                />
                                                Pending
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Balance Flow */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            Opening Balance ({yearData.year})
                        </CardDescription>
                        <CardTitle className="text-xl font-bold tabular-nums font-mono">
                            {formatCurrency(
                                yearData.openingBalance,
                                account.currency,
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            Closing Balance ({yearData.year})
                        </CardDescription>
                        <CardTitle className="text-xl font-bold tabular-nums font-mono">
                            {formatCurrency(
                                yearData.closingBalance,
                                account.currency,
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}

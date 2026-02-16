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
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
    type AccountBook,
    type MonthData,
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
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { UploadDialog } from "@/components/upload-dialog";

const monthlyChartConfig = {
    matched: {
        label: "Matched",
        color: "var(--chart-1)",
    },
    unmatched: {
        label: "Unmatched",
        color: "var(--chart-4)",
    },
} satisfies ChartConfig;

interface DashboardYearProps {
    account: AccountBook;
    yearData: YearData;
    onMonthClick: (month: number) => void;
    onBack: () => void;
}

function makeMonthColumns(
    currency: string,
): ColumnDef<MonthData, unknown>[] {
    return [
        {
            accessorKey: "label",
            header: "Month",
            size: 100,
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5">
                    <HugeiconsIcon
                        icon={Calendar03Icon}
                        strokeWidth={2}
                        className="size-3.5 text-muted-foreground"
                    />
                    <span className="font-medium">{row.original.label}</span>
                </div>
            ),
        },
        {
            accessorKey: "statementCount",
            header: "Stmts",
            size: 65,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {formatNumber(row.original.statementCount)}
                </div>
            ),
        },
        {
            accessorKey: "matchedCount",
            header: "Matched",
            size: 70,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums text-primary">
                    {formatNumber(row.original.matchedCount)}
                </div>
            ),
        },
        {
            accessorKey: "unmatchedCount",
            header: "Unmatched",
            size: 80,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {formatNumber(row.original.unmatchedCount)}
                </div>
            ),
        },
        {
            accessorKey: "matchRate",
            header: "Match Rate",
            size: 130,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Progress
                        value={row.original.matchRate}
                        className="h-1 flex-1"
                    />
                    <Badge
                        variant={
                            row.original.matchRate >= 90
                                ? "default"
                                : row.original.matchRate >= 70
                                    ? "secondary"
                                    : "destructive"
                        }
                        className="text-[10px] h-4 px-1.5 tabular-nums"
                    >
                        {row.original.matchRate}%
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "totalDebit",
            header: "Debits",
            size: 90,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {formatCurrency(row.original.totalDebit, currency)}
                </div>
            ),
        },
        {
            accessorKey: "totalCredit",
            header: "Credits",
            size: 90,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {formatCurrency(row.original.totalCredit, currency)}
                </div>
            ),
        },
        {
            accessorKey: "openingBalance",
            header: "Opening",
            size: 90,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {formatCurrency(row.original.openingBalance, currency)}
                </div>
            ),
        },
        {
            accessorKey: "closingBalance",
            header: "Closing",
            size: 90,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {formatCurrency(row.original.closingBalance, currency)}
                </div>
            ),
        },
        {
            accessorKey: "reconciled",
            header: "Status",
            size: 75,
            meta: { align: "center" },
            enableSorting: false,
            cell: ({ row }) => (
                <div className="text-center">
                    {row.original.reconciled ? (
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
                </div>
            ),
        },
    ];
}

export function DashboardYear({
    account,
    yearData,
    onMonthClick,
    onBack,
}: DashboardYearProps) {
    const months = React.useMemo(
        () => yearData.months.slice().sort((a, b) => a.month - b.month),
        [yearData.months],
    );
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

    const monthColumns = React.useMemo(
        () => makeMonthColumns(account.currency),
        [account.currency],
    );

    const tableToolbar = (columnToggle: React.ReactNode) => (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-medium">Monthly Breakdown</h3>
                <p className="text-xs text-muted-foreground">
                    Reconciliation status per month for {yearData.year}
                </p>
            </div>
            {columnToggle}
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="shrink-0 flex flex-col gap-1">
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
                    <div className="ml-auto">
                        <UploadDialog
                            title="Upload Bank Statements"
                            description="Upload bank statement files. Uploading for a month that already has a statement will overwrite it."
                            accept=".pdf,.csv,.xlsx,.xls"
                            acceptLabel="PDF, CSV, or Excel"
                            multiple
                            onUpload={(files) => {
                                console.log("Statements:", files);
                            }}
                        />
                    </div>
                </div>
                <p className="text-xs text-muted-foreground pl-9">
                    {account.bankName} · {account.accountNumber} · Monthly
                    breakdown for {yearData.year}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="shrink-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                            className={`text-2xl font-bold tabular-nums ${netFlow >= 0
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
            <div className="shrink-0 grid grid-cols-1 gap-4 lg:grid-cols-2">
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

            {/* Monthly Reconciliation Chart */}
            <Card className="shrink-0">
                <CardHeader>
                    <CardTitle>Monthly Reconciliation</CardTitle>
                    <CardDescription>
                        Matched vs unmatched transactions per month for{" "}
                        {yearData.year}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer
                        config={monthlyChartConfig}
                        className="h-[250px] w-full"
                    >
                        <BarChart
                            accessibilityLayer
                            data={months.map((m) => ({
                                month: m.label.slice(0, 3),
                                matched: m.matchedCount,
                                unmatched: m.unmatchedCount,
                            }))}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) =>
                                    formatNumber(value)
                                }
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent hideLabel />
                                }
                            />
                            <ChartLegend
                                content={<ChartLegendContent />}
                            />
                            <Bar
                                dataKey="matched"
                                stackId="a"
                                fill="var(--color-matched)"
                                radius={[0, 0, 0, 0]}
                            />
                            <Bar
                                dataKey="unmatched"
                                stackId="a"
                                fill="var(--color-unmatched)"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Monthly Breakdown Table */}
            <DataTable
                columns={monthColumns}
                data={months}
                toolbar={tableToolbar}
                onRowClick={(row) => onMonthClick(row.month)}
                emptyMessage="No monthly data available."
            />
        </div>
    );
}

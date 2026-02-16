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
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    Calendar01Icon,
    MoneyReceiveSquareIcon,
    MoneySendSquareIcon,
    BarChartIcon,
} from "@hugeicons/core-free-icons";

const reconciliationChartConfig = {
    matched: {
        label: "Matched",
        color: "var(--chart-1)",
    },
    unmatched: {
        label: "Unmatched",
        color: "var(--chart-4)",
    },
} satisfies ChartConfig;

interface DashboardAccountProps {
    account: AccountBook;
    onYearClick: (year: number) => void;
}

export function DashboardAccount({
    account,
    onYearClick,
}: DashboardAccountProps) {
    const allYears = account.years.slice().sort((a, b) => b.year - a.year);
    const latestYear = allYears[0];

    const totalTransactions = allYears.reduce(
        (sum, y) => sum + y.totalTransactions,
        0,
    );
    const totalMatched = allYears.reduce((sum, y) => sum + y.totalMatched, 0);
    const totalUnmatched = allYears.reduce(
        (sum, y) => sum + y.totalUnmatched,
        0,
    );
    const overallMatchRate =
        totalTransactions > 0
            ? Math.round((totalMatched / totalTransactions) * 1000) / 10
            : 0;

    const totalDebit = allYears.reduce((sum, y) => sum + y.totalDebit, 0);
    const totalCredit = allYears.reduce((sum, y) => sum + y.totalCredit, 0);

    // Calculate trend vs previous year if available
    const currentYearMatch =
        allYears.length > 0 ? allYears[0].overallMatchRate : 0;
    const previousYearMatch =
        allYears.length > 1 ? allYears[1].overallMatchRate : null;
    const matchTrend =
        previousYearMatch !== null
            ? Math.round((currentYearMatch - previousYearMatch) * 10) / 10
            : null;

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight">
                        {account.name}
                    </h1>
                    <Badge variant="outline" className="font-mono text-[10px]">
                        {account.currency}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                    {account.bankName} · {account.accountNumber} · Account
                    overview across all statement periods
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
                                Total Transactions
                            </span>
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold tabular-nums">
                            {formatNumber(totalTransactions)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>
                                Across {allYears.length} year
                                {allYears.length !== 1 ? "s" : ""}
                            </span>
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
                                Overall Match Rate
                            </span>
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold tabular-nums">
                            {overallMatchRate}%
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1.5">
                            <Progress
                                value={overallMatchRate}
                                className="h-1.5"
                            />
                            {matchTrend !== null && (
                                <div className="flex items-center gap-1 text-[11px]">
                                    {matchTrend >= 0 ? (
                                        <HugeiconsIcon
                                            icon={ArrowUp02Icon}
                                            strokeWidth={2}
                                            className="size-3 text-primary"
                                        />
                                    ) : (
                                        <HugeiconsIcon
                                            icon={ArrowDown02Icon}
                                            strokeWidth={2}
                                            className="size-3 text-destructive"
                                        />
                                    )}
                                    <span
                                        className={
                                            matchTrend >= 0
                                                ? "text-primary"
                                                : "text-destructive"
                                        }
                                    >
                                        {matchTrend > 0 ? "+" : ""}
                                        {matchTrend}%
                                    </span>
                                    <span className="text-muted-foreground">
                                        vs prior year
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Total Debits */}
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            <span className="flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={MoneySendSquareIcon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Total Debits
                            </span>
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold tabular-nums text-destructive">
                            {formatCurrency(totalDebit, account.currency)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[11px] text-muted-foreground">
                            All outgoing transactions
                        </div>
                    </CardContent>
                </Card>

                {/* Total Credits */}
                <Card size="sm">
                    <CardHeader>
                        <CardDescription>
                            <span className="flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={MoneyReceiveSquareIcon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Total Credits
                            </span>
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold tabular-nums text-primary">
                            {formatCurrency(totalCredit, account.currency)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[11px] text-muted-foreground">
                            All incoming transactions
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reconciliation Status */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card size="sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-1.5 text-sm">
                            <HugeiconsIcon
                                icon={Tick02Icon}
                                strokeWidth={2.5}
                                className="size-4 text-primary"
                            />
                            Matched
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums text-primary">
                            {formatNumber(totalMatched)}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            transactions successfully matched
                        </p>
                    </CardContent>
                </Card>

                <Card size="sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-1.5 text-sm">
                            <HugeiconsIcon
                                icon={Alert02Icon}
                                strokeWidth={2}
                                className="size-4 text-muted-foreground"
                            />
                            Unmatched
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                            {formatNumber(totalUnmatched)}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            transactions require review
                        </p>
                    </CardContent>
                </Card>

                <Card size="sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-1.5 text-sm">
                            <HugeiconsIcon
                                icon={Calendar01Icon}
                                strokeWidth={2}
                                className="size-4"
                            />
                            Latest Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                            {latestYear
                                ? formatCurrency(
                                    latestYear.closingBalance,
                                    account.currency,
                                )
                                : "—"}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            as of {latestYear?.year ?? "—"} closing
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Reconciliation Overview Chart */}
            {/* <Card>
                <CardHeader>
                    <CardTitle>Reconciliation Overview</CardTitle>
                    <CardDescription>
                        Matched vs unmatched transactions per year
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer
                        config={reconciliationChartConfig}
                        className="h-[250px] w-full"
                    >
                        <BarChart
                            accessibilityLayer
                            data={allYears
                                .map((y) => ({
                                    year: String(y.year),
                                    matched: y.totalMatched,
                                    unmatched: y.totalUnmatched,
                                }))
                                .reverse()}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="year"
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
            </Card> */}

            {/* Yearly Breakdown Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Yearly Breakdown</CardTitle>
                    <CardDescription>
                        Summary of reconciliation status per statement year
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Year</TableHead>
                                <TableHead className="text-right">
                                    Transactions
                                </TableHead>
                                <TableHead className="text-right">
                                    Matched
                                </TableHead>
                                <TableHead className="text-right">
                                    Unmatched
                                </TableHead>
                                <TableHead>Match Rate</TableHead>
                                <TableHead className="text-right">
                                    Total Debits
                                </TableHead>
                                <TableHead className="text-right">
                                    Total Credits
                                </TableHead>
                                <TableHead className="text-right">
                                    Opening
                                </TableHead>
                                <TableHead className="text-right">
                                    Closing
                                </TableHead>
                                <TableHead className="text-right">
                                    Months
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allYears.map((yearData) => {
                                const reconciledMonths = yearData.months.filter(
                                    (m) => m.reconciled,
                                ).length;
                                return (
                                    <TableRow
                                        key={yearData.year}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            onYearClick(yearData.year)
                                        }
                                    >
                                        <TableCell>
                                            <span className="font-mono font-medium">
                                                {yearData.year}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatNumber(
                                                yearData.totalTransactions,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-primary">
                                            {formatNumber(
                                                yearData.totalMatched,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatNumber(
                                                yearData.totalUnmatched,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 min-w-[120px]">
                                                <Progress
                                                    value={
                                                        yearData.overallMatchRate
                                                    }
                                                    className="h-1 flex-1"
                                                />
                                                <Badge
                                                    variant={
                                                        yearData.overallMatchRate >=
                                                            90
                                                            ? "default"
                                                            : yearData.overallMatchRate >=
                                                                70
                                                                ? "secondary"
                                                                : "destructive"
                                                    }
                                                    className="text-[10px] h-4 px-1.5 tabular-nums"
                                                >
                                                    {yearData.overallMatchRate}%
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-mono text-xs">
                                            {formatCurrency(
                                                yearData.totalDebit,
                                                account.currency,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-mono text-xs">
                                            {formatCurrency(
                                                yearData.totalCredit,
                                                account.currency,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-mono text-xs">
                                            {formatCurrency(
                                                yearData.openingBalance,
                                                account.currency,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-mono text-xs">
                                            {formatCurrency(
                                                yearData.closingBalance,
                                                account.currency,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                                {reconciledMonths}/
                                                {yearData.months.length}
                                                {reconciledMonths ===
                                                    yearData.months.length ? (
                                                    <HugeiconsIcon
                                                        icon={Tick02Icon}
                                                        strokeWidth={2.5}
                                                        className="inline-block ml-1 size-3 text-primary"
                                                    />
                                                ) : null}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

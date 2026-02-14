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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    type AccountBook,
    type MonthData,
    type Transaction,
    formatCurrency,
    formatNumber,
} from "@/lib/mock-data";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    Analytics02Icon,
    Tick02Icon,
    Alert02Icon,
    MoneyReceiveSquareIcon,
    MoneySendSquareIcon,
    BarChartIcon,
    ArrowDown02Icon,
    ArrowUp02Icon,
    Search01Icon,
    FilterIcon,
    Menu01Icon,
} from "@hugeicons/core-free-icons";

interface DashboardMonthProps {
    account: AccountBook;
    yearValue: number;
    monthData: MonthData;
    onBack: () => void;
}

type FilterMode = "all" | "matched" | "unmatched";

export function DashboardMonth({
    account,
    yearValue,
    monthData,
    onBack,
}: DashboardMonthProps) {
    const [filter, setFilter] = React.useState<FilterMode>("all");
    const [searchQuery, setSearchQuery] = React.useState("");

    const filteredTransactions = React.useMemo(() => {
        let txns = monthData.transactions;

        if (filter === "matched") {
            txns = txns.filter((t) => t.matched);
        } else if (filter === "unmatched") {
            txns = txns.filter((t) => !t.matched);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            txns = txns.filter(
                (t) =>
                    t.description.toLowerCase().includes(q) ||
                    t.reference.toLowerCase().includes(q) ||
                    t.category.toLowerCase().includes(q) ||
                    t.id.toLowerCase().includes(q) ||
                    (t.matchedWith && t.matchedWith.toLowerCase().includes(q)),
            );
        }

        return txns;
    }, [monthData.transactions, filter, searchQuery]);

    const netFlow = monthData.totalCredit - monthData.totalDebit;

    // Stats for filtered view
    const filteredMatched = filteredTransactions.filter(
        (t) => t.matched,
    ).length;
    const filteredUnmatched = filteredTransactions.length - filteredMatched;

    // Category breakdown
    const categoryBreakdown = React.useMemo(() => {
        const map = new Map<
            string,
            {
                category: string;
                count: number;
                debit: number;
                credit: number;
                matched: number;
            }
        >();
        for (const txn of monthData.transactions) {
            const existing = map.get(txn.category) || {
                category: txn.category,
                count: 0,
                debit: 0,
                credit: 0,
                matched: 0,
            };
            existing.count += 1;
            existing.debit += txn.debit || 0;
            existing.credit += txn.credit || 0;
            if (txn.matched) existing.matched += 1;
            map.set(txn.category, existing);
        }
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [monthData.transactions]);

    function getConfidenceBadge(confidence: number | null) {
        if (confidence === null) return null;
        if (confidence >= 95) {
            return (
                <Badge
                    variant="default"
                    className="text-[9px] h-4 px-1 tabular-nums"
                >
                    {confidence}%
                </Badge>
            );
        }
        if (confidence >= 80) {
            return (
                <Badge
                    variant="secondary"
                    className="text-[9px] h-4 px-1 tabular-nums"
                >
                    {confidence}%
                </Badge>
            );
        }
        return (
            <Badge
                variant="outline"
                className="text-[9px] h-4 px-1 tabular-nums text-muted-foreground"
            >
                {confidence}%
            </Badge>
        );
    }

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
                            {monthData.label} {yearValue}
                        </span>
                    </h1>
                    <Badge variant="outline" className="font-mono text-[10px]">
                        {account.currency}
                    </Badge>
                    {monthData.reconciled ? (
                        <Badge
                            variant="default"
                            className="text-[10px] h-5 px-2"
                        >
                            <HugeiconsIcon
                                icon={Tick02Icon}
                                strokeWidth={2.5}
                                className="size-3 mr-0.5"
                            />
                            Reconciled
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-2 text-muted-foreground"
                        >
                            <HugeiconsIcon
                                icon={Alert02Icon}
                                strokeWidth={2}
                                className="size-3 mr-0.5"
                            />
                            Pending
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground pl-9">
                    {account.bankName} · {account.accountNumber} · Bank
                    statement reconciliation detail
                </p>
            </div>

            {/* Summary Cards – 2 column layout */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Reconciliation Statistics */}
                <Card size="sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            <HugeiconsIcon
                                icon={Analytics02Icon}
                                strokeWidth={2}
                                className="size-4"
                            />
                            Reconciliation Statistics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {/* Statements */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={Menu01Icon}
                                    strokeWidth={2}
                                    className="size-3"
                                />
                                Statements
                            </span>
                            <span className="text-2xl font-bold tabular-nums">
                                {formatNumber(monthData.statementCount)}
                            </span>
                        </div>
                        {/* Match Rate */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={BarChartIcon}
                                    strokeWidth={2}
                                    className="size-3"
                                />
                                Match Rate
                            </span>
                            <span className="text-2xl font-bold tabular-nums">
                                {monthData.matchRate}%
                            </span>
                            <Progress
                                value={monthData.matchRate}
                                className="h-1.5 mt-0.5"
                            />
                        </div>
                        {/* Matched */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={Tick02Icon}
                                    strokeWidth={2.5}
                                    className="size-3 text-primary"
                                />
                                Matched
                            </span>
                            <span className="text-2xl font-bold tabular-nums text-primary">
                                {formatNumber(monthData.matchedCount)}
                            </span>
                        </div>
                        {/* Unmatched */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={Alert02Icon}
                                    strokeWidth={2}
                                    className="size-3"
                                />
                                Unmatched
                            </span>
                            <span className="text-2xl font-bold tabular-nums">
                                {formatNumber(monthData.unmatchedCount)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Cash Flow Statistics */}
                <Card size="sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            <HugeiconsIcon
                                icon={MoneyReceiveSquareIcon}
                                strokeWidth={2}
                                className="size-4"
                            />
                            Cash Flow
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {/* Opening Balance */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                                Opening Balance
                            </span>
                            <span className="text-2xl font-bold tabular-nums font-mono">
                                {formatCurrency(
                                    monthData.openingBalance,
                                    account.currency,
                                )}
                            </span>
                        </div>
                        {/* Closing Balance */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                                Closing Balance
                            </span>
                            <span className="text-2xl font-bold tabular-nums font-mono">
                                {formatCurrency(
                                    monthData.closingBalance,
                                    account.currency,
                                )}
                            </span>
                        </div>
                        {/* Total Debits */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={MoneySendSquareIcon}
                                    strokeWidth={2}
                                    className="size-3 text-destructive"
                                />
                                Total Debits
                            </span>
                            <span className="text-2xl font-bold tabular-nums font-mono text-destructive">
                                {formatCurrency(
                                    monthData.totalDebit,
                                    account.currency,
                                )}
                            </span>
                        </div>
                        {/* Net Flow */}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                {netFlow >= 0 ? (
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
                                Net Flow
                            </span>
                            <span
                                className={`text-2xl font-bold tabular-nums font-mono ${
                                    netFlow >= 0
                                        ? "text-primary"
                                        : "text-destructive"
                                }`}
                            >
                                {netFlow >= 0 ? "+" : ""}
                                {formatCurrency(netFlow, account.currency)}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabbed content: Transactions + Categories */}
            <Tabs defaultValue="transactions">
                <TabsList variant="line">
                    <TabsTrigger value="transactions">
                        Transactions ({formatNumber(monthData.statementCount)})
                    </TabsTrigger>
                    <TabsTrigger value="categories">
                        Categories ({formatNumber(categoryBreakdown.length)})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="transactions">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle>
                                        Parsed Bank Statement Transactions
                                    </CardTitle>
                                    <CardDescription>
                                        {filteredTransactions.length ===
                                        monthData.transactions.length
                                            ? `Showing all ${formatNumber(filteredTransactions.length)} transactions`
                                            : `Showing ${formatNumber(filteredTransactions.length)} of ${formatNumber(monthData.transactions.length)} transactions`}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Search */}
                                    <div className="relative">
                                        <HugeiconsIcon
                                            icon={Search01Icon}
                                            strokeWidth={2}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search transactions..."
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            className="h-7 w-[200px] rounded-none border border-input bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                                        />
                                    </div>
                                    {/* Filter buttons */}
                                    <div className="flex items-center border border-input rounded-none">
                                        <Button
                                            variant={
                                                filter === "all"
                                                    ? "secondary"
                                                    : "ghost"
                                            }
                                            size="xs"
                                            onClick={() => setFilter("all")}
                                            className="rounded-none border-0"
                                        >
                                            All
                                        </Button>
                                        <Separator
                                            orientation="vertical"
                                            className="h-4"
                                        />
                                        <Button
                                            variant={
                                                filter === "matched"
                                                    ? "secondary"
                                                    : "ghost"
                                            }
                                            size="xs"
                                            onClick={() => setFilter("matched")}
                                            className="rounded-none border-0"
                                        >
                                            <HugeiconsIcon
                                                icon={Tick02Icon}
                                                strokeWidth={2.5}
                                                className="size-3 text-primary mr-0.5"
                                            />
                                            Matched
                                        </Button>
                                        <Separator
                                            orientation="vertical"
                                            className="h-4"
                                        />
                                        <Button
                                            variant={
                                                filter === "unmatched"
                                                    ? "secondary"
                                                    : "ghost"
                                            }
                                            size="xs"
                                            onClick={() =>
                                                setFilter("unmatched")
                                            }
                                            className="rounded-none border-0"
                                        >
                                            <HugeiconsIcon
                                                icon={Alert02Icon}
                                                strokeWidth={2}
                                                className="size-3 mr-0.5"
                                            />
                                            Unmatched
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="max-h-[600px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">
                                                Status
                                            </TableHead>
                                            <TableHead className="w-[100px]">
                                                Date
                                            </TableHead>
                                            <TableHead className="w-[140px]">
                                                Reference
                                            </TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">
                                                Debit
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Credit
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Balance
                                            </TableHead>
                                            <TableHead className="w-[80px] text-center">
                                                Confidence
                                            </TableHead>
                                            <TableHead className="w-[140px]">
                                                Matched Ledger
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTransactions.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={10}
                                                    className="h-24 text-center text-muted-foreground"
                                                >
                                                    No transactions found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredTransactions.map((txn) => (
                                                <TableRow key={txn.id}>
                                                    <TableCell>
                                                        {txn.matched ? (
                                                            <Badge
                                                                variant="default"
                                                                className="text-[9px] h-4 px-1.5"
                                                            >
                                                                <HugeiconsIcon
                                                                    icon={
                                                                        Tick02Icon
                                                                    }
                                                                    strokeWidth={
                                                                        2.5
                                                                    }
                                                                    className="size-2.5 mr-0.5"
                                                                />
                                                                Match
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[9px] h-4 px-1.5 text-muted-foreground"
                                                            >
                                                                <HugeiconsIcon
                                                                    icon={
                                                                        Alert02Icon
                                                                    }
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    className="size-2.5 mr-0.5"
                                                                />
                                                                None
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="tabular-nums font-mono text-xs">
                                                        {txn.date}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-[11px] text-muted-foreground">
                                                            {txn.reference}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs">
                                                            {txn.description}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-[9px] h-4 px-1.5"
                                                        >
                                                            {txn.category}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-mono text-xs">
                                                        {txn.debit !== null ? (
                                                            <span className="text-destructive">
                                                                {formatCurrency(
                                                                    txn.debit,
                                                                    account.currency,
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/40">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-mono text-xs">
                                                        {txn.credit !== null ? (
                                                            <span className="text-primary">
                                                                {formatCurrency(
                                                                    txn.credit,
                                                                    account.currency,
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/40">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-mono text-xs">
                                                        {formatCurrency(
                                                            txn.balance,
                                                            account.currency,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {getConfidenceBadge(
                                                            txn.matchConfidence,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {txn.matchedWith ? (
                                                            <span className="font-mono text-[10px] text-muted-foreground">
                                                                {
                                                                    txn.matchedWith
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground/40">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="categories">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction Categories</CardTitle>
                            <CardDescription>
                                Breakdown of transactions by category for{" "}
                                {monthData.label} {yearValue}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="text-right">
                                            Count
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Total Debits
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Total Credits
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Matched
                                        </TableHead>
                                        <TableHead>Match Rate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categoryBreakdown.map((cat) => {
                                        const catMatchRate =
                                            cat.count > 0
                                                ? Math.round(
                                                      (cat.matched /
                                                          cat.count) *
                                                          1000,
                                                  ) / 10
                                                : 0;
                                        return (
                                            <TableRow key={cat.category}>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] h-5 px-2"
                                                    >
                                                        {cat.category}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatNumber(cat.count)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums font-mono text-xs">
                                                    {cat.debit > 0 ? (
                                                        <span className="text-destructive">
                                                            {formatCurrency(
                                                                cat.debit,
                                                                account.currency,
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40">
                                                            —
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums font-mono text-xs">
                                                    {cat.credit > 0 ? (
                                                        <span className="text-primary">
                                                            {formatCurrency(
                                                                cat.credit,
                                                                account.currency,
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40">
                                                            —
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatNumber(cat.matched)}/
                                                    {formatNumber(cat.count)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 min-w-[100px]">
                                                        <Progress
                                                            value={catMatchRate}
                                                            className="h-1 flex-1"
                                                        />
                                                        <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">
                                                            {catMatchRate}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

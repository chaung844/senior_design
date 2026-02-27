"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import {
    type AccountBook,
    type MonthData,
    type Transaction,
    formatCurrency,
    formatNumber,
} from "@/lib/domain-types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Analytics02Icon,
    Tick02Icon,
    Alert02Icon,
    MoneyReceiveSquareIcon,
    MoneySendSquareIcon,
    BarChartIcon,
    Search01Icon,
} from "@hugeicons/core-free-icons";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { UploadDialog } from "@/components/upload-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { useDocumentUpload } from "@/hooks/use-document-upload";

interface DashboardMonthProps {
    account: AccountBook;
    yearValue: number;
    monthData: MonthData;
    statementId: number;
    onBack: () => void;
}

type FilterMode = "all" | "matched" | "unmatched";

type CategoryRow = {
    category: string;
    count: number;
    debit: number;
    credit: number;
    matched: number;
    matchRate: number;
};

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

function makeTransactionColumns(
    currency: string,
): ColumnDef<Transaction, unknown>[] {
    return [
        {
            accessorKey: "matched",
            header: "Status",
            size: 60,
            enableSorting: false,
            enableHiding: false,
            meta: { align: "left" },
            cell: ({ row }) =>
                row.original.matched ? (
                    <Badge variant="default" className="text-[9px] h-4 px-1.5">
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            strokeWidth={2.5}
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
                            icon={Alert02Icon}
                            strokeWidth={2}
                            className="size-2.5 mr-0.5"
                        />
                        None
                    </Badge>
                ),
        },
        {
            accessorKey: "date",
            header: "Date",
            size: 70,
            enableHiding: false,
            cell: ({ row }) => (
                <span className="tabular-nums font-mono text-xs">
                    {row.original.date}
                </span>
            ),
        },
        {
            accessorKey: "reference",
            header: "Reference",
            size: 110,
            enableSorting: false,
            cell: ({ row }) => (
                <span className="font-mono text-[11px] text-muted-foreground truncate block">
                    {row.original.reference}
                </span>
            ),
        },
        {
            accessorKey: "description",
            header: "Description",
            size: 200,
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-xs truncate block">
                    {row.original.description}
                </span>
            ),
        },
        {
            accessorKey: "category",
            header: "Category",
            size: 100,
            enableSorting: false,
            cell: ({ row }) => (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                    {row.original.category}
                </Badge>
            ),
        },
        {
            accessorKey: "debit",
            header: "Debit",
            size: 85,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {row.original.debit !== null ? (
                        <span className="text-destructive">
                            {formatCurrency(row.original.debit, currency)}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/40">—</span>
                    )}
                </div>
            ),
            sortingFn: (rowA, rowB) =>
                (rowA.original.debit ?? 0) - (rowB.original.debit ?? 0),
        },
        {
            accessorKey: "credit",
            header: "Credit",
            size: 85,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {row.original.credit !== null ? (
                        <span className="text-primary">
                            {formatCurrency(row.original.credit, currency)}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/40">—</span>
                    )}
                </div>
            ),
            sortingFn: (rowA, rowB) =>
                (rowA.original.credit ?? 0) - (rowB.original.credit ?? 0),
        },
        {
            accessorKey: "balance",
            header: "Balance",
            size: 85,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {formatCurrency(row.original.balance, currency)}
                </div>
            ),
        },
        {
            accessorKey: "matchConfidence",
            header: "Conf.",
            size: 55,
            meta: { align: "center" },
            cell: ({ row }) => (
                <div className="text-center">
                    {getConfidenceBadge(row.original.matchConfidence)}
                </div>
            ),
            sortingFn: (rowA, rowB) =>
                (rowA.original.matchConfidence ?? -1) -
                (rowB.original.matchConfidence ?? -1),
        },
        {
            accessorKey: "matchedWith",
            header: "Matched Ledger",
            size: 110,
            enableSorting: false,
            cell: ({ row }) =>
                row.original.matchedWith ? (
                    <span className="font-mono text-[10px] text-muted-foreground truncate block">
                        {row.original.matchedWith}
                    </span>
                ) : (
                    <span className="text-[10px] text-muted-foreground/40">
                        —
                    </span>
                ),
        },
    ];
}

function makeCategoryColumns(
    currency: string,
): ColumnDef<CategoryRow, unknown>[] {
    return [
        {
            accessorKey: "category",
            header: "Category",
            size: 150,
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <Badge variant="secondary" className="text-[10px] h-5 px-2">
                    {row.original.category}
                </Badge>
            ),
        },
        {
            accessorKey: "count",
            header: "Count",
            size: 70,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {formatNumber(row.original.count)}
                </div>
            ),
        },
        {
            accessorKey: "debit",
            header: "Total Debits",
            size: 120,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {row.original.debit > 0 ? (
                        <span className="text-destructive">
                            {formatCurrency(row.original.debit, currency)}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/40">—</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "credit",
            header: "Total Credits",
            size: 120,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {row.original.credit > 0 ? (
                        <span className="text-primary">
                            {formatCurrency(row.original.credit, currency)}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/40">—</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "matched",
            header: "Matched",
            size: 80,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {formatNumber(row.original.matched)}/
                    {formatNumber(row.original.count)}
                </div>
            ),
        },
        {
            accessorKey: "matchRate",
            header: "Match Rate",
            size: 150,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Progress
                        value={row.original.matchRate}
                        className="h-1 flex-1"
                    />
                    <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">
                        {row.original.matchRate}%
                    </span>
                </div>
            ),
        },
    ];
}

export function DashboardMonth({
    account,
    yearValue,
    monthData,
    statementId,
    onBack,
}: DashboardMonthProps) {
    const {
        uploadFiles,
        isUploading,
        results: uploadResults,
        reset: resetUpload,
    } = useDocumentUpload("receipt", Number(account.id) || undefined);

    const [filter, setFilter] = React.useState<FilterMode>("all");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [activeTab, setActiveTab] = React.useState("transactions");

    const filteredTransactions = React.useMemo(() => {
        let txns = monthData.transactions;
        if (filter === "matched") {
            txns = txns.filter((t) => t.matched);
        } else if (filter === "unmatched") {
            txns = txns.filter((t) => !t.matched);
        }
        return txns;
    }, [monthData.transactions, filter]);

    const netFlow = monthData.totalCredit - monthData.totalDebit;

    // Category breakdown
    const categoryBreakdown = React.useMemo(() => {
        const map = new Map<string, CategoryRow>();
        for (const txn of monthData.transactions) {
            const existing = map.get(txn.category) || {
                category: txn.category,
                count: 0,
                debit: 0,
                credit: 0,
                matched: 0,
                matchRate: 0,
            };
            existing.count += 1;
            existing.debit += txn.debit || 0;
            existing.credit += txn.credit || 0;
            if (txn.matched) existing.matched += 1;
            map.set(txn.category, existing);
        }
        const rows = Array.from(map.values()).sort((a, b) => b.count - a.count);
        for (const row of rows) {
            row.matchRate =
                row.count > 0
                    ? Math.round((row.matched / row.count) * 1000) / 10
                    : 0;
        }
        return rows;
    }, [monthData.transactions]);

    const transactionColumns = React.useMemo(
        () => makeTransactionColumns(account.currency),
        [account.currency],
    );

    const categoryColumns = React.useMemo(
        () => makeCategoryColumns(account.currency),
        [account.currency],
    );

    const transactionsToolbar = (columnToggle: React.ReactNode) => (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h3 className="text-sm font-medium">
                    Parsed Bank Statement Transactions
                </h3>
                <p className="text-xs text-muted-foreground">
                    {filteredTransactions.length ===
                    monthData.transactions.length
                        ? `Showing all ${formatNumber(filteredTransactions.length)} transactions`
                        : `Showing ${formatNumber(filteredTransactions.length)} of ${formatNumber(monthData.transactions.length)} transactions`}
                </p>
            </div>
            <div className="flex items-center gap-2">
                {columnToggle}
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
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 w-[200px] rounded-none border border-input bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    />
                </div>
                {/* Filter buttons */}
                <div className="flex items-center border border-input rounded-none">
                    <Button
                        variant={filter === "all" ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => setFilter("all")}
                        className="rounded-none border-0"
                    >
                        All
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                        variant={filter === "matched" ? "secondary" : "ghost"}
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
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                        variant={filter === "unmatched" ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => setFilter("unmatched")}
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
    );

    const categoriesToolbar = (columnToggle: React.ReactNode) => (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-medium">Transaction Categories</h3>
                <p className="text-xs text-muted-foreground">
                    Breakdown of transactions by category for {monthData.label}{" "}
                    {yearValue}
                </p>
            </div>
            {columnToggle}
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            <DashboardHeader
                account={account}
                periodLabel={`${monthData.label} ${yearValue}`}
                subtitle="Bank statement reconciliation detail"
                onBack={onBack}
                badges={
                    monthData.reconciled ? (
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
                    )
                }
                actions={
                    <div className="flex items-center gap-2">
                        <ExportDialog
                            account={account}
                            yearValue={yearValue}
                            monthData={monthData}
                            statementId={statementId}
                        />
                        <UploadDialog
                            title="Upload Receipts"
                            description="Upload receipt images or PDFs for reconciliation matching."
                            accept=".png,.jpg,.jpeg,.pdf"
                            acceptLabel="PNG, JPEG, JPG, or PDF"
                            multiple
                            onUpload={uploadFiles}
                            isUploading={isUploading}
                            uploadResults={uploadResults}
                            onOpenChange={(open) => {
                                if (!open) resetUpload();
                            }}
                        />
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="shrink-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={BarChartIcon}
                    label="Statements"
                    value={formatNumber(monthData.statementCount)}
                >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="text-primary">
                            {formatNumber(monthData.matchedCount)} matched
                        </span>
                        <span>·</span>
                        <span>
                            {formatNumber(monthData.unmatchedCount)} unmatched
                        </span>
                    </div>
                </StatCard>

                <StatCard
                    icon={Analytics02Icon}
                    label="Match Rate"
                    value={`${monthData.matchRate}%`}
                >
                    <div className="flex flex-col gap-1.5">
                        <Progress
                            value={monthData.matchRate}
                            className="h-1.5"
                        />
                        <div className="text-[11px] text-muted-foreground">
                            {monthData.reconciled
                                ? "Fully reconciled"
                                : "Reconciliation pending"}
                        </div>
                    </div>
                </StatCard>

                <StatCard
                    icon={
                        netFlow >= 0
                            ? MoneyReceiveSquareIcon
                            : MoneySendSquareIcon
                    }
                    label="Net Flow"
                    value={`${netFlow >= 0 ? "+" : ""}${formatCurrency(netFlow, account.currency)}`}
                    valueClassName={
                        netFlow >= 0 ? "text-primary" : "text-destructive"
                    }
                >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="text-destructive">
                            {formatCurrency(
                                monthData.totalDebit,
                                account.currency,
                            )}{" "}
                            out
                        </span>
                        <span>·</span>
                        <span className="text-primary">
                            {formatCurrency(
                                monthData.totalCredit,
                                account.currency,
                            )}{" "}
                            in
                        </span>
                    </div>
                </StatCard>

                <StatCard
                    icon={Tick02Icon}
                    label="Closing Balance"
                    value={formatCurrency(
                        monthData.closingBalance,
                        account.currency,
                    )}
                    valueClassName="font-mono"
                >
                    <div className="text-[11px] text-muted-foreground">
                        Opening:{" "}
                        <span className="font-mono tabular-nums">
                            {formatCurrency(
                                monthData.openingBalance,
                                account.currency,
                            )}
                        </span>
                    </div>
                </StatCard>
            </div>

            {/* Tabbed content: Transactions + Categories */}
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex flex-col"
            >
                <TabsList variant="line" className="shrink-0">
                    <TabsTrigger value="transactions">
                        Transactions ({formatNumber(monthData.statementCount)})
                    </TabsTrigger>
                    <TabsTrigger value="categories">
                        Categories ({formatNumber(categoryBreakdown.length)})
                    </TabsTrigger>
                </TabsList>

                <TabsContent
                    value="transactions"
                    className="flex flex-col mt-3"
                >
                    <DataTable
                        columns={transactionColumns}
                        data={filteredTransactions}
                        toolbar={transactionsToolbar}
                        emptyMessage="No transactions found."
                        globalFilter={searchQuery}
                        onGlobalFilterChange={setSearchQuery}
                    />
                </TabsContent>

                <TabsContent value="categories" className="flex flex-col mt-3">
                    <DataTable
                        columns={categoryColumns}
                        data={categoryBreakdown}
                        toolbar={categoriesToolbar}
                        emptyMessage="No categories found."
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

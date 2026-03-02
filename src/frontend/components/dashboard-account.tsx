"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import {
    type AccountBook,
    type YearData,
    formatCurrency,
    formatNumber,
} from "@/lib/domain-types";
import { getMatchRateBadgeVariant } from "@/lib/constants";
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
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { UploadDialog } from "@/components/upload-dialog";
import { useTrackedDocumentUpload } from "@/hooks/use-tracked-document-upload";
import { EditAccountDialog } from "@/components/edit-account-dialog";
import type { AccountBookRead } from "@/lib/types";
import type { UserRole } from "@/lib/types";

interface DashboardAccountProps {
    account: AccountBook;
    /** Raw API account data, needed by the edit dialog. Present only for admin users. */
    rawAccount?: AccountBookRead;
    /** The current user's system role — edit controls are shown for admins only. */
    userRole?: UserRole;
    onYearClick: (year: number) => void;
}

function makeYearColumns(currency: string): ColumnDef<YearData, unknown>[] {
    return [
        {
            accessorKey: "year",
            header: "Year",
            size: 70,
            enableSorting: true,
            enableHiding: false,
            cell: ({ row }) => (
                <span className="font-mono font-medium">
                    {row.original.year}
                </span>
            ),
        },
        {
            accessorKey: "totalTransactions",
            header: "Transactions",
            size: 90,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {formatNumber(row.original.totalTransactions)}
                </div>
            ),
        },
        {
            accessorKey: "totalMatched",
            header: "Matched",
            size: 80,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums text-primary">
                    {formatNumber(row.original.totalMatched)}
                </div>
            ),
        },
        {
            accessorKey: "totalUnmatched",
            header: "Unmatched",
            size: 80,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {formatNumber(row.original.totalUnmatched)}
                </div>
            ),
        },
        {
            accessorKey: "overallMatchRate",
            header: "Match Rate",
            size: 130,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Progress
                        value={row.original.overallMatchRate}
                        className="h-1 flex-1"
                    />
                    <Badge
                        variant={getMatchRateBadgeVariant(
                            row.original.overallMatchRate,
                        )}
                        className="text-[10px] h-4 px-1.5 tabular-nums"
                    >
                        {row.original.overallMatchRate}%
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "totalDebit",
            header: "Total Debits",
            size: 100,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {formatCurrency(row.original.totalDebit, currency)}
                </div>
            ),
        },
        {
            accessorKey: "totalCredit",
            header: "Total Credits",
            size: 100,
            meta: { align: "right" },
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-mono text-xs">
                    {formatCurrency(row.original.totalCredit, currency)}
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
            id: "months",
            header: "Months",
            size: 75,
            meta: { align: "right" },
            enableSorting: false,
            cell: ({ row }) => {
                const reconciledMonths = row.original.months.filter(
                    (m) => m.reconciled,
                ).length;
                return (
                    <div className="text-right">
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                            {reconciledMonths}/{row.original.months.length}
                            {reconciledMonths === row.original.months.length ? (
                                <HugeiconsIcon
                                    icon={Tick02Icon}
                                    strokeWidth={2.5}
                                    className="inline-block ml-1 size-3 text-primary"
                                />
                            ) : null}
                        </span>
                    </div>
                );
            },
        },
    ];
}

export function DashboardAccount({
    account,
    rawAccount,
    userRole,
    onYearClick,
}: DashboardAccountProps) {
    const {
        uploadFiles,
        isUploading,
        results: uploadResults,
        reset: resetUpload,
    } = useTrackedDocumentUpload(
        "bank_statement",
        Number(account.id) || undefined,
    );

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

    const currentYearMatch =
        allYears.length > 0 ? allYears[0].overallMatchRate : 0;
    const previousYearMatch =
        allYears.length > 1 ? allYears[1].overallMatchRate : null;
    const matchTrend =
        previousYearMatch !== null
            ? Math.round((currentYearMatch - previousYearMatch) * 10) / 10
            : null;

    const isAdmin = userRole === "admin";

    const yearColumns = React.useMemo(
        () => makeYearColumns(account.currency),
        [account.currency],
    );

    const tableToolbar = (columnToggle: React.ReactNode) => (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-medium">Yearly Breakdown</h3>
                <p className="text-xs text-muted-foreground">
                    Summary of reconciliation status per statement year
                </p>
            </div>
            {columnToggle}
        </div>
    );

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
                    <div className="ml-auto flex items-center gap-2">
                        {isAdmin && rawAccount && (
                            <EditAccountDialog account={rawAccount} />
                        )}
                        <UploadDialog
                            title="Upload Bank Statement"
                            description="Upload a PDF bank statement to be parsed and reconciled against this account."
                            accept=".pdf"
                            acceptLabel="PDF only"
                            multiple={false}
                            onUpload={uploadFiles}
                            isUploading={isUploading}
                            uploadResults={uploadResults}
                            onOpenChange={(open) => {
                                if (!open) resetUpload();
                            }}
                        />
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    {account.bankName} · {account.accountNumber} · Account
                    overview across all statement periods
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={BarChartIcon}
                    label="Total Transactions"
                    value={formatNumber(totalTransactions)}
                >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                            Across {allYears.length} year
                            {allYears.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                </StatCard>

                <StatCard
                    icon={Analytics02Icon}
                    label="Overall Match Rate"
                    value={`${overallMatchRate}%`}
                >
                    <div className="flex flex-col gap-1.5">
                        <Progress value={overallMatchRate} className="h-1.5" />
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
                </StatCard>

                <StatCard
                    icon={MoneySendSquareIcon}
                    label="Total Debits"
                    value={formatCurrency(totalDebit, account.currency)}
                    valueClassName="text-destructive"
                >
                    <div className="text-[11px] text-muted-foreground">
                        All outgoing transactions
                    </div>
                </StatCard>

                <StatCard
                    icon={MoneyReceiveSquareIcon}
                    label="Total Credits"
                    value={formatCurrency(totalCredit, account.currency)}
                    valueClassName="text-primary"
                >
                    <div className="text-[11px] text-muted-foreground">
                        All incoming transactions
                    </div>
                </StatCard>
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

            {/* Yearly Breakdown Table */}
            <DataTable
                columns={yearColumns}
                data={allYears}
                toolbar={tableToolbar}
                onRowClick={(row) => onYearClick(row.year)}
                emptyMessage="No yearly data available."
            />
        </div>
    );
}

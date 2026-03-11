"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    Invoice02Icon,
    File01Icon,
    LinkSquare02Icon,
    Delete02Icon,
    ArrowDataTransferHorizontalIcon,
    Settings01Icon,
    TransactionHistoryIcon,
} from "@hugeicons/core-free-icons";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { UploadDialog } from "@/components/upload-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { useDocumentUpload } from "@/hooks/use-document-upload";
import { useReceipts, useReceiptFileUrl } from "@/hooks/use-receipts";
import { ReceiptEditDialog } from "@/components/receipt-edit-dialog";
import { StatementEditDialog } from "@/components/statement-edit-dialog";
import type { ReceiptRead } from "@/lib/types";
import { useTrackedDocumentUpload } from "@/hooks/use-tracked-document-upload";
import { useStartReconciliation } from "@/hooks/use-reconciliation";
import { useDeleteDocument } from "@/hooks/use-documents";
import { useStatement } from "@/hooks/use-statements";
import { StatementLineDialog } from "@/components/statement-line-dialog";
import type { BankStatementLineRead } from "@/lib/types";

interface DashboardMonthProps {
    account: AccountBook;
    yearValue: number;
    monthData: MonthData;
    statementId: number;
    /** Raw API statement lines — used to open the line-detail dialog. */
    rawLines: BankStatementLineRead[];
    onBack: () => void;
}

type FilterMode = "all" | "matched" | "unmatched";
type ReceiptFilterMode = "all" | "matched" | "unmatched";

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
                    <Badge variant="default" className="text-[9px] h-5 px-1.5">
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
                        className="text-[9px] h-5 px-1.5 text-muted-foreground"
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

// ── Receipt file-link cell ────────────────────────────────────────────

function ReceiptFileLink({ receiptId }: { receiptId: number }) {
    const [enabled, setEnabled] = React.useState(false);
    const { data, isLoading } = useReceiptFileUrl(enabled ? receiptId : null);

    React.useEffect(() => {
        if (data?.url) {
            window.open(data.url, "_blank", "noopener,noreferrer");
            setEnabled(false);
        }
    }, [data?.url]);

    return (
        <Button
            variant="ghost"
            size="xs"
            className="h-5 px-1 gap-1 text-[10px]"
            onClick={() => setEnabled(true)}
            disabled={isLoading}
        >
            <HugeiconsIcon
                icon={LinkSquare02Icon}
                strokeWidth={2}
                className="size-3 shrink-0"
            />
            {isLoading ? "Loading…" : "View"}
        </Button>
    );
}

function makeReceiptColumns(
    currency: string,
): ColumnDef<ReceiptRead, unknown>[] {
    return [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) =>
                        table.toggleAllPageRowsSelected(!!value)
                    }
                    aria-label="Select all"
                    className="translate-y-0.5"
                />
            ),
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        className="translate-y-0.5"
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "match_status",
            header: "Status",
            size: 110,
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
                const s = row.original.match_status;
                if (s === "perfect_matched") {
                    return (
                        <Badge
                            variant="default"
                            className="text-[9px] h-5 px-1.5"
                        >
                            <HugeiconsIcon
                                icon={Tick02Icon}
                                strokeWidth={2.5}
                                className="size-2.5 mr-0.5 mb-0.5"
                            />
                            Perfect Match
                        </Badge>
                    );
                }
                if (s === "bundle_matched") {
                    return (
                        <Badge
                            variant="secondary"
                            className="text-[9px] h-5 px-1.5"
                        >
                            <HugeiconsIcon
                                icon={Tick02Icon}
                                strokeWidth={2.5}
                                className="size-2.5 mr-0.5 mb-0.5"
                            />
                            Bundle Match
                        </Badge>
                    );
                }
                if (s === "manual") {
                    return (
                        <Badge
                            variant="outline"
                            className="text-[9px] h-5 px-1.5"
                        >
                            Manual
                        </Badge>
                    );
                }
                return (
                    <Badge
                        variant="outline"
                        className="text-[9px] h-5 px-1.5 text-muted-foreground"
                    >
                        <HugeiconsIcon
                            icon={Alert02Icon}
                            strokeWidth={2}
                            className="size-2.5 mr-0.5 mb-0.5"
                        />
                        Unmatched
                    </Badge>
                );
            },
        },
        {
            accessorKey: "billing_date",
            header: "Date",
            size: 90,
            enableSorting: true,
            cell: ({ row }) => (
                <span className="font-mono tabular-nums text-[11px]">
                    {row.original.billing_date}
                </span>
            ),
        },
        {
            accessorKey: "vendor",
            header: "Vendor",
            size: 160,
            cell: ({ row }) => (
                <span className="truncate block" title={row.original.vendor}>
                    {row.original.vendor}
                </span>
            ),
        },
        {
            accessorKey: "invoice_number",
            header: "Invoice #",
            size: 110,
            cell: ({ row }) => (
                <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                    {row.original.invoice_number ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "expense_type",
            header: "Type",
            size: 100,
            cell: ({ row }) =>
                row.original.expense_type ? (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        {row.original.expense_type}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            accessorKey: "description",
            header: "Description",
            size: 200,
            cell: ({ row }) => (
                <span
                    className="truncate block text-muted-foreground"
                    title={row.original.description ?? ""}
                >
                    {row.original.description ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "charged_amount",
            header: "Amount",
            size: 100,
            cell: ({ row }) => (
                <span className="font-mono tabular-nums">
                    {formatCurrency(
                        Number(row.original.charged_amount),
                        row.original.currency || currency,
                    )}
                </span>
            ),
            sortingFn: (a, b) =>
                Number(a.original.charged_amount) -
                Number(b.original.charged_amount),
        },
        {
            accessorKey: "file_name",
            header: "File",
            size: 140,
            enableSorting: false,
            cell: ({ row }) => {
                const { receipt_id, file_name } = row.original;
                if (!file_name) {
                    return (
                        <span className="text-muted-foreground text-[11px]">
                            No file
                        </span>
                    );
                }
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <HugeiconsIcon
                            icon={File01Icon}
                            strokeWidth={2}
                            className="size-3 shrink-0 text-muted-foreground"
                        />
                        <span
                            className="truncate text-[11px] text-muted-foreground"
                            title={file_name}
                        >
                            {file_name}
                        </span>
                        <ReceiptFileLink receiptId={receipt_id} />
                    </div>
                );
            },
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
    rawLines,
    onBack,
}: DashboardMonthProps) {
    const deleteDoc = useDeleteDocument();

    const {
        uploadFiles,
        isUploading,
        results: uploadResults,
        reset: resetUpload,
    } = useTrackedDocumentUpload(
        "receipt",
        Number(account.id) || undefined,
        statementId,
    );

    const {
        startReconciliation,
        isPending: isReconciling,
        error: reconcileError,
        reset: resetReconcile,
    } = useStartReconciliation();

    const [reconcileDialogOpen, setReconcileDialogOpen] = React.useState(false);

    async function handleReconcile() {
        if (!statementId) return;
        resetReconcile();
        try {
            await startReconciliation({
                accountId: Number(account.id),
                statementId,
                label: `${monthData.label} ${yearValue}`,
            });
        } catch {
            // Error is surfaced via reconcileError; keep dialog open so the
            // user can see it.
            return;
        }
        setReconcileDialogOpen(false);
    }

    // ── Statement-line dialog state ───────────────────────────────────
    const [selectedLine, setSelectedLine] =
        React.useState<BankStatementLineRead | null>(null);
    const [lineDialogOpen, setLineDialogOpen] = React.useState(false);

    // Keep selectedLine in sync with the latest rawLines so the dialog
    // reflects updated match_status after linking/unlinking a receipt.
    React.useEffect(() => {
        if (selectedLine) {
            const fresh = rawLines.find(
                (l) => l.line_id === selectedLine.line_id,
            );
            if (fresh && fresh !== selectedLine) {
                setSelectedLine(fresh);
            }
        }
    }, [rawLines, selectedLine]);

    function handleTransactionRowClick(txn: Transaction) {
        const lineId = Number(txn.id);
        const raw = rawLines.find((l) => l.line_id === lineId) ?? null;
        if (!raw) return;
        setSelectedLine(raw);
        setLineDialogOpen(true);
    }

    const [filter, setFilter] = React.useState<FilterMode>("all");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [activeTab, setActiveTab] = React.useState("transactions");
    const [receiptFilter, setReceiptFilter] =
        React.useState<ReceiptFilterMode>("all");
    const [receiptSearch, setReceiptSearch] = React.useState("");
    const [selectedReceipt, setSelectedReceipt] =
        React.useState<ReceiptRead | null>(null);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState({});
    const [stmtEditDialogOpen, setStmtEditDialogOpen] = React.useState(false);

    // Fetch the raw statement record so the edit dialog has document_id, etc.
    const { data: statementDetail } = useStatement(statementId ?? null);

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

    const { data: receiptsData, isLoading: receiptsLoading } = useReceipts({
        account_id: Number(account.id) || undefined,
        statement_id: statementId,
        limit: 100,
    });

    const allReceipts = receiptsData?.receipts ?? [];

    const filteredReceipts = React.useMemo(() => {
        let list = allReceipts;
        if (receiptFilter === "matched") {
            list = list.filter(
                (r) =>
                    r.match_status === "perfect_matched" ||
                    r.match_status === "bundle_matched" ||
                    r.match_status === "manual",
            );
        } else if (receiptFilter === "unmatched") {
            list = list.filter((r) => r.match_status === "unmatched");
        }
        if (receiptSearch.trim()) {
            const q = receiptSearch.trim().toLowerCase();
            list = list.filter(
                (r) =>
                    r.vendor.toLowerCase().includes(q) ||
                    (r.invoice_number ?? "").toLowerCase().includes(q) ||
                    (r.description ?? "").toLowerCase().includes(q) ||
                    (r.expense_type ?? "").toLowerCase().includes(q) ||
                    (r.file_name ?? "").toLowerCase().includes(q),
            );
        }
        return list;
    }, [allReceipts, receiptFilter, receiptSearch]);

    const receiptColumns = React.useMemo(
        () => makeReceiptColumns(account.currency),
        [account.currency],
    );

    const matchedReceiptCount = React.useMemo(
        () =>
            allReceipts.filter(
                (r) =>
                    r.match_status === "perfect_matched" ||
                    r.match_status === "bundle_matched" ||
                    r.match_status === "manual",
            ).length,
        [allReceipts],
    );

    const receiptsToolbar = (columnToggle: React.ReactNode) => (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h3 className="text-sm font-medium">Receipts</h3>
                <p className="text-xs text-muted-foreground">
                    {filteredReceipts.length === allReceipts.length
                        ? `Showing all ${formatNumber(filteredReceipts.length)} receipts`
                        : `Showing ${formatNumber(filteredReceipts.length)} of ${formatNumber(allReceipts.length)} receipts`}
                    {allReceipts.length > 0 && (
                        <>
                            {" · "}
                            <span className="text-primary">
                                {formatNumber(matchedReceiptCount)} matched
                            </span>
                            {" · "}
                            <span>
                                {formatNumber(
                                    allReceipts.length - matchedReceiptCount,
                                )}{" "}
                                unmatched
                            </span>
                        </>
                    )}
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
                        placeholder="Search receipts..."
                        value={receiptSearch}
                        onChange={(e) => setReceiptSearch(e.target.value)}
                        className="h-7 w-50 rounded-none border border-input bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    />
                </div>
                {/* Action buttons */}
                {Object.keys(rowSelection).length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="xs"
                                className="h-7 px-2 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                                disabled={deleteDoc.isPending}
                            >
                                <HugeiconsIcon
                                    icon={Delete02Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Delete {Object.keys(rowSelection).length}{" "}
                                selected
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Delete {Object.keys(rowSelection).length}{" "}
                                    {Object.keys(rowSelection).length === 1
                                        ? "receipt"
                                        : "receipts"}
                                    ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete{" "}
                                    {Object.keys(rowSelection).length === 1
                                        ? "the selected receipt"
                                        : `all ${Object.keys(rowSelection).length} selected receipts`}{" "}
                                    and their associated files. This action
                                    cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    variant="destructive"
                                    onClick={async () => {
                                        const ids =
                                            Object.keys(rowSelection).map(
                                                Number,
                                            );
                                        for (const id of ids) {
                                            const receipt = allReceipts.find(
                                                (r) => r.receipt_id === id,
                                            );
                                            if (receipt?.document_id) {
                                                await deleteDoc.mutateAsync(
                                                    receipt.document_id,
                                                );
                                            }
                                        }
                                        setRowSelection({});
                                    }}
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                {/* Filter buttons */}
                <div className="flex items-center border border-input rounded-none">
                    <Button
                        variant={
                            receiptFilter === "all" ? "secondary" : "ghost"
                        }
                        size="xs"
                        onClick={() => setReceiptFilter("all")}
                        className="rounded-none border-0"
                    >
                        All
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                        variant={
                            receiptFilter === "matched" ? "secondary" : "ghost"
                        }
                        size="xs"
                        onClick={() => setReceiptFilter("matched")}
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
                        variant={
                            receiptFilter === "unmatched"
                                ? "secondary"
                                : "ghost"
                        }
                        size="xs"
                        onClick={() => setReceiptFilter("unmatched")}
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
                        className="h-7 w-50 rounded-none border border-input bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
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
                        {statementId != null && statementDetail && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStmtEditDialogOpen(true)}
                            >
                                <HugeiconsIcon
                                    icon={Settings01Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Edit Statement
                            </Button>
                        )}
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
                        {statementId != null && (
                            <AlertDialog
                                open={reconcileDialogOpen}
                                onOpenChange={(open) => {
                                    setReconcileDialogOpen(open);
                                    if (!open) resetReconcile();
                                }}
                            >
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isReconciling}
                                    >
                                        {isReconciling ? (
                                            <span
                                                className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                                                aria-hidden
                                            />
                                        ) : (
                                            <HugeiconsIcon
                                                icon={
                                                    ArrowDataTransferHorizontalIcon
                                                }
                                                strokeWidth={2}
                                                className="size-3.5"
                                            />
                                        )}
                                        {isReconciling
                                            ? "Reconciling…"
                                            : "Reconcile"}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Run Reconciliation
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will match all bank statement
                                            transactions for{" "}
                                            <strong>
                                                {monthData.label} {yearValue}
                                            </strong>{" "}
                                            against uploaded receipts. Any
                                            existing automatic matches will be
                                            replaced. Manual matches are
                                            preserved.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    {reconcileError && (
                                        <p className="text-xs text-destructive px-1">
                                            {reconcileError.message}
                                        </p>
                                    )}
                                    <AlertDialogFooter>
                                        <AlertDialogCancel
                                            disabled={isReconciling}
                                        >
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleReconcile();
                                            }}
                                            disabled={isReconciling}
                                        >
                                            {isReconciling ? (
                                                <>
                                                    <span
                                                        className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                                                        aria-hidden
                                                    />
                                                    Reconciling…
                                                </>
                                            ) : (
                                                <>
                                                    <HugeiconsIcon
                                                        icon={
                                                            ArrowDataTransferHorizontalIcon
                                                        }
                                                        strokeWidth={2}
                                                        className="size-3.5"
                                                    />
                                                    Run Reconciliation
                                                </>
                                            )}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <ExportDialog
                            account={account}
                            yearValue={yearValue}
                            monthData={monthData}
                            statementId={statementId}
                        />
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="shrink-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={TransactionHistoryIcon}
                    label="Statements"
                    value={formatNumber(monthData.statementCount)}
                >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="text-primary">
                            {formatNumber(monthData.matchedCount)} matched
                        </span>
                        <span>·</span>
                        <span
                            className={
                                monthData.unmatchedCount > 0
                                    ? "text-destructive"
                                    : undefined
                            }
                        >
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
                    <TabsTrigger value="receipts">
                        {/*<HugeiconsIcon
                            icon={Invoice02Icon}
                            strokeWidth={2}
                            className="size-3.5 mr-1"
                        />*/}
                        Receipts
                        {allReceipts.length > 0 && (
                            <span className="ml-1">
                                ({formatNumber(allReceipts.length)})
                            </span>
                        )}
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
                        onRowClick={handleTransactionRowClick}
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

                <TabsContent value="receipts" className="flex flex-col mt-3">
                    {receiptsLoading ? (
                        <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                            Loading receipts…
                        </div>
                    ) : (
                        <DataTable
                            columns={receiptColumns}
                            data={filteredReceipts}
                            toolbar={receiptsToolbar}
                            emptyMessage={
                                allReceipts.length === 0
                                    ? "No receipts uploaded for this account yet."
                                    : "No receipts match the current filter."
                            }
                            globalFilter={receiptSearch}
                            onGlobalFilterChange={setReceiptSearch}
                            rowSelection={rowSelection}
                            onRowSelectionChange={setRowSelection}
                            getRowId={(row) => String(row.receipt_id)}
                            onRowClick={(row) => {
                                setSelectedReceipt(row);
                                setEditDialogOpen(true);
                            }}
                        />
                    )}
                </TabsContent>
            </Tabs>

            <ReceiptEditDialog
                receipt={selectedReceipt}
                open={editDialogOpen}
                onOpenChange={(open) => {
                    setEditDialogOpen(open);
                    if (!open) setSelectedReceipt(null);
                }}
                currency={account.currency}
            />
            <StatementEditDialog
                statement={statementDetail ?? null}
                open={stmtEditDialogOpen}
                onOpenChange={setStmtEditDialogOpen}
                onDeleted={onBack}
            />
            <StatementLineDialog
                line={selectedLine}
                receipts={allReceipts}
                receiptsLoading={receiptsLoading}
                statementId={statementId}
                currency={account.currency}
                open={lineDialogOpen}
                onOpenChange={(open) => {
                    setLineDialogOpen(open);
                    if (!open) setSelectedLine(null);
                }}
            />
        </div>
    );
}

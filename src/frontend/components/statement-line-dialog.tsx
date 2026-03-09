"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Tick02Icon,
    Alert02Icon,
    Cancel01Icon,
    LinkSquare02Icon,
    Calendar03Icon,
    ArrowDataTransferHorizontalIcon,
    Delete02Icon,
    Invoice02Icon,
    File01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useUpdateStatementLine } from "@/hooks/use-statements";
import {
    useMatchesByLine,
    useCreateManualMatch,
    useDeleteMatch,
} from "@/hooks/use-reconciliation";
import { useReceiptFileUrl } from "@/hooks/use-receipts";
import type {
    BankStatementLineRead,
    BankStatementLineUpdate,
    ReceiptRead,
    MatchStatus,
    ReconciliationMatchRead,
} from "@/lib/types";
import { formatCurrency } from "@/lib/domain-types";

// ── Props ─────────────────────────────────────────────────────────────

interface StatementLineDialogProps {
    /** The raw API line being inspected. null = dialog closed. */
    line: BankStatementLineRead | null;
    /** All receipts for the statement month (account-scoped, statement-scoped). */
    receipts: ReceiptRead[];
    /** Whether the receipts list is still loading. */
    receiptsLoading?: boolean;
    /** The statement this line belongs to (for cache invalidation). */
    statementId: number;
    /** Account currency for formatting. */
    currency: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────

function matchStatusBadge(status: MatchStatus, small = false) {
    const cls = small ? "text-[9px] h-4 px-1.5" : "text-[9px] h-5 px-2";
    switch (status) {
        case "perfect_matched":
            return (
                <Badge variant="default" className={cls}>
                    <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2.5}
                        className="size-2.5 mr-0.5"
                    />
                    Perfect
                </Badge>
            );
        case "bundle_matched":
            return (
                <Badge variant="secondary" className={cls}>
                    <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2.5}
                        className="size-2.5 mr-0.5"
                    />
                    Bundle
                </Badge>
            );
        case "manual":
            return (
                <Badge variant="outline" className={cls}>
                    <HugeiconsIcon
                        icon={ArrowDataTransferHorizontalIcon}
                        strokeWidth={2}
                        className="size-2.5 mr-0.5"
                    />
                    Manual
                </Badge>
            );
        default:
            return (
                <Badge
                    variant="outline"
                    className={cn(cls, "text-muted-foreground")}
                >
                    <HugeiconsIcon
                        icon={Alert02Icon}
                        strokeWidth={2}
                        className="size-2.5 mr-0.5"
                    />
                    Unmatched
                </Badge>
            );
    }
}

// ── Receipt file-open button ──────────────────────────────────────────

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
        <button
            type="button"
            onClick={() => setEnabled(true)}
            disabled={isLoading}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="View receipt file"
        >
            <HugeiconsIcon
                icon={LinkSquare02Icon}
                strokeWidth={2}
                className="size-3"
            />
        </button>
    );
}

// ── Left pane: line info + edit ───────────────────────────────────────

interface LineEditPaneProps {
    line: BankStatementLineRead;
    statementId: number;
    currency: string;
    onSaved: () => void;
}

function LineEditPane({
    line,
    statementId,
    currency,
    onSaved,
}: LineEditPaneProps) {
    const updateMutation = useUpdateStatementLine();

    const [vendor, setVendor] = React.useState(line.vendor);
    const [description, setDescription] = React.useState(line.description);
    const [charge, setCharge] = React.useState(String(line.charge));
    const [transactionDate, setTransactionDate] = React.useState(
        line.transaction_date,
    );
    const [postingDate, setPostingDate] = React.useState(line.posting_date);
    const [mcc, setMcc] = React.useState(line.mcc ?? "");
    const [txCalOpen, setTxCalOpen] = React.useState(false);
    const [postCalOpen, setPostCalOpen] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Re-sync when the line prop changes (new row selected).
    React.useEffect(() => {
        setVendor(line.vendor);
        setDescription(line.description);
        setCharge(String(line.charge));
        setTransactionDate(line.transaction_date);
        setPostingDate(line.posting_date);
        setMcc(line.mcc ?? "");
        setError(null);
    }, [line]);

    const isDirty =
        vendor !== line.vendor ||
        description !== line.description ||
        charge !== String(line.charge) ||
        transactionDate !== line.transaction_date ||
        postingDate !== line.posting_date ||
        mcc !== (line.mcc ?? "");

    function isoFromDate(d: Date): string {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    function handleSave() {
        setError(null);
        const body: BankStatementLineUpdate = {};
        if (vendor !== line.vendor) body.vendor = vendor;
        if (description !== line.description) body.description = description;
        if (charge !== String(line.charge)) {
            const parsed = parseFloat(charge);
            if (isNaN(parsed)) {
                setError("Charge must be a valid number.");
                return;
            }
            body.charge = parsed;
        }
        if (transactionDate !== line.transaction_date)
            body.transaction_date = transactionDate;
        if (postingDate !== line.posting_date) body.posting_date = postingDate;
        if (mcc !== (line.mcc ?? "")) body.mcc = mcc || undefined;

        if (Object.keys(body).length === 0) {
            onSaved();
            return;
        }

        updateMutation.mutate(
            { statementId, lineId: line.line_id, body },
            {
                onSuccess: () => onSaved(),
                onError: (err) =>
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to save changes.",
                    ),
            },
        );
    }

    const isBusy = updateMutation.isPending;
    const isDebit = line.charge > 0;

    return (
        <div className="flex flex-col gap-0 h-full">
            {/* Static metadata block */}
            <div className="flex flex-col gap-2.5 px-4 pt-4 pb-3">
                {/* Reference + status */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5">
                        #{line.line_number}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate flex-1">
                        {line.reference_number}
                    </span>
                    {matchStatusBadge(line.match_status)}
                </div>

                {/* Charge amount */}
                <div className="flex items-baseline gap-2">
                    <span
                        className={cn(
                            "text-2xl font-mono font-semibold tabular-nums",
                            isDebit ? "text-destructive" : "text-primary",
                        )}
                    >
                        {isDebit ? "−" : "+"}
                        {formatCurrency(Math.abs(line.charge), currency)}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                        {line.currency}
                    </span>
                </div>
            </div>

            <Separator />

            {/* Editable fields */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="flex flex-col gap-3 px-4 py-3">
                    {/* Vendor */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="sl-vendor" className="text-xs">
                            Vendor
                        </Label>
                        <Input
                            id="sl-vendor"
                            value={vendor}
                            onChange={(e) => setVendor(e.target.value)}
                            disabled={isBusy}
                            className="h-7 text-xs"
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="sl-description" className="text-xs">
                            Description
                        </Label>
                        <Input
                            id="sl-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isBusy}
                            className="h-7 text-xs"
                        />
                    </div>

                    {/* Charge */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="sl-charge" className="text-xs">
                            Charge
                        </Label>
                        <Input
                            id="sl-charge"
                            type="number"
                            step="0.01"
                            value={charge}
                            onChange={(e) => setCharge(e.target.value)}
                            disabled={isBusy}
                            className="h-7 text-xs font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Positive = debit/expense · Negative = credit/refund
                        </p>
                    </div>

                    {/* Transaction date */}
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Transaction Date</Label>
                        <Popover open={txCalOpen} onOpenChange={setTxCalOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isBusy}
                                    className={cn(
                                        "h-7 w-full justify-start text-left font-normal gap-1.5 text-xs",
                                        !transactionDate &&
                                            "text-muted-foreground",
                                    )}
                                >
                                    <HugeiconsIcon
                                        icon={Calendar03Icon}
                                        strokeWidth={2}
                                        className="size-3 shrink-0"
                                    />
                                    {transactionDate
                                        ? new Date(
                                              transactionDate + "T00:00:00",
                                          ).toLocaleDateString(undefined, {
                                              year: "numeric",
                                              month: "short",
                                              day: "numeric",
                                          })
                                        : "Pick a date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-auto p-0"
                                align="start"
                            >
                                <Calendar
                                    mode="single"
                                    selected={
                                        transactionDate
                                            ? new Date(
                                                  transactionDate + "T00:00:00",
                                              )
                                            : undefined
                                    }
                                    onSelect={(d) => {
                                        setTransactionDate(
                                            d ? isoFromDate(d) : "",
                                        );
                                        setTxCalOpen(false);
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Posting date */}
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Posting Date</Label>
                        <Popover
                            open={postCalOpen}
                            onOpenChange={setPostCalOpen}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isBusy}
                                    className={cn(
                                        "h-7 w-full justify-start text-left font-normal gap-1.5 text-xs",
                                        !postingDate && "text-muted-foreground",
                                    )}
                                >
                                    <HugeiconsIcon
                                        icon={Calendar03Icon}
                                        strokeWidth={2}
                                        className="size-3 shrink-0"
                                    />
                                    {postingDate
                                        ? new Date(
                                              postingDate + "T00:00:00",
                                          ).toLocaleDateString(undefined, {
                                              year: "numeric",
                                              month: "short",
                                              day: "numeric",
                                          })
                                        : "Pick a date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-auto p-0"
                                align="start"
                            >
                                <Calendar
                                    mode="single"
                                    selected={
                                        postingDate
                                            ? new Date(
                                                  postingDate + "T00:00:00",
                                              )
                                            : undefined
                                    }
                                    onSelect={(d) => {
                                        setPostingDate(d ? isoFromDate(d) : "");
                                        setPostCalOpen(false);
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* MCC */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="sl-mcc" className="text-xs">
                            MCC{" "}
                            <span className="text-muted-foreground font-normal">
                                (optional)
                            </span>
                        </Label>
                        <Input
                            id="sl-mcc"
                            value={mcc}
                            onChange={(e) => setMcc(e.target.value)}
                            placeholder="e.g. 5812"
                            maxLength={10}
                            disabled={isBusy}
                            className="h-7 text-xs font-mono"
                        />
                    </div>
                </div>
            </ScrollArea>

            {error && (
                <p className="px-4 py-1.5 text-[11px] text-destructive bg-destructive/5 border-t border-destructive/20">
                    {error}
                </p>
            )}

            <Separator />

            <div className="px-4 py-3 flex items-center justify-end gap-2">
                <DialogClose asChild>
                    <Button variant="outline" size="sm" disabled={isBusy}>
                        Cancel
                    </Button>
                </DialogClose>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!isDirty || isBusy}
                >
                    {isBusy ? (
                        <>
                            <span
                                className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                                aria-hidden
                            />
                            Saving…
                        </>
                    ) : (
                        "Save Changes"
                    )}
                </Button>
            </div>
        </div>
    );
}

// ── Receipt card within the right pane ───────────────────────────────

interface ReceiptCardProps {
    receipt: ReceiptRead;
    matchForThisLine: ReconciliationMatchRead | undefined;
    isLinking: boolean;
    isUnlinking: boolean;
    /** True when the current statement line is unmatched — bundle-linking is allowed. */
    lineIsUnmatched: boolean;
    currency: string;
    onLink: (receiptId: number) => void;
    onUnlink: (matchId: number) => void;
}

function ReceiptCard({
    receipt,
    matchForThisLine,
    isLinking,
    isUnlinking,
    lineIsUnmatched,
    currency,
    onLink,
    onUnlink,
}: ReceiptCardProps) {
    const isLinkedToThisLine = matchForThisLine !== undefined;
    const isLinkedElsewhere =
        !isLinkedToThisLine && receipt.match_status !== "unmatched";
    // Bundle-linking: receipt is matched elsewhere but we can still attach it
    // to this unmatched line (forming a bundle match).
    const canBundleLink = isLinkedElsewhere && lineIsUnmatched;

    return (
        <div
            className={cn(
                "flex flex-col gap-1.5 rounded-none border px-3 py-2.5 transition-colors",
                isLinkedToThisLine
                    ? "border-primary/40 bg-primary/5"
                    : isLinkedElsewhere && !canBundleLink
                      ? "border-border bg-muted/30 opacity-60"
                      : "border-border bg-background hover:bg-muted/40",
            )}
        >
            {/* Top row: vendor + status + actions */}
            <div className="flex items-start gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <HugeiconsIcon
                        icon={Invoice02Icon}
                        strokeWidth={2}
                        className="size-3 shrink-0 text-muted-foreground"
                    />
                    <span className="text-xs font-medium truncate">
                        {receipt.vendor}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {matchStatusBadge(receipt.match_status, true)}
                    {canBundleLink && (
                        <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30"
                        >
                            Bundle
                        </Badge>
                    )}
                    {receipt.file_name && (
                        <ReceiptFileLink receiptId={receipt.receipt_id} />
                    )}
                </div>
            </div>

            {/* Middle row: amount + date + invoice */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                <span className="tabular-nums font-mono font-medium text-foreground">
                    {formatCurrency(receipt.charged_amount, currency)}
                </span>
                <span>{receipt.billing_date}</span>
                {receipt.invoice_number && (
                    <span className="font-mono text-[10px]">
                        #{receipt.invoice_number}
                    </span>
                )}
                {receipt.expense_type && (
                    <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1.5"
                    >
                        {receipt.expense_type}
                    </Badge>
                )}
            </div>

            {/* File name */}
            {receipt.file_name && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <HugeiconsIcon
                        icon={File01Icon}
                        strokeWidth={2}
                        className="size-2.5 shrink-0"
                    />
                    <span className="truncate">{receipt.file_name}</span>
                </div>
            )}

            {/* Description */}
            {receipt.description && (
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {receipt.description}
                </p>
            )}

            {/* Action button */}
            <div className="pt-0.5 flex flex-col gap-1">
                {isLinkedToThisLine ? (
                    <Button
                        variant="outline"
                        size="xs"
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={isUnlinking}
                        onClick={() => onUnlink(matchForThisLine.match_id)}
                    >
                        {isUnlinking ? (
                            <span
                                className="size-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin"
                                aria-hidden
                            />
                        ) : (
                            <HugeiconsIcon
                                icon={Delete02Icon}
                                strokeWidth={2}
                                className="size-3"
                            />
                        )}
                        Remove Match
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="xs"
                        className={cn(
                            "gap-1",
                            canBundleLink &&
                                "border-amber-400/60 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30",
                        )}
                        disabled={
                            isLinking || (isLinkedElsewhere && !canBundleLink)
                        }
                        title={
                            canBundleLink
                                ? "Add to bundle — this receipt is already matched to another line"
                                : isLinkedElsewhere
                                  ? "Already matched to another line (line is not unmatched)"
                                  : "Manually link this receipt to the transaction"
                        }
                        onClick={() => onLink(receipt.receipt_id)}
                    >
                        {isLinking ? (
                            <span
                                className="size-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin"
                                aria-hidden
                            />
                        ) : (
                            <HugeiconsIcon
                                icon={ArrowDataTransferHorizontalIcon}
                                strokeWidth={2}
                                className="size-3"
                            />
                        )}
                        {canBundleLink ? "Add to Bundle" : "Link Receipt"}
                    </Button>
                )}
                {canBundleLink && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                        Already matched elsewhere. Linking will create a bundle
                        match.
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Right pane: receipt matcher ───────────────────────────────────────

interface ReceiptMatchPaneProps {
    line: BankStatementLineRead;
    receipts: ReceiptRead[];
    receiptsLoading: boolean;
    statementId: number;
    currency: string;
}

function ReceiptMatchPane({
    line,
    receipts,
    receiptsLoading,
    statementId,
    currency,
}: ReceiptMatchPaneProps) {
    const [search, setSearch] = React.useState("");
    const [filterMode, setFilterMode] = React.useState<
        "all" | "unmatched" | "matched"
    >("all");

    const { data: matchesData, isLoading: matchesLoading } = useMatchesByLine(
        line.line_id,
    );

    const createMatch = useCreateManualMatch(statementId);
    const removeMatch = useDeleteMatch(statementId, line.line_id);

    // The set of receipt_ids already linked to THIS line.
    const matchesByReceiptId = React.useMemo(() => {
        const map = new Map<number, ReconciliationMatchRead>();
        for (const m of matchesData?.matches ?? []) {
            map.set(m.receipt_id, m);
        }
        return map;
    }, [matchesData]);

    // Track which individual receipt is in-flight (for per-card spinners).
    const [linkingReceiptId, setLinkingReceiptId] = React.useState<
        number | null
    >(null);
    const [unlinkingMatchId, setUnlinkingMatchId] = React.useState<
        number | null
    >(null);

    async function handleLink(receiptId: number) {
        setLinkingReceiptId(receiptId);
        try {
            await createMatch.mutateAsync({
                line_id: line.line_id,
                receipt_ids: [receiptId],
                match_type: "manual",
            });
        } finally {
            setLinkingReceiptId(null);
        }
    }

    async function handleUnlink(matchId: number) {
        setUnlinkingMatchId(matchId);
        try {
            await removeMatch.mutateAsync(matchId);
        } finally {
            setUnlinkingMatchId(null);
        }
    }

    const lineIsUnmatched = line.match_status === "unmatched";

    const filteredReceipts = React.useMemo(() => {
        let list = receipts;
        if (filterMode === "unmatched") {
            // When bundle-linking is possible, also show receipts already
            // linked to THIS line so the user can remove them if needed.
            list = list.filter(
                (r) =>
                    r.match_status === "unmatched" ||
                    matchesByReceiptId.has(r.receipt_id),
            );
        } else if (filterMode === "matched") {
            list = list.filter(
                (r) =>
                    r.match_status !== "unmatched" ||
                    matchesByReceiptId.has(r.receipt_id),
            );
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
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
    }, [receipts, filterMode, search, matchesByReceiptId]);

    // Linked receipts always float to the top.
    const sortedReceipts = React.useMemo(() => {
        return [...filteredReceipts].sort((a, b) => {
            const aLinked = matchesByReceiptId.has(a.receipt_id) ? 0 : 1;
            const bLinked = matchesByReceiptId.has(b.receipt_id) ? 0 : 1;
            return aLinked - bLinked;
        });
    }, [filteredReceipts, matchesByReceiptId]);

    const linkedCount = matchesByReceiptId.size;
    const isLoading = receiptsLoading || matchesLoading;

    return (
        <div className="flex flex-col gap-0 h-full">
            {/* Pane header */}
            <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5">
                <div>
                    <h3 className="text-sm font-medium">Receipts</h3>
                    <p className="text-[11px] text-muted-foreground">
                        {receipts.length} receipt
                        {receipts.length !== 1 ? "s" : ""} this month
                        {linkedCount > 0 && (
                            <>
                                {" · "}
                                <span className="text-primary">
                                    {linkedCount} linked to this line
                                </span>
                            </>
                        )}
                    </p>
                </div>

                {/* Search */}
                <div className="relative">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search receipts…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-7 w-full rounded-none border border-input bg-transparent pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    />
                </div>

                {/* Filter pills */}
                <div className="flex items-center border border-input rounded-none">
                    {(
                        [
                            ["all", "All"],
                            ["unmatched", "Unmatched"],
                            ["matched", "Matched"],
                        ] as const
                    ).map(([mode, label], i, arr) => (
                        <React.Fragment key={mode}>
                            <Button
                                variant={
                                    filterMode === mode ? "secondary" : "ghost"
                                }
                                size="xs"
                                onClick={() => setFilterMode(mode)}
                                className="rounded-none border-0 flex-1"
                            >
                                {label}
                            </Button>
                            {i < arr.length - 1 && (
                                <Separator
                                    orientation="vertical"
                                    className="h-4"
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Receipt list */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="flex flex-col gap-2 px-4 py-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                            <span
                                className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                                aria-hidden
                            />
                            Loading receipts…
                        </div>
                    ) : sortedReceipts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-1 text-center">
                            <HugeiconsIcon
                                icon={Invoice02Icon}
                                strokeWidth={1.5}
                                className="size-8 text-muted-foreground/40"
                            />
                            <p className="text-xs text-muted-foreground">
                                {receipts.length === 0
                                    ? "No receipts uploaded for this month."
                                    : "No receipts match the current filter."}
                            </p>
                        </div>
                    ) : (
                        sortedReceipts.map((receipt) => (
                            <ReceiptCard
                                key={receipt.receipt_id}
                                receipt={receipt}
                                matchForThisLine={matchesByReceiptId.get(
                                    receipt.receipt_id,
                                )}
                                isLinking={
                                    linkingReceiptId === receipt.receipt_id
                                }
                                isUnlinking={
                                    unlinkingMatchId ===
                                    matchesByReceiptId.get(receipt.receipt_id)
                                        ?.match_id
                                }
                                lineIsUnmatched={lineIsUnmatched}
                                currency={currency}
                                onLink={handleLink}
                                onUnlink={handleUnlink}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// ── Root dialog ───────────────────────────────────────────────────────

export function StatementLineDialog({
    line,
    receipts,
    receiptsLoading = false,
    statementId,
    currency,
    open,
    onOpenChange,
}: StatementLineDialogProps) {
    // Close guard: reset editing state when dialog closes.
    function handleOpenChange(next: boolean) {
        onOpenChange(next);
    }

    if (!line) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className={cn(
                    // Wide two-column layout — override the default sm:max-w-sm
                    "sm:max-w-6xl w-[calc(100vw-2rem)]",
                    // Fixed height so both panes scroll independently
                    "h-[90vh] max-h-224",
                    "p-0 gap-0 overflow-hidden",
                )}
                showCloseButton
            >
                {/* Visually hidden a11y title / description */}
                <DialogHeader className="sr-only">
                    <DialogTitle>
                        Statement Line — {line.vendor || line.description}
                    </DialogTitle>
                    <DialogDescription>
                        Edit statement line details and manually match receipts.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex h-full overflow-hidden">
                    {/* ── Left: line editor ── */}
                    <div className="flex flex-col w-85 shrink-0 border-r border-border overflow-hidden">
                        {/* Pane title */}
                        <div className="px-4 pt-3 pb-0 shrink-0">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Transaction Detail
                            </p>
                        </div>
                        <LineEditPane
                            line={line}
                            statementId={statementId}
                            currency={currency}
                            onSaved={() => onOpenChange(false)}
                        />
                    </div>

                    {/* ── Right: receipt matcher ── */}
                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                        {/* Pane title */}
                        <div className="px-4 pt-3 pb-0 shrink-0">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Manual Matching
                            </p>
                        </div>
                        <ReceiptMatchPane
                            line={line}
                            receipts={receipts}
                            receiptsLoading={receiptsLoading}
                            statementId={statementId}
                            currency={currency}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

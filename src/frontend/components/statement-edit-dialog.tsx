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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Delete02Icon,
    Alert02Icon,
    Tick02Icon,
    LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { useUpdateStatement, useDeleteStatement } from "@/hooks/use-statements";
import { useStatementFileUrl } from "@/hooks/use-statements";
import type { BankStatementRead, BankStatementUpdate } from "@/lib/types";
import { formatCurrency } from "@/lib/domain-types";

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

interface StatementEditDialogProps {
    statement: BankStatementRead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called after a successful delete so the parent can navigate away. */
    onDeleted?: () => void;
}

export function StatementEditDialog({
    statement,
    open,
    onOpenChange,
    onDeleted,
}: StatementEditDialogProps) {
    const updateMutation = useUpdateStatement();
    const deleteMutation = useDeleteStatement();

    // File-URL lazy load (same pattern as ReceiptEditDialog)
    const [fileViewEnabled, setFileViewEnabled] = React.useState(false);
    const { data: fileUrlData, isLoading: fileUrlLoading } =
        useStatementFileUrl(
            fileViewEnabled && statement ? statement.statement_id : null,
        );

    React.useEffect(() => {
        if (fileUrlData?.url) {
            window.open(fileUrlData.url, "_blank", "noopener,noreferrer");
            setFileViewEnabled(false);
        }
    }, [fileUrlData?.url]);

    // ── Form state ────────────────────────────────────────────────────
    const [month, setMonth] = React.useState("");
    const [year, setYear] = React.useState("");
    const [last4, setLast4] = React.useState("");
    const [currency, setCurrency] = React.useState("");
    // const [totalAmount, setTotalAmount] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    // Sync when dialog opens or statement changes
    React.useEffect(() => {
        if (statement && open) {
            setMonth(String(statement.month));
            setYear(String(statement.year));
            setLast4(statement.account_number_last4);
            setCurrency(statement.currency);
            // setTotalAmount(String(statement.total_amount));
            setError(null);
            setFileViewEnabled(false);
        }
    }, [statement, open]);

    if (!statement) return null;

    const isDirty =
        month !== String(statement.month) ||
        year !== String(statement.year) ||
        last4 !== statement.account_number_last4 ||
        currency !== statement.currency;
    // totalAmount !== String(statement.total_amount);

    function handleSave() {
        if (!statement) return;
        setError(null);

        const body: BankStatementUpdate = {};

        const parsedMonth = parseInt(month, 10);
        if (month !== String(statement.month)) {
            if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
                setError("Month must be a number between 1 and 12.");
                return;
            }
            body.month = parsedMonth;
        }

        const parsedYear = parseInt(year, 10);
        if (year !== String(statement.year)) {
            if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
                setError("Year must be between 2000 and 2100.");
                return;
            }
            body.year = parsedYear;
        }

        if (last4 !== statement.account_number_last4) {
            if (last4.length !== 4 || !/^\d{4}$/.test(last4)) {
                setError("Account number last 4 must be exactly 4 digits.");
                return;
            }
            body.account_number_last4 = last4;
        }

        if (currency !== statement.currency) {
            if (currency.length !== 3) {
                setError("Currency must be a 3-letter code (e.g. USD).");
                return;
            }
            body.currency = currency;
        }

        // if (totalAmount !== String(statement.total_amount)) {
        //     const parsedAmount = parseFloat(totalAmount);
        //     if (isNaN(parsedAmount)) {
        //         setError("Total amount must be a valid number.");
        //         return;
        //     }
        //     body.total_amount = parsedAmount;
        // }

        if (Object.keys(body).length === 0) {
            onOpenChange(false);
            return;
        }

        updateMutation.mutate(
            { statementId: statement.statement_id, body },
            {
                onSuccess: () => {
                    onOpenChange(false);
                },
                onError: (err) => {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to update statement.",
                    );
                },
            },
        );
    }

    function handleDelete() {
        if (!statement || !statement.document_id) return;
        setError(null);

        deleteMutation.mutate(statement.document_id, {
            onSuccess: () => {
                onOpenChange(false);
                onDeleted?.();
            },
            onError: (err) => {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to delete statement.",
                );
            },
        });
    }

    const canDelete = statement.document_id !== null;
    const isBusy = updateMutation.isPending || deleteMutation.isPending;

    const reconcileLabel = statement.reconciled ? (
        <Badge variant="default" className="text-[9px] h-4 px-1.5">
            <HugeiconsIcon
                icon={Tick02Icon}
                strokeWidth={2.5}
                className="size-2.5 mr-0.5"
            />
            Reconciled
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
            Pending
        </Badge>
    );

    const monthName =
        MONTH_NAMES[(statement.month ?? 1) - 1] ?? `Month ${statement.month}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Edit Statement
                        {reconcileLabel}
                    </DialogTitle>
                    <DialogDescription>
                        Modify the bank statement metadata below.{" "}
                        {statement.file_name && (
                            <>
                                Source file:{" "}
                                <span className="font-mono text-foreground">
                                    {statement.file_name}
                                </span>
                            </>
                        )}
                    </DialogDescription>
                    {statement.file_name && (
                        <Button
                            variant="outline"
                            size="xs"
                            className="w-fit gap-1.5 mt-1"
                            onClick={() => setFileViewEnabled(true)}
                            disabled={fileUrlLoading || fileViewEnabled}
                        >
                            <HugeiconsIcon
                                icon={LinkSquare02Icon}
                                strokeWidth={2}
                                className="size-3 shrink-0"
                            />
                            {fileUrlLoading ? "Loading…" : "View File"}
                        </Button>
                    )}
                </DialogHeader>

                <Separator />

                {/* Read-only stats row */}
                <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div>
                        <p className="font-medium text-foreground tabular-nums">
                            {statement.line_count}
                        </p>
                        <p>Lines</p>
                    </div>
                    <div>
                        <p className="font-medium text-foreground tabular-nums">
                            {statement.match_rate}%
                        </p>
                        <p>Match Rate</p>
                    </div>
                    <div>
                        <p className="font-medium text-foreground font-mono tabular-nums">
                            {formatCurrency(
                                statement.total_amount,
                                statement.currency,
                            )}
                        </p>
                        <p>
                            {monthName} {statement.year}
                        </p>
                    </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                    {/* Row 1: Month + Year */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="stmt-month">Month</Label>
                            <Input
                                id="stmt-month"
                                type="number"
                                min={1}
                                max={12}
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                placeholder="1–12"
                                disabled={isBusy}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="stmt-year">Year</Label>
                            <Input
                                id="stmt-year"
                                type="number"
                                min={2000}
                                max={2100}
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="e.g. 2024"
                                disabled={isBusy}
                            />
                        </div>
                    </div>

                    {/* Row 2: Currency + Last 4 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="stmt-currency">Currency</Label>
                            <Input
                                id="stmt-currency"
                                value={currency}
                                onChange={(e) =>
                                    setCurrency(e.target.value.toUpperCase())
                                }
                                placeholder="USD"
                                maxLength={3}
                                disabled={isBusy}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="stmt-last4">
                                Account Last 4 Digits
                            </Label>
                            <Input
                                id="stmt-last4"
                                value={last4}
                                onChange={(e) =>
                                    setLast4(
                                        e.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 4),
                                    )
                                }
                                placeholder="e.g. 4242"
                                maxLength={4}
                                disabled={isBusy}
                            />
                        </div>
                    </div>

                    {/* Row 3: Total Amount */}
                    {/*<div className="grid gap-1.5">
                        <Label htmlFor="stmt-total">Total Amount</Label>
                        <Input
                            id="stmt-total"
                            type="number"
                            step="0.01"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            placeholder="0.00"
                            disabled={isBusy}
                        />
                    </div>*/}
                </div>

                {error && <p className="text-destructive text-xs">{error}</p>}

                <Separator />

                <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    {/* Delete — guarded by a nested AlertDialog */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                                disabled={isBusy || !canDelete}
                            >
                                <HugeiconsIcon
                                    icon={Delete02Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Delete Statement
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Delete Statement
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the{" "}
                                    <strong>
                                        {monthName} {statement.year}
                                    </strong>{" "}
                                    bank statement, all{" "}
                                    <strong>{statement.line_count}</strong>{" "}
                                    transaction lines, every linked receipt, and
                                    all reconciliation matches. This action
                                    cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel size="sm">
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={isBusy}
                                >
                                    {deleteMutation.isPending
                                        ? "Deleting…"
                                        : "Delete"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <div className="flex items-center gap-2">
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isBusy}
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!isDirty || isBusy}
                        >
                            {updateMutation.isPending
                                ? "Saving…"
                                : "Save Changes"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

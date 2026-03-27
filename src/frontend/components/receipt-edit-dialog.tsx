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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Delete02Icon,
    Tick02Icon,
    Alert02Icon,
    Cancel01Icon,
    LinkSquare02Icon,
    Calendar03Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useUpdateReceipt, useReceiptFileUrl } from "@/hooks/use-receipts";
import { useDeleteDocument } from "@/hooks/use-documents";
import type { ReceiptRead, ReceiptUpdate } from "@/lib/types";
import { formatCurrency } from "@/lib/domain-types";

interface ReceiptEditDialogProps {
    receipt: ReceiptRead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currency: string;
    /** When true, fields are read-only and save/delete are hidden (viewer). */
    readOnly?: boolean;
    /** When true, do not offer opening the original receipt file (e.g. statement archived). */
    hideSourceFile?: boolean;
}

export function ReceiptEditDialog({
    receipt,
    open,
    onOpenChange,
    currency,
    readOnly = false,
    hideSourceFile = false,
}: ReceiptEditDialogProps) {
    const updateMutation = useUpdateReceipt();
    const deleteMutation = useDeleteDocument();

    const [fileViewEnabled, setFileViewEnabled] = React.useState(false);
    const { data: fileUrlData, isLoading: fileUrlLoading } = useReceiptFileUrl(
        fileViewEnabled && receipt ? receipt.receipt_id : null,
    );

    React.useEffect(() => {
        if (fileUrlData?.url) {
            window.open(fileUrlData.url, "_blank", "noopener,noreferrer");
            setFileViewEnabled(false);
        }
    }, [fileUrlData?.url]);

    const [vendor, setVendor] = React.useState("");
    const [invoiceNumber, setInvoiceNumber] = React.useState("");
    const [billingDate, setBillingDate] = React.useState("");
    const [calendarOpen, setCalendarOpen] = React.useState(false);
    const [chargedAmount, setChargedAmount] = React.useState("");
    const [currencyField, setCurrencyField] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [expenseType, setExpenseType] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    // Sync form state when receipt changes or dialog opens
    React.useEffect(() => {
        if (receipt && open) {
            setVendor(receipt.vendor);
            setInvoiceNumber(receipt.invoice_number ?? "");
            setBillingDate(receipt.billing_date);
            setChargedAmount(String(receipt.charged_amount));
            setCurrencyField(receipt.currency);
            setDescription(receipt.description ?? "");
            setExpenseType(receipt.expense_type ?? "");
            setError(null);
        }
    }, [receipt, open]);

    if (!receipt) return null;

    const showSourceFile = Boolean(receipt.file_name) && !hideSourceFile;

    const isDirty =
        vendor !== receipt.vendor ||
        invoiceNumber !== (receipt.invoice_number ?? "") ||
        billingDate !== receipt.billing_date ||
        chargedAmount !== String(receipt.charged_amount) ||
        currencyField !== receipt.currency ||
        description !== (receipt.description ?? "") ||
        expenseType !== (receipt.expense_type ?? "");

    function handleSave() {
        if (!receipt || readOnly) return;
        setError(null);

        const body: ReceiptUpdate = {};
        if (vendor !== receipt.vendor) body.vendor = vendor;
        if (invoiceNumber !== (receipt.invoice_number ?? ""))
            body.invoice_number = invoiceNumber || undefined;
        if (billingDate !== receipt.billing_date)
            body.billing_date = billingDate;
        if (chargedAmount !== String(receipt.charged_amount)) {
            const parsed = parseFloat(chargedAmount);
            if (isNaN(parsed)) {
                setError("Amount must be a valid number.");
                return;
            }
            body.charged_amount = parsed;
        }
        if (currencyField !== receipt.currency) body.currency = currencyField;
        if (description !== (receipt.description ?? ""))
            body.description = description || undefined;
        if (expenseType !== (receipt.expense_type ?? ""))
            body.expense_type = expenseType || undefined;

        if (Object.keys(body).length === 0) {
            onOpenChange(false);
            return;
        }

        updateMutation.mutate(
            { receiptId: receipt.receipt_id, body },
            {
                onSuccess: () => {
                    onOpenChange(false);
                },
                onError: (err) => {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to update receipt.",
                    );
                },
            },
        );
    }

    function handleDelete() {
        if (!receipt || !receipt.document_id || readOnly) return;
        setError(null);

        deleteMutation.mutate(receipt.document_id, {
            onSuccess: () => {
                onOpenChange(false);
            },
            onError: (err) => {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to delete receipt.",
                );
            },
        });
    }

    const canDelete = receipt ? receipt.document_id !== null : false;

    const matchStatusLabel = (() => {
        switch (receipt.match_status) {
            case "perfect_matched":
                return (
                    <Badge variant="default" className="text-[9px] h-4 px-1.5">
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            strokeWidth={2.5}
                            className="size-2.5 mr-0.5"
                        />
                        Perfect Match
                    </Badge>
                );
            case "bundle_matched":
                return (
                    <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1.5"
                    >
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            strokeWidth={2.5}
                            className="size-2.5 mr-0.5"
                        />
                        Bundle Match
                    </Badge>
                );
            case "manual":
                return (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        Manual
                    </Badge>
                );
            default:
                return (
                    <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1.5 text-muted-foreground"
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
    })();

    const isBusy =
        updateMutation.isPending || deleteMutation.isPending || readOnly;

    const billingDateObj = billingDate
        ? new Date(billingDate + "T00:00:00")
        : undefined;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {readOnly ? "Receipt" : "Edit Receipt"}
                        {matchStatusLabel}
                    </DialogTitle>
                    <DialogDescription>
                        {readOnly
                            ? "Parsed receipt data for this month."
                            : "Modify the parsed receipt data below."}
                        {showSourceFile && (
                            <>
                                {" "}
                                Source file:{" "}
                                <span className="font-mono text-foreground">
                                    {receipt.file_name}
                                </span>
                            </>
                        )}
                    </DialogDescription>
                    {showSourceFile && (
                        <Button
                            variant="outline"
                            size="xs"
                            className="w-fit gap-1.5 mt-1"
                            onClick={() => setFileViewEnabled(true)}
                            disabled={fileUrlLoading}
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

                <div className="grid gap-3">
                    {/* Row 1: Vendor + Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="receipt-vendor">Vendor</Label>
                            <Input
                                id="receipt-vendor"
                                value={vendor}
                                onChange={(e) => setVendor(e.target.value)}
                                placeholder="Vendor name"
                                disabled={isBusy}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Billing Date</Label>
                            <Popover
                                open={calendarOpen}
                                onOpenChange={setCalendarOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isBusy}
                                        className={cn(
                                            "w-full justify-start text-left font-normal gap-1.5",
                                            !billingDate &&
                                                "text-muted-foreground",
                                        )}
                                    >
                                        <HugeiconsIcon
                                            icon={Calendar03Icon}
                                            strokeWidth={2}
                                            className="size-3.5 shrink-0"
                                        />
                                        {billingDate
                                            ? new Date(
                                                  billingDate + "T00:00:00",
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
                                        captionLayout="dropdown"
                                        startMonth={
                                            // start month = current year - 10 years
                                            new Date(
                                                new Date().getFullYear() - 10,
                                                0,
                                            )
                                        }
                                        endMonth={
                                            // end month = current year + 10 years
                                            new Date(
                                                new Date().getFullYear() + 10,
                                                11,
                                            )
                                        }
                                        selected={billingDateObj}
                                        defaultMonth={billingDateObj}
                                        onSelect={(date) => {
                                            if (date) {
                                                const yyyy = date.getFullYear();
                                                const mm = String(
                                                    date.getMonth() + 1,
                                                ).padStart(2, "0");
                                                const dd = String(
                                                    date.getDate(),
                                                ).padStart(2, "0");
                                                setBillingDate(
                                                    `${yyyy}-${mm}-${dd}`,
                                                );
                                            } else {
                                                setBillingDate("");
                                            }
                                            setCalendarOpen(false);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Row 2: Amount + Currency + Invoice # */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="receipt-amount">Amount</Label>
                            <Input
                                id="receipt-amount"
                                type="number"
                                step="0.01"
                                value={chargedAmount}
                                onChange={(e) =>
                                    setChargedAmount(e.target.value)
                                }
                                placeholder="0.00"
                                disabled={isBusy}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="receipt-currency">Currency</Label>
                            <Input
                                id="receipt-currency"
                                value={currencyField}
                                onChange={(e) =>
                                    setCurrencyField(
                                        e.target.value.toUpperCase(),
                                    )
                                }
                                placeholder="USD"
                                maxLength={3}
                                disabled={isBusy}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="receipt-invoice">Invoice #</Label>
                            <Input
                                id="receipt-invoice"
                                value={invoiceNumber}
                                onChange={(e) =>
                                    setInvoiceNumber(e.target.value)
                                }
                                placeholder="Optional"
                                disabled={isBusy}
                            />
                        </div>
                    </div>

                    {/* Row 3: Expense Type */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="receipt-expense-type">
                            Expense Type
                        </Label>
                        <Input
                            id="receipt-expense-type"
                            value={expenseType}
                            onChange={(e) => setExpenseType(e.target.value)}
                            placeholder="e.g. Travel, Office Supplies"
                            disabled={isBusy}
                        />
                    </div>

                    {/* Row 4: Description */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="receipt-description">Description</Label>
                        <Textarea
                            id="receipt-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description"
                            disabled={isBusy}
                            className="min-h-15"
                        />
                    </div>
                </div>

                {error && <p className="text-destructive text-xs">{error}</p>}

                <Separator />

                <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    {!readOnly && (
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
                                    Delete Receipt
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        Delete Receipt
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete this
                                        receipt? This will remove the receipt and
                                        its associated document. This action
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
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    <div
                        className={cn(
                            "flex items-center gap-2",
                            readOnly && "w-full justify-end",
                        )}
                    >
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                    readOnly
                                        ? false
                                        : updateMutation.isPending ||
                                          deleteMutation.isPending
                                }
                            >
                                {readOnly ? "Close" : "Cancel"}
                            </Button>
                        </DialogClose>
                        {!readOnly && (
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={!isDirty || isBusy}
                            >
                                {updateMutation.isPending
                                    ? "Saving…"
                                    : "Save Changes"}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

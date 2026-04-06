"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useCreateStatementLine } from "@/hooks/use-statements";
import type { BankStatementLineCreate } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────

function isoFromDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// ── Props ────────────────────────────────────────────────────────────

export interface CreateStatementLineDialogProps {
    statementId: number;
    currency: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// ── Component ────────────────────────────────────────────────────────

export function CreateStatementLineDialog({
    statementId,
    currency,
    open,
    onOpenChange,
}: CreateStatementLineDialogProps) {
    const createMutation = useCreateStatementLine();

    const today = isoFromDate(new Date());
    const [vendor, setVendor] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [charge, setCharge] = React.useState("");
    const [transactionDate, setTransactionDate] = React.useState(today);
    const [postingDate, setPostingDate] = React.useState(today);
    const [mcc, setMcc] = React.useState("");
    const [referenceNumber, setReferenceNumber] = React.useState("");
    const [lineCurrency, setLineCurrency] = React.useState(currency);
    const [txCalOpen, setTxCalOpen] = React.useState(false);
    const [postCalOpen, setPostCalOpen] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            const t = isoFromDate(new Date());
            setVendor("");
            setDescription("");
            setCharge("");
            setTransactionDate(t);
            setPostingDate(t);
            setMcc("");
            setReferenceNumber("");
            setLineCurrency(currency);
            setError(null);
        }
    }, [open, currency]);

    const isValid =
        vendor.trim().length > 0 &&
        description.trim().length > 0 &&
        charge.trim().length > 0 &&
        !isNaN(parseFloat(charge)) &&
        transactionDate.length > 0 &&
        postingDate.length > 0;

    function handleSubmit() {
        setError(null);
        const parsedCharge = parseFloat(charge);
        if (isNaN(parsedCharge)) {
            setError("Charge must be a valid number.");
            return;
        }
        const body: BankStatementLineCreate = {
            transaction_date: transactionDate,
            posting_date: postingDate,
            description: description.trim(),
            vendor: vendor.trim(),
            charge: parsedCharge,
            currency: lineCurrency || undefined,
            mcc: mcc.trim() || undefined,
            reference_number: referenceNumber.trim() || undefined,
        };
        createMutation.mutate(
            { statementId, body },
            {
                onSuccess: () => onOpenChange(false),
                onError: (err) =>
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to create line.",
                    ),
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>New Statement Line</DialogTitle>
                    <DialogDescription>
                        Manually add a transaction line to this statement.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-2">
                    {/* Vendor */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="csl-vendor" className="text-xs">
                            Vendor <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="csl-vendor"
                            value={vendor}
                            onChange={(e) => setVendor(e.target.value)}
                            placeholder="e.g. Amazon"
                            className="h-8 text-xs"
                            disabled={createMutation.isPending}
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="csl-description" className="text-xs">
                            Description{" "}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="csl-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Transaction description"
                            className="h-8 text-xs"
                            disabled={createMutation.isPending}
                        />
                    </div>

                    {/* Charge + Currency row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 grid gap-1.5">
                            <Label htmlFor="csl-charge" className="text-xs">
                                Charge{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="csl-charge"
                                type="number"
                                step="0.01"
                                value={charge}
                                onChange={(e) => setCharge(e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-xs font-mono"
                                disabled={createMutation.isPending}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Positive = debit · Negative = credit
                            </p>
                        </div>
                        <div className="grid gap-1.5 pb-6">
                            <Label htmlFor="csl-currency" className="text-xs">
                                Currency
                            </Label>
                            <Input
                                id="csl-currency"
                                value={lineCurrency}
                                onChange={(e) =>
                                    setLineCurrency(e.target.value.toUpperCase())
                                }
                                maxLength={3}
                                className="h-8 text-xs font-mono"
                                disabled={createMutation.isPending}
                            />
                        </div>
                    </div>

                    {/* Date pickers row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label className="text-xs">
                                Transaction Date{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Popover
                                open={txCalOpen}
                                onOpenChange={setTxCalOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={createMutation.isPending}
                                        className={cn(
                                            "h-8 w-full justify-start text-left font-normal gap-1.5 text-xs",
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
                                        captionLayout="dropdown"
                                        fromYear={2000}
                                        toYear={2100}
                                        selected={
                                            transactionDate
                                                ? new Date(
                                                    transactionDate +
                                                    "T00:00:00",
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

                        <div className="grid gap-1.5">
                            <Label className="text-xs">
                                Posting Date{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Popover
                                open={postCalOpen}
                                onOpenChange={setPostCalOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={createMutation.isPending}
                                        className={cn(
                                            "h-8 w-full justify-start text-left font-normal gap-1.5 text-xs",
                                            !postingDate &&
                                            "text-muted-foreground",
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
                                        captionLayout="dropdown"
                                        fromYear={2000}
                                        toYear={2100}
                                        selected={
                                            postingDate
                                                ? new Date(
                                                    postingDate + "T00:00:00",
                                                )
                                                : undefined
                                        }
                                        onSelect={(d) => {
                                            setPostingDate(
                                                d ? isoFromDate(d) : "",
                                            );
                                            setPostCalOpen(false);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Reference + MCC row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label
                                htmlFor="csl-reference"
                                className="text-xs"
                            >
                                Reference #
                                <span className="text-muted-foreground font-normal">
                                    {" "}
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="csl-reference"
                                value={referenceNumber}
                                onChange={(e) =>
                                    setReferenceNumber(e.target.value)
                                }
                                placeholder="Defaults to MANUAL"
                                className="h-8 text-xs font-mono"
                                disabled={createMutation.isPending}
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="csl-mcc" className="text-xs">
                                MCC
                                <span className="text-muted-foreground font-normal">
                                    {" "}
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="csl-mcc"
                                value={mcc}
                                onChange={(e) => setMcc(e.target.value)}
                                placeholder="e.g. 5812"
                                maxLength={10}
                                className="h-8 text-xs font-mono"
                                disabled={createMutation.isPending}
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <p className="text-[11px] text-destructive bg-destructive/5 border border-destructive/20 px-3 py-1.5">
                        {error}
                    </p>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!isValid || createMutation.isPending}
                    >
                        {createMutation.isPending ? (
                            <>
                                <span
                                    className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                                    aria-hidden
                                />
                                Creating…
                            </>
                        ) : (
                            <>
                                <HugeiconsIcon
                                    icon={Add01Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Create Line
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

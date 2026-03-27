"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useCreateAccount } from "@/hooks/use-accounts";
import type { AccountBookCreate, AccountType } from "@/lib/types";

interface AddAccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (accountId: number) => void;
}

const DEFAULT_ARCHIVE_MONTHS = 18;
const MIN_ARCHIVE_MONTHS = 1;
const MAX_ARCHIVE_MONTHS = 120;

const DEFAULT_BODY: AccountBookCreate = {
    bank_name: "",
    account_name: "",
    account_type: "credit_card",
    currency: "USD",
    account_number_last4: "",
    archive_after_months: DEFAULT_ARCHIVE_MONTHS,
};

function onlyDigits(value: string): string {
    return value.replace(/\D/g, "");
}

export function AddAccountDialog({
    open,
    onOpenChange,
    onCreated,
}: AddAccountDialogProps) {
    const createAccount = useCreateAccount();
    const [body, setBody] = React.useState<AccountBookCreate>(DEFAULT_BODY);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setBody(DEFAULT_BODY);
            setError(null);
        }
    }, [open]);

    const isSubmitting = createAccount.isPending;

    const archiveMonths = body.archive_after_months ?? DEFAULT_ARCHIVE_MONTHS;
    const archiveOk =
        Number.isInteger(archiveMonths) &&
        archiveMonths >= MIN_ARCHIVE_MONTHS &&
        archiveMonths <= MAX_ARCHIVE_MONTHS;

    const currencyTrimmed = (body.currency ?? "").trim();

    const canSubmit =
        body.bank_name.trim().length > 0 &&
        body.account_name.trim().length > 0 &&
        (body.account_type === "credit_card" || body.account_type === "checking") &&
        currencyTrimmed.length > 0 &&
        body.account_number_last4.trim().length === 4 &&
        archiveOk;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit || isSubmitting) return;
        setError(null);
        try {
            const created = await createAccount.mutateAsync({
                bank_name: body.bank_name.trim(),
                account_name: body.account_name.trim(),
                account_type: body.account_type ?? "credit_card",
                currency: currencyTrimmed.toUpperCase(),
                account_number_last4: body.account_number_last4.trim(),
                archive_after_months:
                    body.archive_after_months ?? DEFAULT_ARCHIVE_MONTHS,
            });
            onOpenChange(false);
            onCreated?.(created.account_id);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create account";
            setError(message);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add account book</DialogTitle>
                    <DialogDescription>
                        Create a new account book to organize statements and reconciliation.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="bank_name">Bank name</Label>
                        <Input
                            id="bank_name"
                            value={body.bank_name}
                            onChange={(e) =>
                                setBody((prev) => ({
                                    ...prev,
                                    bank_name: e.target.value,
                                }))
                            }
                            placeholder="e.g. Chase"
                            autoComplete="off"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="account_name">Account name</Label>
                        <Input
                            id="account_name"
                            value={body.account_name}
                            onChange={(e) =>
                                setBody((prev) => ({
                                    ...prev,
                                    account_name: e.target.value,
                                }))
                            }
                            placeholder="e.g. Team Card"
                            autoComplete="off"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Account type</Label>
                        <Select
                            value={body.account_type ?? "credit_card"}
                            onValueChange={(v) =>
                                setBody((prev) => ({
                                    ...prev,
                                    account_type: v as AccountType,
                                }))
                            }
                            disabled={isSubmitting}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="credit_card">Credit card</SelectItem>
                                <SelectItem value="checking">Checking</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
                            id="currency"
                            value={body.currency ?? "USD"}
                            onChange={(e) =>
                                setBody((prev) => ({
                                    ...prev,
                                    currency: e.target.value,
                                }))
                            }
                            placeholder="USD"
                            autoComplete="off"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="account_number_last4">Account number (last 4)</Label>
                        <Input
                            id="account_number_last4"
                            inputMode="numeric"
                            maxLength={4}
                            value={body.account_number_last4}
                            onChange={(e) => {
                                const digits = onlyDigits(e.target.value).slice(0, 4);
                                setBody((prev) => ({
                                    ...prev,
                                    account_number_last4: digits,
                                }));
                            }}
                            placeholder="1234"
                            autoComplete="off"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="archive_after_months">
                            Archive statements after (months)
                        </Label>
                        <Input
                            id="archive_after_months"
                            type="number"
                            min={MIN_ARCHIVE_MONTHS}
                            max={MAX_ARCHIVE_MONTHS}
                            value={body.archive_after_months ?? DEFAULT_ARCHIVE_MONTHS}
                            onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                setBody((prev) => ({
                                    ...prev,
                                    archive_after_months: Number.isNaN(n)
                                        ? undefined
                                        : n,
                                }));
                            }}
                            disabled={isSubmitting}
                            className="font-mono tabular-nums"
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Default {DEFAULT_ARCHIVE_MONTHS} months (range{" "}
                            {MIN_ARCHIVE_MONTHS}–{MAX_ARCHIVE_MONTHS}).
                        </p>
                    </div>

                    {error && (
                        <div className="text-xs text-destructive" role="alert">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit || isSubmitting}>
                            {isSubmitting && (
                                <span
                                    className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                                    aria-hidden
                                />
                            )}
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}


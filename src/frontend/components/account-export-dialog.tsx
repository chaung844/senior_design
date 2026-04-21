"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon, Invoice02Icon } from "@hugeicons/core-free-icons";
import {
    ExportRow,
    type ExportItemState,
} from "@/components/export/export-row";
import type { AccountBook } from "@/lib/domain-types";
import { MONTH_LABELS } from "@/lib/constants";
import { downloadAccountVendorSheet } from "@/lib/api";

/** Matches backend `MAX_EXPORT_MONTH_SPAN_INCLUSIVE` (10 years). */
const MAX_EXPORT_MONTH_SPAN_INCLUSIVE = 120;

function monthOrdinal(year: number, month: number): number {
    return year * 12 + month;
}

function validateAccountVendorSheetRange(
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
): string | null {
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
        return "Each month must be between 1 and 12.";
    }
    const startOrd = monthOrdinal(startYear, startMonth);
    const endOrd = monthOrdinal(endYear, endMonth);
    if (startOrd > endOrd) {
        return "Start period must be on or before end period.";
    }
    if (endOrd - startOrd + 1 > MAX_EXPORT_MONTH_SPAN_INCLUSIVE) {
        return `Date range cannot exceed ${MAX_EXPORT_MONTH_SPAN_INCLUSIVE} months.`;
    }
    return null;
}

function getDefaultExportRange(account: AccountBook): {
    start_year: number;
    start_month: number;
    end_year: number;
    end_month: number;
} {
    const years = account.years;
    if (years.length === 0) {
        const y = new Date().getFullYear();
        return {
            start_year: y,
            start_month: 1,
            end_year: y,
            end_month: 12,
        };
    }
    const byYear = [...years].sort((a, b) => a.year - b.year);
    const firstY = byYear[0];
    const lastY = byYear[byYear.length - 1];
    const monthsFirst = firstY.months.map((m) => m.month);
    const monthsLast = lastY.months.map((m) => m.month);
    const startMonth = monthsFirst.length > 0 ? Math.min(...monthsFirst) : 1;
    const endMonth = monthsLast.length > 0 ? Math.max(...monthsLast) : 12;
    return {
        start_year: firstY.year,
        start_month: startMonth,
        end_year: lastY.year,
        end_month: endMonth,
    };
}

function buildYearOptions(account: AccountBook): number[] {
    const set = new Set<number>();
    const cy = new Date().getFullYear();
    for (const y of account.years) {
        set.add(y.year);
    }
    set.add(cy);
    set.add(cy - 1);
    set.add(cy + 1);
    return Array.from(set).sort((a, b) => a - b);
}

interface AccountExportDialogProps {
    account: AccountBook;
}

export function AccountExportDialog({ account }: AccountExportDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [startYear, setStartYear] = React.useState(
        () => getDefaultExportRange(account).start_year,
    );
    const [startMonth, setStartMonth] = React.useState(
        () => getDefaultExportRange(account).start_month,
    );
    const [endYear, setEndYear] = React.useState(
        () => getDefaultExportRange(account).end_year,
    );
    const [endMonth, setEndMonth] = React.useState(
        () => getDefaultExportRange(account).end_month,
    );
    const [csvState, setCsvState] = React.useState<ExportItemState>({
        status: "idle",
    });

    const yearOptions = React.useMemo(
        () => buildYearOptions(account),
        [account],
    );

    const rangeError = React.useMemo(
        () =>
            validateAccountVendorSheetRange(
                startYear,
                startMonth,
                endYear,
                endMonth,
            ),
        [startYear, startMonth, endYear, endMonth],
    );

    function handleOpenChange(next: boolean) {
        setOpen(next);
        if (next) {
            const d = getDefaultExportRange(account);
            setStartYear(d.start_year);
            setStartMonth(d.start_month);
            setEndYear(d.end_year);
            setEndMonth(d.end_month);
            setCsvState({ status: "idle" });
        } else {
            setCsvState({ status: "idle" });
        }
    }

    async function handleVendorSheetDownload() {
        const err = validateAccountVendorSheetRange(
            startYear,
            startMonth,
            endYear,
            endMonth,
        );
        if (err) {
            setCsvState({ status: "error", error: err });
            return;
        }
        setCsvState({ status: "loading" });
        try {
            await downloadAccountVendorSheet(Number(account.id), {
                start_year: startYear,
                start_month: startMonth,
                end_year: endYear,
                end_month: endMonth,
            });
            setCsvState({ status: "done" });
        } catch (e) {
            const message =
                e instanceof Error
                    ? e.message
                    : "Export failed. Please try again.";
            setCsvState({ status: "error", error: message });
        }
    }

    const monthItems = MONTH_LABELS.map((label, index) => ({
        value: index + 1,
        label,
    }));

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="default" size="sm">
                    <HugeiconsIcon
                        icon={Download04Icon}
                        strokeWidth={2}
                        className="size-3.5"
                    />
                    Export
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Export account data</DialogTitle>
                    <DialogDescription>
                        Download a vendor sheet of{" "}
                        <span className="font-medium text-foreground">
                            matched statement lines
                        </span>{" "}
                        for the selected statement periods. Original statement
                        PDFs and receipt files are not included. Very large
                        exports are delivered as a ZIP of CSV parts.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    <div className="grid gap-2">
                        <span className="text-xs font-medium">From</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex flex-col gap-1">
                                <Label
                                    htmlFor="export-start-month"
                                    className="text-[11px] text-muted-foreground"
                                >
                                    Month
                                </Label>
                                <Select
                                    value={String(startMonth)}
                                    onValueChange={(v) =>
                                        setStartMonth(Number.parseInt(v, 10))
                                    }
                                >
                                    <SelectTrigger
                                        id="export-start-month"
                                        size="sm"
                                        className="w-35"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthItems.map((m) => (
                                            <SelectItem
                                                key={m.value}
                                                value={String(m.value)}
                                            >
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label
                                    htmlFor="export-start-year"
                                    className="text-[11px] text-muted-foreground"
                                >
                                    Year
                                </Label>
                                <Select
                                    value={String(startYear)}
                                    onValueChange={(v) =>
                                        setStartYear(Number.parseInt(v, 10))
                                    }
                                >
                                    <SelectTrigger
                                        id="export-start-year"
                                        size="sm"
                                        className="w-25"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((y) => (
                                            <SelectItem
                                                key={y}
                                                value={String(y)}
                                            >
                                                {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <span className="text-xs font-medium">To</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex flex-col gap-1">
                                <Label
                                    htmlFor="export-end-month"
                                    className="text-[11px] text-muted-foreground"
                                >
                                    Month
                                </Label>
                                <Select
                                    value={String(endMonth)}
                                    onValueChange={(v) =>
                                        setEndMonth(Number.parseInt(v, 10))
                                    }
                                >
                                    <SelectTrigger
                                        id="export-end-month"
                                        size="sm"
                                        className="w-35"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthItems.map((m) => (
                                            <SelectItem
                                                key={m.value}
                                                value={String(m.value)}
                                            >
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label
                                    htmlFor="export-end-year"
                                    className="text-[11px] text-muted-foreground"
                                >
                                    Year
                                </Label>
                                <Select
                                    value={String(endYear)}
                                    onValueChange={(v) =>
                                        setEndYear(Number.parseInt(v, 10))
                                    }
                                >
                                    <SelectTrigger
                                        id="export-end-year"
                                        size="sm"
                                        className="w-25"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((y) => (
                                            <SelectItem
                                                key={y}
                                                value={String(y)}
                                            >
                                                {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {rangeError ? (
                        <p className="text-[11px] text-destructive leading-relaxed">
                            {rangeError}
                        </p>
                    ) : null}
                </div>

                <Separator />

                <ExportRow
                    icon={Invoice02Icon}
                    title="Matching results (.csv or .zip)"
                    description={`Export matched lines for the selected range (inclusive). Maximum ${MAX_EXPORT_MONTH_SPAN_INCLUSIVE} months.`}
                    state={csvState}
                    onDownload={handleVendorSheetDownload}
                    disableDownload={rangeError !== null}
                />

                <DialogFooter showCloseButton />
            </DialogContent>
        </Dialog>
    );
}

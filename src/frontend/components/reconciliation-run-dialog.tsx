"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowDataTransferHorizontalIcon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    Settings02Icon,
} from "@hugeicons/core-free-icons";
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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ReconciliationConfig } from "@/lib/types";

// ---------------------------------------------------------------------------
// Default config values — mirror the backend MatchConfig defaults.
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG: ReconciliationConfig = {
    max_date_window: 14,
    confidence_threshold: 80,
    bundle_vendor_threshold: 60,
    max_bundle_size: 4,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReconciliationRunDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Human-readable label for the selected month, e.g. "January 2025". */
    monthLabel: string;
    /** Called when the user confirms the run. Receives the resolved config. */
    onRun: (config: ReconciliationConfig) => Promise<void>;
    isPending: boolean;
    error: Error | null;
}

// ---------------------------------------------------------------------------
// Field metadata
// ---------------------------------------------------------------------------

interface ConfigFieldMeta {
    key: keyof ReconciliationConfig;
    label: string;
    min: number;
    max: number;
    unit: string;
    hint: string;
}

const CONFIG_FIELDS: ConfigFieldMeta[] = [
    {
        key: "max_date_window",
        label: "Max Date Window",
        min: 1,
        max: 90,
        unit: "days",
        hint: "Maximum days between a bank transaction and a receipt date for the pair to be considered. Wider windows catch delayed billing but increase false positives.",
    },
    {
        key: "confidence_threshold",
        label: "Confidence Threshold",
        min: 50,
        max: 100,
        unit: "/ 100",
        hint: "Minimum match score required to accept a fuzzy 1-to-1 match. Lower values match more pairs (fewer missed matches, more false positives).",
    },
    {
        key: "bundle_vendor_threshold",
        label: "Bundle Vendor Threshold",
        min: 0,
        max: 100,
        unit: "/ 100",
        hint: "Minimum vendor similarity score for each item in a split-charge bundle match. Lower values find more bundles but risk misassociating unrelated transactions.",
    },
    {
        key: "max_bundle_size",
        label: "Max Bundle Size",
        min: 2,
        max: 6,
        unit: "items",
        hint: "Maximum number of lines or receipts that can be combined into a single bundle match. Higher values cover larger split payments at the cost of slower matching.",
    },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReconciliationRunDialog({
    open,
    onOpenChange,
    monthLabel,
    onRun,
    isPending,
    error,
}: ReconciliationRunDialogProps) {
    const [advancedOpen, setAdvancedOpen] = React.useState(false);
    const [config, setConfig] =
        React.useState<ReconciliationConfig>(DEFAULT_CONFIG);
    const [draftValues, setDraftValues] = React.useState<
        Record<keyof ReconciliationConfig, string>
    >({
        max_date_window: String(DEFAULT_CONFIG.max_date_window),
        confidence_threshold: String(DEFAULT_CONFIG.confidence_threshold),
        bundle_vendor_threshold: String(DEFAULT_CONFIG.bundle_vendor_threshold),
        max_bundle_size: String(DEFAULT_CONFIG.max_bundle_size),
    });

    // Reset state whenever the dialog opens.
    React.useEffect(() => {
        if (open) {
            setConfig(DEFAULT_CONFIG);
            setDraftValues({
                max_date_window: String(DEFAULT_CONFIG.max_date_window),
                confidence_threshold: String(DEFAULT_CONFIG.confidence_threshold),
                bundle_vendor_threshold: String(
                    DEFAULT_CONFIG.bundle_vendor_threshold,
                ),
                max_bundle_size: String(DEFAULT_CONFIG.max_bundle_size),
            });
            setAdvancedOpen(false);
        }
    }, [open]);

    function handleFieldChange(key: keyof ReconciliationConfig, raw: string) {
        setDraftValues((prev) => ({ ...prev, [key]: raw }));
        if (raw.trim() === "") return;
        const value = parseInt(raw, 10);
        if (Number.isNaN(value)) return;
        setConfig((prev) => ({ ...prev, [key]: value }));
    }

    function handleReset() {
        setConfig(DEFAULT_CONFIG);
        setDraftValues({
            max_date_window: String(DEFAULT_CONFIG.max_date_window),
            confidence_threshold: String(DEFAULT_CONFIG.confidence_threshold),
            bundle_vendor_threshold: String(DEFAULT_CONFIG.bundle_vendor_threshold),
            max_bundle_size: String(DEFAULT_CONFIG.max_bundle_size),
        });
    }

    async function handleRun() {
        await onRun(config);
    }

    const isDefault =
        JSON.stringify(config) === JSON.stringify(DEFAULT_CONFIG);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Run Reconciliation</DialogTitle>
                    <DialogDescription>
                        Match all bank statement transactions for{" "}
                        <strong>{monthLabel}</strong> against uploaded receipts.
                        Existing automatic matches will be replaced; manual
                        matches are preserved.
                    </DialogDescription>
                </DialogHeader>

                <Collapsible
                    open={advancedOpen}
                    onOpenChange={setAdvancedOpen}
                    className="mt-1"
                >
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                                "text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
                            )}
                        >
                            <HugeiconsIcon
                                icon={Settings02Icon}
                                strokeWidth={2}
                                className="size-3.5 shrink-0"
                            />
                            <span className="flex-1 text-left">
                                Advanced Options
                            </span>
                            {!isDefault && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                    modified
                                </span>
                            )}
                            <HugeiconsIcon
                                icon={
                                    advancedOpen
                                        ? ArrowUp01Icon
                                        : ArrowDown01Icon
                                }
                                strokeWidth={2}
                                className="size-3.5 shrink-0"
                            />
                        </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <Separator className="my-3" />
                        <div className="space-y-4 px-1 pb-1">
                            {CONFIG_FIELDS.map((field) => (
                                <div key={field.key} className="space-y-1.5">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <Label
                                            htmlFor={`config-${field.key}`}
                                            className="text-sm font-medium"
                                        >
                                            {field.label}
                                        </Label>
                                        <span className="text-xs text-muted-foreground">
                                            default:{" "}
                                            {DEFAULT_CONFIG[field.key]}{" "}
                                            {field.unit}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id={`config-${field.key}`}
                                            type="number"
                                            min={field.min}
                                            max={field.max}
                                            value={draftValues[field.key]}
                                            onChange={(e) =>
                                                handleFieldChange(
                                                    field.key,
                                                    e.target.value,
                                                )
                                            }
                                            disabled={isPending}
                                            className="w-24 tabular-nums"
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {field.unit} &middot; {field.min}–
                                            {field.max}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {field.hint}
                                    </p>
                                </div>
                            ))}

                            {!isDefault && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    disabled={isPending}
                                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50"
                                >
                                    Reset to defaults
                                </button>
                            )}
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {error && (
                    <p className="text-xs text-destructive px-1">
                        {error.message}
                    </p>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleRun} disabled={isPending}>
                        {isPending ? (
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
                                    icon={ArrowDataTransferHorizontalIcon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                                Run Reconciliation
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
    Download04Icon,
    Tick02Icon,
    Alert02Icon,
    Loading03Icon,
} from "@hugeicons/core-free-icons";

export type ExportItemStatus = "idle" | "loading" | "done" | "error";

export interface ExportItemState {
    status: ExportItemStatus;
    error?: string;
}

export interface ExportRowProps {
    icon: IconSvgElement;
    title: string;
    description: string;
    state: ExportItemState;
    onDownload: () => void;
    /** When true, the download button is disabled (e.g. invalid form state). */
    disableDownload?: boolean;
}

export function ExportRow({
    icon,
    title,
    description,
    state,
    onDownload,
    disableDownload = false,
}: ExportRowProps) {
    const isLoading = state.status === "loading";
    const isDone = state.status === "done";
    const isError = state.status === "error";

    return (
        <div className="flex items-start gap-3 py-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-none border border-border bg-muted text-muted-foreground">
                <HugeiconsIcon
                    icon={icon}
                    strokeWidth={1.5}
                    className="size-4"
                />
            </div>

            <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span className="text-xs font-medium leading-none">
                    {title}
                </span>
                {isError ? (
                    <span className="text-[11px] text-destructive leading-relaxed">
                        {state.error ?? "Export failed. Please try again."}
                    </span>
                ) : isDone ? (
                    <span className="text-[11px] text-primary leading-relaxed">
                        Download started.
                    </span>
                ) : (
                    <span className="text-[11px] text-muted-foreground leading-relaxed">
                        {description}
                    </span>
                )}
            </div>

            <Button
                size="sm"
                variant={isError ? "destructive" : "default"}
                disabled={isLoading || disableDownload}
                onClick={onDownload}
                className="shrink-0"
            >
                {isLoading ? (
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="size-3.5 animate-spin"
                    />
                ) : isDone ? (
                    <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2.5}
                        className="size-3.5"
                    />
                ) : isError ? (
                    <HugeiconsIcon
                        icon={Alert02Icon}
                        strokeWidth={2}
                        className="size-3.5"
                    />
                ) : (
                    <HugeiconsIcon
                        icon={Download04Icon}
                        strokeWidth={2}
                        className="size-3.5"
                    />
                )}
                {isLoading
                    ? "Preparing…"
                    : isDone
                      ? "Downloaded"
                      : isError
                        ? "Retry"
                        : "Download"}
            </Button>
        </div>
    );
}

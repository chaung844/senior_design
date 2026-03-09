"use client";

import * as React from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Upload04Icon,
    Cancel01Icon,
    File01Icon,
    Tick02Icon,
    Alert02Icon,
} from "@hugeicons/core-free-icons";
import type { UploadFileResult } from "@/hooks/use-document-upload";

interface UploadDialogProps {
    trigger?: React.ReactNode;
    title: string;
    description: string;
    accept: string;
    acceptLabel: string;
    multiple?: boolean;
    onUpload?: (files: File[]) => void | Promise<UploadFileResult[]>;
    isUploading?: boolean;
    uploadResults?: UploadFileResult[];
    onOpenChange?: (open: boolean) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDialog({
    trigger,
    title,
    description,
    accept,
    acceptLabel,
    multiple = true,
    onUpload,
    isUploading = false,
    uploadResults = [],
    onOpenChange: onOpenChangeProp,
}: UploadDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [files, setFiles] = React.useState<File[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const dragCounter = React.useRef(0);

    const acceptedExtensions = React.useMemo(
        () => accept.split(",").map((ext) => ext.trim().toLowerCase()),
        [accept],
    );

    function isFileAccepted(file: File): boolean {
        const name = file.name.toLowerCase();
        return acceptedExtensions.some((ext) => name.endsWith(ext));
    }

    function addFiles(incoming: FileList | File[]) {
        const valid = Array.from(incoming).filter(isFileAccepted);
        if (valid.length === 0) return;
        setFiles((prev) => (multiple ? [...prev, ...valid] : [valid[0]]));
    }

    function removeFile(index: number) {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    }

    function handleDragEnter(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (dragCounter.current === 1) setIsDragging(true);
    }

    function handleDragLeave(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) setIsDragging(false);
    }

    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    }

    async function handleUpload() {
        if (files.length === 0) return;
        const result = onUpload?.(files);
        if (result instanceof Promise) {
            await result;
            // Progress and close are handled via uploadResults + useEffect
        } else {
            setFiles([]);
            setOpen(false);
        }
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        onOpenChangeProp?.(nextOpen);
        if (!nextOpen) {
            setFiles([]);
            setIsDragging(false);
            dragCounter.current = 0;
        }
    }

    // Close dialog when upload finishes and all succeeded
    const prevUploadingRef = React.useRef(false);
    React.useEffect(() => {
        const wasUploading = prevUploadingRef.current;
        prevUploadingRef.current = isUploading;
        if (wasUploading && !isUploading && uploadResults.length > 0) {
            const allDone = uploadResults.every((r) => r?.status === "done");
            if (allDone) {
                setOpen(false);
                setFiles([]);
            }
        }
    }, [isUploading, uploadResults]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm">
                        <HugeiconsIcon
                            icon={Upload04Icon}
                            strokeWidth={2}
                            className="size-3.5"
                        />
                        Upload
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {/* Drop zone */}
                <div
                    role="button"
                    tabIndex={isUploading ? -1 : 0}
                    onClick={() => !isUploading && inputRef.current?.click()}
                    onKeyDown={(e) => {
                        if (isUploading) return;
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            inputRef.current?.click();
                        }
                    }}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed px-4 py-8 text-center transition-colors",
                        isUploading && "pointer-events-none opacity-60",
                        !isUploading && "cursor-pointer",
                        isDragging
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25 hover:border-muted-foreground/50",
                    )}
                >
                    <div
                        className={cn(
                            "flex size-10 items-center justify-center rounded-full transition-colors",
                            isDragging
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                        )}
                    >
                        <HugeiconsIcon
                            icon={Upload04Icon}
                            strokeWidth={1.5}
                            className="size-5"
                        />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-medium">
                            {isDragging
                                ? "Drop files here"
                                : "Drag & drop files here, or click to browse"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            Accepts {acceptLabel}
                        </p>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        multiple={multiple}
                        onChange={(e) => {
                            if (e.target.files) addFiles(e.target.files);
                            e.target.value = "";
                        }}
                        className="hidden"
                    />
                </div>

                {/* File list */}
                {files.length > 0 && (
                    <div className="flex flex-col gap-1.5 max-h-45 overflow-y-auto">
                        {files.map((file, i) => {
                            const result = uploadResults[i];
                            const status = result?.status;
                            const isPending = !status || status === "pending";
                            const isInProgress =
                                status === "uploading" ||
                                status === "confirming";
                            const isDone = status === "done";
                            const isError = status === "error";
                            return (
                                <div
                                    key={`${file.name}-${file.size}-${i}`}
                                    className="flex items-center gap-2 rounded-none border border-border px-2.5 py-1.5"
                                >
                                    <HugeiconsIcon
                                        icon={File01Icon}
                                        strokeWidth={2}
                                        className="size-3.5 shrink-0 text-muted-foreground"
                                    />
                                    <span className="flex-1 min-w-0 truncate text-xs">
                                        {file.name}
                                    </span>
                                    {isInProgress && (
                                        <span
                                            className="size-3.5 shrink-0 border-2 border-primary border-t-transparent rounded-full animate-spin"
                                            aria-hidden
                                        />
                                    )}
                                    {isDone && (
                                        <HugeiconsIcon
                                            icon={Tick02Icon}
                                            strokeWidth={2.5}
                                            className="size-3.5 shrink-0 text-primary"
                                            aria-label="Uploaded"
                                        />
                                    )}
                                    {isError && (
                                        <HugeiconsIcon
                                            icon={Alert02Icon}
                                            strokeWidth={2}
                                            className="size-3.5 shrink-0 text-destructive"
                                            aria-label="Error"
                                        />
                                    )}
                                    {!result && (
                                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                            {formatFileSize(file.size)}
                                        </span>
                                    )}
                                    {isError && result?.error && (
                                        <span className="shrink-0 max-w-30truncate text-[10px] text-destructive">
                                            {result.error}
                                        </span>
                                    )}
                                    {!isInProgress && (
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFile(i);
                                            }}
                                            className="shrink-0"
                                        >
                                            <HugeiconsIcon
                                                icon={Cancel01Icon}
                                                strokeWidth={2}
                                                className="size-3"
                                            />
                                            <span className="sr-only">
                                                Remove
                                            </span>
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isUploading}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        onClick={handleUpload}
                        disabled={files.length === 0 || isUploading}
                    >
                        {isUploading ? (
                            <span
                                className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                                aria-hidden
                            />
                        ) : (
                            <HugeiconsIcon
                                icon={Upload04Icon}
                                strokeWidth={2}
                                className="size-3.5"
                            />
                        )}
                        {isUploading
                            ? "Uploading…"
                            : `Upload${files.length > 0 ? ` (${files.length})` : ""}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

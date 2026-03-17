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
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
    Download04Icon,
    FileZipIcon,
    PdfIcon,
    Invoice02Icon,
    Tick02Icon,
    Alert02Icon,
    Loading03Icon,
} from "@hugeicons/core-free-icons";
import {
    getStatementFileUrl,
    getReceiptFileUrl,
    listReceipts,
    listMatchesByLine,
} from "@/lib/api";
import type { MonthData, AccountBook, Transaction } from "@/lib/domain-types";
import type { BankStatementLineRead } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────

type ExportItemStatus = "idle" | "loading" | "done" | "error";

interface ExportItemState {
    status: ExportItemStatus;
    error?: string;
}

interface ExportDialogProps {
    account: AccountBook;
    yearValue: number;
    monthData: MonthData;
    statementId: number;
    rawLines: BankStatementLineRead[];
}

// ── CSV helpers ───────────────────────────────────────────────────────

function escapeCsvField(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function transactionsToCsv(
    transactions: Transaction[],
    currency: string,
): string {
    const headers = [
        "Invoice number on receipt",
        "Invoice Type",
        "Invoice Date",
        "Amount",
        "Description",
        "Match type",
    ];

    const rows = transactions
        .filter((t) => t.matched)
        .map((t) => {
            const debit = Number.parseFloat(
                String(t.debit ?? "").replace(/,/g, ""),
            );
            const credit = Number.parseFloat(
                String(t.credit ?? "").replace(/,/g, ""),
            );
            const amount = Number.isFinite(debit)
                ? debit
                : Number.isFinite(credit)
                    ? -credit
                    : 0;
            const invoiceType = amount < 0 ? "Credit-Memo" : "Standard";
            const matchTypeRaw = String(t.matchedWith ?? "").toLowerCase();
            const matchType = matchTypeRaw.includes("bundle")
                ? "bundle match"
                : "perfect match";

            return [
                escapeCsvField(t.reference),
                escapeCsvField(invoiceType),
                escapeCsvField(t.date),
                escapeCsvField(amount.toFixed(2)),
                escapeCsvField(t.description),
                escapeCsvField(matchType),
            ];
        });

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke after a short delay to allow the download to start
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function fetchAsBlob(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    return res.blob();
}

// ── ZIP builder (no dependencies — uses Compression Streams API) ──────
// Builds a ZIP file in-memory using the DeflateRaw compression stream
// available in all modern browsers. Falls back to stored (uncompressed)
// entries when the API is unavailable.

interface ZipEntry {
    name: string;
    data: Uint8Array<ArrayBuffer>;
}

function u16le(n: number): number[] {
    return [n & 0xff, (n >> 8) & 0xff];
}

function u32le(n: number): number[] {
    return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

function crc32(data: Uint8Array): number {
    const table = crc32.table;
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        t[i] = c;
    }
    return t;
})();

async function compressDeflate(
    data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer> | null> {
    if (
        typeof CompressionStream === "undefined" ||
        typeof ReadableStream === "undefined"
    ) {
        return null;
    }
    try {
        const cs = new CompressionStream("deflate-raw");
        const writer = cs.writable.getWriter();
        writer.write(data);
        writer.close();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        const reader = cs.readable.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value as Uint8Array<ArrayBuffer>);
        }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const out = new Uint8Array(new ArrayBuffer(total));
        let offset = 0;
        for (const chunk of chunks) {
            out.set(chunk, offset);
            offset += chunk.length;
        }
        return out;
    } catch {
        return null;
    }
}

async function buildZip(entries: ZipEntry[]): Promise<Blob> {
    const localHeaders: Uint8Array[] = [];
    const localData: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;

    const encoder = new TextEncoder();

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const crc = crc32(entry.data);
        const uncompressedSize = entry.data.length;

        const compressed = await compressDeflate(
            entry.data as Uint8Array<ArrayBuffer>,
        );
        const useCompressed =
            compressed !== null && compressed.length < uncompressedSize;
        const compressedData: Uint8Array<ArrayBuffer> = useCompressed
            ? compressed!
            : entry.data;
        const compressionMethod = useCompressed ? 8 : 0;
        const compressedSize = compressedData.length;

        // Local file header (signature 0x04034b50)
        const localHeader = new Uint8Array([
            0x50,
            0x4b,
            0x03,
            0x04, // signature
            ...u16le(20), // version needed
            ...u16le(0), // general purpose bit flag
            ...u16le(compressionMethod),
            ...u16le(0),
            ...u16le(0), // mod time / date
            ...u32le(crc),
            ...u32le(compressedSize),
            ...u32le(uncompressedSize),
            ...u16le(nameBytes.length),
            ...u16le(0), // extra field length
            ...nameBytes,
        ]);

        // Central directory header (signature 0x02014b50)
        const centralHeader = new Uint8Array([
            0x50,
            0x4b,
            0x01,
            0x02, // signature
            ...u16le(20), // version made by
            ...u16le(20), // version needed
            ...u16le(0), // general purpose bit flag
            ...u16le(compressionMethod),
            ...u16le(0),
            ...u16le(0), // mod time / date
            ...u32le(crc),
            ...u32le(compressedSize),
            ...u32le(uncompressedSize),
            ...u16le(nameBytes.length),
            ...u16le(0), // extra field length
            ...u16le(0), // file comment length
            ...u16le(0), // disk number start
            ...u16le(0), // internal attrs
            ...u32le(0), // external attrs
            ...u32le(offset), // relative offset
            ...nameBytes,
        ]);

        localHeaders.push(localHeader);
        localData.push(compressedData);
        centralDir.push(centralHeader);

        offset += localHeader.length + compressedData.length;
    }

    const centralDirOffset = offset;
    const centralDirSize = centralDir.reduce((s, c) => s + c.length, 0);

    // End of central directory record
    const eocd = new Uint8Array([
        0x50,
        0x4b,
        0x05,
        0x06, // signature
        ...u16le(0), // disk number
        ...u16le(0), // disk with start of CD
        ...u16le(entries.length), // entries on disk
        ...u16le(entries.length), // total entries
        ...u32le(centralDirSize),
        ...u32le(centralDirOffset),
        ...u16le(0), // comment length
    ]);

    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (let i = 0; i < entries.length; i++) {
        parts.push(localHeaders[i] as Uint8Array<ArrayBuffer>);
        parts.push(localData[i] as Uint8Array<ArrayBuffer>);
    }
    for (const cd of centralDir) {
        parts.push(cd as Uint8Array<ArrayBuffer>);
    }
    parts.push(eocd as Uint8Array<ArrayBuffer>);

    return new Blob(parts, { type: "application/zip" });
}

// ── Export action helpers ─────────────────────────────────────────────

async function downloadStatementPdf(
    statementId: number,
    filename: string,
): Promise<void> {
    const { url } = await getStatementFileUrl(statementId);
    const blob = await fetchAsBlob(url);
    triggerDownload(blob, filename);
}

async function buildReceiptLineNumberMap(
    rawLines: BankStatementLineRead[],
): Promise<Map<number, number>> {
    const map = new Map<number, number>();

    if (rawLines.length === 0) {
        return map;
    }

    const results = await Promise.allSettled(
        rawLines.map((line) => listMatchesByLine(line.line_id)),
    );

    rawLines.forEach((line, index) => {
        const result = results[index];
        if (result.status !== "fulfilled") return;
        for (const match of result.value.matches) {
            const existing = map.get(match.receipt_id);
            const n = line.line_number;
            if (existing == null || n < existing) {
                map.set(match.receipt_id, n);
            }
        }
    });

    return map;
}

async function downloadReceiptsZip(
    accountId: number,
    statementId: number,
    rawLines: BankStatementLineRead[],
    filename: string,
): Promise<void> {
    const { receipts } = await listReceipts({
        account_id: accountId,
        statement_id: statementId,
        limit: 100,
    });

    const matchedReceipts = receipts.filter(
        (r) => r.match_status !== "unmatched",
    );

    if (matchedReceipts.length === 0) {
        throw new Error("No reconciled receipts found for this statement.");
    }

    const lineMap = await buildReceiptLineNumberMap(rawLines);

    const entries: ZipEntry[] = [];
    const seen = new Set<string>();

    for (const receipt of matchedReceipts) {
        try {
            const { url } = await getReceiptFileUrl(receipt.receipt_id);
            const blob = await fetchAsBlob(url);
            const buf = (await blob.arrayBuffer()) as ArrayBuffer;

            const lineNumber = lineMap.get(receipt.receipt_id);
            const lineLabel =
                lineNumber != null
                    ? lineNumber.toString().padStart(3, "0")
                    : "000";

            const amountStr = Number(receipt.charged_amount).toFixed(2);
            const vendorSafe = (receipt.vendor ?? "")
                .replace(/[/\\:*?"<>|]/g, "_")
                .trim()
                .replace(/\s+/g, " ") || `receipt_${receipt.receipt_id}`;

            const ext =
                receipt.file_name?.includes(".")
                    ? `.${receipt.file_name.split(".").pop()}`
                    : ".pdf";

            const baseWithLine = `${lineLabel}_${amountStr}_${vendorSafe}`;

            let name = `${baseWithLine}${ext}`;
            let counter = 2;
            while (seen.has(name)) {
                name = `${baseWithLine}_${counter}${ext}`;
                counter += 1;
            }
            seen.add(name);

            entries.push({ name, data: new Uint8Array(buf) });
        } catch {
            // Skip receipts that can't be fetched — don't abort the whole zip
        }
    }

    if (entries.length === 0) {
        throw new Error("Could not retrieve any receipt files.");
    }

    const zipBlob = await buildZip(entries);
    triggerDownload(zipBlob, filename);
}

function downloadMatchingCsv(
    transactions: Transaction[],
    currency: string,
    filename: string,
): void {
    const csv = transactionsToCsv(transactions, currency);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, filename);
}

// ── Export row component ──────────────────────────────────────────────

interface ExportRowProps {
    icon: IconSvgElement;
    title: string;
    description: string;
    state: ExportItemState;
    onDownload: () => void;
}

function ExportRow({
    icon,
    title,
    description,
    state,
    onDownload,
}: ExportRowProps) {
    const isLoading = state.status === "loading";
    const isDone = state.status === "done";
    const isError = state.status === "error";

    return (
        <div className="flex items-start gap-3 py-3">
            {/* Icon */}
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-none border border-border bg-muted text-muted-foreground">
                <HugeiconsIcon
                    icon={icon}
                    strokeWidth={1.5}
                    className="size-4"
                />
            </div>

            {/* Text */}
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

            {/* Action button */}
            <Button
                size="sm"
                variant={isError ? "destructive" : "default"}
                disabled={isLoading}
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

// ── Main dialog ───────────────────────────────────────────────────────

export function ExportDialog({
    account,
    yearValue,
    monthData,
    statementId,
    rawLines,
}: ExportDialogProps) {
    const [open, setOpen] = React.useState(false);

    // Independent state per export item
    const [pdfState, setPdfState] = React.useState<ExportItemState>({
        status: "idle",
    });
    const [zipState, setZipState] = React.useState<ExportItemState>({
        status: "idle",
    });
    const [csvState, setCsvState] = React.useState<ExportItemState>({
        status: "idle",
    });

    function handleOpenChange(next: boolean) {
        setOpen(next);
        if (!next) {
            // Reset all states when dialog closes
            setPdfState({ status: "idle" });
            setZipState({ status: "idle" });
            setCsvState({ status: "idle" });
        }
    }

    // Derived filename prefix: e.g. "acme_jan_2025"
    const filePrefix = [
        account.name
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .toLowerCase(),
        monthData.label.toLowerCase(),
        String(yearValue),
    ].join("_");

    async function handlePdfDownload() {
        setPdfState({ status: "loading" });
        try {
            await downloadStatementPdf(
                statementId,
                `${filePrefix}_statement.pdf`,
            );
            setPdfState({ status: "done" });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Download failed.";
            setPdfState({ status: "error", error: message });
        }
    }

    async function handleZipDownload() {
        setZipState({ status: "loading" });
        try {
            await downloadReceiptsZip(
                Number(account.id),
                statementId,
                rawLines,
                `${filePrefix}_receipts.zip`,
            );
            setZipState({ status: "done" });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Download failed.";
            setZipState({ status: "error", error: message });
        }
    }

    function handleCsvDownload() {
        setCsvState({ status: "loading" });
        try {
            downloadMatchingCsv(
                monthData.transactions,
                account.currency,
                `${filePrefix}_vendor_sheet.csv`,
            );
            setCsvState({ status: "done" });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Export failed.";
            setCsvState({ status: "error", error: message });
        }
    }

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
                    <DialogTitle>Export Statement Data</DialogTitle>
                    <DialogDescription>
                        Download documents and data for{" "}
                        <span className="font-medium text-foreground">
                            {monthData.label} {yearValue}
                        </span>
                        .
                    </DialogDescription>
                </DialogHeader>

                {/* Export options */}
                <div className="flex flex-col">
                    <ExportRow
                        icon={PdfIcon}
                        title="Bank Statement PDF"
                        description="Download the original statement PDF from storage."
                        state={pdfState}
                        onDownload={handlePdfDownload}
                    />

                    <Separator />

                    <ExportRow
                        icon={FileZipIcon}
                        title="Receipts Archive (.zip)"
                        description="Package all matched receipts for this account into a ZIP file."
                        state={zipState}
                        onDownload={handleZipDownload}
                    />

                    <Separator />

                    <ExportRow
                        icon={Invoice02Icon}
                        title="Matching Results (.csv)"
                        description="Export matched transactions to vendor sheet."
                        state={csvState}
                        onDownload={handleCsvDownload}
                    />
                </div>

                <DialogFooter showCloseButton />
            </DialogContent>
        </Dialog>
    );
}

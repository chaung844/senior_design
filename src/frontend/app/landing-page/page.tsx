import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function MatchaLogo({ size = 28 }: { size?: number }) {
    const height = size * (157.96 / 204.04);
    return (
        <svg
            viewBox="622.48 382.02 204.04 157.96"
            width={size}
            height={height}
            fill="currentColor"
            aria-label="Matcha logo"
        >
            <path d="M642.48 392.02 L701.52 392.02 C701.52 392.02, 711.52 392.02, 711.52 402.02 L711.52 442.02 C711.52 442.02, 711.52 452.02, 721.52 452.02 L727.48 452.02 C727.48 452.02, 737.48 452.02, 737.48 442.02 L737.48 403.02 C737.48 403.02, 737.48 393.02, 747.48 393.02 L806.52 393.02 C806.52 393.02, 816.52 393.02, 816.52 403.02 L816.52 460.98 C816.52 460.98, 816.52 470.98, 806.52 470.98 L756.52 470.98 C756.52 470.98, 746.52 470.98, 746.52 480.98 L746.52 519.98 C746.52 519.98, 746.52 529.98, 736.52 529.98 L677.48 529.98 C677.48 529.98, 667.48 529.98, 667.48 519.98 L667.48 479.98 C667.48 479.98, 667.48 469.98, 657.48 469.98 L642.48 469.98 C642.48 469.98, 632.48 469.98, 632.48 459.98 L632.48 402.02 C632.48 402.02, 632.48 392.02, 642.48 392.02" />
        </svg>
    );
}

function BlockDivider() {
    return (
        <div className="flex items-center gap-3 w-full max-w-5xl mx-auto px-6">
            <div className="h-1 w-8 bg-primary" />
            <div className="h-px flex-1 bg-border" />
            <div className="h-1 w-8 bg-primary" />
        </div>
    );
}

function PipelineArrow() {
    return (
        <div className="hidden md:flex items-center justify-center">
            <div className="flex items-center gap-1">
                <div className="h-px w-6 bg-primary" />
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className="text-primary"
                >
                    <path
                        d="M2 6H10M10 6L7 3M10 6L7 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                    />
                </svg>
            </div>
        </div>
    );
}

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
            {/* ─── Nav ─── */}
            <nav className="border-b border-border">
                <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
                    <div className="flex items-center gap-2.5">
                        <span className="text-primary">
                            <MatchaLogo size={26} />
                        </span>
                        <span className="text-xs font-semibold tracking-[0.15em] uppercase">
                            Matcha
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/auth/login">Log in</Link>
                        </Button>
                        <Button size="sm" asChild>
                            <Link href="/auth/signup">Get Started</Link>
                        </Button>
                    </div>
                </div>
            </nav>

            {/* ─── Hero ─── */}
            <section className="relative overflow-hidden">
                {/* Grid background pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                        backgroundSize: "48px 48px",
                    }}
                />

                {/* Accent block decorations */}
                {/*<div className="absolute top-12 left-8 w-2 h-16 bg-primary/10 hidden lg:block" />
                <div className="absolute top-24 left-8 w-2 h-8 bg-primary/5 hidden lg:block" />
                <div className="absolute bottom-16 right-12 w-24 h-2 bg-primary/10 hidden lg:block" />
                <div className="absolute bottom-16 right-40 w-12 h-2 bg-primary/5 hidden lg:block" />*/}

                <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
                    {/* Status badge */}
                    <div className="mb-8">
                        <Badge variant="outline" className="gap-2 px-3">
                            <span className="w-1.5 h-1.5 bg-primary animate-pulse" />
                            Automated reconciliation system
                        </Badge>
                    </div>

                    {/* Headline block */}
                    <div className="space-y-6 max-w-3xl">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
                            Hours of manual work,
                            <br />
                            done in{" "}
                            <span className="relative inline-block">
                                <span className="text-primary">
                                    under 5 minutes.
                                </span>
                                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary" />
                            </span>
                        </h1>

                        <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                            Bank reconciliation used to mean hours of
                            cross-referencing statements, ledgers, and receipts
                            by hand. Matcha replaces that entire workflow —
                            upload your documents, and our system handles
                            parsing, matching, and reporting automatically.
                        </p>
                    </div>

                    {/* Time comparison block */}
                    <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-end gap-6 sm:gap-10">
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                Manual Process
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl sm:text-4xl font-bold text-muted-foreground/40 line-through decoration-destructive/60 decoration-2">
                                    4–8 hrs
                                </span>
                            </div>
                        </div>

                        <div className="hidden sm:block text-muted-foreground/30 text-2xl font-light pb-1">
                            →
                        </div>

                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                With Matcha
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl sm:text-4xl font-bold text-primary">
                                    &lt;5 min
                                </span>
                            </div>
                        </div>

                        <div className="sm:ml-auto flex items-center gap-2">
                            <Button size="lg" asChild>
                                <Link href="/auth/signup">
                                    Start Reconciling
                                </Link>
                            </Button>
                            <Button variant="outline" size="lg" asChild>
                                <Link href="/auth/login">Log in</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <BlockDivider />

            {/* ─── Pipeline ─── */}
            <section className="py-20 sm:py-28">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="mb-14 max-w-lg">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
                            How it works
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-3 leading-tight">
                            Three stages.
                            <br />
                            Zero manual entry.
                        </h2>
                        <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-w-md">
                            From raw document to fully reconciled ledger — every
                            step is automated. Upload once, review once, done.
                        </p>
                    </div>

                    {/* Pipeline cards */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 md:gap-0 items-stretch">
                        {/* Stage 1 - VLM Parsing */}
                        <Card className="relative border-2 border-border hover:border-primary/40 transition-colors">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground text-xs font-bold">
                                        01
                                    </div>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wide">
                                        VLM Document Parsing
                                    </CardTitle>
                                </div>
                                <CardDescription>
                                    Vision-language model reads bank statements,
                                    receipts, and ledgers — extracting every
                                    line item, date, and amount with high
                                    accuracy.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {/* Mini visual: document blocks */}
                                    <div className="flex gap-1.5">
                                        <div className="h-8 w-14 border border-border bg-muted/50 flex items-center justify-center">
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                className="text-muted-foreground/60"
                                            >
                                                <rect
                                                    x="3"
                                                    y="2"
                                                    width="10"
                                                    height="12"
                                                    rx="0"
                                                    stroke="currentColor"
                                                    strokeWidth="1"
                                                />
                                                <line
                                                    x1="5"
                                                    y1="5"
                                                    x2="11"
                                                    y2="5"
                                                    stroke="currentColor"
                                                    strokeWidth="0.75"
                                                />
                                                <line
                                                    x1="5"
                                                    y1="7"
                                                    x2="11"
                                                    y2="7"
                                                    stroke="currentColor"
                                                    strokeWidth="0.75"
                                                />
                                                <line
                                                    x1="5"
                                                    y1="9"
                                                    x2="9"
                                                    y2="9"
                                                    stroke="currentColor"
                                                    strokeWidth="0.75"
                                                />
                                            </svg>
                                        </div>
                                        <div className="h-8 w-14 border border-border bg-muted/50 flex items-center justify-center">
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                className="text-muted-foreground/60"
                                            >
                                                <rect
                                                    x="3"
                                                    y="2"
                                                    width="10"
                                                    height="12"
                                                    rx="0"
                                                    stroke="currentColor"
                                                    strokeWidth="1"
                                                />
                                                <rect
                                                    x="5"
                                                    y="4"
                                                    width="6"
                                                    height="4"
                                                    rx="0"
                                                    stroke="currentColor"
                                                    strokeWidth="0.75"
                                                />
                                                <line
                                                    x1="5"
                                                    y1="10"
                                                    x2="11"
                                                    y2="10"
                                                    stroke="currentColor"
                                                    strokeWidth="0.75"
                                                />
                                            </svg>
                                        </div>
                                        <div className="h-8 flex-1 border border-primary/30 bg-primary/5 flex items-center justify-center">
                                            <span className="text-[9px] text-primary font-semibold tracking-wider uppercase">
                                                Parsed
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-wrap">
                                        {["PDF", "JPG", "PNG", "XLSX"].map(
                                            (fmt) => (
                                                <span
                                                    key={fmt}
                                                    className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground font-medium tracking-wider"
                                                >
                                                    {fmt}
                                                </span>
                                            ),
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <PipelineArrow />

                        {/* Stage 2 - Reconciliation */}
                        <Card className="relative border-2 border-border hover:border-primary/40 transition-colors">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground text-xs font-bold">
                                        02
                                    </div>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wide">
                                        Auto Reconciliation
                                    </CardTitle>
                                </div>
                                <CardDescription>
                                    Intelligent matching algorithm
                                    cross-references every transaction against
                                    your records — flagging discrepancies and
                                    bundling related items.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1.5">
                                    {/* Mini visual: matching lines */}
                                    {[
                                        {
                                            label: "Perfect match",
                                            pct: "72%",
                                            color: "bg-primary",
                                        },
                                        {
                                            label: "Bundle match",
                                            pct: "18%",
                                            color: "bg-chart-3",
                                        },
                                        {
                                            label: "Flagged",
                                            pct: "10%",
                                            color: "bg-destructive/60",
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className="flex items-center gap-2"
                                        >
                                            <div
                                                className={`w-2 h-2 ${item.color}`}
                                            />
                                            <span className="text-[10px] text-muted-foreground flex-1">
                                                {item.label}
                                            </span>
                                            <span className="text-[10px] font-semibold tabular-nums">
                                                {item.pct}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="mt-2 h-2 w-full bg-muted flex overflow-hidden">
                                        <div
                                            className="h-full bg-primary"
                                            style={{ width: "72%" }}
                                        />
                                        <div
                                            className="h-full bg-chart-3"
                                            style={{ width: "18%" }}
                                        />
                                        <div
                                            className="h-full bg-destructive/60"
                                            style={{ width: "10%" }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <PipelineArrow />

                        {/* Stage 3 - Dashboard */}
                        <Card className="relative border-2 border-border hover:border-primary/40 transition-colors">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground text-xs font-bold">
                                        03
                                    </div>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wide">
                                        Dashboard View
                                    </CardTitle>
                                </div>
                                <CardDescription>
                                    Drill down from account overview to
                                    individual transactions. See match rates,
                                    flag outliers, and export results — all in
                                    one view.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1.5">
                                    {/* Mini visual: dashboard hierarchy */}
                                    <div className="border border-border">
                                        <div className="flex items-center px-2 py-1 border-b border-border bg-muted/30">
                                            <span className="text-[9px] text-muted-foreground font-semibold tracking-wider uppercase">
                                                Account → Year → Month
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-px bg-border">
                                            {["Jan", "Feb", "Mar"].map((mo) => (
                                                <div
                                                    key={mo}
                                                    className="bg-background px-2 py-1.5 text-center"
                                                >
                                                    <span className="text-[9px] text-muted-foreground block">
                                                        {mo}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-primary">
                                                        98%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        {["Charts", "Tables", "Export"].map(
                                            (f) => (
                                                <span
                                                    key={f}
                                                    className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground font-medium tracking-wider"
                                                >
                                                    {f}
                                                </span>
                                            ),
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            <BlockDivider />

            {/* ─── Before / After Comparison ─── */}
            <section className="py-20 sm:py-28 relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-[0.015]"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)",
                        backgroundSize: "12px 12px",
                    }}
                />

                <div className="relative max-w-5xl mx-auto px-6">
                    <div className="mb-14 max-w-lg">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
                            The difference
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-3 leading-tight">
                            Stop drowning in
                            <br />
                            spreadsheets.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Without Matcha */}
                        <div className="border-2 border-border p-6 space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 border-2 border-muted-foreground/30 flex items-center justify-center">
                                    <svg
                                        width="10"
                                        height="10"
                                        viewBox="0 0 10 10"
                                        className="text-muted-foreground/50"
                                    >
                                        <line
                                            x1="2"
                                            y1="2"
                                            x2="8"
                                            y2="8"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        />
                                        <line
                                            x1="8"
                                            y1="2"
                                            x2="2"
                                            y2="8"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        />
                                    </svg>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Without Matcha
                                </span>
                            </div>
                            <div className="space-y-3">
                                {[
                                    {
                                        task: "Download & print statements",
                                        time: "30 min",
                                    },
                                    {
                                        task: "Manually cross-reference entries",
                                        time: "2–4 hrs",
                                    },
                                    {
                                        task: "Hunt for missing receipts",
                                        time: "1–2 hrs",
                                    },
                                    {
                                        task: "Flag & investigate discrepancies",
                                        time: "1–2 hrs",
                                    },
                                    {
                                        task: "Compile final reconciliation report",
                                        time: "30 min",
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.task}
                                        className="flex items-center justify-between gap-4"
                                    >
                                        <span className="text-[11px] text-muted-foreground leading-tight">
                                            {item.task}
                                        </span>
                                        <span className="text-[11px] font-semibold text-muted-foreground/60 whitespace-nowrap tabular-nums">
                                            {item.time}
                                        </span>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Total
                                    </span>
                                    <span className="text-sm font-bold text-muted-foreground/50 line-through decoration-destructive decoration-2">
                                        4–8+ hours
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* With Matcha */}
                        <div className="border-2 border-primary p-6 space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-primary flex items-center justify-center">
                                    <svg
                                        width="10"
                                        height="10"
                                        viewBox="0 0 10 10"
                                        className="text-primary-foreground"
                                    >
                                        <polyline
                                            points="2,5 4,7.5 8,2.5"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            fill="none"
                                        />
                                    </svg>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wide text-primary">
                                    With Matcha
                                </span>
                            </div>
                            <div className="space-y-3">
                                {[
                                    {
                                        task: "Upload statements & receipts",
                                        time: "1 min",
                                    },
                                    {
                                        task: "AI parses all documents",
                                        time: "~2 min",
                                    },
                                    {
                                        task: "Auto-reconciliation runs",
                                        time: "~30 sec",
                                    },
                                    {
                                        task: "Review flagged items on dashboard",
                                        time: "1 min",
                                    },
                                    {
                                        task: "Export or approve",
                                        time: "10 sec",
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.task}
                                        className="flex items-center justify-between gap-4"
                                    >
                                        <span className="text-[11px] text-foreground leading-tight">
                                            {item.task}
                                        </span>
                                        <span className="text-[11px] font-semibold text-primary whitespace-nowrap tabular-nums">
                                            {item.time}
                                        </span>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Total
                                    </span>
                                    <span className="text-sm font-bold text-primary">
                                        &lt;5 minutes
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <BlockDivider />

            {/* ─── Features Grid ─── */}
            <section className="py-20 sm:py-28">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="mb-14 max-w-lg">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
                            Built for accountants
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-3 leading-tight">
                            Every detail considered.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            {
                                title: "Multi-format ingestion",
                                description:
                                    "Upload PDFs, images, scanned receipts, or spreadsheets. VLM handles them all.",
                                marker: "01",
                            },
                            {
                                title: "Intelligent matching",
                                description:
                                    "Perfect matches, bundle matches, and fuzzy matches — configurable thresholds for your workflow.",
                                marker: "02",
                            },
                            {
                                title: "Discrepancy alerts",
                                description:
                                    "Unmatched and suspicious transactions surface immediately. Nothing falls through the cracks.",
                                marker: "03",
                            },
                            {
                                title: "Drill-down navigation",
                                description:
                                    "Account → Year → Month → Transaction. Every level shows match rates and summaries.",
                                marker: "04",
                            },
                            {
                                title: "Real-time job tracking",
                                description:
                                    "Watch parsing and reconciliation progress live. Know exactly when results are ready.",
                                marker: "05",
                            },
                            {
                                title: "Team collaboration",
                                description:
                                    "Invite members to account books. Role-based access keeps everyone on the same page.",
                                marker: "06",
                            },
                        ].map((feature) => (
                            <Card
                                key={feature.title}
                                size="sm"
                                className="hover:border-primary/30 transition-colors group"
                            >
                                <CardHeader>
                                    <div className="flex items-start gap-3">
                                        <span className="text-[10px] font-bold text-primary/60 mt-0.5 shrink-0 tabular-nums">
                                            {feature.marker}
                                        </span>
                                        <div className="space-y-1">
                                            <CardTitle className="group-hover:text-primary transition-colors">
                                                {feature.title}
                                            </CardTitle>
                                            <CardDescription>
                                                {feature.description}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <BlockDivider />

            {/* ─── CTA ─── */}
            <section className="py-20 sm:py-28 relative">
                <div className="absolute inset-0 bg-primary/2" />
                <div className="relative max-w-5xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-4 h-10 mb-6">
                        <MatchaLogo size={20} />
                        <span className="text-sm font-bold tracking-[0.15em] uppercase">
                            Matcha
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                        Ready to save
                        <br />
                        <span className="text-primary">hours every month?</span>
                    </h2>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto mt-4 leading-relaxed">
                        Join teams who have replaced tedious manual
                        reconciliation with an automated, AI-powered workflow.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-8">
                        <Button size="lg" asChild>
                            <Link href="/auth/signup">Get Started</Link>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            <Link href="/auth/login">Log in</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="border-t border-border mt-auto">
                <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground/50">
                        <MatchaLogo size={14} />
                        <span className="text-[10px] tracking-widest uppercase">
                            Matcha
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40">
                        © 2025 Matcha — Bank reconciliation, automated.
                    </p>
                </div>
            </footer>
        </div>
    );
}

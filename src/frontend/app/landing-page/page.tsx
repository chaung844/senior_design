import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 py-3 border-b border-border max-w-6xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <svg
                        viewBox="622.48 382.02 204.04 157.96"
                        width="28"
                        height="22"
                        fill="currentColor"
                        className="text-primary"
                        aria-label="Matcha logo"
                    >
                        <path d="M642.48 392.02 L701.52 392.02 C701.52 392.02, 711.52 392.02, 711.52 402.02 L711.52 442.02 C711.52 442.02, 711.52 452.02, 721.52 452.02 L727.48 452.02 C727.48 452.02, 737.48 452.02, 737.48 442.02 L737.48 403.02 C737.48 403.02, 737.48 393.02, 747.48 393.02 L806.52 393.02 C806.52 393.02, 816.52 393.02, 816.52 403.02 L816.52 460.98 C816.52 460.98, 816.52 470.98, 806.52 470.98 L756.52 470.98 C756.52 470.98, 746.52 470.98, 746.52 480.98 L746.52 519.98 C746.52 519.98, 746.52 529.98, 736.52 529.98 L677.48 529.98 C677.48 529.98, 667.48 529.98, 667.48 519.98 L667.48 479.98 C667.48 479.98, 667.48 469.98, 657.48 469.98 L642.48 469.98 C642.48 469.98, 632.48 469.98, 632.48 459.98 L632.48 402.02 C632.48 402.02, 632.48 392.02, 642.48 392.02" />
                    </svg>
                    <span className="text-xs font-semibold tracking-tight uppercase">
                        Matcha
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" asChild>
                        <Link href="/auth/login">Log in</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/auth/signup">Get Started</Link>
                    </Button>
                </div>
            </nav>

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="max-w-2xl mx-auto text-center space-y-6 -mt-20">
                    <Badge variant="outline" className="gap-2">
                        <span className="w-1.5 h-1.5 bg-primary animate-pulse" />
                        Bank reconciliation, simplified
                    </Badge>

                    <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
                        Reconcile your books
                        <br />
                        <span className="text-primary">
                            in minutes, not days.
                        </span>
                    </h1>

                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Upload statements, match transactions automatically, and
                        resolve discrepancies — all from a single dashboard.
                    </p>

                    <div className="flex items-center justify-center gap-2 pt-2">
                        <Button size="lg" asChild>
                            <Link href="/auth/signup">Get Started</Link>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            <Link href="/auth/login">Log in</Link>
                        </Button>
                    </div>
                </div>

                {/* Feature grid */}
                <div className="max-w-3xl mx-auto mt-24 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    {[
                        {
                            title: "Auto-matching",
                            description:
                                "Transactions are matched against your book entries automatically with configurable rules.",
                        },
                        {
                            title: "Drill-down views",
                            description:
                                "Navigate from account overview down to individual months and line items.",
                        },
                        {
                            title: "Discrepancy tracking",
                            description:
                                "Surface unmatched and flagged transactions instantly. Nothing slips through.",
                        },
                    ].map((feature) => (
                        <Card key={feature.title} size="sm">
                            <CardHeader>
                                <CardTitle>{feature.title}</CardTitle>
                                <CardDescription>
                                    {feature.description}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer>
                <Separator />
                <p className="py-6 text-center text-[11px] text-muted-foreground/60">
                    © 2025 Matcha
                </p>
            </footer>
        </div>
    );
}

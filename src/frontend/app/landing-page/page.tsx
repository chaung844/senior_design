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
                    <div className="w-2 h-2 bg-primary" />
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

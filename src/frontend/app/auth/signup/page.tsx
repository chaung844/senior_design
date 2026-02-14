import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SignupPage() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 py-3 border-b border-border max-w-6xl mx-auto w-full">
                <Button variant="ghost" asChild>
                    <Link
                        href="/landing-page"
                        className="flex items-center gap-2"
                    >
                        <div className="w-2 h-2 bg-primary" />
                        <span className="text-xs font-semibold tracking-tight uppercase">
                            Matcha
                        </span>
                    </Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link href="/auth/login">Log in</Link>
                </Button>
            </nav>

            {/* WIP Notice */}
            <main className="flex-1 flex items-center justify-center px-6">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="flex justify-center mb-2">
                            <Badge variant="outline" className="gap-2">
                                <span className="w-1.5 h-1.5 bg-destructive animate-pulse" />
                                Work in Progress
                            </Badge>
                        </div>
                        <CardTitle className="text-lg">
                            Registration Unavailable
                        </CardTitle>
                        <CardDescription>
                            Matcha is currently in active development and is not
                            accepting new users at this time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Separator />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Our github repo for the project is available&nbsp;
                            <a
                                href="https://github.com/chaung844/senior_design"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-primary"
                            >
                                here
                            </a>
                            .
                        </p>
                    </CardContent>
                    <CardFooter className="justify-center gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/landing-page">Back to Home</Link>
                        </Button>
                        <Button asChild>
                            <Link href="/auth/login">Log in</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}

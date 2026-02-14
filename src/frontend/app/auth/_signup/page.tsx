"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FieldError } from "@/components/ui/field";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setLoading(true);

        // TODO: Replace with actual signup API call
        try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            router.push("/dashboard");
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

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

            {/* Form */}
            <main className="flex-1 flex items-center justify-center px-6">
                <div className="w-full max-w-sm space-y-8 -mt-20">
                    <div className="space-y-2 text-center">
                        <h1 className="text-lg font-semibold tracking-tight">
                            Create your account
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Get started with Matcha in seconds.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Full name</Label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoComplete="name"
                                placeholder="Jane Doe"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                placeholder="you@company.com"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                placeholder="At least 8 characters"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="confirm-password">
                                Confirm password
                            </Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                required
                                autoComplete="new-password"
                                placeholder="Repeat your password"
                            />
                        </div>

                        {error && <FieldError>{error}</FieldError>}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full"
                        >
                            {loading ? "Creating account..." : "Create account"}
                        </Button>
                    </form>

                    <div className="space-y-4">
                        <Separator />
                        <p className="text-center text-xs text-muted-foreground">
                            Already have an account?{" "}
                            <Button
                                variant="link"
                                size="xs"
                                className="h-auto p-0"
                                asChild
                            >
                                <Link href="/auth/login">Log in</Link>
                            </Button>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

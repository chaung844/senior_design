"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: integrate with backend auth
        console.log("login", { email, password });
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
                    <Link href="/auth/signup">Create account</Link>
                </Button>
            </nav>

            {/* Form */}
            <main className="flex-1 flex items-center justify-center px-6">
                <div className="w-full max-w-sm space-y-8 -mt-20">
                    <div className="space-y-2 text-center">
                        <h1 className="text-lg font-semibold tracking-tight">
                            Welcome back
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Log in to your Matcha account
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Button
                                    type="button"
                                    variant="link"
                                    size="xs"
                                    className="text-muted-foreground/70 h-auto p-0"
                                >
                                    Forgot?
                                </Button>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        <Button type="submit" className="w-full">
                            Log in
                        </Button>
                    </form>

                    <div className="space-y-4">
                        <Separator />
                        <p className="text-center text-xs text-muted-foreground">
                            Don&apos;t have an account?{" "}
                            <Button
                                variant="link"
                                size="xs"
                                className="h-auto p-0"
                                asChild
                            >
                                <Link href="/auth/signup">Sign up</Link>
                            </Button>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

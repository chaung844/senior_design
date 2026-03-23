"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    LogoutIcon,
    UserIcon,
} from "@hugeicons/core-free-icons";

interface DeveloperConsoleShellProps {
    reconciliationHref: string;
    children: React.ReactNode;
}

export function DeveloperConsoleShell({
    reconciliationHref,
    children,
}: DeveloperConsoleShellProps) {
    const router = useRouter();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        router.replace("/auth/login");
    };

    return (
        <div className="flex h-dvh flex-col overflow-hidden">
            <header className="shrink-0 flex h-12 items-center justify-between border-b px-4 bg-background">
                <div className="flex items-center gap-3">
                    <svg
                        viewBox="622.48 382.02 204.04 157.96"
                        width="24"
                        height="18"
                        fill="currentColor"
                        className="text-primary shrink-0"
                        aria-label="Matcha logo"
                    >
                        <path d="M642.48 392.02 L701.52 392.02 C701.52 392.02, 711.52 392.02, 711.52 402.02 L711.52 442.02 C711.52 442.02, 711.52 452.02, 721.52 452.02 L727.48 452.02 C727.48 452.02, 737.48 452.02, 737.48 442.02 L737.48 403.02 C737.48 403.02, 737.48 393.02, 747.48 393.02 L806.52 393.02 C806.52 393.02, 816.52 393.02, 816.52 403.02 L816.52 460.98 C816.52 460.98, 816.52 470.98, 806.52 470.98 L756.52 470.98 C756.52 470.98, 746.52 470.98, 746.52 480.98 L746.52 519.98 C746.52 519.98, 746.52 529.98, 736.52 529.98 L677.48 529.98 C677.48 529.98, 667.48 529.98, 667.48 519.98 L667.48 479.98 C667.48 479.98, 667.48 469.98, 657.48 469.98 L642.48 469.98 C642.48 469.98, 632.48 469.98, 632.48 459.98 L632.48 402.02 C632.48 402.02, 632.48 392.02, 642.48 392.02" />
                    </svg>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-tight leading-none">
                            Developer Console
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            Tenant & account management
                        </span>
                    </div>

                    <Separator orientation="vertical" className="mx-1 h-5" />

                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" asChild>
                        <Link href={reconciliationHref}>
                            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
                            Reconciliation
                        </Link>
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3.5" />
                        <span>{user?.name ?? "Developer"}</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={handleLogout}
                    >
                        <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} className="size-3.5" />
                    </Button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}

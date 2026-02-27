"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { AccountBook } from "@/lib/domain-types";

interface DashboardHeaderProps {
    account: AccountBook;
    periodLabel: string;
    subtitle: string;
    onBack: () => void;
    badges?: React.ReactNode;
    actions?: React.ReactNode;
}

export function DashboardHeader({
    account,
    periodLabel,
    subtitle,
    onBack,
    badges,
    actions,
}: DashboardHeaderProps) {
    return (
        <div className="shrink-0 flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon-sm" onClick={onBack}>
                    <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        strokeWidth={2}
                        className="size-4"
                    />
                </Button>
                <h1 className="text-lg font-semibold tracking-tight">
                    {account.name}
                    <span className="text-muted-foreground ml-2 font-mono">
                        {periodLabel}
                    </span>
                </h1>
                <Badge variant="outline" className="font-mono text-[10px]">
                    {account.currency}
                </Badge>
                {badges}
                {actions && <div className="ml-auto">{actions}</div>}
            </div>
            <p className="text-xs text-muted-foreground pl-9">
                {account.bankName} · {account.accountNumber} · {subtitle}
            </p>
        </div>
    );
}

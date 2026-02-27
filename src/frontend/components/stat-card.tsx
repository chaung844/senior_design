import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    icon: IconSvgElement;
    label: string;
    value: React.ReactNode;
    valueClassName?: string;
    children?: React.ReactNode;
}

export function StatCard({
    icon,
    label,
    value,
    valueClassName,
    children,
}: StatCardProps) {
    return (
        <Card size="sm">
            <CardHeader>
                <CardDescription>
                    <span className="flex items-center gap-1.5">
                        <HugeiconsIcon
                            icon={icon}
                            strokeWidth={2}
                            className="size-3.5"
                        />
                        {label}
                    </span>
                </CardDescription>
                <CardTitle
                    className={cn(
                        "text-2xl font-bold tabular-nums",
                        valueClassName,
                    )}
                >
                    {value}
                </CardTitle>
            </CardHeader>
            {children && <CardContent>{children}</CardContent>}
        </Card>
    );
}

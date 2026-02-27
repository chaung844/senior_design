"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccountBooks } from "@/hooks/use-accounts";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
    const router = useRouter();
    const { data: accountBooks, isLoading } = useAccountBooks();

    useEffect(() => {
        if (isLoading) return;
        const firstId = accountBooks?.[0]?.id;
        if (firstId) {
            router.replace(`/dashboard/${firstId}`);
        }
    }, [accountBooks, isLoading, router]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Skeleton className="h-8 w-48" />
            </div>
        );
    }

    if (!accountBooks?.length) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                No account books available.
            </div>
        );
    }

    return null;
}

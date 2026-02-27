"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardAccount } from "@/components/dashboard-account";
import { useAccountBook } from "@/hooks/use-accounts";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";

export default function DashboardAccountPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = Number(params.accountId);
    const { data: account, isLoading } = useAccountBook(
        Number.isNaN(accountId) ? null : accountId,
    );

    if (isLoading) return <DashboardSkeleton />;
    if (!account) return <EmptyState message="Account not found." />;

    return (
        <DashboardAccount
            account={account}
            onYearClick={(year) =>
                router.push(`/dashboard/${accountId}/${year}`)
            }
        />
    );
}

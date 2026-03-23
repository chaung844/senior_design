"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardYear } from "@/components/dashboard-year";
import { useAccountBook } from "@/hooks/use-accounts";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { canMutateData } from "@/lib/permissions";

export default function DashboardYearPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const canMutate = canMutateData(user);
    const accountId = Number(params.accountId);
    const year = parseInt(params.year as string, 10);
    const { data: account, isLoading } = useAccountBook(
        Number.isNaN(accountId) ? null : accountId,
    );

    const yearData = account?.years.find((y) => y.year === year);

    if (Number.isNaN(year)) return <EmptyState message="Invalid year." />;
    if (isLoading) return <DashboardSkeleton />;
    if (!account) return <EmptyState message="Account not found." />;
    if (!yearData) return <EmptyState message="Year data not found." />;

    return (
        <DashboardYear
            account={account}
            yearData={yearData}
            canMutate={canMutate}
            onMonthClick={(month) =>
                router.push(`/dashboard/${accountId}/${year}/${month}`)
            }
            onBack={() => router.push(`/dashboard/${accountId}`)}
        />
    );
}

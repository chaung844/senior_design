"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardAccount } from "@/components/dashboard-account";
import { useAccountBook, useAccount } from "@/hooks/use-accounts";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { canMutateData } from "@/lib/permissions";

export default function DashboardAccountPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const canMutate = canMutateData(user);
    const accountId = Number(params.accountId);

    const isValidId = !Number.isNaN(accountId);

    const { data: account, isLoading: bookLoading } = useAccountBook(
        isValidId ? accountId : null,
    );
    const { data: rawAccount, isLoading: rawLoading } = useAccount(
        isValidId ? accountId : null,
    );

    const isLoading = bookLoading || rawLoading;

    if (isLoading) return <DashboardSkeleton />;
    if (!account) return <EmptyState message="Account not found." />;

    return (
        <DashboardAccount
            account={account}
            rawAccount={rawAccount}
            userRole={user?.role}
            canMutate={canMutate}
            onYearClick={(year) =>
                router.push(`/dashboard/${accountId}/${year}`)
            }
        />
    );
}

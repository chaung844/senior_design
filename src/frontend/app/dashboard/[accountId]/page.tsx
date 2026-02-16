"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardAccount } from "@/components/dashboard-account";
import { getAccountBook } from "@/lib/mock-data";

export default function DashboardAccountPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;
    const account = getAccountBook(accountId);

    if (!account) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Account not found.
            </div>
        );
    }

    return (
        <DashboardAccount
            account={account}
            onYearClick={(year) =>
                router.push(`/dashboard/${accountId}/${year}`)
            }
        />
    );
}

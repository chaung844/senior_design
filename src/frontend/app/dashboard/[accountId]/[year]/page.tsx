"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardYear } from "@/components/dashboard-year";
import { getAccountBook, getYearData } from "@/lib/mock-data";

export default function DashboardYearPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;
    const year = parseInt(params.year as string, 10);
    const account = getAccountBook(accountId);
    const yearData = getYearData(accountId, year);

    if (Number.isNaN(year)) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Invalid year.
            </div>
        );
    }

    if (!account) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Account not found.
            </div>
        );
    }

    if (!yearData) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Year data not found.
            </div>
        );
    }

    return (
        <DashboardYear
            account={account}
            yearData={yearData}
            onMonthClick={(month) =>
                router.push(`/dashboard/${accountId}/${year}/${month}`)
            }
            onBack={() => router.push(`/dashboard/${accountId}`)}
        />
    );
}

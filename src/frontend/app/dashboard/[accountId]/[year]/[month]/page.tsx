"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardMonth } from "@/components/dashboard-month";
import { getAccountBook, getMonthData } from "@/lib/mock-data";

export default function DashboardMonthPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;
    const year = parseInt(params.year as string, 10);
    const month = parseInt(params.month as string, 10);
    const account = getAccountBook(accountId);
    const monthData = getMonthData(accountId, year, month);

    if (Number.isNaN(year) || Number.isNaN(month)) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Invalid year or month.
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

    if (!monthData) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Month data not found.
            </div>
        );
    }

    return (
        <DashboardMonth
            account={account}
            yearValue={year}
            monthData={monthData}
            onBack={() => router.push(`/dashboard/${accountId}/${year}`)}
        />
    );
}

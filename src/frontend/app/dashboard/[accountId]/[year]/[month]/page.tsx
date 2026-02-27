"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardMonth } from "@/components/dashboard-month";
import { useAccountBook } from "@/hooks/use-accounts";
import { useStatements, useStatement } from "@/hooks/use-statements";
import { statementToMonthData } from "@/lib/transforms";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";
import * as React from "react";

export default function DashboardMonthPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = Number(params.accountId);
    const year = parseInt(params.year as string, 10);
    const month = parseInt(params.month as string, 10);

    const { data: account, isLoading: accountLoading } = useAccountBook(
        Number.isNaN(accountId) ? null : accountId,
    );

    const { data: statementsRes } = useStatements(
        Number.isNaN(accountId) ? undefined : accountId,
    );

    const statement = statementsRes?.statements.find(
        (s) => s.year === year && s.month === month,
    );

    const { data: statementDetail, isLoading: statementLoading } = useStatement(
        statement?.statement_id ?? null,
    );

    const monthData = React.useMemo(
        () => (statementDetail ? statementToMonthData(statementDetail) : null),
        [statementDetail],
    );

    if (Number.isNaN(year) || Number.isNaN(month)) {
        return <EmptyState message="Invalid year or month." />;
    }
    if (accountLoading || statementLoading) return <DashboardSkeleton />;
    if (!account) return <EmptyState message="Account not found." />;
    if (!monthData) {
        return <EmptyState message="No statement data found for this month." />;
    }

    return (
        <DashboardMonth
            account={account}
            yearValue={year}
            monthData={monthData}
            statementId={statement!.statement_id}
            onBack={() => router.push(`/dashboard/${accountId}/${year}`)}
        />
    );
}

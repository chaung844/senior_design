import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-28" />
                ))}
            </div>
            <Skeleton className="h-64" />
        </div>
    );
}

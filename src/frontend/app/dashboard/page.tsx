import { redirect } from "next/navigation";
import { accountBooks } from "@/lib/mock-data";

export default function DashboardPage() {
    const firstAccountId = accountBooks[0]?.id;
    if (!firstAccountId) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                No account books available.
            </div>
        );
    }
    redirect(`/dashboard/${firstAccountId}`);
}

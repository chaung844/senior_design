"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ShieldUserIcon } from "@hugeicons/core-free-icons";

/**
 * Persistent strip for users with the viewer role — shown on every dashboard route.
 */
export function ViewerModeBanner() {
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 border-b border-amber-500/35 bg-amber-500/10 px-4 py-1.5 text-center dark:bg-amber-950/35 dark:border-amber-500/25"
        >
            <HugeiconsIcon
                icon={ShieldUserIcon}
                size={14}
                className="shrink-0 text-amber-800 dark:text-amber-200"
                aria-hidden
            />
            <p className="text-[11px] leading-snug text-amber-950 dark:text-amber-100/95">
                <span className="font-semibold">View-only</span>
                <span className="text-amber-900/90 dark:text-amber-100/80">
                    {" "}
                    — You can open assigned account books and export data.
                    Uploads, edits, reconciliation, and manual matching are
                    disabled.
                </span>
            </p>
        </div>
    );
}

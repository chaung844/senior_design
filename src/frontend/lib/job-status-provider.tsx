"use client";

import { type ReactNode } from "react";
import {
    JobStatusContext,
    useJobStatusProvider,
} from "@/hooks/use-job-status";

export function JobStatusProvider({ children }: { children: ReactNode }) {
    const value = useJobStatusProvider();

    return (
        <JobStatusContext.Provider value={value}>
            {children}
        </JobStatusContext.Provider>
    );
}

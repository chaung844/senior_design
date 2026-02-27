"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm text-muted-foreground">
                        Something went wrong loading this section.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            this.setState({ hasError: false, error: null })
                        }
                    >
                        Try again
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}

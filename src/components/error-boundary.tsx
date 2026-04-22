"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="mx-auto w-full max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm dark:border-amber-800 dark:bg-zinc-900">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <AlertTriangle className="size-6 text-amber-600 dark:text-amber-400" />
            </div>

            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Something went wrong
            </h2>

            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>

            <Button onClick={this.handleReset}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

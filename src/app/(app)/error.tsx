"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="size-8 text-red-500" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Button onClick={reset} className="btn-brand gap-1.5">
          <RotateCcw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}

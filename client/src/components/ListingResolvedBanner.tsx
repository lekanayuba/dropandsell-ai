import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";

const STORAGE_KEY = "listing-resolved-banner-dismissed";

export function ListingResolvedBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  };

  return (
    <div
      data-testid="banner-listing-resolved"
      className="flex items-start gap-3 border-b border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 px-5 py-3 lg:px-8"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
      <div className="flex-1 text-sm text-green-800 dark:text-green-200">
        <span className="font-semibold">You can now list anytime.</span>{" "}
        The previous listing issue is fully resolved — create and publish listings at any
        time of day, no need to wait for quieter morning hours like before.
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        data-testid="button-dismiss-listing-banner"
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-md p-1 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

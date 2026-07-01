import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, CheckCircle2, XCircle, Clock, ExternalLink, Search } from "lucide-react";

type TrackingStatus = "pending" | "in_transit" | "delivered" | "failed";

interface TrackingResult {
  trackingNumber: string;
  carrier: string;
  status: TrackingStatus;
  trackingUrl: string | null;
  lastUpdated: string | null;
  customerName: string | null;
  orderDate: string | null;
}

const statusConfig: Record<TrackingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: "Pending",    color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Clock className="h-5 w-5" /> },
  in_transit: { label: "In Transit", color: "bg-blue-100 text-blue-800 border-blue-300",       icon: <Truck className="h-5 w-5" /> },
  delivered:  { label: "Delivered",  color: "bg-green-100 text-green-800 border-green-300",    icon: <CheckCircle2 className="h-5 w-5" /> },
  failed:     { label: "Failed",     color: "bg-red-100 text-red-800 border-red-300",         icon: <XCircle className="h-5 w-5" /> },
};

function StatusTimeline({ status }: { status: TrackingStatus }) {
  const steps: { key: TrackingStatus; label: string }[] = [
    { key: "pending", label: "Order Placed" },
    { key: "in_transit", label: "In Transit" },
    { key: "delivered", label: "Delivered" },
  ];
  const currentIdx = steps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center justify-center gap-1 my-6">
      {steps.map((step, i) => {
        const done = i <= currentIdx;
        const isLast = i === steps.length - 1;
        return (
          <div key={step.key} className="flex items-center">
            <div className={`flex flex-col items-center ${done ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                done ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className="text-xs mt-1 whitespace-nowrap">{step.label}</span>
            </div>
            {!isLast && (
              <div className={`h-0.5 w-12 sm:w-20 mx-1 ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TrackOrder() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/track/${encodeURIComponent(trackingNumber.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to look up tracking");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const cfg = result ? statusConfig[result.status] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Package Tracker</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-center">Track Your Package</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={loading || !trackingNumber.trim()}>
                {loading ? "Searching..." : "Track"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="pt-6 text-center">
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-500 text-sm mt-1">Check the tracking number and try again.</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && cfg && (
          <Card>
            <CardContent className="pt-6">
              {/* Status badge */}
              <div className="flex flex-col items-center mb-4">
                <div className={`p-3 rounded-full mb-2 ${cfg.color.replace('text-', 'bg-').split(' ')[0]} bg-opacity-20`}>
                  {cfg.icon}
                </div>
                <Badge className={`px-4 py-1.5 text-sm font-semibold border ${cfg.color}`}>
                  {cfg.label}
                </Badge>
              </div>

              {/* Timeline */}
              <StatusTimeline status={result.status} />

              {/* Details */}
              <div className="border-t pt-4 mt-4 space-y-3">
                <DetailRow label="Tracking #" value={result.trackingNumber} />
                <DetailRow label="Carrier" value={result.carrier} capitalize />
                {result.customerName && <DetailRow label="Recipient" value={result.customerName} />}
                {result.lastUpdated && (
                  <DetailRow label="Last Updated" value={new Date(result.lastUpdated).toLocaleString()} />
                )}
                {result.orderDate && (
                  <DetailRow label="Order Date" value={new Date(result.orderDate).toLocaleDateString()} />
                )}
                {result.trackingUrl && (
                  <div className="pt-2">
                    <a href={result.trackingUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium">
                      <ExternalLink className="h-4 w-4" />
                      Track on {result.carrier}&apos;s website
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} DropSell. All rights reserved.
      </footer>
    </div>
  );
}

function DetailRow({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </div>
  );
}

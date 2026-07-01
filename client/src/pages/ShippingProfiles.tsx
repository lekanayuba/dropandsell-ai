import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Truck, Package, Clock, Search, ExternalLink, Globe, ShoppingBag, Loader2, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const platformMeta: Record<string, { icon: React.ElementType; color: string }> = {
  ebay: { icon: ShoppingBag, color: "text-blue-600 bg-blue-100 dark:bg-blue-950/30" },
  shopify: { icon: ShoppingBag, color: "text-green-600 bg-green-100 dark:bg-green-950/30" },
  amazon: { icon: ShoppingBag, color: "text-orange-600 bg-orange-100 dark:bg-orange-950/30" },
  woocommerce: { icon: ShoppingBag, color: "text-purple-600 bg-purple-100 dark:bg-purple-950/30" },
};

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    delivered: "bg-emerald-500", in_transit: "bg-blue-500",
    pending: "bg-amber-500", failed: "bg-red-500",
  };
  return <span className={cn("h-2.5 w-2.5 rounded-full inline-block shrink-0", colors[status] || "bg-gray-400")} />;
}

function TrackingDialog({ orderId, onClose, onSuccess }: { orderId: number | null; onClose: () => void; onSuccess: () => void }) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const { toast } = useToast();
  useEffect(() => { if (orderId) { setCarrier(""); setTrackingNumber(""); } }, [orderId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, trackingNumber }),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Shipped", description: `${carrier}: ${trackingNumber}` }); onSuccess(); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Tracking — Order #{orderId}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Carrier</Label>
            <Input placeholder="e.g. Royal Mail, UPS, DHL, eBay" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tracking Number</Label>
            <Input placeholder="Enter tracking number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={!carrier || !trackingNumber || mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Mark as Shipped"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ShippingProfiles() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => { const r = await fetch("/api/orders", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });

  const trackedOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o: any) => o.trackingNumber || o.status === "shipped" || o.fulfillmentStatus === "fulfilled");
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!search) return trackedOrders;
    const q = search.toLowerCase();
    return trackedOrders.filter((o: any) =>
      (o.trackingNumber || "").toLowerCase().includes(q) ||
      (o.carrier || "").toLowerCase().includes(q) ||
      (o.customerName || "").toLowerCase().includes(q) ||
      String(o.id).includes(q) ||
      (o.externalOrderId || "").toLowerCase().includes(q)
    );
  }, [trackedOrders, search]);

  const inTransitCount = trackedOrders.filter((o: any) => o.trackingStatus === "in_transit").length;
  const deliveredCount = trackedOrders.filter((o: any) => o.trackingStatus === "delivered").length;
  const pendingTrackCount = trackedOrders.filter((o: any) => !o.trackingStatus || o.trackingStatus === "pending").length;

  const refreshOrders = () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

  if (isLoading) return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Tracking</h2>
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Tracking</h2>
          <p className="text-sm text-muted-foreground mt-1">Track shipments from eBay and other carriers</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={refreshOrders}>
          <Loader2 className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
          <CardContent className="p-4 flex items-center gap-3">
            <Truck className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-blue-600 font-medium">In Transit</p>
              <p className="text-xl font-bold text-blue-700">{inTransitCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs text-emerald-600 font-medium">Delivered</p>
              <p className="text-xl font-bold text-emerald-700">{deliveredCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs text-amber-600 font-medium">Pending</p>
              <p className="text-xl font-bold text-amber-700">{pendingTrackCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by tracking number, carrier, customer, or order ID..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tracked Orders Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border/30">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Customer</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Platform</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Carrier</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tracking #</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Last Updated</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    {search ? "No shipments match your search" : "No shipments yet — mark an order as shipped to start tracking"}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => {
                  const PlatMeta = platformMeta[order.store?.platform] || null;
                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <span className="text-xs font-mono font-medium">#{order.externalOrderId || order.id}</span>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-xs">{order.customerName || "—"}</span>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {PlatMeta ? (
                          <Badge variant="outline" className={cn("text-[10px] gap-1 capitalize", PlatMeta.color)}>
                            <PlatMeta.icon className="w-3 h-3" />
                            {order.store?.platform || "—"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-xs capitalize">{order.carrier || "—"}</span>
                      </td>
                      <td className="p-3">
                        {order.trackingNumber ? (
                          order.trackingUrl ? (
                            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline font-mono flex items-center gap-1"
                            >
                              {order.trackingNumber}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs font-mono">{order.trackingNumber}</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <StatusDot status={order.trackingStatus || "pending"} />
                          <span className="text-xs capitalize">
                            {order.trackingStatus === "delivered" ? "Delivered" :
                             order.trackingStatus === "in_transit" ? "In Transit" :
                             order.trackingStatus === "failed" ? "Exception" : "Pending"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {order.trackingUpdatedAt
                            ? new Date(order.trackingUpdatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : order.updatedAt
                              ? new Date(order.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                              : "—"}
                        </span>
                      </td>
                      <td className="p-3">
                        {(!order.trackingStatus || order.trackingStatus === "pending") && order.status !== "cancelled" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => setTrackingOrderId(order.id)}
                          >
                            <Truck className="w-3 h-3" /> Track
                          </Button>
                        )}
                        {order.trackingUrl && (
                          <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                              <ExternalLink className="w-3 h-3" /> View
                            </Button>
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Untracked Orders */}
      {orders && orders.filter((o: any) => !o.trackingNumber && o.status !== "cancelled").length > 0 && (
        <Card className="border-dashed border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {orders.filter((o: any) => !o.trackingNumber && o.status !== "cancelled").length} orders need tracking numbers
                </span>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLocation("/orders")}>
                View Orders <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <TrackingDialog
        orderId={trackingOrderId}
        onClose={() => setTrackingOrderId(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          setTrackingOrderId(null);
        }}
      />
    </div>
  );
}

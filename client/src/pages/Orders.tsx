import { useOrders } from "@/hooks/use-orders";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Package, Clock, Search, AlertTriangle, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";

export default function Orders() {
  const { data: orders, isLoading } = useOrders();
  const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const pendingCount = orders?.filter(o => o.status === 'pending').length ?? 0;
  const unfulfilledCount = orders?.filter(o => o.fulfillmentStatus === 'unfulfilled').length ?? 0;
  const needsTrackingCount = orders?.filter(o =>
    o.fulfillmentStatus === 'fulfilled' && !o.trackingNumber
  ).length ?? 0;
  const shippedToday = orders?.filter(o =>
    o.status === 'shipped' && o.updatedAt &&
    new Date(o.updatedAt).toDateString() === new Date().toDateString()
  ).length ?? 0;

  if (isLoading) return <div className="p-8">Loading orders...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Orders</h2>
        <p className="text-muted-foreground mt-2">Track and manage customer orders</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Pending Processing</CardTitle>
            <Clock className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">Awaiting Fulfillment</CardTitle>
            <Package className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{unfulfilledCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Needs Tracking</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{needsTrackingCount}</div>
            <p className="text-[10px] text-amber-600 mt-1">Convert supplier tracking → customer</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Shipped Today</CardTitle>
            <Truck className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{shippedToday}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No orders found</TableCell>
              </TableRow>
            ) : (
              orders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.externalOrderId || `#${order.id}`}</TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customerName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>£{Number(order.totalAmount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      order.status === 'shipped' || order.status === 'processing' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                      order.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border-red-200' :
                      order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-200' :
                      'bg-gray-100 text-gray-600'
                    }>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      order.fulfillmentStatus === 'fulfilled' ? 'bg-green-500/10 text-green-600 border-green-200' :
                      order.fulfillmentStatus === 'unfulfilled' ? 'bg-red-500/10 text-red-600 border-red-200' :
                      'bg-blue-500/10 text-blue-600 border-blue-200'
                    }>
                      {order.fulfillmentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.trackingNumber ? (
                      <div className="flex flex-col gap-1">
                        <div className="text-xs">
                          <span className="font-medium">{order.carrier}</span>:{" "}
                          {order.trackingUrl ? (
                            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {order.trackingNumber}
                            </a>
                          ) : (
                            order.trackingNumber
                          )}
                        </div>
                        {order.trackingStatus && (
                          <Badge variant="outline" className={
                            order.trackingStatus === 'delivered' ? 'bg-green-500/10 text-green-600 border-green-200 w-fit text-[10px] px-1.5 py-0' :
                            order.trackingStatus === 'in_transit' ? 'bg-blue-500/10 text-blue-600 border-blue-200 w-fit text-[10px] px-1.5 py-0' :
                            order.trackingStatus === 'failed' ? 'bg-red-500/10 text-red-600 border-red-200 w-fit text-[10px] px-1.5 py-0' :
                            'bg-yellow-500/10 text-yellow-600 border-yellow-200 w-fit text-[10px] px-1.5 py-0'
                          }>
                            {order.trackingStatus === 'delivered' ? 'Delivered' :
                             order.trackingStatus === 'in_transit' ? 'In Transit' :
                             order.trackingStatus === 'failed' ? 'Exception' : 'Pending'}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.fulfillmentStatus === 'fulfilled' && !order.trackingNumber ? (
                      <Button variant="outline" size="sm" onClick={() => setTrackingOrderId(order.id)}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20">
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Convert
                      </Button>
                    ) : order.fulfillmentStatus !== 'fulfilled' && order.status !== 'cancelled' ? (
                      <Button variant="ghost" size="sm" onClick={() => setTrackingOrderId(order.id)}>
                        <Truck className="w-4 h-4 mr-1" />
                        Ship
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TrackingDialog
        orderId={trackingOrderId}
        onClose={() => setTrackingOrderId(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
          setTrackingOrderId(null);
        }}
      />
    </div>
  );
}

function TrackingDialog({
  orderId,
  onClose,
  onSuccess,
}: {
  orderId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [detected, setDetected] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (orderId) {
      setCarrier("");
      setTrackingNumber("");
      setDetected(null);
    }
  }, [orderId]);

  // Client-side carrier hint from tracking number prefix
  const updateTrackingNumber = (value: string) => {
    setTrackingNumber(value);
    const t = value.trim().toUpperCase();
    if (/^1Z[A-Z0-9]{16,18}$/.test(t)) setDetected("UPS");
    else if (/^(FX|RF)/.test(t) || /^\d{12,15}$/.test(t)) setDetected("FedEx");
    else if (/^(94|93|92|91|90)\d{18,20}$/.test(t)) setDetected("USPS");
    else if (/^JD\d{18}/.test(t) || /^\d{10}$/.test(t)) setDetected("DHL");
    else if (/^[A-Z]{2}\d{9}GB$/.test(t)) setDetected("Royal Mail");
    else if (/^LP\d{13,16}$/.test(t) || /^CP\d{13,16}$/.test(t)) setDetected("China Post");
    else if (/^\d{14}$/.test(t)) setDetected("DPD");
    else if (/^\d{16}$/.test(t)) setDetected("Evri");
    else setDetected(null);
  };

  const trackingMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { trackingNumber };
      if (carrier) body.carrier = carrier;
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update tracking");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Order Shipped", description: `Tracking added — ${carrier || detected || ''}: ${trackingNumber}` });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!trackingNumber) return;
    if (!carrier && !detected) {
      toast({ title: "Carrier needed", description: "Enter the carrier name or check the tracking number format.", variant: "destructive" });
      return;
    }
    trackingMutation.mutate();
  };

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert Tracking — Order #{orderId}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Paste the tracking number from your supplier. The carrier will be auto-detected.
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tracking Number (from supplier)</Label>
            <Input
              placeholder="Paste supplier tracking number"
              value={trackingNumber}
              onChange={(e) => updateTrackingNumber(e.target.value)}
            />
            {detected && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Detected carrier: <strong>{detected}</strong>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Carrier {detected && <span className="text-xs text-muted-foreground">(optional — auto-detected above)</span>}</Label>
            <Input
              placeholder={detected || "e.g. Royal Mail, UPS, DHL"}
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
            <strong>How this works:</strong> After you add tracking, the customer will receive an email with the
            tracking link, and the marketplace (eBay/Shopify) will be updated automatically.
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!trackingNumber || trackingMutation.isPending}
          >
            {trackingMutation.isPending ? "Converting..." : "Convert & Notify Customer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

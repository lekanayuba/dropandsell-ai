import { useOrders } from "@/hooks/use-orders";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Package, Clock, Search } from "lucide-react";
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

      <div className="grid gap-4 md:grid-cols-3">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTrackingOrderId(order.id)}
                      disabled={order.fulfillmentStatus === 'fulfilled' || order.status === 'shipped' || order.status === 'cancelled'}
                    >
                      <Truck className="w-4 h-4 mr-1" />
                      Ship
                    </Button>
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
  const { toast } = useToast();

  useEffect(() => {
    if (orderId) {
      setCarrier("");
      setTrackingNumber("");
    }
  }, [orderId]);

  const trackingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, trackingNumber }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update tracking");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Order Shipped", description: `Tracking added — ${carrier}: ${trackingNumber}` });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ship Order #{orderId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Carrier</Label>
            <Input
              placeholder="e.g. Royal Mail, UPS, DHL"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Tracking Number</Label>
            <Input
              placeholder="Enter tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => trackingMutation.mutate()}
            disabled={!carrier || !trackingNumber || trackingMutation.isPending}
          >
            {trackingMutation.isPending ? "Saving..." : "Mark as Shipped"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

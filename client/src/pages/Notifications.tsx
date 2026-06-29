import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Package, Truck, AlertTriangle, Info, Loader2, RefreshCw, DollarSign, ShieldAlert, Sparkles, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications, isLoading } = useQuery({
    queryKey: [api.notification.list.path],
    queryFn: async () => {
      const res = await fetch(api.notification.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return api.notification.list.responses[200].parse(await res.json());
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.notification.readAll.path, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notification.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.notification.unreadCount.path] });
      toast({ title: "Done", description: "All notifications marked as read" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = api.notification.markRead.path.replace(":id", String(id));
      const res = await fetch(url, { method: "PUT", credentials: "include" });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notification.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.notification.unreadCount.path] });
    },
  });

  const typeIcon = (type: string) => {
    switch (type) {
      case 'order_shipped': return <Truck className="w-5 h-5 text-blue-500" />;
      case 'order_delivered': return <Package className="w-5 h-5 text-green-500" />;
      case 'stock_alert': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'restock': return <RotateCcw className="w-5 h-5 text-emerald-500" />;
      case 'price_alert': return <DollarSign className="w-5 h-5 text-purple-500" />;
      case 'supplier_alert': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'new_products': return <Sparkles className="w-5 h-5 text-pink-500" />;
      default: return <Info className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'order_shipped': return 'bg-blue-500/10 border-blue-200';
      case 'order_delivered': return 'bg-green-500/10 border-green-200';
      case 'stock_alert': return 'bg-amber-500/10 border-amber-200';
      case 'restock': return 'bg-emerald-500/10 border-emerald-200';
      case 'price_alert': return 'bg-purple-500/10 border-purple-200';
      case 'supplier_alert': return 'bg-red-500/10 border-red-200';
      case 'new_products': return 'bg-pink-500/10 border-pink-200';
      default: return 'bg-muted/50 border-border';
    }
  };

  if (isLoading) return <div className="p-8">Loading notifications...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Notifications</h2>
          <p className="text-muted-foreground mt-2">Stay updated on orders, shipments, and stock</p>
        </div>
        {notifications?.some(n => !n.read) && (
          <Button
            variant="outline"
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {notifications?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bell className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No notifications</h3>
              <p className="text-muted-foreground text-sm">You're all caught up!</p>
            </CardContent>
          </Card>
        ) : (
          notifications?.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                !notif.read ? 'border-primary/30 bg-primary/5' : typeColor(notif.type)
              }`}
              onClick={() => { if (!notif.read) markReadMutation.mutate(notif.id); }}
            >
              <div className="mt-0.5">{typeIcon(notif.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{notif.title}</p>
                  {!notif.read && (
                    <Badge variant="default" className="h-1.5 w-1.5 rounded-full p-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{notif.message}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ''}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

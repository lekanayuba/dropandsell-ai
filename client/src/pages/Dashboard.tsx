import { useDashboardStats } from "@/hooks/use-dashboard";
import { StatsCard } from "@/components/StatsCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  DollarSign, ShoppingBag, Store, Wallet, ArrowUpRight, AlertTriangle,
  GripVertical, Package, Truck, Clock, RefreshCw, CheckCircle2, XCircle,
  ShoppingCart, TrendingUp, TrendingDown, Boxes, Bell, Eye, EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STORAGE_KEY = "dash-card-order";

const statCards = [
  { title: "Total Revenue", key: "totalRevenue", icon: DollarSign, fmt: "currency" },
  { title: "Total Orders", key: "totalOrders", icon: ShoppingBag, fmt: "number" },
  { title: "Active Listings", key: "activeListings", icon: Store, fmt: "number" },
  { title: "Wallet Balance", key: "walletBalance", icon: Wallet, fmt: "currency" },
  { title: "Out of Stock", key: "outOfStockProducts", icon: AlertTriangle, fmt: "number" },
] as const;

function statValue(stats: any, key: string, fmt: string): string {
  const val = stats?.[key] ?? 0;
  if (fmt === "currency") {
    const n = typeof val === "number" ? val : parseFloat(String(val));
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return Number(val).toString();
}

function statDesc(key: string, stats: any): string {
  if (key === "outOfStockProducts") {
    return (stats?.outOfStockProducts ?? 0) > 0 ? "Needs attention" : "All in stock";
  }
  const growth = stats?.weeklyGrowth;
  if (key === "totalRevenue") return growth ? `+${growth}% this week` : "Track your earnings";
  if (key === "totalOrders") return `${stats?.totalOrders ?? 0} total orders placed`;
  if (key === "activeListings") return `Across ${stats?.storeCount ?? 0} stores`;
  if (key === "walletBalance") return "Available for payout";
  return "";
}

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function SortableStatCard({ id, stats, icon: Icon, title, value, description }: {
  id: string; stats: any; icon: any; title: string; value: string; description: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={`drop-zone ${isDragging ? "dragging" : ""}`}>
      <StatsCard title={title} value={value} icon={Icon} description={description}
        dragHandle={
          <button className="p-2 -ml-2 touch-none cursor-grab active:cursor-grabbing hover:text-primary transition-colors" {...attributes} {...listeners} aria-label="Drag to reorder">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        }
      />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    delivered: "bg-emerald-500", in_transit: "bg-blue-500",
    pending: "bg-amber-500", failed: "bg-red-500",
  };
  return <span className={cn("h-2 w-2 rounded-full inline-block shrink-0", colors[status] || "bg-gray-400")} />;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const [cardOrder, setCardOrder] = useState<string[]>(() => loadOrder());

  useEffect(() => {
    if (cardOrder.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(cardOrder));
  }, [cardOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const initialIds = statCards.map((c) => c.key);
  const order = cardOrder.length === statCards.length ? cardOrder : initialIds;

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCardOrder((prev) => {
        const ids = prev.length === statCards.length ? prev : initialIds;
        const oldIdx = ids.indexOf(active.id as string);
        const newIdx = ids.indexOf(over.id as string);
        return arrayMove(ids, oldIdx, newIdx);
      });
    }
  }, []);

  // Fetch orders for tracking + revenue chart
  const { data: orders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => { const r = await fetch("/api/orders", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });

  // Fetch products for stock alerts
  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => { const r = await fetch("/api/products", { credentials: "include" }); if (!r.ok) return { items: [] }; return r.json(); },
  });

  // Fetch stores for auto-restock status
  const { data: stores } = useQuery({
    queryKey: ["/api/stores"],
    queryFn: async () => { const r = await fetch("/api/stores", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });

  // Fetch notifications for activity
  const { data: notifications } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => { const r = await fetch("/api/notifications", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });

  // Compute daily revenue from orders for chart
  const revenueChartData = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const last7 = new Date(Date.now() - 7 * 86400000);
    const recent = orders.filter((o: any) => o.createdAt && new Date(o.createdAt) >= last7 && o.status !== "cancelled");
    const days: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000);
      days[d.toLocaleDateString(undefined, { weekday: "short" })] = 0;
    }
    recent.forEach((o: any) => {
      const key = new Date(o.createdAt).toLocaleDateString(undefined, { weekday: "short" });
      days[key] = (days[key] || 0) + Number(o.totalAmount || 0);
    });
    return Object.entries(days).map(([name, total]) => ({ name, total }));
  }, [orders]);

  // Active orders with tracking (not delivered, has tracking number, or recent)
  const trackedOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter((o: any) => o.trackingNumber || o.status === "shipped" || o.status === "processing")
      .slice(0, 5);
  }, [orders]);

  // Low stock / out of stock products
  const lowStockProducts = useMemo(() => {
    if (!products?.items) return [];
    return products.items
      .filter((p: any) => Number(p.quantity) <= 5)
      .slice(0, 5);
  }, [products]);

  // Auto-restock stores
  const autoRestockStores = useMemo(() => {
    if (!stores) return [];
    return stores.filter((s: any) => s.autoRestock);
  }, [stores]);

  // Pending orders count
  const pendingOrders = useMemo(() => {
    if (!orders) return 0;
    return orders.filter((o: any) => o.status === "pending").length;
  }, [orders]);

  if (statsLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-4 md:px-6 lg:px-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Overview of your dropshipping business</p>
        </div>
      </div>

      {/* Stats Cards */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 px-4 md:px-6 lg:px-0">
            {order.map((key) => {
              const card = statCards.find((c) => c.key === key);
              if (!card) return null;
              return (
                <SortableStatCard key={card.key} id={card.key} stats={stats}
                  icon={card.icon} title={card.title}
                  value={statValue(stats, card.key, card.fmt)}
                  description={statDesc(card.key, stats)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Main grid: Chart + Tracking + Stock */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 px-4 md:px-6 lg:px-0">

        {/* Revenue Chart */}
        <Card className="lg:col-span-4 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Revenue (Last 7 Days)</CardTitle>
            <Badge variant="outline" className="text-xs">
              {revenueChartData.reduce((s: number, d: any) => s + d.total, 0).toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 0 })}
            </Badge>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[250px] md:h-[300px]">
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No revenue data yet. Orders will appear here.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Activity + Quick Stats */}
        <div className="lg:col-span-3 space-y-4">

          {/* Recent Activity */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Bell className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {!notifications || notifications.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">No recent activity</div>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 5).map((n: any) => (
                    <div key={n.id} className="flex items-start gap-3 py-2 border-b border-border/10 last:border-0">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        n.type === "order_delivered" ? "bg-emerald-50 dark:bg-emerald-950/20" :
                        n.type === "order_shipped" ? "bg-blue-50 dark:bg-blue-950/20" :
                        n.type === "stock_alert" ? "bg-red-50 dark:bg-red-950/20" :
                        "bg-muted"
                      )}>
                        {n.type === "order_delivered" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                         n.type === "order_shipped" ? <Truck className="w-4 h-4 text-blue-600" /> :
                         n.type === "stock_alert" ? <AlertTriangle className="w-4 h-4 text-red-600" /> :
                         <Bell className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground">{n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Pending</span>
                </div>
                <p className="text-xl font-bold">{pendingOrders}</p>
                <p className="text-[10px] text-muted-foreground">Orders to process</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Boxes className="w-4 h-4 text-violet-500" />
                  <span className="text-xs text-muted-foreground">Low Stock</span>
                </div>
                <p className="text-xl font-bold">{lowStockProducts.length}</p>
                <p className="text-[10px] text-muted-foreground">Products need restock</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Tracking & Stock Section */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 px-4 md:px-6 lg:px-0">

        {/* Active Orders with Tracking */}
        <Card className="lg:col-span-4 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Order Tracking
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLocation("/orders")}>
              View All <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {!orders || orders.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No orders yet</div>
            ) : trackedOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No active shipments</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left pb-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Order</th>
                      <th className="text-left pb-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Carrier</th>
                      <th className="text-left pb-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left pb-2.5 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Tracking #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {trackedOrders.map((order: any) => (
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setLocation("/orders")}>
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium">#{order.id}</span>
                          <span className="text-[10px] text-muted-foreground block">{order.customerName || "—"}</span>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground hidden sm:table-cell">{order.carrier || "—"}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusDot status={order.trackingStatus || "pending"} />
                            <span className="text-xs capitalize">{order.trackingStatus || "pending"}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell">
                          {order.trackingNumber ? (
                            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline font-mono" onClick={e => e.stopPropagation()}>
                              {order.trackingNumber}
                            </a>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock & Auto-Restock */}
        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Stock Alerts
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLocation("/inventory")}>
              Manage <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {(!products?.items || products.items.length === 0) ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No products yet</div>
            ) : lowStockProducts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">All products are well-stocked</div>
            ) : (
              <div className="divide-y divide-border/10">
                {lowStockProducts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-3 px-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                        Number(p.quantity) <= 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-amber-50 dark:bg-amber-950/20"
                      )}>
                        {Number(p.quantity) <= 0
                          ? <XCircle className="w-3.5 h-3.5 text-red-600" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.name || p.sku || `Product #${p.id}`}</p>
                        <p className="text-[10px] text-muted-foreground">Stock: {Number(p.quantity)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0",
                      Number(p.quantity) <= 0 ? "text-red-600 border-red-200" : "text-amber-600 border-amber-200"
                    )}>
                      {Number(p.quantity) <= 0 ? "OUT" : "LOW"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-Restock Status */}
            {stores && stores.length > 0 && (
              <div className="border-t border-border/20 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Auto-Restock</span>
                  <Badge variant="outline" className="text-[10px]">{autoRestockStores.length}/{stores.length} enabled</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stores.slice(0, 4).map((s: any) => (
                    <Badge key={s.id} variant="secondary" className="text-[10px] gap-1">
                      {s.autoRestock ? <RefreshCw className="w-2.5 h-2.5 text-emerald-500" /> : <EyeOff className="w-2.5 h-2.5 text-muted-foreground" />}
                      {s.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

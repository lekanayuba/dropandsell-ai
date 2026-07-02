import { useDashboardStats } from "@/hooks/use-dashboard";
import { useStores } from "@/hooks/use-stores";
import { useStoreFilter } from "@/hooks/use-store-filter";
import { StoreFilterDropdown } from "@/components/StoreFilterDropdown";
import { StatsCard } from "@/components/StatsCard";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { useState, useEffect, useRef } from "react";
import { DollarSign, ShoppingBag, Store, Wallet, ArrowUpRight, Link, Copy, RefreshCw, Loader2, Bell, Package, Eye, ChevronDown, ChevronUp, MapPin, AlertTriangle, X } from "lucide-react";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildUserUniqueUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { useLocation } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { StoreRulesCard } from "@/components/StoreRulesCard";

export default function Dashboard() {
  const { data: storesData } = useStores();
  const { user: currentUser } = useAuth();
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  const acceptDisclaimerMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/accept-disclaimer");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });
  const allStoreIds = (storesData || []).map((s: any) => s.id);
  const storeFilter = useStoreFilter(allStoreIds);
  const { data: stats, isLoading } = useDashboardStats(
    storeFilter.hasMultipleStores ? storeFilter.selectedStoreIds : undefined
  );
  const { toast } = useToast();
  const { symbol: currSym, format: fc } = useCurrency();
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  const autoSyncDone = useRef(false);

  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ebay/sync-orders');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
      const parts = [];
      if (data.newOrders > 0) parts.push(`${data.newOrders} new order${data.newOrders !== 1 ? 's' : ''}`);
      if (data.updatedOrders > 0) parts.push(`${data.updatedOrders} updated`);
      if (data.revenueAdded > 0) parts.push(`${fc(data.revenueAdded)} revenue added`);
      if (parts.length > 0) {
        toast({
          title: "Orders Synced",
          description: parts.join(', '),
        });
      }
    },
    onError: (err: any) => {
      if (autoSyncDone.current && !manualSync.current) return;
      toast({ title: "Sync Failed", description: err.message || "Failed to sync eBay orders", variant: "destructive" });
    },
  });

  const manualSync = useRef(false);

  useEffect(() => {
    if (autoSyncDone.current) return;
    const hasEbay = (storesData || []).some((s: any) => s.platform === 'ebay' && s.status === 'active');
    if (!hasEbay || !storesData) return;
    autoSyncDone.current = true;
    syncOrdersMutation.mutate();
  }, [storesData]);

  const { data: uniqueUrlData, isLoading: isLoadingUrl } = useQuery<{ uniqueUrl: string }>({
    queryKey: ["/api/user/unique-url"],
  });

  const getFullUniqueUrl = () => {
    return buildUserUniqueUrl(uniqueUrlData?.uniqueUrl || "");
  };

  const copyUniqueUrl = () => {
    const fullUrl = getFullUniqueUrl();
    if (fullUrl) {
      navigator.clipboard.writeText(fullUrl);
      toast({
        title: "Copied!",
        description: "Your unique URL has been copied to clipboard",
      });
    }
  };

  const copyUniqueUrlCode = () => {
    if (uniqueUrlData?.uniqueUrl) {
      navigator.clipboard.writeText(uniqueUrlData.uniqueUrl);
      toast({
        title: "Copied!",
        description: "Your unique URL code has been copied to clipboard",
      });
    }
  };

  const chartData = [
    { name: "Mon", total: 0 },
    { name: "Tue", total: 0 },
    { name: "Wed", total: 0 },
    { name: "Thu", total: 0 },
    { name: "Fri", total: 0 },
    { name: "Sat", total: 0 },
    { name: "Sun", total: 0 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8 p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display tracking-tight">{t('dashboard')}</h2>
        <div className="flex items-center gap-2">
          {storeFilter.hasMultipleStores && (
            <StoreFilterDropdown
              stores={(storesData || []).map((s: any) => ({ id: s.id, name: s.name, platform: s.platform, status: s.status }))}
              selectedStoreIds={storeFilter.selectedStoreIds}
              onToggleStore={storeFilter.toggleStore}
              onSelectAll={storeFilter.selectAll}
              isAllSelected={storeFilter.isAllSelected}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { manualSync.current = true; syncOrdersMutation.mutate(); }}
            disabled={syncOrdersMutation.isPending}
            data-testid="button-sync-orders"
          >
            {syncOrdersMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync eBay Orders
          </Button>
          <PageRefreshButton />
        </div>
      </div>

      <Card className="border-border/50 shadow-sm" data-testid="card-dashboard-unique-url">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('your_url')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('unique_url')}</p>
            <div className="flex gap-2">
              <Input
                value={isLoadingUrl ? "Loading..." : getFullUniqueUrl()}
                readOnly
                className="font-mono text-sm flex-1"
                data-testid="input-dashboard-unique-url"
              />
              <Button variant="outline" onClick={copyUniqueUrl} data-testid="button-copy-dashboard-url">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('unique_code')}</p>
            <div className="flex gap-2">
              <Input
                value={isLoadingUrl ? "Loading..." : (uniqueUrlData?.uniqueUrl || "")}
                readOnly
                className="font-mono text-sm flex-1"
                data-testid="input-dashboard-unique-url-code"
              />
              <Button variant="outline" onClick={copyUniqueUrlCode} data-testid="button-copy-dashboard-url-code">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <StoreRulesCard />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title={t('total_revenue')}
          value={fc(stats?.totalRevenue || 0)}
          icon={DollarSign}
          description={t('from_last_month')}
        />
        <Card
          className="overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer relative"
          onClick={() => navigate('/stores')}
          data-testid="card-new-orders"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('new_orders')}</CardTitle>
            <div className="relative p-2 bg-orange-500/10 rounded-full">
              <Bell className="h-4 w-4 text-orange-500" />
              {(stats?.newOrders || 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 text-white text-[9px] font-bold items-center justify-center">
                    {stats?.newOrders || 0}
                  </span>
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{stats?.newOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.newOrders || 0) > 0 ? t('awaiting_fulfillment') : t('all_fulfilled')}
            </p>
          </CardContent>
        </Card>
        <StatsCard
          title={t('total_orders')}
          value={stats?.totalOrders.toString() || "0"}
          icon={ShoppingBag}
          description={t('orders_up')}
        />
        <StatsCard
          title={t('active_listings')}
          value={stats?.activeListings.toString() || "0"}
          icon={Store}
          description={storeFilter.hasMultipleStores && !storeFilter.isAllSelected ? t('in_selected') : t('across_stores')}
        />
        <StatsCard
          title={t('wallet_balance')}
          value={fc(stats?.walletBalance || 0)}
          icon={Wallet}
          description={t('available_payout')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>{t('revenue_overview')}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => fc(value)}
                />
                <Tooltip 
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--popover))", 
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  formatter={(value: any) => [fc(value), "Revenue"]}
                />
                <Bar 
                  dataKey="total" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('recent_orders')}</CardTitle>
            {(stats?.newOrders || 0) > 0 && (
              <Badge className="bg-orange-500 text-white animate-pulse" data-testid="badge-new-orders-count">
                {stats?.newOrders} new
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {(stats?.recentOrders && stats.recentOrders.length > 0) ? (
              <RecentOrdersList orders={stats.recentOrders} fc={fc} navigate={navigate} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <ArrowUpRight className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No pending orders</p>
                <p className="text-xs mt-1">New orders will appear here when customers purchase</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecentOrdersList({ orders, fc, navigate }: { orders: any[]; fc: (n: number) => string; navigate: (path: string) => void }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {orders.map((order: any) => (
        <div key={order.id}>
          <div
            className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
            data-testid={`recent-order-${order.id}`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/10">
                <Package className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium">{order.customerName || 'Customer'}</p>
                <p className="text-xs text-muted-foreground">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Recent'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-semibold">{fc(Number(order.totalAmount || 0))}</p>
                <Badge
                  variant="outline"
                  className={
                    order.fulfillmentStatus === 'unfulfilled'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-200 text-[10px]'
                      : 'bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]'
                  }
                >
                  {order.fulfillmentStatus === 'unfulfilled' ? 'Unfulfilled' : order.status}
                </Badge>
              </div>
              {expandedId === order.id ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {expandedId === order.id && (
            <div className="ml-12 p-3 bg-muted/20 rounded-b-lg border border-t-0 border-border/50 text-sm space-y-2 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-1 text-muted-foreground font-medium">
                <MapPin className="w-3 h-3" /> Shipping Address
              </div>
              {order.shippingAddress ? (
                <div className="pl-4 space-y-0.5">
                  <p className="font-medium">{order.shippingAddress.name}</p>
                  <p>{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                  <p>{order.shippingAddress.city}, {order.shippingAddress.stateOrProvince} {order.shippingAddress.postalCode}</p>
                  <p>{order.shippingAddress.countryCode}</p>
                </div>
              ) : (
                <p className="pl-4 text-muted-foreground">No address available</p>
              )}
              <div className="pt-1 pl-4 text-xs text-muted-foreground">
                <p>Order: {order.externalOrderId || `#${order.id}`}</p>
                <p>Store: #{order.storeId || 'N/A'}</p>
              </div>
            </div>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-primary"
        onClick={() => navigate('/orders')}
        data-testid="button-view-all-orders"
      >
        <Eye className="w-4 h-4 mr-2" />
        View All Orders
      </Button>
    </div>
  );
}

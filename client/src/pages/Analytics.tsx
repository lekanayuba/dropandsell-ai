import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Package, Truck, AlertCircle, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useState } from "react";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1"];

function StatCard({ title, value, icon: Icon, subtitle }: { title: string; value: string; icon: any; subtitle?: string }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ daily }: { daily: Record<string, number> }) {
  const data = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, total]) => ({ date: date.slice(5), total }));
  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No revenue data. Create orders to see charts.</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthlyChart({ monthly }: { monthly: Record<string, number> }) {
  const data = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, total]) => ({ month, total }));
  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No monthly data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="month" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} />
        <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TopProductsChart({ products }: { products: any[] }) {
  if (products.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No products to show.</p>;
  const data = products.slice(0, 5).map(p => ({ name: p.title.length > 20 ? p.title.substring(0, 20) + '...' : p.title, revenue: p.revenue }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function Analytics() {
  const [tab, setTab] = useState("overview");
  const { data: revenue, isLoading: revLoading } = useQuery({ queryKey: ["/api/analytics/revenue"], queryFn: async () => { const r = await fetch("/api/analytics/revenue", { credentials: "include" }); return r.json(); } });
  const { data: topProducts, isLoading: prodLoading } = useQuery({ queryKey: ["/api/analytics/top-products"], queryFn: async () => { const r = await fetch("/api/analytics/top-products", { credentials: "include" }); return r.json(); } });
  const { data: profitSummary, isLoading: profitLoading } = useQuery({ queryKey: ["/api/analytics/profit-summary"], queryFn: async () => { const r = await fetch("/api/analytics/profit-summary", { credentials: "include" }); return r.json(); } });
  const { data: vendorPerf, isLoading: vendorLoading } = useQuery({ queryKey: ["/api/analytics/vendor-performance"], queryFn: async () => { const r = await fetch("/api/analytics/vendor-performance", { credentials: "include" }); return r.json(); } });

  const loading = revLoading || prodLoading || profitLoading || vendorLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold font-display">Analytics</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Analytics</h2>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={`$${(profitSummary?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={DollarSign} subtitle="All time" />
        <StatCard title="Total Profit" value={`$${(profitSummary?.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={TrendingUp} subtitle={`${profitSummary?.margin || 0}% margin`} />
        <StatCard title="Products" value={String(profitSummary?.productCount || 0)} icon={Package} subtitle="In catalog" />
        <StatCard title="Monthly Revenue" value={`$${revenue ? Object.values(revenue.monthlyRevenue || {}).reduce((a: number, b: any) => a + Number(b), 0).toFixed(2) : '0'}`} icon={BarChart3} subtitle="Current month" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Revenue</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader><CardTitle>Daily Revenue</CardTitle></CardHeader>
            <CardContent><RevenueChart daily={revenue?.dailyRevenue || {}} /></CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader><CardTitle>Monthly Revenue Trend</CardTitle></CardHeader>
            <CardContent><MonthlyChart monthly={revenue?.monthlyRevenue || {}} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card className="border-border/50 shadow-sm">
            <CardHeader><CardTitle>Top Products by Revenue</CardTitle></CardHeader>
            <CardContent>
              <TopProductsChart products={topProducts || []} />
              <div className="mt-6 space-y-2">
                {(topProducts || []).slice(0, 10).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${p.revenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{p.stock} in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors">
          <Card className="border-border/50 shadow-sm">
            <CardHeader><CardTitle>Vendor Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Vendor</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Products</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total Cost</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total Revenue</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(vendorPerf || []).map((v: any) => (
                      <tr key={v.id} className="border-b border-border/20 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{v.name}</td>
                        <td className="py-3 px-2 text-right">{v.productCount}</td>
                        <td className="py-3 px-2 text-right">${v.totalCost.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">${v.totalRevenue.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-medium" style={{ color: v.profit >= 0 ? '#22c55e' : '#ef4444' }}>
                          ${v.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {(!vendorPerf || vendorPerf.length === 0) && (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No vendor data. Add vendors and products first.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
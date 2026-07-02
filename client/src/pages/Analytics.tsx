import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, Package, Store, ShoppingBag, DollarSign } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function Analytics() {
  const { symbol: currSym, format: fc } = useCurrency();
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/analytics"],
  });

  const isLoading = statsLoading || analyticsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-10" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const platformData = analyticsData?.platformBreakdown || [];
  const publishingActivity = analyticsData?.publishingActivity || [];
  const inventoryByVendor = analyticsData?.inventoryByVendor || [];
  const revenueOverTime = analyticsData?.revenueOverTime || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight" data-testid="text-analytics-title">Analytics</h2>
          <p className="text-muted-foreground mt-2">Track your activity and performance metrics</p>
        </div>
        <PageRefreshButton />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-products">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeListings ?? 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-stores">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.totalStores ?? 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-published-listings">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published Listings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.totalPublished ?? 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fc(stats?.totalRevenue ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-chart-platform">
          <CardHeader>
            <CardTitle>Listings by Platform</CardTitle>
            <CardDescription>Distribution of published listings across marketplaces</CardDescription>
          </CardHeader>
          <CardContent>
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {platformData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No published listings yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-chart-publishing">
          <CardHeader>
            <CardTitle>Publishing Activity</CardTitle>
            <CardDescription>Products published over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {publishingActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={publishingActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Published" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No publishing activity yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-chart-inventory">
          <CardHeader>
            <CardTitle>Inventory by Vendor</CardTitle>
            <CardDescription>Product count per vendor</CardDescription>
          </CardHeader>
          <CardContent>
            {inventoryByVendor.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inventoryByVendor} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} name="Products" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No vendors or products yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-chart-revenue">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Revenue over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => fc(value)} />
                  <Tooltip formatter={(value: any) => [fc(value), "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No revenue data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

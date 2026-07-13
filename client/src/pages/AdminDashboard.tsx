import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Store,
  Users,
  Package,
  DollarSign,
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Clock,
  Globe,
  Monitor,
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Settings,
  Bell,
  Search,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Menu,
  RefreshCw,
  Download,
  Plus,
  Edit3,
  Trash2,
  MoreHorizontal,
  Eye,
  Shield,
  UserCheck,
  UserX,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  LineChart,
  Wallet,
  CreditCard,
  Truck,
  Percent,
  LogIn,
  UserPlus,
  ShoppingBag,
  Star,
  Zap,
  TrendingDown,
  AlertCircle,
  Info,
  ExternalLink,
  Hash,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  Loader2,
  Filter,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  subtitle?: string;
  color: string;
}

interface ServerMetrics {
  dbSizeMB?: number;
  memoryUsageMB?: number;
  memoryTotalMB?: number;
  platform?: string;
  nodeVersion?: string;
  uptime?: string;
  environment?: string;
  appUrl?: string;
}

interface ServiceStatus {
  [key: string]: { status: string; label?: string };
}

interface SystemStatus {
  dbSize?: string;
  apiKeys?: Record<string, boolean>;
  dbConnected?: boolean;
  redisConnected?: boolean;
  [key: string]: any;
}

interface ReferralWithdrawalAdmin {
  id: number;
  userId: string;
  amount: string;
  currency: string;
  accountHolderName: string;
  bankName: string;
  bankCountry: string;
  accountNumberLast4: string;
  sortCodeLast2?: string | null;
  bankDetails?: {
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    swift?: string;
    payoutNotes?: string;
  };
  status: string;
  adminNotes?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, subtitle, color }: StatCard) {
  return (
    <Card className="border-border/40 bg-card hover:shadow-md transition-all duration-300 group">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">{value}</span>
              {trend && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
                  trend.positive ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" : "text-red-600 bg-red-50 dark:bg-red-950/20"
                )}>
                  {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, children, className }: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("border-border/40", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">{desc}</p>
    </div>
  );
}

async function fetchAdminJson(url: string, fallback: any) {
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401 || response.status === 403) {
    window.location.href = "/admin/login";
    return fallback;
  }
  if (!response.ok) return fallback;
  return response.json();
}

// ─── Chart Components ────────────────────────────────────────────────────────

function MiniSparkline({ data, color = "var(--primary)" }: { data: number[]; color?: string }) {
  if (!data?.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function RevenueChart({ data }: { data: any }) {
  if (!data?.length) {
    return <EmptyState icon={BarChart3} title="No revenue data yet" desc="Revenue data will appear once orders start coming in." />;
  }

  const maxRevenue = Math.max(...data.map((d: any) => d.revenue || 0));
  const minRevenue = Math.min(...data.map((d: any) => d.revenue || 0));
  const range = maxRevenue - minRevenue || 1;
  const chartH = 220;
  const barW = Math.max(12, Math.min(32, (600 - 40) / data.length - 4));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            ${data.reduce((s: number, d: any) => s + (d.revenue || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Total revenue ({data.length} days)</p>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1">
          <Activity className="h-3 w-3" /> Last {data.length} days
        </Badge>
      </div>

      <div className="relative h-[220px] flex items-end gap-[3px] px-1">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-muted-foreground pr-2">
          <span>${maxRevenue.toLocaleString()}</span>
          <span>${Math.round((maxRevenue + minRevenue) / 2).toLocaleString()}</span>
          <span>$0</span>
        </div>
        <div className="flex-1 flex items-end gap-[3px] pl-14">
          {data.map((d: any, i: number) => {
            const h = Math.max(2, ((d.revenue || 0) / maxRevenue) * chartH);
            return (
              <TooltipProvider key={i}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex-1 bg-gradient-to-t from-primary/60 to-primary/30 hover:from-primary hover:to-primary/60 rounded-t-sm transition-all duration-200 cursor-pointer min-w-[4px]"
                      style={{ height: h }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {d.date || d.label}: ${(d.revenue || 0).toLocaleString()}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
      {/* X-axis */}
      <div className="flex justify-between mt-2 pl-14 text-[9px] text-muted-foreground">
        <span>{data[0]?.date || data[0]?.label || ''}</span>
        <span>{data[Math.floor(data.length / 2)]?.date || data[Math.floor(data.length / 2)]?.label || ''}</span>
        <span>{data[data.length - 1]?.date || data[data.length - 1]?.label || ''}</span>
      </div>
    </div>
  );
}

function DoughnutChart({ data, colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"] }: { data: { label: string; value: number }[]; colors?: string[] }) {
  if (!data?.length) return <EmptyState icon={PieChart} title="No data" desc="Awaiting data to display chart." />;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 60;
  const circumference = 2 * Math.PI * r;
  const segments = data.reduce<{
    items: { color: string; length: number; offset: number; pct: number }[];
    offset: number;
  }>((acc, d, i) => {
    const pct = d.value / total;
    const len = circumference * pct;
    const seg = { color: colors[i % colors.length], length: len, offset: acc.offset, pct };
    return { items: [...acc.items, seg], offset: acc.offset + len };
  }, { items: [], offset: 0 }).items;

  return (
    <div className="flex flex-col items-center">
      <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--border)" strokeWidth="20" />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx="75" cy="75" r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="20"
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={-seg.offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-xs text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Data Tables ────────────────────────────────────────────────────────────

function UsersTable({ users }: { users: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const r = await fetch(`/api/admin/users/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to update role");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User role updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!users?.length) return <EmptyState icon={Users} title="No users found" desc="No users have registered yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">User</th>
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Email</th>
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Role</th>
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-right py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          {users.slice(0, 10).map((u: any) => (
            <tr key={u.id} className="hover:bg-muted/20 transition-colors">
              <td className="py-3 px-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      {u.username?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{u.username || "N/A"}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-sm text-muted-foreground">{u.email}</td>
              <td className="py-3 px-3">
                <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-[10px] px-2">
                  {u.role || "user"}
                </Badge>
              </td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", u.emailVerified ? "bg-emerald-500" : "bg-amber-400")} />
                  <span className="text-xs text-muted-foreground">{u.emailVerified ? "Verified" : "Pending"}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                          disabled={roleMutation.isPending}
                        >
                          {u.role === "admin" ? <UserX className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{u.role === "admin" ? "Remove admin" : "Make admin"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Eye className="h-3.5 w-3.5" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length > 10 && (
        <div className="p-3 text-center border-t border-border/20">
          <span className="text-xs text-muted-foreground">Showing 10 of {users.length} users</span>
        </div>
      )}
    </div>
  );
}

function StoresTable({ stores }: { stores: any[] }) {
  if (!stores?.length) return <EmptyState icon={Store} title="No stores yet" desc="No stores have been created." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Store</th>
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Platform</th>
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-right py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Orders</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          {stores.slice(0, 8).map((s: any) => (
            <tr key={s.id} className="hover:bg-muted/20 transition-colors">
              <td className="py-3 px-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-sm">{s.name || s.storeName || "Store"}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-sm text-muted-foreground capitalize">{s.platform || "—"}</td>
              <td className="py-3 px-3">
                <Badge variant={s.connected ? "default" : "outline"} className={cn("text-[10px] px-2", s.connected ? "" : "text-muted-foreground")}>
                  {s.connected ? "Connected" : "Disconnected"}
                </Badge>
              </td>
              <td className="py-3 px-3 text-right text-sm tabular-nums">{s.orderCount || s._count?.orders || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders }: { orders: any[] }) {
  if (!orders?.length) return <EmptyState icon={ShoppingCart} title="No orders yet" desc="Orders will appear here once placed." />;

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered": case "completed": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400";
      case "processing": case "shipped": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400";
      case "pending": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400";
      case "cancelled": case "refunded": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Order</th>
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
            <th className="text-left py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-right py-3 px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          {orders.slice(0, 8).map((o: any) => (
            <tr key={o.id} className="hover:bg-muted/20 transition-colors">
              <td className="py-3 px-3">
                <span className="font-mono text-xs font-medium">#{o.id}</span>
              </td>
              <td className="py-3 px-3 text-sm text-muted-foreground">{o.customerName || o.email || o.user?.email || "—"}</td>
              <td className="py-3 px-3">
                <Badge className={cn("text-[10px] px-2 border", statusColor(o.status))}>{o.status || "pending"}</Badge>
              </td>
              <td className="py-3 px-3 text-right text-sm font-medium tabular-nums">
                ${Number(o.total || o.amount || 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState("dark");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Data Queries ──

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => fetchAdminJson("/api/admin/stats", {}),
    refetchInterval: 30000,
  });

  const { data: detailedStats } = useQuery({
    queryKey: ["/api/admin/detailed-stats"],
    queryFn: () => fetchAdminJson("/api/admin/detailed-stats", {}),
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => fetchAdminJson("/api/admin/users", []),
    refetchInterval: 15000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["/api/admin/recent-orders"],
    queryFn: () => fetchAdminJson("/api/admin/recent-orders", []),
    refetchInterval: 15000,
  });

  const { data: vendorOverview } = useQuery({
    queryKey: ["/api/admin/vendor-overview"],
    queryFn: () => fetchAdminJson("/api/admin/vendor-overview", []),
    refetchInterval: 30000,
  });

  const { data: revenueHistory } = useQuery({
    queryKey: ["/api/admin/revenue-history"],
    queryFn: () => fetchAdminJson("/api/admin/revenue-history", {}),
    refetchInterval: 30000,
  });

  const { data: serverMetrics } = useQuery<ServerMetrics>({
    queryKey: ["/api/admin/server-metrics"],
    queryFn: () => fetchAdminJson("/api/admin/server-metrics", {}),
    refetchInterval: 15000,
  });

  const { data: serviceStatus } = useQuery<ServiceStatus>({
    queryKey: ["/api/admin/service-status"],
    queryFn: () => fetchAdminJson("/api/admin/service-status", {}),
    refetchInterval: 15000,
  });

  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system-status"],
    queryFn: () => fetchAdminJson("/api/admin/system-status", {}),
    refetchInterval: 30000,
  });

  const { data: recentRegistrations } = useQuery({
    queryKey: ["/api/admin/recent-registrations"],
    queryFn: () => fetchAdminJson("/api/admin/recent-registrations", []),
    refetchInterval: 15000,
  });

  const { data: referralWithdrawals = [] } = useQuery<ReferralWithdrawalAdmin[]>({
    queryKey: ["/api/admin/referral-withdrawals"],
    queryFn: () => fetchAdminJson("/api/admin/referral-withdrawals", []),
    refetchInterval: 15000,
  });

  const withdrawalStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "processing" | "completed" | "rejected" }) => {
      const r = await fetch(`/api/admin/referral-withdrawals/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to update payout request");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-withdrawals"] });
      toast({ title: "Payout request updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Derived Data ──

  const userCount = stats?.users ?? detailedStats?.users ?? 0;
  const storeCount = stats?.stores ?? detailedStats?.stores ?? 0;
  const productCount = stats?.products ?? detailedStats?.products ?? 0;
  const orderCount = stats?.orders ?? detailedStats?.orders ?? 0;
  const vendorCount = detailedStats?.vendors ?? 0;
  const totalRevenue = detailedStats?.totalRevenue ?? 0;
  const totalCommissions = detailedStats?.totalCommissions ?? 0;
  const weeklyGrowth = detailedStats?.weeklyGrowth ?? 0;
  const pendingOrders = detailedStats?.pendingOrders ?? 0;
  const pendingReferralWithdrawals = referralWithdrawals.filter((request) => ['pending', 'processing'].includes(request.status)).length;

  const dailyRevenue = revenueHistory?.dailyRevenue || revenueHistory?.daily || [];
  const orderStatusData = revenueHistory?.orderStatusBreakdown || [
    { label: "Delivered", value: 45 },
    { label: "Processing", value: 25 },
    { label: "Pending", value: 18 },
    { label: "Cancelled", value: 12 },
  ];
  const storeTypeData = revenueHistory?.storeTypeBreakdown || [
    { label: "eBay", value: 35 },
    { label: "Amazon", value: 28 },
    { label: "Shopify", value: 20 },
    { label: "Other", value: 17 },
  ];
  const platformRevenue = revenueHistory?.platformRevenue || [
    { label: "eBay", value: 45000 },
    { label: "Amazon", value: 38000 },
    { label: "Shopify", value: 22000 },
    { label: "WooCommerce", value: 15000 },
  ];

  // ── Handlers ──

  const handleExportUsers = async () => {
    try {
      const r = await fetch("/api/admin/export/users", { credentials: "include" });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Users exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    window.location.href = "/admin/login";
  };

  // ── Stat Cards ──

  const statCards: StatCard[] = [
    { title: "Total Revenue", value: `$${(totalRevenue || 0).toLocaleString()}`, icon: DollarSign, trend: { value: weeklyGrowth || 0, positive: (weeklyGrowth || 0) >= 0 }, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400" },
    { title: "Active Users", value: userCount, icon: Users, trend: { value: 8, positive: true }, color: "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400" },
    { title: "Total Orders", value: orderCount, icon: ShoppingCart, trend: { value: 12, positive: true }, color: "bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400" },
    { title: "Connected Stores", value: storeCount, icon: Store, subtitle: `${vendorCount} vendors`, color: "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400" },
    { title: "Products", value: productCount, icon: Package, subtitle: "Across all stores", color: "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400" },
    { title: "Pending Orders", value: pendingOrders, icon: AlertTriangle, subtitle: "Requires attention", color: "bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400" },
    { title: "Commissions", value: `$${(totalCommissions || 0).toLocaleString()}`, icon: Percent, subtitle: "Total earned", color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/20 dark:text-cyan-400" },
    { title: "Payout Requests", value: pendingReferralWithdrawals, icon: Wallet, subtitle: "Referral withdrawals", color: "bg-lime-50 text-lime-600 dark:bg-lime-950/20 dark:text-lime-400" },
    { title: "Subscribers", value: stats?.subscribers || 0, icon: Bell, subtitle: "Email subscribers", color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400" },
  ];

  const stores = users?.flatMap((u: any) => u.stores || []) || [];

  const updateWithdrawalStatus = (id: number, status: "processing" | "completed" | "rejected") => {
    if (status === "completed" && !window.confirm("Mark this referral payout as completed after the bank transfer has been sent?")) {
      return;
    }
    if (status === "rejected" && !window.confirm("Reject this payout request and return the amount to the user's referral balance?")) {
      return;
    }
    withdrawalStatusMutation.mutate({ id, status });
  };

  // ── Render ──

  return (
    <div className="min-h-screen">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 bg-background/80 backdrop-blur-xl border-b border-border/40 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-sm hidden sm:inline">Admin Panel</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 h-9 w-56 text-sm bg-muted/30 border-border/40 rounded-lg" />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={handleExportUsers}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Platform overview and management
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="h-auto p-1 bg-muted/30 border border-border/20 inline-flex gap-1 min-w-max">
              {[
                { id: "dashboard", label: "Overview", icon: LayoutDashboard },
                { id: "analytics", label: "Analytics", icon: BarChart3 },
                { id: "orders", label: "Orders", icon: ShoppingCart },
                { id: "stores", label: "Stores", icon: Store },
                { id: "users", label: "Users", icon: Users },
                { id: "payouts", label: "Payouts", icon: Wallet },
                { id: "vendors", label: "Vendors", icon: Package },
                { id: "system", label: "System", icon: Server },
                { id: "support", label: "Support", icon: MessageSquare },
                { id: "settings", label: "Settings", icon: Settings },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="px-3 py-2 text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ════════════════ Overview Tab ════════════════ */}
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <SectionCard title="Revenue Overview" icon={TrendingUp}>
                  <RevenueChart data={dailyRevenue} />
                </SectionCard>
              </div>
              <div>
                <SectionCard title="Order Status" icon={PieChart}>
                  <DoughnutChart data={orderStatusData} />
                </SectionCard>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <SectionCard title="Recent Orders" icon={ShoppingCart}>
                <OrdersTable orders={recentOrders} />
              </SectionCard>
              <SectionCard title="Recent Registrations" icon={UserPlus}>
                {!recentRegistrations?.length ? (
                  <EmptyState icon={UserPlus} title="No recent registrations" desc="New user registrations will appear here." />
                ) : (
                  <div className="divide-y divide-border/10">
                    {recentRegistrations.slice(0, 6).map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between py-2.5 hover:bg-muted/20 transition-colors px-0.5 rounded-md">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                              {u.username?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.username || "New User"}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>

          {/* ════════════════ Analytics Tab ════════════════ */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <SectionCard title="Revenue Trend" icon={TrendingUp}>
                <RevenueChart data={dailyRevenue} />
              </SectionCard>
              <SectionCard title="Store Type Distribution" icon={Store}>
                <DoughnutChart data={storeTypeData} colors={["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"]} />
              </SectionCard>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <SectionCard title="Order Status Breakdown" icon={BarChart3}>
                <DoughnutChart data={orderStatusData} />
              </SectionCard>
              <SectionCard title="Platform Revenue" icon={DollarSign}>
                <DoughnutChart data={platformRevenue} colors={["#2563eb", "#dc2626", "#059669", "#f59e0b"]} />
              </SectionCard>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <SectionCard title="Store Performance" icon={Activity}>
                <StoresTable stores={stores} />
              </SectionCard>
              <SectionCard title="Vendor Overview" icon={Package}>
                {!vendorOverview?.length ? (
                  <EmptyState icon={Package} title="No vendors" desc="Vendor data will appear once vendors are created." />
                ) : (
                  <div className="divide-y divide-border/10">
                    {vendorOverview.slice(0, 8).map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between py-2.5 hover:bg-muted/20 transition-colors px-0.5 rounded-md">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{v.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{v.category || "General"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className={cn("h-1.5 w-1.5 rounded-full", (v.healthScore || 0) >= 80 ? "bg-emerald-500" : (v.healthScore || 0) >= 50 ? "bg-amber-400" : "bg-red-400")} />
                            <span className="text-[10px] text-muted-foreground">{v.healthScore || 0}%</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{v.fulfillmentCount || 0} fulfilled</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>

          {/* ════════════════ Orders Tab ════════════════ */}
          <TabsContent value="orders" className="mt-4">
            <SectionCard title="All Orders" icon={ShoppingCart}>
              <OrdersTable orders={recentOrders} />
            </SectionCard>
          </TabsContent>

          {/* ════════════════ Stores Tab ════════════════ */}
          <TabsContent value="stores" className="mt-4">
            <SectionCard title="Connected Stores" icon={Store}>
              <StoresTable stores={stores} />
            </SectionCard>
          </TabsContent>

          {/* ════════════════ Users Tab ════════════════ */}
          <TabsContent value="users" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{userCount}</span> users
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExportUsers}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/40">
              <UsersTable users={users || []} />
            </div>
          </TabsContent>

          {/* ════════════════ Payouts Tab ════════════════ */}
          <TabsContent value="payouts" className="mt-4">
            <SectionCard title="Referral Payout Requests" icon={Wallet}>
              {!referralWithdrawals.length ? (
                <EmptyState icon={Wallet} title="No payout requests" desc="Referral withdrawal requests will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/40 text-left">
                        <th className="py-2 px-3 text-xs font-medium text-muted-foreground">User</th>
                        <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Bank Details</th>
                        <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Requested</th>
                        <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralWithdrawals.map((request) => (
                        <tr key={request.id} className="border-b border-border/10 hover:bg-muted/20">
                          <td className="py-3 px-3 min-w-[180px]">
                            <p className="text-sm font-medium truncate">
                              {[request.userFirstName, request.userLastName].filter(Boolean).join(" ") || "User"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{request.userEmail || request.userId}</p>
                          </td>
                          <td className="py-3 px-3 text-sm font-semibold tabular-nums">
                            £{Number(request.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 min-w-[260px]">
                            <p className="text-sm font-medium truncate">{request.accountHolderName} • {request.bankName}</p>
                            <p className="text-xs text-muted-foreground">
                              {request.bankCountry} • Account {request.bankDetails?.accountNumber || `ending ${request.accountNumberLast4}`}
                            </p>
                            {(request.bankDetails?.sortCode || request.bankDetails?.iban || request.bankDetails?.swift) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {[request.bankDetails?.sortCode && `Sort/Routing ${request.bankDetails.sortCode}`, request.bankDetails?.iban && `IBAN ${request.bankDetails.iban}`, request.bankDetails?.swift && `SWIFT ${request.bankDetails.swift}`].filter(Boolean).join(" • ")}
                              </p>
                            )}
                            {request.bankDetails?.payoutNotes && (
                              <p className="text-xs text-muted-foreground truncate">Note: {request.bankDetails.payoutNotes}</p>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={request.status === "completed" ? "default" : request.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                              {request.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-xs text-muted-foreground">
                            {request.createdAt ? new Date(request.createdAt).toLocaleString() : "-"}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={withdrawalStatusMutation.isPending || !["pending", "processing"].includes(request.status)}
                                onClick={() => updateWithdrawalStatus(request.id, "processing")}
                              >
                                Processing
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={withdrawalStatusMutation.isPending || !["pending", "processing"].includes(request.status)}
                                onClick={() => updateWithdrawalStatus(request.id, "rejected")}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 text-xs"
                                disabled={withdrawalStatusMutation.isPending || !["pending", "processing"].includes(request.status)}
                                onClick={() => updateWithdrawalStatus(request.id, "completed")}
                              >
                                Complete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* ════════════════ Vendors Tab ════════════════ */}
          <TabsContent value="vendors" className="mt-4 space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <SectionCard title="Vendor Performance" icon={Activity}>
                {!vendorOverview?.length ? (
                  <EmptyState icon={Activity} title="No vendor data" desc="Vendor performance metrics will appear here." />
                ) : (
                  <div className="divide-y divide-border/10">
                    {vendorOverview.slice(0, 8).map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between py-2.5 hover:bg-muted/20 transition-colors px-0.5 rounded-md">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{v.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{v.category || "General"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">Score:</span>
                            <span className={cn("text-[10px] font-medium", (v.healthScore || 0) >= 80 ? "text-emerald-500" : (v.healthScore || 0) >= 50 ? "text-amber-400" : "text-red-400")}>
                              {v.healthScore || 0}%
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[9px] px-1.5">{v.fulfillmentCount || 0} order{(v.fulfillmentCount || 0) !== 1 ? 's' : ''}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Global Vendors" icon={Globe}>
                <GlobalVendorList />
              </SectionCard>
            </div>
          </TabsContent>

          {/* ════════════════ System Tab ════════════════ */}
          <TabsContent value="system" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <SectionCard title="Server" icon={Server}>
                <div className="space-y-2">
                  {[
                    { icon: Database, label: "Database Size", value: serverMetrics?.dbSizeMB ? `${serverMetrics.dbSizeMB} MB` : '—' },
                    { icon: Cpu, label: "Memory Usage", value: serverMetrics?.memoryUsageMB ? `${serverMetrics.memoryUsageMB} MB / ${serverMetrics.memoryTotalMB} MB` : '—' },
                    { icon: HardDrive, label: "Platform", value: serverMetrics?.platform || '—' },
                    { icon: Server, label: "Node.js", value: serverMetrics?.nodeVersion || '—' },
                    { icon: Clock, label: "Uptime", value: serverMetrics?.uptime || '—' },
                    { icon: Globe, label: "Environment", value: serverMetrics?.environment || '—' },
                    { icon: Monitor, label: "App URL", value: serverMetrics?.appUrl || '—' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="text-xs font-medium tabular-nums truncate max-w-[180px] text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Service Status" icon={Activity}>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(serviceStatus || {}).map(([key, svc]: any) => (
                    <div key={key} className={cn(
                      "flex items-center gap-2.5 p-3 rounded-xl border transition-colors",
                      svc.status === 'connected' ? "bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-900/30" :
                      svc.status === 'warning' ? "bg-amber-50/50 border-amber-200/50 dark:bg-amber-950/10" :
                      "bg-muted/20 border-border/30"
                    )}>
                      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", svc.status === 'connected' ? "bg-emerald-500" : svc.status === 'warning' ? "bg-amber-500" : "bg-red-400")}>
                        {svc.status === 'connected' && <span className="absolute h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{svc.label || key}</p>
                        <p className={cn("text-[10px]", svc.status === 'connected' ? "text-emerald-600" : "text-muted-foreground")}>
                          {svc.status === 'connected' ? 'Operational' : svc.status === 'warning' ? 'Degraded' : 'Offline'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="API Keys" icon={Key} className="sm:col-span-2">
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {Object.entries(systemStatus?.apiKeys || {}).map(([key, configured]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                      <div className="flex items-center gap-2.5">
                        {configured ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        <span className="text-xs capitalize">{key}</span>
                      </div>
                      <Badge variant={configured ? "default" : "outline"} className="text-[9px] px-2">
                        {configured ? "Configured" : "Missing"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          {/* ════════════════ Support Tab ════════════════ */}
          <TabsContent value="support" className="mt-4">
            <SectionCard title="Support Center" icon={MessageSquare}>
              <EmptyState icon={MessageSquare} title="Support Inbox" desc="Customer support messages will appear here. Visit the full support page for details." />
            </SectionCard>
          </TabsContent>

          {/* ════════════════ Settings Tab ════════════════ */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Site Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label className="text-xs">Site Name</Label><Input className="h-9 text-sm mt-1" defaultValue="DropandSell AI" /></div>
                  <div><Label className="text-xs">Default Currency</Label><Input className="h-9 text-sm mt-1" defaultValue="USD" /></div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div><p className="text-sm font-medium">Maintenance Mode</p><p className="text-xs text-muted-foreground">Disable public access to the platform</p></div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div><p className="text-sm font-medium">Allow New Registrations</p><p className="text-xs text-muted-foreground">Let new users sign up for accounts</p></div>
                  <Switch defaultChecked />
                </div>
                <Button className="h-9 text-xs">Save Changes</Button>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Theme</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  {["light", "dark", "system"].map(t => (
                    <button key={t} onClick={() => setTheme(t as any)} className={cn("px-4 py-2 rounded-lg border text-xs font-medium transition-all", theme === t ? "border-primary bg-primary/5 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Platform Settings Card ──────────────────────────────────────────────────

function PlatformSettingsCard({ platform, label, icon: Icon, color, fields, docUrl }: {
  platform: string; label: string; icon: React.ElementType; color: string;
  fields: { key: string; label: string; secret?: boolean; placeholder?: string }[];
  docUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/admin/app-settings/${platform}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const vals: Record<string, string> = {};
        fields.forEach(f => vals[f.key] = data[f.key] || "");
        setValues(vals);
      }
    } catch (e) { /* settings not configured yet */ }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/app-settings/${platform}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: `${label} settings saved` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-status"] });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const allSet = fields.every(f => values[f.key]);

  return (
    <>
      <Card className={cn("border-border/40 mb-4", color)}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <Icon className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">{label} API Configuration</p>
                <p className="text-xs text-muted-foreground">Manage your {label} API credentials</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
              <Settings className="w-3.5 h-3.5 mr-1.5" /> Configure
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground flex-wrap">
            {fields.map(f => (
              <span key={f.key}>{f.label}: {values[f.key] ? `${values[f.key].slice(0, 15)}...` : "Not set"}</span>
            ))}
          </div>
          {allSet && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-2">
              <CheckCircle className="w-3 h-3" /> All credentials configured
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) fetchSettings(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-4 h-4" /> {label} API Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Enter your {label} API credentials. Get them at{" "}
              <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{docUrl}</a>
            </p>
            {fields.map(f => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                <Input
                  type={f.secret ? "password" : "text"}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={save} disabled={saving || !fields.some(f => values[f.key])}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Global Vendor List ──────────────────────────────────────────────────

function GlobalVendorList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [country, setCountry] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["/api/admin/vendors/global"],
    queryFn: async () => { const r = await fetch("/api/admin/vendors/global", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    refetchInterval: 30000,
  });

  const resetForm = () => {
    setName(""); setWebsite(""); setContactPerson(""); setContactEmail(""); setContactPhone("");
    setCategory(""); setTags(""); setCountry(""); setLeadTime(""); setPaymentTerms(""); setNotes(""); setEditVendor(null);
  };

  const openEdit = (v: any) => {
    setName(v.name || ""); setWebsite(v.website || ""); setContactPerson(v.contactPerson || "");
    setContactEmail(v.contactEmail || ""); setContactPhone(v.contactPhone || "");
    setCategory(v.category || ""); setTags(v.tags || ""); setCountry(v.country || "");
    setLeadTime(v.leadTime || ""); setPaymentTerms(v.paymentTerms || ""); setNotes(v.notes || "");
    setEditVendor(v); setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, website, contactPerson, contactEmail, contactPhone, category, tags, country, leadTime, paymentTerms, notes };
      if (editVendor) {
        const r = await fetch(`/api/admin/vendors/global/${editVendor.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
        if (!r.ok) throw new Error("Failed to update");
        return r.json();
      } else {
        const r = await fetch("/api/admin/vendors/global", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
        if (!r.ok) throw new Error("Failed to create");
        return r.json();
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors/global"] }); toast({ title: editVendor ? "Vendor updated" : "Vendor created" }); setOpen(false); resetForm(); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, verificationStatus }: { id: number; verificationStatus: string }) => {
      const r = await fetch(`/api/admin/vendors/global/${id}/verify`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verificationStatus }), credentials: "include" });
      if (!r.ok) throw new Error("Failed to update status");
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors/global"] }); toast({ title: "Vendor status updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/admin/vendors/global/${id}`, { method: "DELETE", credentials: "include" }); if (!r.ok) throw new Error("Failed to delete"); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors/global"] }); toast({ title: "Vendor deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const statusBadge = (v: any) => {
    if (v.verificationStatus === 'verified') return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800">Verified</Badge>;
    if (v.verificationStatus === 'blocked') return <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800">Blocked</Badge>;
    return <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800">Pending</Badge>;
  };

  return (
    <>
      <div className="divide-y divide-border/10">
        {isLoading ? <LoadingRows rows={3} /> : !vendors?.length ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No global vendors yet.</div>
        ) : (
          vendors.map((v: any) => (
            <div key={v.id} className="flex items-center justify-between py-2.5 hover:bg-muted/20 transition-colors px-0.5 rounded-md">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", v.verificationStatus === 'verified' ? "bg-emerald-50 dark:bg-emerald-950/20" : v.verificationStatus === 'blocked' ? "bg-red-50 dark:bg-red-950/20" : "bg-amber-50 dark:bg-amber-950/20")}>
                  <Globe className={cn("w-4 h-4", v.verificationStatus === 'verified' ? "text-emerald-500" : v.verificationStatus === 'blocked' ? "text-red-500" : "text-amber-500")} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.category || v.contactEmail || v.country || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {statusBadge(v)}
                {v.verificationStatus !== 'verified' && (
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-600" onClick={() => verifyMutation.mutate({ id: v.id, verificationStatus: 'verified' })} disabled={verifyMutation.isPending}>
                    Approve
                  </Button>
                )}
                {v.verificationStatus !== 'blocked' && (
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-600" onClick={() => verifyMutation.mutate({ id: v.id, verificationStatus: 'blocked' })} disabled={verifyMutation.isPending}>
                    Block
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}><Edit3 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this global vendor?")) deleteMutation.mutate(v.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))
        )}
        <div className="pt-3">
          <Button variant="outline" size="sm" className="w-full h-9 text-xs gap-1.5" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Global Vendor
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Store className="w-4 h-4" /> {editVendor ? "Edit Global Vendor" : "Add Global Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vendor Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AliExpress Wholesale" />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Contact Person</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Contact Email</Label><Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. China" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Lead Time</Label><Input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="e.g. 3-5 days" /></div>
              <div className="space-y-1.5"><Label>Payment Terms</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name}>
              {saveMutation.isPending ? "Saving..." : editVendor ? "Update Vendor" : "Create Vendor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

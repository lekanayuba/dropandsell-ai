import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Store, Package, ShoppingCart, CreditCard, Shield, Settings,
  MessageSquare, TrendingUp, TrendingDown, Activity, Clock,
  AlertTriangle, CheckCircle, XCircle, Database, Key, Server, ChevronLeft, ChevronRight,
  UserPlus, Search, HeartPulse, Boxes, BarChart3, MoreHorizontal,
  LayoutDashboard, DollarSign, Download,
  RefreshCw, Globe,
  Link, ExternalLink, Plus,
  FileText, LifeBuoy, Timer, HardDrive, Cpu, Monitor,
  TrendingUp as TrendUp, ArrowUpRight,
  ArrowDownRight, Info, X as CloseIcon, Menu, GripVertical, Mail,
  Receipt, Truck, Eye, EyeOff, Maximize2, Minimize2, ShoppingBag,
  Edit3, Trash2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";

type TabId = "overview" | "users" | "vendors" | "subscribers" | "integrations" | "system" | "support" | "settings";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1"];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500", inactive: "bg-gray-400", pending: "bg-amber-500",
  shipped: "bg-blue-500", processing: "bg-violet-500", cancelled: "bg-red-500",
  completed: "bg-emerald-500", delivered: "bg-emerald-500", connected: "bg-emerald-500",
  offline: "bg-red-500", warning: "bg-amber-500",
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; from: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary", from: "from-primary to-transparent" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600", from: "from-amber-500 to-transparent" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600", from: "from-emerald-500 to-transparent" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600", from: "from-violet-500 to-transparent" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600", from: "from-rose-500 to-transparent" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600", from: "from-cyan-500 to-transparent" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-600", from: "from-indigo-500 to-transparent" },
  green: { bg: "bg-green-500/10", text: "text-green-600", from: "from-green-500 to-transparent" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600", from: "from-orange-500 to-transparent" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600", from: "from-blue-500 to-transparent" },
};

function StatusDot({ status }: { status: string }) {
  return <span className={cn("h-2 w-2 rounded-full inline-block", STATUS_COLORS[status] || "bg-gray-400")} />;
}

function Sparkline({ data, color = "hsl(var(--primary))" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data); const max = Math.max(...data); const range = Math.max(max - min, 1);
  const w = 80; const h = 28; const px = (i: number) => (i / (data.length - 1)) * w;
  const py = (v: number) => h - ((v - min) / range) * (h - 4) - 2;
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(v)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({ label, value, icon: Icon, trend, color = "primary", sparklineData, subtitle }: {
  label: string; value: string | number; icon: any; trend?: { up: boolean; pct: string };
  color?: string; sparklineData?: number[]; subtitle?: string;
}) {
  const cc = COLOR_CLASSES[color] || COLOR_CLASSES.primary;
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-border/40">
      <div className={cn("absolute inset-0 opacity-[0.03] bg-gradient-to-br", cc.from)} />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", cc.bg)}>
            <Icon className={cn("w-4.5 h-4.5", cc.text)} />
          </div>
          {sparklineData && <Sparkline data={sparklineData} color={`hsl(var(--primary))`} />}
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none tracking-tight">{value}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          {trend && (
            <span className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5",
              trend.up ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" : "text-red-600 bg-red-50 dark:bg-red-950/20"
            )}>
              {trend.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {trend.pct}
            </span>
          )}
          {subtitle && <span className="text-[10px] text-muted-foreground ml-auto">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, action, children, className }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn("border-border/40", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 sm:px-5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, action, children, className }: {
  title: string; icon: any; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn("border-border/40 overflow-hidden", className)}>
      <CardHeader className="pb-2 border-b border-border/30 bg-muted/5 pt-3.5 px-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
            <Icon className="w-3.5 h-3.5" />{title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</p>
    </div>
  );
}

function DTable({ headers, rows, empty, onRowClick }: {
  headers: { key: string; label: string; className?: string }[];
  rows: { key: string; cells: (string | React.ReactNode)[] }[];
  empty?: { icon: any; title: string; desc: string };
  onRowClick?: (key: string) => void;
}) {
  if (rows.length === 0 && empty) return <EmptyState {...empty} />;
  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-0">
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border/30">
              {headers.map((h, i) => (
                <th key={h.key} className={cn("pb-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-left", h.className)}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {rows.map((row) => (
              <tr key={row.key} className={cn("transition-colors hover:bg-muted/20", onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(row.key)}>
                {row.cells.map((cell, i) => (
                  <td key={i} className={cn("py-2.5 text-sm", headers[i]?.className)}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingRows({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-2.5">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 bg-muted/30 rounded-lg animate-pulse" />)}</div>;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();  
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [globalVendorOpen, setGlobalVendorOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [vendorCurrentPage, setVendorCurrentPage] = useState(1);
  const vendorRowsPerPage = 5;
  const { toast } = useToast();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useQuery({
    queryKey: ["/api/admin/check"],
    queryFn: async () => { const r = await fetch("/api/admin/stats", { credentials: "include" }); if (r.status === 401) { setAuthed(false); localStorage.removeItem("adminAuthed"); } return r.json(); },
    enabled: true,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/detailed-stats"],
    queryFn: async () => { const r = await fetch("/api/admin/detailed-stats", { credentials: "include" }); if (!r.ok) throw new Error("Unauthorized"); return r.json(); },
    enabled: true, refetchInterval: 30000,
  });

  const { data: revenueHist } = useQuery({
    queryKey: ["/api/admin/revenue-history"],
    queryFn: async () => { const r = await fetch("/api/admin/revenue-history", { credentials: "include" }); if (!r.ok) return {}; return r.json(); },
    enabled: true, refetchInterval: 60000,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => { const r = await fetch("/api/admin/users", { credentials: "include" }); if (!r.ok) throw new Error("Unauthorized"); return r.json(); },
    enabled: true, refetchInterval: 30000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["/api/admin/recent-orders"],
    queryFn: async () => { const r = await fetch("/api/admin/recent-orders", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: true, refetchInterval: 30000,
  });

  const { data: vendorOverview } = useQuery({
    queryKey: ["/api/admin/vendor-overview"],
    queryFn: async () => { const r = await fetch("/api/admin/vendor-overview", { credentials: "include" }); if (!r.ok) return { vendors: [], totalVendors: 0, avgHealthScore: 0 }; return r.json(); },
    enabled: true, refetchInterval: 60000,
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["/api/admin/system-status"],
    queryFn: async () => { const r = await fetch("/api/admin/system-status", { credentials: "include" }); if (!r.ok) return {}; return r.json(); },
    enabled: true, refetchInterval: 120000,
  });

  const { data: serverMetrics } = useQuery({
    queryKey: ["/api/admin/server-metrics"],
    queryFn: async () => { const r = await fetch("/api/admin/server-metrics", { credentials: "include" }); if (!r.ok) return {}; return r.json(); },
    enabled: true, refetchInterval: 120000,
  });

  const { data: serviceStatus } = useQuery({
    queryKey: ["/api/admin/service-status"],
    queryFn: async () => { const r = await fetch("/api/admin/service-status", { credentials: "include" }); if (!r.ok) return {}; return r.json(); },
    enabled: true, refetchInterval: 60000,
  });

  const { data: activity } = useQuery({
    queryKey: ["/api/admin/activity"],
    queryFn: async () => { const r = await fetch("/api/admin/activity", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: true, refetchInterval: 30000,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const r = await fetch(`/api/admin/users/${id}/role`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }), credentials: "include" });
      if (!r.ok) throw new Error("Failed"); return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter((u: any) => u.email?.toLowerCase().includes(q) || u.firstName?.toLowerCase().includes(q) || u.lastName?.toLowerCase().includes(q));
  }, [users, userSearch]);

  const paginatedVendors = useMemo(() => {
    if (!vendorOverview?.vendors) return [];
    return vendorOverview.vendors.slice(
      (vendorCurrentPage - 1) * vendorRowsPerPage,
      vendorCurrentPage * vendorRowsPerPage
    );
  }, [vendorOverview, vendorCurrentPage]);
  const totalVendorPages = Math.ceil((vendorOverview?.vendors?.length || 0) / vendorRowsPerPage);

  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);

  const exportUsers = async () => {
    const r = await fetch("/api/admin/export/users", { credentials: "include" });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const dailyRevData = useMemo(() => ((revenueHist as any)?.dailyRevenue || []).map((r: any) => ({ name: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: Number(r.total) })), [revenueHist]) as { name: string; value: number }[];
  const getWeekNumber = (d: Date) => { const start = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7); };
  const weeklyRevData = useMemo(() => ((revenueHist as any)?.weeklyRevenue || []).map((r: any) => ({ name: `W${getWeekNumber(new Date(r.week))}`, value: Number(r.total) })), [revenueHist]);
  const monthlyRevData = useMemo(() => ((revenueHist as any)?.monthlyRevenue || []).map((r: any) => ({ name: new Date(r.month).toLocaleDateString(undefined, { month: 'short' }), value: Number(r.total) })), [revenueHist]);
  const userGrowthData = useMemo(() => ((revenueHist as any)?.userGrowth || []).map((r: any) => ({ name: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: Number(r.count) })), [revenueHist]) as { name: string; value: number }[];
  const marketplaceData = useMemo(() => ((revenueHist as any)?.marketplaceSales || []).map((r: any) => ({ name: r.platform || 'Direct', value: Number(r.revenue) })), [revenueHist]);
  const dailyOrdersData = useMemo(() => ((revenueHist as any)?.dailyOrders || []).map((r: any) => ({ name: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: Number(r.count) })), [revenueHist]) as { name: string; value: number }[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Admin Dashboard</h1>
      </div>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          {/* ===== OVERVIEW ===== */}
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <KpiCard label="Total Users" value={stats?.users ?? 0} icon={Users} trend={{ up: true, pct: `${stats?.weeklyGrowth || 0}%` }} color="primary" sparklineData={userGrowthData.slice(-7).map(d => d.value)} />
                <KpiCard label="Total Orders" value={stats?.orders ?? 0} icon={ShoppingCart} subtitle={stats?.pendingOrders > 0 ? `${stats.pendingOrders} pending` : ''} color="amber" sparklineData={dailyOrdersData.slice(-7).map(d => d.value)} />
                <KpiCard label="Total Revenue" value={stats?.totalRevenue ? `$${Number(stats.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '$0'} icon={DollarSign} color="emerald" sparklineData={dailyRevData.slice(-7).map(d => d.value)} />
                <KpiCard label="Products" value={stats?.products ?? 0} icon={Package} color="violet" />
                <KpiCard label="Subscribers" value={stats?.subscribers ?? 0} icon={CreditCard} color="rose" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <KpiCard label="Stores" value={stats?.stores ?? 0} icon={Store} color="cyan" />
                <KpiCard label="Vendors" value={stats?.vendors ?? 0} icon={Boxes} subtitle={`${stats?.activeVendors || 0} active`} color="indigo" />
                <KpiCard label="Today's Sales" value={stats?.todaySales ? `$${Number(stats.todaySales).toFixed(2)}` : '$0'} icon={TrendUp} color="green" />
                <KpiCard label="Pending Orders" value={stats?.pendingOrders ?? 0} icon={Timer} color="orange" />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <SectionCard title="Recent Activity" icon={Activity} action={<Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/activity"] })}><RefreshCw className="w-3 h-3 mr-1" />Refresh</Button>}>
                  {!activity ? <LoadingRows rows={5} /> : activity.length === 0 ? <EmptyState icon={Activity} title="No activity" desc="New orders and registrations will appear here" /> : (
                    <div className="space-y-0.5">
                      {activity.slice(0, 8).map((a: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-border/10 last:border-0">
                          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", a.type === 'order' ? "bg-amber-50 dark:bg-amber-950/20" : "bg-blue-50 dark:bg-blue-950/20")}>
                            {a.type === 'order' ? <ShoppingCart className="w-3.5 h-3.5 text-amber-600" /> : <UserPlus className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{a.label}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{a.detail}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
                            {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Vendor Health" icon={HeartPulse} action={vendorOverview?.totalVendors > 0 && <Badge variant="outline" className="text-[10px] gap-1">{Number(vendorOverview.avgHealthScore).toFixed(1)} avg</Badge>}>
                  {!vendorOverview ? <LoadingRows rows={4} /> : vendorOverview.vendors.length === 0 ? <EmptyState icon={HeartPulse} title="No vendors yet" desc="Add vendors to see health scores" /> : (
                    <div className="space-y-1">
                      {vendorOverview.vendors.slice(0, 6).map((v: any) => {
                        const score = v.healthScore || 0;
                        return (
                          <div key={v.id} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", score >= 4 ? "bg-emerald-50 dark:bg-emerald-950/20" : score >= 3 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                                <Store className={cn("w-4 h-4", score >= 4 ? "text-emerald-600" : score >= 3 ? "text-amber-600" : "text-red-600")} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{v.name}</p>
                                {v.category && <p className="text-[10px] text-muted-foreground capitalize">{v.category}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {score > 0 && <span className="text-[11px] tabular-nums text-amber-500">{'★'.repeat(score)}{'☆'.repeat(5 - score)}</span>}
                              <Badge variant="outline" className={cn("text-[9px] px-1.5", v.status === 'active' ? "text-emerald-600 border-emerald-200" : "text-muted-foreground")}>{v.status}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* Quick actions */}
              <Card className="border-dashed border-border/40">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Support Queue", icon: MessageSquare, path: "/admin/support", color: "text-violet-500" },
                      { label: "Manage Stores", icon: Store, path: "/stores", color: "text-emerald-500" },
                      { label: "Manage Vendors", icon: Boxes, path: "/vendors", color: "text-cyan-500" },
                      { label: "View Orders", icon: ShoppingCart, path: "/orders", color: "text-amber-500" },
                      { label: "Site Settings", icon: Settings, path: "/admin/settings", color: "text-gray-500" },
                    ].map(a => (
                      <Button key={a.label} variant="outline" size="sm" className="h-8 text-xs gap-1.5 hover:border-primary/30" onClick={() => setLocation(a.path)}>
                        <a.icon className={cn("w-3.5 h-3.5", a.color)} />{a.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
          </div>
        </TabsContent>
        <TabsContent value="users" className="mt-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Search users..." className="pl-8 h-9 text-xs" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                </div>
                <Badge variant="secondary" className="text-[11px] h-7 px-2.5">{users?.length ?? 0} total</Badge>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={exportUsers}>
                  <Download className="w-3.5 h-3.5" />Export CSV
                </Button>
              </div>
              <Card className="border-border/40">
                <CardContent className="p-0">
                  {!users ? <LoadingRows rows={6} /> : paginatedUsers.length === 0 ? (
                    <EmptyState icon={Users} title={userSearch ? "No matches" : "No users"} desc={userSearch ? "Try a different search" : "Register a user to get started"} />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead className="hidden sm:table-cell">Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="hidden md:table-cell">Status</TableHead>
                          <TableHead className="hidden md:table-cell">Plan</TableHead>
                          <TableHead className="hidden lg:table-cell">Joined</TableHead>
                          <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((u: any) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary ring-1 ring-primary/20">
                                  {(u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()}
                                </div>
                                <span>{u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}` : u.email?.split('@')[0]}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{u.email}</TableCell>
                            <TableCell><Badge variant="outline" className={cn(u.role === 'admin' ? "text-primary border-primary/30 bg-primary/5" : "")}>{u.role}</Badge></TableCell>
                            <TableCell className="hidden md:table-cell"><div className="flex items-center gap-2"><StatusDot status={u.subscriptionStatus || 'inactive'} /><span className="capitalize">{u.subscriptionStatus || 'inactive'}</span></div></TableCell>
                            <TableCell className="hidden md:table-cell">{u.subscriptionPlan || 'free'}</TableCell>
                            <TableCell className="hidden lg:table-cell">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}>{u.role === "admin" ? "Demote to User" : "Promote to Admin"}</DropdownMenuItem>
                                  <DropdownMenuItem>View details</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive">Delete user</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between border-t px-6 py-3">
                  <div className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              )}
            </div>          
        </TabsContent>
        <TabsContent value="vendors" className="mt-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                <KpiCard label="Total Vendors" value={stats?.vendors ?? 0} icon={Boxes} color="indigo" />
                <KpiCard label="Active" value={stats?.activeVendors ?? 0} icon={CheckCircle} color="emerald" />
                <KpiCard label="Avg Health" value={vendorOverview?.avgHealthScore ? Number(vendorOverview.avgHealthScore).toFixed(1) : '—'} icon={HeartPulse} color="rose" />
                <KpiCard label="Products" value={stats?.products ?? 0} icon={Package} color="violet" />
              </div>
              <Card className="border-border/40">
                <CardContent className="p-0">
                  {!vendorOverview ? <LoadingRows rows={4} /> : vendorOverview.vendors.length === 0 ? (
                    <EmptyState icon={Boxes} title="No vendors" desc="Add vendors from the Vendors page" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Health</TableHead>
                          <TableHead>Orders Fulfilled</TableHead>
                          <TableHead>Last Check</TableHead>
                          <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedVendors.map((v: any) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">{v.name}</TableCell>
                            <TableCell><Badge variant={v.status === 'active' ? 'default' : 'secondary'}>{v.status}</Badge></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-amber-500">{'★'.repeat(v.healthScore || 0)}</span>
                                <span className="text-muted-foreground/30">{'☆'.repeat(5 - (v.healthScore || 0))}</span>
                              </div>
                            </TableCell>
                            <TableCell>{v.totalOrdersFulfilled || 0}</TableCell>
                            <TableCell>{v.lastHealthCheck ? new Date(v.lastHealthCheck).toLocaleDateString() : '—'}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>View Details</DropdownMenuItem>
                                  <DropdownMenuItem>Edit Vendor</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              {totalVendorPages > 1 && (
                <CardFooter className="flex items-center justify-between border-t px-6 py-3">
                  <div className="text-xs text-muted-foreground">
                    Page {vendorCurrentPage} of {totalVendorPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setVendorCurrentPage(p => Math.max(1, p - 1))} disabled={vendorCurrentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setVendorCurrentPage(p => Math.min(totalVendorPages, p + 1))} disabled={vendorCurrentPage === totalVendorPages}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              )}

              {/* Global Vendors Management */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" />
                      Global Vendors
                    </h4>
                    <p className="text-xs text-muted-foreground">Vendors available to all clients</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setGlobalVendorOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Global Vendor
                  </Button>
                </div>
                <GlobalVendorList />
              </div>
            </div>          
        </TabsContent>
        <TabsContent value="subscribers" className="mt-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                <KpiCard label="Subscribers" value={stats?.subscribers ?? 0} icon={CreditCard} color="rose" />
                <KpiCard label="Total Users" value={stats?.users ?? 0} icon={Users} color="blue" />
                <KpiCard label="Conversion Rate" value={stats?.users > 0 ? `${Math.round((stats?.subscribers || 0) / stats.users * 100)}%` : '0%'} icon={TrendUp} color="emerald" />
              </div>
              <Card className="border-border/40">
                <CardContent className="p-0">
                  {!users ? <LoadingRows rows={5} /> : (
                    <DTable
                      headers={[
                        { key: "user", label: "User" },
                        { key: "email", label: "Email", className: "hidden sm:table-cell" },
                        { key: "plan", label: "Plan" },
                        { key: "status", label: "Status" },
                        { key: "joined", label: "Joined", className: "hidden md:table-cell" },
                      ]}
                      rows={users.filter((u: any) => u.subscriptionStatus === 'active').map((u: any) => ({
                        key: u.id,
                        cells: [
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-200 to-rose-50 dark:from-rose-800 dark:to-rose-950 flex items-center justify-center text-[10px] font-bold text-rose-700 dark:text-rose-300">{(u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()}</div>
                            <span className="text-xs font-medium">{u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email?.split('@')[0]}</span>
                          </div>,
                          <span className="text-xs text-muted-foreground hidden sm:inline">{u.email}</span>,
                          <span className="text-xs font-medium">{u.subscriptionPlan || '—'}</span>,
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px]">{u.subscriptionStatus}</Badge>,
                          <span className="text-xs text-muted-foreground hidden md:inline tabular-nums">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</span>,
                        ]
                      }))}
                      empty={{ icon: CreditCard, title: "No subscribers", desc: "Users who have subscribed will appear here" }}
                    />
                  )}
                </CardContent>
              </Card>
            </div>          
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">Configure and monitor third-party API connections. These credentials are used by all client stores — end users never need to enter API keys manually.</p>
              </div>

              {/* Platform API Settings Cards */}
              <PlatformSettingsCard
                platform="ebay"
                label="eBay"
                icon={Globe}
                color="border-blue-200/50 dark:border-blue-900/30"
                fields={[
                  { key: "clientId", label: "Client ID (App ID)", placeholder: "Olalekan-DropandS-PRD-..." },
                  { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "PRD-..." },
                  { key: "ruName", label: "RuName (Redirect URL)", placeholder: "Olalekan_Ayuba-..." },
                ]}
                docUrl="https://developer.ebay.com"
              />

              <PlatformSettingsCard
                platform="shopify"
                label="Shopify"
                icon={ShoppingBag}
                color="border-green-200/50 dark:border-green-900/30"
                fields={[
                  { key: "clientId", label: "Client ID", placeholder: "Your Shopify App Client ID" },
                  { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "Your Shopify App Client Secret" },
                  { key: "redirectUri", label: "Redirect URI", placeholder: "https://yourapp.com/api/oauth/shopify/callback" },
                ]}
                docUrl="https://shopify.dev/docs/apps/auth/oauth"
              />

              <PlatformSettingsCard
                platform="amazon"
                label="Amazon SP-API"
                icon={Store}
                color="border-orange-200/50 dark:border-orange-900/30"
                fields={[
                  { key: "clientId", label: "Client ID", placeholder: "amzn1.application-oa2-..." },
                  { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "Your Amazon SP-API Client Secret" },
                  { key: "redirectUri", label: "Redirect URI", placeholder: "https://yourapp.com/api/oauth/amazon/callback" },
                  { key: "refreshToken", label: "Refresh Token", secret: true, placeholder: "Your Amazon SP-API Refresh Token" },
                ]}
                docUrl="https://developer.amazon.com/docs/amazon-sp-api.html"
              />

              <PlatformSettingsCard
                platform="woocommerce"
                label="WooCommerce"
                icon={ShoppingCart}
                color="border-purple-200/50 dark:border-purple-900/30"
                fields={[
                  { key: "consumerKey", label: "Consumer Key", placeholder: "ck_..." },
                  { key: "consumerSecret", label: "Consumer Secret", secret: true, placeholder: "cs_..." },
                ]}
                docUrl="https://woocommerce.com/document/rest-api/"
              />

              <PlatformSettingsCard
                platform="jumia"
                label="Jumia"
                icon={Globe}
                color="border-orange-200/50 dark:border-orange-900/30"
                fields={[
                  { key: "apiKey", label: "API Key", placeholder: "Your Jumia API Key" },
                  { key: "apiSecret", label: "API Secret", secret: true, placeholder: "Your Jumia API Secret" },
                  { key: "sellerId", label: "Seller ID", placeholder: "Your Jumia Seller ID" },
                ]}
                docUrl="https://developers.jumia.com"
              />

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {[
                  { key: "stripe", name: "Stripe", desc: "Payment processing & subscriptions", icon: CreditCard, doc: "https://stripe.com/docs" },
                  { key: "openai", name: "OpenAI", desc: "AI descriptions & support chat", icon: MessageSquare, doc: "https://openai.com" },
                  { key: "resend", name: "Resend", desc: "Transactional emails", icon: Mail, doc: "https://resend.com" },
                  { key: "amazon", name: "Amazon", desc: "Marketplace listings & orders", icon: Store, doc: "https://developer.amazon.com" },
                  { key: "ebay", name: "eBay", desc: "eBay listings & fulfillment", icon: Globe, doc: "https://developer.ebay.com" },
                  { key: "shopify", name: "Shopify", desc: "Shopify store integration", icon: ShoppingCart, doc: "https://shopify.dev" },
                  { key: "tracking", name: "Tracking API", desc: "Shipment tracking updates", icon: Truck, doc: "#" },
                ].map(svc => {
                  const status = (serviceStatus as any)?.[svc.key]?.status || 'offline';
                  return (
                    <Card key={svc.key} className={cn("border-border/40 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5", status === 'connected' && "border-emerald-200/50 dark:border-emerald-900/30")}>
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", status === 'connected' ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-muted")}>
                              <svc.icon className={cn("w-5 h-5", status === 'connected' ? "text-emerald-600" : "text-muted-foreground")} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{svc.name}</p>
                              <p className="text-xs text-muted-foreground">{svc.desc}</p>
                            </div>
                          </div>
                          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 mt-1", status === 'connected' ? "bg-emerald-500" : status === 'warning' ? "bg-amber-500" : "bg-red-500")} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant={status === 'connected' ? "default" : "outline"} className={cn("text-[10px]", status === 'connected' ? "" : "text-muted-foreground")}>
                            {status === 'connected' ? 'Connected' : status === 'warning' ? 'Warning' : 'Not connected'}
                          </Badge>
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-muted-foreground">
                            <ExternalLink className="w-3 h-3" /> Docs
                          </Button>
                        </div>
                        {status === 'connected' && (
                          <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500" /> API operational
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>          
        </TabsContent>
        <TabsContent value="system" className="mt-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                        <Badge variant={configured ? "default" : "outline"} className={cn("text-[9px] px-2", configured ? "" : "text-muted-foreground")}>
                          {configured ? "Configured" : "Missing"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>          
        </TabsContent>
        <TabsContent value="support" className="mt-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="default" size="sm" className="h-9 text-xs gap-1.5"><MessageSquare className="w-3.5 h-3.5" />All Conversations</Button>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Flagged</Button>
                <Badge variant="secondary" className="text-[11px] h-7 px-2.5 ml-auto">3 open</Badge>
              </div>
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <EmptyState icon={MessageSquare} title="Support Inbox" desc="Customer support messages will appear here. Configure email integration to receive tickets." />
                </CardContent>
              </Card>
            </div>          
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Site Settings</CardTitle></CardHeader>
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

              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Theme</CardTitle></CardHeader>
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
            </div>          
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
    } catch (e) {
      // settings not configured yet
    }
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
      <Card className="border-border/40">
        <CardContent className="p-0">
          {isLoading ? <LoadingRows rows={3} /> : !vendors?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No global vendors yet. Click "Add Global Vendor" to create one.</div>
          ) : (
            <div className="divide-y divide-border/10">
              {vendors.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Phone</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. China" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Lead Time</Label>
                <Input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="e.g. 3-5 days" />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name}>
              {saveMutation.isPending ? "Saving..." : editVendor ? "Update Vendor" : "Create Vendor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
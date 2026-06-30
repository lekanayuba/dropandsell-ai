import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Users, Store, Package, ShoppingCart, CreditCard, Shield, Settings,
  MessageSquare, LogOut, TrendingUp, TrendingDown, Activity, Clock,
  AlertTriangle, CheckCircle, XCircle, Database, Key, Server,
  UserPlus, Search, ChevronRight, HeartPulse, Boxes, BarChart3,
  LayoutDashboard, Sun, Moon, SlidersHorizontal, RefreshCw,
  ChevronDown, ChevronUp, PanelLeft, PanelLeftClose,
  UserCheck, UserX, Mail, Phone, Calendar, DollarSign, Award,
} from "lucide-react";

type TabId = "overview" | "users" | "orders" | "vendors" | "system";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "vendors", label: "Vendors", icon: Boxes },
  { id: "system", label: "System", icon: Server },
];

function StatCard({ label, value, icon: Icon, sub, color, trend }: {
  label: string; value: number | string; icon: any; sub?: string;
  color: string; trend?: { up: boolean; pct: string };
}) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            `bg-${color.split("-")[0]}-50 dark:bg-${color.split("-")[0]}-950/20`
          )}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
              {trend && (
                <span className={cn(
                  "flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5",
                  trend.up ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20" : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/20"
                )}>
                  {trend.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {trend.pct}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800",
    inactive: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400",
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400",
    shipped: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400",
    processing: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400",
    cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400",
    admin: "bg-primary/10 text-primary border-primary/20",
    user: "bg-muted text-muted-foreground",
    free: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5", colors[status] || "bg-muted text-muted-foreground")}>
      {status}
    </Badge>
  );
}

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-muted/40 rounded-lg animate-pulse" />
      ))}
    </div>
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

function SectionCard({ title, icon: Icon, action, children, className }: {
  title: string; icon: any; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function DataTable({ headers, rows, empty }: {
  headers: { key: string; label: string; className?: string }[];
  rows: { key: string; cells: (string | React.ReactNode)[] }[];
  empty?: { icon: any; title: string; desc: string };
}) {
  if (rows.length === 0 && empty) {
    return <EmptyState {...empty} />;
  }
  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-0">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-border/40">
            <thead>
              <tr className="border-b border-border/40">
                {headers.map((h, i) => (
                  <th key={h.key} className={cn(
                    "pb-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                    i === 0 ? "text-left" : "text-left",
                    h.className
                  )}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-muted/20 transition-colors">
                  {row.cells.map((cell, i) => (
                    <td key={i} className={cn(
                      "py-2.5 text-sm",
                      headers[i]?.className
                    )}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState(!!localStorage.getItem("adminAuthed"));
  const [creds, setCreds] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useQuery({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const r = await fetch("/api/admin/stats", { credentials: "include" });
      if (r.status === 401) { setAuthed(false); localStorage.removeItem("adminAuthed"); }
      return r.json();
    },
    enabled: authed,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => { const r = await fetch("/api/admin/stats", { credentials: "include" }); if (!r.ok) throw new Error("Unauthorized"); return r.json(); },
    enabled: authed, refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => { const r = await fetch("/api/admin/users", { credentials: "include" }); if (!r.ok) throw new Error("Unauthorized"); return r.json(); },
    enabled: authed, refetchInterval: 30000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["/api/admin/recent-orders"],
    queryFn: async () => { const r = await fetch("/api/admin/recent-orders", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: authed, refetchInterval: 30000,
  });

  const { data: recentRegs } = useQuery({
    queryKey: ["/api/admin/recent-registrations"],
    queryFn: async () => { const r = await fetch("/api/admin/recent-registrations", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: authed, refetchInterval: 30000,
  });

  const { data: vendorOverview } = useQuery({
    queryKey: ["/api/admin/vendor-overview"],
    queryFn: async () => { const r = await fetch("/api/admin/vendor-overview", { credentials: "include" }); if (!r.ok) return { vendors: [], totalVendors: 0, avgHealthScore: 0 }; return r.json(); },
    enabled: authed, refetchInterval: 60000,
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["/api/admin/system-status"],
    queryFn: async () => { const r = await fetch("/api/admin/system-status", { credentials: "include" }); if (!r.ok) return {}; return r.json(); },
    enabled: authed, refetchInterval: 120000,
  });

  const { data: activity } = useQuery({
    queryKey: ["/api/admin/activity"],
    queryFn: async () => { const r = await fetch("/api/admin/activity", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: authed, refetchInterval: 30000,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const r = await fetch(`/api/admin/users/${id}/role`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }), credentials: "include" });
      if (!r.ok) throw new Error("Failed"); return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const handleLogin = async () => {
    setLoginError("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creds), credentials: "include" });
    if (!r.ok) { setLoginError("Invalid credentials"); return; }
    localStorage.setItem("adminAuthed", "true");
    setAuthed(true);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    localStorage.removeItem("adminAuthed");
    setAuthed(false);
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter((u: any) =>
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
        <Card className="w-full max-w-sm shadow-2xl border-border/40">
          <CardHeader className="text-center pb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Admin Panel</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">DropandSell AI Administration</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Username</Label>
              <Input value={creds.username} onChange={e => setCreds(p => ({ ...p, username: e.target.value }))} placeholder="Enter username" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" value={creds.password} onChange={e => setCreds(p => ({ ...p, password: e.target.value }))} placeholder="Enter password" className="h-9" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            {loginError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {loginError}
              </div>
            )}
            <Button className="w-full h-9" onClick={handleLogin}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold truncate">Admin</span>
          </div>

          {/* Desktop Nav Tabs */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-4">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setLocation("/admin/support")}>
              <MessageSquare className="w-3.5 h-3.5 lg:mr-1.5" />
              <span className="hidden lg:inline">Support</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setLocation("/admin/settings")}>
              <Settings className="w-3.5 h-3.5 lg:mr-1.5" />
              <span className="hidden lg:inline">Settings</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5 lg:mr-1.5" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="flex lg:hidden overflow-x-auto gap-1 px-4 pb-2 -mt-1 scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors shrink-0",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mb-6">
          <StatCard label="Users" value={stats?.users ?? 0} icon={Users} color="text-blue-600" />
          <StatCard label="Stores" value={stats?.stores ?? 0} icon={Store} color="text-emerald-600" />
          <StatCard label="Products" value={stats?.products ?? 0} icon={Package} color="text-violet-600" />
          <StatCard label="Orders" value={stats?.orders ?? 0} icon={ShoppingCart} color="text-amber-600" />
          <StatCard label="Subscribers" value={stats?.subscribers ?? 0} icon={CreditCard} color="text-rose-600" />
          <StatCard label="Vendors" value={vendorOverview?.totalVendors ?? 0} icon={Boxes} color="text-cyan-600" />
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Activity Feed */}
              <SectionCard title="Recent Activity" icon={Activity} action={
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] }); }}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              }>
                {!activity ? (
                  <LoadingSkeleton rows={5} />
                ) : activity.length === 0 ? (
                  <EmptyState icon={Activity} title="No activity yet" desc="Activity from orders and registrations will appear here" />
                ) : (
                  <div className="space-y-0.5">
                    {activity.slice(0, 8).map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                        <div className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                          a.type === 'order' ? "bg-amber-50 dark:bg-amber-950/20" : "bg-blue-50 dark:bg-blue-950/20"
                        )}>
                          {a.type === 'order'
                            ? <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                            : <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{a.label}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{a.detail}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                          {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Vendor Health */}
              <SectionCard title="Vendor Health" icon={HeartPulse} action={
                vendorOverview?.totalVendors > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Award className="w-2.5 h-2.5 text-amber-500" />
                    {Number(vendorOverview.avgHealthScore).toFixed(1)} avg
                  </Badge>
                )
              }>
                {!vendorOverview ? (
                  <LoadingSkeleton rows={4} />
                ) : vendorOverview.vendors.length === 0 ? (
                  <EmptyState icon={HeartPulse} title="No vendors yet" desc="Add vendors to see their health scores here" />
                ) : (
                  <div className="space-y-1">
                    {vendorOverview.vendors.slice(0, 6).map((v: any) => {
                      const score = v.healthScore || 0;
                      return (
                        <div key={v.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                              score >= 4 ? "bg-emerald-50 dark:bg-emerald-950/20" :
                              score >= 3 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-red-50 dark:bg-red-950/20"
                            )}>
                              <Store className={cn(
                                "w-4 h-4",
                                score >= 4 ? "text-emerald-600" :
                                score >= 3 ? "text-amber-600" : "text-red-600"
                              )} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{v.name}</p>
                              {v.category && (
                                <p className="text-[10px] text-muted-foreground capitalize">{v.category}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {score > 0 && (
                              <span className="text-[11px] tabular-nums">{'★'.repeat(score)}{'☆'.repeat(5 - score)}</span>
                            )}
                            <StatusBadge status={v.status} />
                          </div>
                        </div>
                      );
                    })}
                    {vendorOverview.vendors.length > 6 && (
                      <button onClick={() => setLocation("/vendors")} className="flex items-center gap-1 text-xs text-primary hover:underline pt-1.5">
                        View all {vendorOverview.totalVendors} vendors <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Quick Actions */}
            <Card className="border-dashed border-border/60">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Support Queue", icon: MessageSquare, path: "/admin/support", color: "text-violet-600" },
                    { label: "Site Settings", icon: Settings, path: "/admin/settings", color: "text-gray-600" },
                    { label: "Manage Stores", icon: Store, path: "/stores", color: "text-emerald-600" },
                    { label: "Manage Vendors", icon: Boxes, path: "/vendors", color: "text-cyan-600" },
                    { label: "View Orders", icon: ShoppingCart, path: "/orders", color: "text-amber-600" },
                  ].map(action => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 hover:border-primary/30"
                      onClick={() => setLocation(action.path)}
                    >
                      <action.icon className={cn("w-3.5 h-3.5", action.color)} />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === "users" && (
          <SectionCard title="User Management" icon={Users} action={
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-7 h-7 text-xs w-48"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
              <Badge variant="secondary" className="text-[10px]">{users?.length ?? 0} total</Badge>
            </div>
          }>
            {/* Mobile search */}
            <div className="sm:hidden relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-7 h-8 text-xs" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            {!users ? <LoadingSkeleton rows={5} /> : (
              <DataTable
                headers={[
                  { key: "email", label: "Email" },
                  { key: "name", label: "Name", className: "hidden sm:table-cell" },
                  { key: "role", label: "Role" },
                  { key: "plan", label: "Plan", className: "hidden md:table-cell" },
                  { key: "status", label: "Status", className: "hidden md:table-cell" },
                  { key: "joined", label: "Joined", className: "hidden lg:table-cell" },
                  { key: "actions", label: "", className: "text-right" },
                ]}
                rows={filteredUsers.map((u: any) => ({
                  key: u.id,
                  cells: [
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate max-w-[160px] sm:max-w-none">{u.email}</p>
                      <p className="text-[10px] text-muted-foreground sm:hidden">{u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}` : "—"}</p>
                    </div>,
                    <span className="text-xs hidden sm:inline">{u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}` : "—"}</span>,
                    <StatusBadge status={u.role} />,
                    <Badge variant="outline" className="text-[10px] hidden md:inline-flex">{u.subscriptionPlan ?? "free"}</Badge>,
                    <span className="hidden md:inline"><StatusBadge status={u.subscriptionStatus || "inactive"} /></span>,
                    <span className="text-xs text-muted-foreground hidden lg:inline tabular-nums">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</span>,
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] px-2"
                        onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </Button>
                    </div>,
                  ]
                }))}
                empty={{ icon: Users, title: userSearch ? "No users match search" : "No users found", desc: userSearch ? "Try a different search term" : "Users will appear here when they register" }}
              />
            )}
          </SectionCard>
        )}

        {/* ===== ORDERS TAB ===== */}
        {activeTab === "orders" && (
          <SectionCard title="Recent Orders" icon={ShoppingCart} action={
            recentOrders?.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{recentOrders.length} latest</Badge>
            )
          }>
            {!recentOrders ? <LoadingSkeleton rows={4} /> : (
              <DataTable
                headers={[
                  { key: "customer", label: "Customer" },
                  { key: "amount", label: "Amount" },
                  { key: "status", label: "Status" },
                  { key: "tracking", label: "Tracking", className: "hidden sm:table-cell" },
                  { key: "date", label: "Date", className: "hidden md:table-cell" },
                ]}
                rows={recentOrders.map((o: any) => ({
                  key: o.id,
                  cells: [
                    <span className="text-xs font-medium">{o.customerName || "—"}</span>,
                    <span className="text-xs font-medium tabular-nums">{o.totalAmount ? `£${Number(o.totalAmount).toFixed(2)}` : "—"}</span>,
                    <StatusBadge status={o.status} />,
                    <span className="hidden sm:inline"><StatusBadge status={o.trackingStatus || "pending"} /></span>,
                    <span className="text-xs text-muted-foreground hidden md:inline tabular-nums">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</span>,
                  ]
                }))}
                empty={{ icon: ShoppingCart, title: "No orders yet", desc: "Orders will appear here when customers start purchasing" }}
              />
            )}
          </SectionCard>
        )}

        {/* ===== VENDORS TAB ===== */}
        {activeTab === "vendors" && (
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            <SectionCard title="All Vendors" icon={Boxes} action={
              <Badge variant="secondary" className="text-[10px]">{vendorOverview?.totalVendors ?? 0}</Badge>
            }>
              {!vendorOverview ? <LoadingSkeleton rows={4} /> : vendorOverview.vendors.length === 0 ? (
                <EmptyState icon={Boxes} title="No vendors created" desc="Vendors appear here when you add them from the Vendors page" />
              ) : (
                <div className="space-y-1">
                  {vendorOverview.vendors.map((v: any) => {
                    const score = v.healthScore || 0;
                    return (
                      <div key={v.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                            score >= 4 ? "bg-emerald-50 dark:bg-emerald-950/20" :
                            score >= 3 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted"
                          )}>
                            <Store className={cn(
                              "w-4 h-4",
                              score >= 4 ? "text-emerald-600" :
                              score >= 3 ? "text-amber-600" : "text-muted-foreground"
                            )} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{v.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {v.totalOrdersFulfilled || 0} fulfilled
                              {v.stockUpdateReliability ? ` · ${v.stockUpdateReliability}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {score > 0 && (
                            <span className="text-[11px] tabular-nums">{'★'.repeat(score)}{'☆'.repeat(5 - score)}</span>
                          )}
                          <StatusBadge status={v.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Recent Registrations */}
            <SectionCard title="Recent Registrations" icon={UserPlus}>
              {!recentRegs ? <LoadingSkeleton rows={4} /> : recentRegs.length === 0 ? (
                <EmptyState icon={UserPlus} title="No recent registrations" desc="New user signups will appear here" />
              ) : (
                <div className="space-y-1">
                  {recentRegs.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center shrink-0">
                          <UserPlus className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{u.email}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}` : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px]">{u.subscriptionPlan || "free"}</Badge>
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ===== SYSTEM TAB ===== */}
        {activeTab === "system" && (
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {/* API Keys */}
            <SectionCard title="API Keys" icon={Key}>
              {!systemStatus?.apiKeys ? <LoadingSkeleton rows={6} /> : (
                <div className="space-y-1.5">
                  {Object.entries(systemStatus.apiKeys).map(([key, configured]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-2.5">
                        {configured
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        }
                        <span className="text-xs capitalize">{key}</span>
                      </div>
                      <Badge variant={configured ? "default" : "outline"} className={cn(
                        "text-[9px] px-2",
                        configured ? "" : "text-muted-foreground"
                      )}>
                        {configured ? "Connected" : "Not set"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* System Info */}
            <SectionCard title="System Information" icon={Server}>
              <div className="space-y-1.5">
                {[
                  { icon: Database, label: "Database Size", value: systemStatus?.dbSizeMB ? `${systemStatus.dbSizeMB} MB` : "—" },
                  { icon: Server, label: "Platform", value: systemStatus?.platform || "—" },
                  { icon: Server, label: "Node.js", value: systemStatus?.nodeVersion || "—" },
                  { icon: Activity, label: "App URL", value: "dropandsell.online" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="text-xs font-medium tabular-nums truncate max-w-[160px] text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Service Status Cards */}
            <Card className="sm:col-span-2 border-dashed border-border/60">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Service Status</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: "Stripe", ok: systemStatus?.apiKeys?.stripe, icon: CreditCard },
                    { name: "OpenAI", ok: systemStatus?.apiKeys?.openai, icon: MessageSquare },
                    { name: "eBay", ok: systemStatus?.apiKeys?.ebay, icon: ShoppingCart },
                    { name: "Amazon", ok: systemStatus?.apiKeys?.amazon, icon: Store },
                  ].map(s => (
                    <div key={s.name} className={cn(
                      "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border transition-colors",
                      s.ok
                        ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900"
                        : "bg-muted/20 border-border/40"
                    )}>
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        s.ok ? "bg-emerald-100 dark:bg-emerald-950/30" : "bg-muted"
                      )}>
                        <s.icon className={cn(
                          "w-4 h-4",
                          s.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
                        )} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium">{s.name}</p>
                        <p className={cn(
                          "text-[10px]",
                          s.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
                        )}>
                          {s.ok ? "Connected" : "Not configured"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
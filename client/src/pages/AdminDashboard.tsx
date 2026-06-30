import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Users, Store, Package, ShoppingCart, CreditCard, Shield, Settings,
  MessageSquare, LogOut, TrendingUp, TrendingDown, Activity, Clock,
  AlertTriangle, CheckCircle, XCircle, Database, Key, Globe, Server,
  ArrowUpRight, UserPlus, RefreshCw, Search, ChevronRight, Star,
  HeartPulse, Truck, Boxes, DollarSign, BarChart3, Inbox,
} from "lucide-react";

function StatCard({ label, value, icon: Icon, color, trend }: {
  label: string; value: number | string; icon: any; color: string; trend?: { up: boolean; pct: string };
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", color.replace("text", "bg").replace("-500", "-100 dark:bg-opacity-20"))}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
          {trend && (
            <div className={cn("flex items-center gap-0.5 text-xs shrink-0", trend.up ? "text-emerald-600" : "text-red-600")}>
              {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.pct}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400",
    inactive: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400",
    pending: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400",
    shipped: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400",
    processing: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400",
    cancelled: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400",
    admin: "bg-primary/10 text-primary border-primary/20",
    user: "bg-muted text-muted-foreground border-border/50",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", colors[status] || "bg-muted text-muted-foreground")}>
      {status}
    </Badge>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState(!!localStorage.getItem("adminAuthed"));
  const [creds, setCreds] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [userSearch, setUserSearch] = useState("");

  useQuery({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.status === 401) { setAuthed(false); localStorage.removeItem("adminAuthed"); }
      return res.json();
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

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <Card className="w-full max-w-md mx-4 shadow-xl">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-2 text-primary" />
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">DropandSell AI Administration</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={creds.username} onChange={e => setCreds(p => ({ ...p, username: e.target.value }))} placeholder="Username" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={creds.password} onChange={e => setCreds(p => ({ ...p, password: e.target.value }))} placeholder="Password" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            {loginError && <p className="text-sm text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" />{loginError}</p>}
            <Button className="w-full" onClick={handleLogin}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredUsers = users?.filter((u: any) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.email?.toLowerCase().includes(q) || u.firstName?.toLowerCase().includes(q) || u.lastName?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your DropandSell AI platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/admin/support")}>
            <MessageSquare className="w-4 h-4 mr-2" />Support
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/admin/settings")}>
            <Settings className="w-4 h-4 mr-2" />Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />Logout
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Users" value={stats?.users ?? 0} icon={Users} color="text-blue-500" />
        <StatCard label="Stores" value={stats?.stores ?? 0} icon={Store} color="text-emerald-500" />
        <StatCard label="Products" value={stats?.products ?? 0} icon={Package} color="text-violet-500" />
        <StatCard label="Orders" value={stats?.orders ?? 0} icon={ShoppingCart} color="text-amber-500" />
        <StatCard label="Subscribers" value={stats?.subscribers ?? 0} icon={CreditCard} color="text-rose-500" />
        <StatCard label="Vendors" value={vendorOverview?.totalVendors ?? 0} icon={Boxes} color="text-cyan-500" />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-2" />Overview</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />Users</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingCart className="w-4 h-4 mr-2" />Orders</TabsTrigger>
          <TabsTrigger value="vendors"><Boxes className="w-4 h-4 mr-2" />Vendors</TabsTrigger>
          <TabsTrigger value="system"><Server className="w-4 h-4 mr-2" />System</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!activity || activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
                ) : (
                  activity.slice(0, 10).map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/30 last:border-0">
                      <div className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                        a.type === 'order' ? "bg-amber-100 dark:bg-amber-950/30" : "bg-blue-100 dark:bg-blue-950/30"
                      )}>
                        {a.type === 'order' ? <ShoppingCart className="w-3.5 h-3.5 text-amber-600" /> : <UserPlus className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-xs">{a.label}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{a.detail}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Vendor Health Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartPulse className="w-4 h-4" /> Vendor Health
                  {vendorOverview?.totalVendors > 0 && (
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      Avg: {Number(vendorOverview.avgHealthScore).toFixed(1)} ★
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!vendorOverview?.vendors?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No vendors yet</p>
                ) : (
                  vendorOverview.vendors.slice(0, 8).map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-medium truncate">{v.name}</span>
                        <Badge variant="outline" className="text-[9px] capitalize">{v.category || 'N/A'}</Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.healthScore ? (
                          <span className="text-xs tabular-nums">{'★'.repeat(v.healthScore)}{'☆'.repeat(5 - v.healthScore)}</span>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                        <StatusBadge status={v.status} />
                      </div>
                    </div>
                  ))
                )}
                {vendorOverview?.vendors?.length > 8 && (
                  <button onClick={() => setLocation("/vendors")} className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" /> Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setLocation("/admin/support")}>
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Support Queue
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/admin/settings")}>
                <Settings className="w-3.5 h-3.5 mr-1.5" /> Site Settings
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/stores")}>
                <Store className="w-3.5 h-3.5 mr-1.5" /> Manage Stores
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/vendors")}>
                <Boxes className="w-3.5 h-3.5 mr-1.5" /> Manage Vendors
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/orders")}>
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> All Orders
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === USERS TAB === */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" /> User Management
                  <Badge variant="secondary" className="text-xs ml-1">{users?.length ?? 0}</Badge>
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Search users..." className="pl-8 h-8 text-xs" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!filteredUsers || filteredUsers.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  {userSearch ? "No users match your search" : "No users found"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left pb-2 font-medium text-xs">Email</th>
                        <th className="text-left pb-2 font-medium text-xs">Name</th>
                        <th className="text-left pb-2 font-medium text-xs">Role</th>
                        <th className="text-left pb-2 font-medium text-xs">Plan</th>
                        <th className="text-left pb-2 font-medium text-xs">Status</th>
                        <th className="text-left pb-2 font-medium text-xs">Joined</th>
                        <th className="text-left pb-2 font-medium text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u: any) => (
                        <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2.5 text-xs">{u.email}</td>
                          <td className="py-2.5 text-xs">{u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}` : "—"}</td>
                          <td className="py-2.5"><StatusBadge status={u.role} /></td>
                          <td className="py-2.5"><Badge variant="outline" className="text-[10px]">{u.subscriptionPlan ?? "free"}</Badge></td>
                          <td className="py-2.5"><StatusBadge status={u.subscriptionStatus || "inactive"} /></td>
                          <td className="py-2.5 text-muted-foreground text-[11px]">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                          <td className="py-2.5">
                            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}>
                              <Shield className="w-3 h-3 mr-1" />{u.role === "admin" ? "Demote" : "Promote"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ORDERS TAB === */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recentOrders || recentOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No orders yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left pb-2 font-medium text-xs">Customer</th>
                        <th className="text-left pb-2 font-medium text-xs">Amount</th>
                        <th className="text-left pb-2 font-medium text-xs">Status</th>
                        <th className="text-left pb-2 font-medium text-xs">Tracking</th>
                        <th className="text-left pb-2 font-medium text-xs">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((o: any) => (
                        <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2.5 text-xs">{o.customerName || "—"}</td>
                          <td className="py-2.5 text-xs font-medium tabular-nums">{o.totalAmount ? `£${Number(o.totalAmount).toFixed(2)}` : "—"}</td>
                          <td className="py-2.5"><StatusBadge status={o.status} /></td>
                          <td className="py-2.5"><StatusBadge status={o.trackingStatus || "pending"} /></td>
                          <td className="py-2.5 text-muted-foreground text-[11px]">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === VENDORS TAB === */}
        <TabsContent value="vendors">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Boxes className="w-4 h-4" /> All Vendors
                  <Badge variant="secondary" className="text-xs ml-1">{vendorOverview?.totalVendors ?? 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!vendorOverview?.vendors?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No vendors created yet</p>
                ) : (
                  vendorOverview.vendors.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          v.healthScore && v.healthScore >= 4 ? "bg-emerald-100 dark:bg-emerald-950/30" :
                          v.healthScore && v.healthScore >= 3 ? "bg-amber-100 dark:bg-amber-950/30" :
                          "bg-red-100 dark:bg-red-950/30"
                        )}>
                          <Store className={cn(
                            "w-4 h-4",
                            v.healthScore && v.healthScore >= 4 ? "text-emerald-600" :
                            v.healthScore && v.healthScore >= 3 ? "text-amber-600" : "text-red-600"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{v.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {v.totalOrdersFulfilled || 0} orders · {v.stockUpdateReliability || 'N/A'} reliability
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.healthScore && (
                          <span className="text-xs tabular-nums">{'★'.repeat(v.healthScore)}{'☆'.repeat(5 - v.healthScore)}</span>
                        )}
                        <StatusBadge status={v.status} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Registrations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Recent Registrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!recentRegs || recentRegs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No recent registrations</p>
                ) : (
                  recentRegs.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                          <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs truncate font-medium">{u.email}</p>
                          <p className="text-[10px] text-muted-foreground">{u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}` : "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px]">{u.subscriptionPlan || "free"}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === SYSTEM TAB === */}
        <TabsContent value="system">
          <div className="grid md:grid-cols-2 gap-6">
            {/* API Keys Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" /> API Keys Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {systemStatus?.apiKeys ? (
                  Object.entries(systemStatus.apiKeys).map(([key, configured]) => (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        {configured ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className="text-xs capitalize">{key}</span>
                      </div>
                      <Badge variant={configured ? "default" : "outline"} className="text-[10px]">{configured ? "Configured" : "Missing"}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="w-4 h-4" /> System Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                  <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs">Database Size</span></div>
                  <span className="text-xs font-medium">{systemStatus?.dbSizeMB ? `${systemStatus.dbSizeMB} MB` : "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                  <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs">Platform</span></div>
                  <span className="text-xs font-medium capitalize">{systemStatus?.platform || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                  <div className="flex items-center gap-2"><Server className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs">Node.js</span></div>
                  <span className="text-xs font-medium">{systemStatus?.nodeVersion || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs">App URL</span></div>
                  <span className="text-xs font-medium text-primary truncate max-w-[200px]">{process.env.APP_URL || "dropandsell.online"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Config Status */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Configuration Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl border border-border/30">
                    <CreditCard className={cn("w-6 h-6 mb-2", systemStatus?.apiKeys?.stripe ? "text-emerald-500" : "text-red-400")} />
                    <span className="text-xs font-medium">Stripe</span>
                    <Badge variant={systemStatus?.apiKeys?.stripe ? "default" : "outline"} className="text-[9px] mt-1">
                      {systemStatus?.apiKeys?.stripe ? "Active" : "Not Set"}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl border border-border/30">
                    <MessageSquare className={cn("w-6 h-6 mb-2", systemStatus?.apiKeys?.openai ? "text-emerald-500" : "text-red-400")} />
                    <span className="text-xs font-medium">OpenAI</span>
                    <Badge variant={systemStatus?.apiKeys?.openai ? "default" : "outline"} className="text-[9px] mt-1">
                      {systemStatus?.apiKeys?.openai ? "Active" : "Not Set"}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl border border-border/30">
                    <ShoppingCart className={cn("w-6 h-6 mb-2", systemStatus?.apiKeys?.ebay ? "text-emerald-500" : "text-red-400")} />
                    <span className="text-xs font-medium">eBay</span>
                    <Badge variant={systemStatus?.apiKeys?.ebay ? "default" : "outline"} className="text-[9px] mt-1">
                      {systemStatus?.apiKeys?.ebay ? "Active" : "Not Set"}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl border border-border/30">
                    <Store className={cn("w-6 h-6 mb-2", systemStatus?.apiKeys?.amazon ? "text-emerald-500" : "text-red-400")} />
                    <span className="text-xs font-medium">Amazon</span>
                    <Badge variant={systemStatus?.apiKeys?.amazon ? "default" : "outline"} className="text-[9px] mt-1">
                      {systemStatus?.apiKeys?.amazon ? "Active" : "Not Set"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
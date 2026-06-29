import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Store, Package, ShoppingCart, CreditCard, Shield, Settings, MessageSquare, Plus, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState(!!localStorage.getItem("adminAuthed"));
  const [creds, setCreds] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (!authed) return;
    fetch("/api/admin/stats", { credentials: "include" }).then(r => {
      if (r.status === 401) { setAuthed(false); localStorage.removeItem("adminAuthed"); }
    });
  }, [authed]);

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    enabled: authed,
    refetchInterval: 30000,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const handleLogin = async () => {
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
      credentials: "include",
    });
    if (!res.ok) { setLoginError("Invalid credentials"); return; }
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
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <Shield className="w-10 h-10 mx-auto mb-2 text-primary" />
            <CardTitle>Admin Login</CardTitle>
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
            {loginError && <p className="text-sm text-destructive">{loginError}</p>}
            <Button className="w-full" onClick={handleLogin}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: "Users", value: stats?.users ?? 0, icon: Users, color: "text-blue-500" },
    { label: "Stores", value: stats?.stores ?? 0, icon: Store, color: "text-emerald-500" },
    { label: "Products", value: stats?.products ?? 0, icon: Package, color: "text-violet-500" },
    { label: "Orders", value: stats?.orders ?? 0, icon: ShoppingCart, color: "text-amber-500" },
    { label: "Subscribers", value: stats?.subscribers ?? 0, icon: CreditCard, color: "text-rose-500" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-6">
      <div className="flex items-center justify-between">
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!users || users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 font-medium">Email</th>
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-left pb-2 font-medium">Role</th>
                    <th className="text-left pb-2 font-medium">Plan</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-left pb-2 font-medium">Joined</th>
                    <th className="text-left pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2">{u.email}</td>
                      <td className="py-2">{u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}` : "-"}</td>
                      <td className="py-2">
                        <Badge variant={u.role === "admin" ? "default" : "outline"}>{u.role}</Badge>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline">{u.subscriptionPlan ?? "free"}</Badge>
                      </td>
                      <td className="py-2">
                        <Badge variant={u.subscriptionStatus === "active" ? "default" : "secondary"}>
                          {u.subscriptionStatus ?? "inactive"}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                          >
                            <Shield className="w-3 h-3 mr-1" />
                            {u.role === "admin" ? "Demote" : "Promote"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
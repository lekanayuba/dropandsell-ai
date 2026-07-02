import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Search, Trash2, Edit, ShieldAlert, Tag, AlertTriangle, Loader2, BarChart3, Scan, Mail, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type GlobalVeroItem = {
  id: number;
  type: string;
  value: string;
  platform: string | null;
  reason: string | null;
  category: string | null;
  severity: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminGlobalVero() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<GlobalVeroItem | null>(null);
  const [form, setForm] = useState({ type: "brand", value: "", platform: "", reason: "", category: "brand_protection", severity: "block" });
  const [scanResult, setScanResult] = useState<any>(null);

  const isAdmin = user?.isAdmin === "true" || user?.email === "dropandsellauth@gmail.com";

  const { data: items = [], isLoading } = useQuery<GlobalVeroItem[]>({
    queryKey: ["/api/global-vero-list"],
  });

  const { data: stats } = useQuery<{ total: number; active: number; brands: number; keywords: number }>({
    queryKey: ["/api/global-vero-list/stats"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/admin/global-vero-list", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list/stats"] });
      setAddOpen(false);
      setForm({ type: "brand", value: "", platform: "", reason: "", category: "brand_protection", severity: "block" });
      toast({ title: "Added to Global VeRO list" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PUT", `/api/admin/global-vero-list/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list/stats"] });
      setEditItem(null);
      toast({ title: "Updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/global-vero-list/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list/stats"] });
      toast({ title: "Removed from Global VeRO list" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/global-vero-list/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list/stats"] });
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/vero-scan-all-users");
      return res.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      toast({
        title: `Scan Complete`,
        description: `${data.totalProductsRemoved} products removed from ${data.affectedUsers?.length || 0} users. ${data.totalEmailsSent} notifications sent.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchTerm || item.value.toLowerCase().includes(searchTerm.toLowerCase()) || (item.reason || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [items, searchTerm, typeFilter]);

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-6 w-6 text-primary" />
            Global VeRO Management
          </h1>
          <p className="text-muted-foreground mt-1">System-wide brand protection list applied to all users</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            data-testid="button-refresh-vero"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list"] });
              queryClient.invalidateQueries({ queryKey: ["/api/global-vero-list/stats"] });
              toast({ title: "Refreshed", description: "VeRO list reloaded from server" });
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-scan-all-users" disabled={scanAllMutation.isPending}>
                {scanAllMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Scan className="h-4 w-4 mr-2" />}
                {scanAllMutation.isPending ? "Scanning..." : "Scan & Remove All Users"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Scan All Users' Inventory</AlertDialogTitle>
                <AlertDialogDescription>
                  This will scan every user's inventory against the Global VeRO list. Any products containing blocked brands or keywords will be <strong className="text-red-600">permanently deleted</strong> and each affected user will receive an email notification explaining what was removed and why.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => scanAllMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Scan & Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-vero">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Global VeRO Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="sku">SKU Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input data-testid="input-value" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. Nike, replica, SKU*" />
              </div>
              <div>
                <Label>Reason</Label>
                <Input data-testid="input-reason" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why this is blocked" />
              </div>
              <div>
                <Label>Platform (optional)</Label>
                <Select value={form.platform || "all"} onValueChange={v => setForm(f => ({ ...f, platform: v === "all" ? "" : v }))}>
                  <SelectTrigger data-testid="select-platform"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="ebay">eBay</SelectItem>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="shopify">Shopify</SelectItem>
                    <SelectItem value="tiktok">TikTok Shop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger data-testid="select-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => addMutation.mutate(form)} disabled={!form.value || addMutation.isPending} data-testid="button-submit-add">
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {scanResult && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <ShieldAlert className="h-5 w-5" />
                VeRO Scan Results
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setScanResult(null)} data-testid="button-dismiss-scan">Dismiss</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div><p className="text-xs text-muted-foreground">Users Scanned</p><p className="text-lg font-bold" data-testid="text-scan-users">{scanResult.totalUsersScanned}</p></div>
              <div><p className="text-xs text-muted-foreground">Products Scanned</p><p className="text-lg font-bold" data-testid="text-scan-products">{scanResult.totalProductsScanned}</p></div>
              <div><p className="text-xs text-red-600">Products Removed</p><p className="text-lg font-bold text-red-600" data-testid="text-scan-removed">{scanResult.totalProductsRemoved}</p></div>
              <div><p className="text-xs text-muted-foreground">Emails Sent</p><p className="text-lg font-bold flex items-center gap-1" data-testid="text-scan-emails"><Mail className="h-4 w-4" />{scanResult.totalEmailsSent}</p></div>
            </div>
            {scanResult.affectedUsers?.length > 0 && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Affected Users:</p>
                {scanResult.affectedUsers.map((u: any, i: number) => (
                  <div key={i} className="bg-white dark:bg-zinc-900 rounded-md p-3 border text-sm" data-testid={`scan-user-result-${i}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{u.name || u.email}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{u.productsRemoved} removed</Badge>
                        {u.emailSent && <Badge variant="outline" className="text-green-600 border-green-300"><Mail className="h-3 w-3 mr-1" />Notified</Badge>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {u.removedProducts?.map((rp: any, j: number) => (
                        <div key={j}>
                          <span className="text-red-500 font-medium">{rp.title}</span>
                          <span className="ml-1">({rp.violations.join(', ')})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {scanResult.totalProductsRemoved === 0 && (
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">All inventories are clean - no VeRO violations found.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Entries</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-total-entries">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-active-entries">{stats?.active ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Brands</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-brand-count">{stats?.brands ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Keywords</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-keyword-count">{stats?.keywords ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
            <CardTitle className="text-lg">VeRO Entries</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input data-testid="input-search" placeholder="Search brands, keywords..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32" data-testid="select-type-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="brand">Brands</SelectItem>
                  <SelectItem value="keyword">Keywords</SelectItem>
                  <SelectItem value="sku">SKU</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id} data-testid={`row-vero-${item.id}`}>
                      <TableCell>
                        <Badge variant={item.type === "brand" ? "default" : item.type === "keyword" ? "secondary" : "outline"}>
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-value-${item.id}`}>{item.value}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{item.reason || "-"}</TableCell>
                      <TableCell>{item.platform || "All"}</TableCell>
                      <TableCell>
                        <Badge variant={item.severity === "block" ? "destructive" : "outline"}>
                          {item.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={checked => toggleMutation.mutate({ id: item.id, isActive: checked })}
                          data-testid={`switch-active-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditItem(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Delete "${item.value}" from global VeRO list?`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? "No entries match your search" : "No VeRO entries found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Showing {filteredItems.length} of {items.length} entries
          </p>
        </CardContent>
      </Card>

      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit VeRO Entry</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={editItem.type} onValueChange={v => setEditItem({ ...editItem, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="sku">SKU Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input value={editItem.value} onChange={e => setEditItem({ ...editItem, value: e.target.value })} />
              </div>
              <div>
                <Label>Reason</Label>
                <Input value={editItem.reason || ""} onChange={e => setEditItem({ ...editItem, reason: e.target.value })} />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={editItem.severity} onValueChange={v => setEditItem({ ...editItem, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => editItem && updateMutation.mutate({ id: editItem.id, type: editItem.type, value: editItem.value, reason: editItem.reason, severity: editItem.severity })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

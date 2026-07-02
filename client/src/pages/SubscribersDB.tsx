import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Database, Search, Download, Mail, Calendar, Trash2, Loader2 } from "lucide-react";

type Subscriber = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  createdAt: string | null;
};

const PLANS = ["free", "starter", "pro", "business", "enterprise"];

export default function SubscribersDB() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);

  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
  });

  const planMutation = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/subscribers/${userId}/plan`, { plan });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
      toast({ title: "Plan updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update plan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/subscribers/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
      setDeleteTarget(null);
      toast({ title: "Subscriber deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete subscriber", variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subscribers.filter(s => {
      const name = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
      return (s.email || "").toLowerCase().includes(q) || name.includes(q);
    });
  }, [subscribers, search]);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const handleExport = () => {
    const header = ["Email", "Name", "Plan", "Status", "Joined"];
    const rows = filtered.map(s => [
      s.email || "",
      `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      s.subscriptionPlan || "free",
      s.subscriptionStatus || "",
      formatDate(s.createdAt),
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6" data-testid="page-subscribers-db">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-6 w-6 text-primary" />
            Subscribers DB
          </h1>
          <p className="text-muted-foreground mt-1">Manage your subscriber database</p>
        </div>
        <Button variant="outline" onClick={handleExport} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <span className="text-sm text-muted-foreground" data-testid="text-subscriber-count">{filtered.length} subscribers</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Mail className="h-3.5 w-3.5 inline mr-1" /> Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><Calendar className="h-3.5 w-3.5 inline mr-1" /> Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} data-testid={`row-subscriber-${s.id}`}>
                      <TableCell className="font-medium" data-testid={`text-email-${s.id}`}>{s.email || "—"}</TableCell>
                      <TableCell data-testid={`text-name-${s.id}`}>{`${s.firstName || ""} ${s.lastName || ""}`.trim() || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={s.subscriptionPlan || "free"}
                          onValueChange={(plan) => planMutation.mutate({ userId: s.id, plan })}
                        >
                          <SelectTrigger className="w-[140px]" data-testid={`select-plan-${s.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLANS.map(p => (
                              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.subscriptionStatus === "active" ? "default" : "secondary"} data-testid={`status-${s.id}`}>
                          {s.subscriptionStatus || "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-joined-${s.id}`}>{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(s)}
                          data-testid={`button-delete-${s.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {search ? "No subscribers match your search" : "No subscribers found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscriber</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.email}</strong> and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

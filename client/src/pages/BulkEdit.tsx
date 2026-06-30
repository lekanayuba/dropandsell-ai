import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Search, Package, CheckCircle2, AlertCircle } from "lucide-react";

export default function BulkEdit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const r = await fetch("/api/products", { credentials: "include" });
      return r.json();
    },
  });

  const { data: vendorsData } = useQuery({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const r = await fetch("/api/vendors", { credentials: "include" });
      return r.json();
    },
  });

  const [bulkUpdates, setBulkUpdates] = useState<Record<string, any>>({});

  const mutation = useMutation({
    mutationFn: async (data: { productIds: number[]; updates: Record<string, any> }) => {
      const r = await fetch("/api/products/bulk-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `Updated ${data.updated} products`, description: `${data.total - data.updated} skipped` });
      setSelectedIds(new Set());
      setBulkUpdates({});
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const products = (productsData as any)?.items || [];
  const vendors = (vendorsData as any) || [];

  const filtered = products.filter((p: any) =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p: any) => p.id)));
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  if (isLoading) {
    return <div className="space-y-6"><h2 className="text-2xl md:text-3xl font-bold font-display">Bulk Edit</h2>{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Bulk Edit Products</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground whitespace-nowrap">{selectedIds.size} selected</p>
      </div>

      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Bulk Actions — {selectedIds.size} product{selectedIds.size > 1 ? 's' : ''} selected</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Selling Price</Label>
                <Input type="number" step="0.01" placeholder="Set price..." value={bulkUpdates.sellingPrice ?? ''} onChange={(e) => setBulkUpdates(p => ({ ...p, sellingPrice: e.target.value ? parseFloat(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label>Cost Price</Label>
                <Input type="number" step="0.01" placeholder="Set cost..." value={bulkUpdates.costPrice ?? ''} onChange={(e) => setBulkUpdates(p => ({ ...p, costPrice: e.target.value ? parseFloat(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" placeholder="Set quantity..." value={bulkUpdates.quantity ?? ''} onChange={(e) => setBulkUpdates(p => ({ ...p, quantity: e.target.value ? parseInt(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label>Vendor</Label>
                <Select value={bulkUpdates.vendorId ?? ''} onValueChange={(v) => setBulkUpdates(p => ({ ...p, vendorId: v ? parseInt(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Assign vendor..." /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => mutation.mutate({ productIds: Array.from(selectedIds), updates: bulkUpdates })}
                disabled={mutation.isPending || Object.keys(bulkUpdates).length === 0}
              >
                {mutation.isPending ? 'Updating...' : `Apply to ${selectedIds.size} products`}
              </Button>
              <Button variant="outline" onClick={() => { setSelectedIds(new Set()); setBulkUpdates({}); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-3 px-4 w-10">
                    <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Product</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">SKU</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cost</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className={`border-b border-border/20 hover:bg-muted/30 ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-4">
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-medium truncate max-w-[250px]">{p.title}</p>
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground">{p.sku}</td>
                    <td className="py-3 px-2 text-right">${Number(p.costPrice).toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-medium">${Number(p.sellingPrice).toFixed(2)}</td>
                    <td className="py-3 px-2 text-right">
                      <span className={Number(p.quantity) <= 0 ? 'text-destructive' : 'text-green-600'}>
                        {p.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No products found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
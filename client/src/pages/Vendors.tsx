import { useVendors, useCreateVendor, useDeleteVendor } from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, HeartPulse, Loader2, Truck, XCircle, Package, ArrowLeftRight, Timer, AlertTriangle, RefreshCw, Store, SwitchCamera, History, Search, Edit3, Download, Globe, Phone, Mail, Tag, MapPin, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVendorSchema, type InsertVendor } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function StarRating({ score }: { score: number | null }) {
  if (!score) return <span className="text-muted-foreground text-xs">No data</span>;
  return (
    <span className="text-base tracking-wider" aria-label={`${score} out of 5 stars`}>
      {"★".repeat(score)}{"☆".repeat(5 - score)}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (!score) return <Badge variant="outline" className="text-xs">Pending</Badge>;
  const colors: Record<number, string> = {
    1: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
    2: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800",
    3: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
    4: "bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-950/20 dark:text-lime-400 dark:border-lime-800",
    5: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800",
  };
  const labels: Record<number, string> = {
    1: "Unreliable", 2: "Below Avg", 3: "Average", 4: "Good", 5: "Reliable",
  };
  return (
    <Badge variant="outline" className={cn("text-xs gap-1", colors[score])}>
      <HeartPulse className="w-3 h-3" />
      {labels[score]}
    </Badge>
  );
}

function StockBadge({ inStock, outOfStock, total }: { inStock: number; outOfStock: number; total: number }) {
  if (total === 0) return null;
  const allOos = outOfStock === total;
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={cn(
        "text-xs gap-1 px-2 py-0.5",
        allOos
          ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400"
          : outOfStock > 0
            ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400"
            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
      )}>
        <Package className="w-3 h-3" />
        {allOos ? "All OOS" : outOfStock > 0 ? `${outOfStock}/${total} OOS` : `${inStock} in stock`}
      </Badge>
    </div>
  );
}

function HealthMeter({ label, value, icon: Icon, good, total }: {
  label: string; value: React.ReactNode | string | number | null; icon: any; good?: boolean; total?: string | number | null;
}) {
  const isGood = good ?? true;
  const color = value === null
    ? "text-muted-foreground"
    : isGood
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn("w-4 h-4 shrink-0", color)} />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <span className={cn("text-xs font-medium tabular-nums shrink-0 ml-2", color)}>
        {value ?? "—"}
      </span>
    </div>
  );
}

type VendorFormData = InsertVendor & { id?: number };

function VendorForm({ vendor, onSuccess }: { vendor?: any; onSuccess: () => void }) {
  const createVendor = useCreateVendor();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update vendor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({ title: "Success", description: "Vendor updated" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update vendor", variant: "destructive" });
    },
  });

  const form = useForm<VendorFormData>({
    resolver: zodResolver(insertVendorSchema),
    defaultValues: vendor ? {
      name: vendor.name || "",
      website: vendor.website || "",
      integrationType: vendor.integrationType || "custom",
      config: vendor.config || {},
      contactPerson: vendor.contactPerson || "",
      contactEmail: vendor.contactEmail || "",
      contactPhone: vendor.contactPhone || "",
      category: vendor.category || "",
      tags: vendor.tags || "",
      country: vendor.country || "",
      leadTime: vendor.leadTime || "",
      paymentTerms: vendor.paymentTerms || "",
      minOrderAmount: vendor.minOrderAmount || "",
      notes: vendor.notes || "",
      status: vendor.status || "active",
    } : {
      name: "",
      website: "",
      integrationType: "custom",
      config: {},
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      category: "",
      tags: "",
      country: "",
      leadTime: "",
      paymentTerms: "",
      minOrderAmount: "",
      notes: "",
      status: "active",
    }
  });

  const onSubmit = (data: VendorFormData) => {
    if (vendor) {
      updateMutation.mutate(data);
    } else {
      createVendor.mutate(data as any, { onSuccess });
    }
  };

  const isPending = createVendor.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor Name *</FormLabel>
              <FormControl><Input placeholder="Supplier Inc." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="website" render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="contactPerson" render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Person</FormLabel>
              <FormControl><Input placeholder="John Doe" {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="contactEmail" render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Email</FormLabel>
              <FormControl><Input placeholder="john@supplier.com" type="email" {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="contactPhone" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl><Input placeholder="+1 234 567 8900" {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="country" render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl><Input placeholder="China, USA, ..." {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select value={field.value || ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="dropshipper">Dropshipper</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="tags" render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl><Input placeholder="comma, separated, tags" {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="leadTime" render={({ field }) => (
            <FormItem>
              <FormLabel>Lead Time</FormLabel>
              <FormControl><Input placeholder="3-5 days" {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="paymentTerms" render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Terms</FormLabel>
              <FormControl><Input placeholder="Net 30, PayPal, ..." {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl><Textarea placeholder="Internal notes about this supplier..." className="min-h-[80px]" {...field} value={field.value || ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Saving..." : vendor ? "Update Vendor" : "Add Vendor"}
        </Button>
      </form>
    </Form>
  );
}

function ImportVendorsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvText, setCsvText] = useState("");

  const importMutation = useMutation({
    mutationFn: async (vendors: any[]) => {
      const res = await fetch('/api/vendors/import', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendors }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Import failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({ title: "Imported", description: `${data.imported} vendors added` });
      setCsvText("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const parseAndImport = () => {
    const lines = csvText.trim().split('\n').filter(Boolean);
    const vendors = lines.map(line => {
      const parts = line.split(',').map(s => s.trim());
      return {
        name: parts[0] || '',
        website: parts[1] || '',
        contactPerson: parts[2] || '',
        contactEmail: parts[3] || '',
        contactPhone: parts[4] || '',
        country: parts[5] || '',
        category: parts[6] || '',
        tags: parts[7] || '',
      };
    }).filter(v => v.name);
    if (vendors.length === 0) {
      toast({ title: "No valid vendors", description: "Each line needs at least a name", variant: "destructive" });
      return;
    }
    importMutation.mutate(vendors);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Vendors</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste CSV data below. Format per line: <code className="text-xs bg-muted px-1 py-0.5 rounded">name, website, contact, email, phone, country, category, tags</code>
          </p>
          <Textarea
            placeholder={`AliExpress, https://aliexpress.com, Ali Baba, support@aliexpress.com, +86 123, China, dropshipper, electronics\neBay Wholesale, https://ebay.com, , , , USA, wholesale, collectibles`}
            className="min-h-[200px] font-mono text-xs"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={parseAndImport}
            disabled={importMutation.isPending || !csvText.trim()}
          >
            {importMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Import Vendors</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORIES = ["all", "wholesale", "manufacturer", "dropshipper", "distributor", "other"] as const;

export default function Vendors() {
  const { data: vendors, isLoading } = useVendors();
  const deleteVendor = useDeleteVendor();
  const [addOpen, setAddOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);
  const [expandedOos, setExpandedOos] = useState<number | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors.filter((v: any) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch = v.name?.toLowerCase().includes(q)
          || v.website?.toLowerCase().includes(q)
          || v.tags?.toLowerCase().includes(q)
          || v.contactPerson?.toLowerCase().includes(q)
          || v.country?.toLowerCase().includes(q)
          || v.category?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      return true;
    });
  }, [vendors, search, categoryFilter]);

  const healthMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/vendors/calculate-health', { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Health calculation failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({ title: "Health Scores Calculated", description: `Updated ${data.count} suppliers` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [replacingProduct, setReplacingProduct] = useState<number | null>(null);
  const [showReplaceLogs, setShowReplaceLogs] = useState(false);
  const [replaceLogs, setReplaceLogs] = useState<any[]>([]);

  const replaceMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch(`/api/products/${productId}/auto-replace-supplier`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Replace failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      if (data.replaced) {
        toast({ title: "Supplier Replaced", description: data.reason });
      } else {
        toast({ title: "No Replacement", description: data.reason, variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Replace Failed", description: err.message, variant: "destructive" });
    },
  });

  const batchReplaceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/products/auto-replace-suppliers', {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Batch replace failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({
        title: "Batch Replace Complete",
        description: `Replaced ${data.replaced} of ${data.total} OOS products`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Batch Replace Failed", description: err.message, variant: "destructive" });
    },
  });

  const fetchReplaceLogs = async () => {
    try {
      const res = await fetch('/api/products/replacement-logs', { credentials: "include" });
      if (res.ok) {
        setReplaceLogs(await res.json());
        setShowReplaceLogs(true);
      }
    } catch { /* ignore */ }
  };

  const countByCategory = useMemo(() => {
    if (!vendors) return {};
    const counts: Record<string, number> = {};
    for (const v of vendors) {
      const cat = v.category || "other";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [vendors]);

  if (isLoading) return <div className="p-8">Loading vendors...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Vendors & Suppliers</h2>
          <p className="text-muted-foreground mt-2">Manage your suppliers and sourcing partners</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReplaceLogs}
            disabled={!vendors || vendors.length === 0}
          >
            <History className="w-4 h-4 mr-1.5" />
            Replacements
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => batchReplaceMutation.mutate()}
            disabled={batchReplaceMutation.isPending || !vendors || vendors.length === 0}
          >
            {batchReplaceMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <SwitchCamera className="w-4 h-4 mr-1.5" />
            )}
            Replace All OOS
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => healthMutation.mutate()}
            disabled={healthMutation.isPending || !vendors || vendors.length === 0}
          >
            {healthMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <HeartPulse className="w-4 h-4 mr-1.5" />
            )}
            Check Health
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              <VendorForm onSuccess={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors by name, country, tags..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              className="capitalize whitespace-nowrap"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
              {cat !== "all" && countByCategory[cat] ? (
                <span className="ml-1.5 text-xs opacity-70">({countByCategory[cat]})</span>
              ) : null}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVendors.map((vendor: any) => {
          const stats = vendor.productStats || { total: 0, inStock: 0, outOfStock: 0, unknown: 0 };
          const hasOos = stats.outOfStock > 0;
          const alts = vendor.alternativeSuppliers || [];
          const isOosExpanded = expandedOos === vendor.id;
          const isVendorExpanded = expandedVendor === vendor.id;
          const tags = vendor.tags ? vendor.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

          return (
            <Card
              key={vendor.id}
              className={cn(
                "border-border/50 transition-colors",
                hasOos ? "hover:border-red-300 dark:hover:border-red-800" : "hover:border-primary/30",
                hasOos && "border-red-200 dark:border-red-900/50"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      hasOos ? "bg-red-100 dark:bg-red-950/30" : "bg-primary/10"
                    )}>
                      {hasOos ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Users className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{vendor.name}</CardTitle>
                      <CardDescription className="text-xs truncate">{vendor.website || "No website"}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!vendor.isGlobal && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setEditVendor(vendor)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteVendor.mutate(vendor.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Tags & Category Row */}
                <div className="flex items-center flex-wrap gap-1.5">
                  {vendor.isGlobal && (
                    <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800">
                      <Globe className="w-3 h-3 mr-1" />
                      Global
                    </Badge>
                  )}
                  {vendor.category && (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      <Tag className="w-3 h-3 mr-1" />
                      {vendor.category}
                    </Badge>
                  )}
                  {vendor.country && (
                    <Badge variant="outline" className="text-[10px]">
                      <MapPin className="w-3 h-3 mr-1" />
                      {vendor.country}
                    </Badge>
                  )}
                  {tags.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-[9px] text-muted-foreground">
                      {tag}
                    </Badge>
                  ))}
                  {tags.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StarRating score={vendor.healthScore} />
                    <ScoreBadge score={vendor.healthScore} />
                  </div>
                  <span className="text-[11px] text-muted-foreground capitalize px-2 py-0.5 bg-muted rounded-full">
                    {vendor.integrationType}
                  </span>
                </div>

                {/* Contact Info */}
                {(vendor.contactPerson || vendor.contactEmail || vendor.contactPhone) && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {vendor.contactPerson && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        <span>{vendor.contactPerson}</span>
                      </div>
                    )}
                    {vendor.contactEmail && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{vendor.contactEmail}</span>
                      </div>
                    )}
                    {vendor.contactPhone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        <span>{vendor.contactPhone}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Lead Time & Payment Terms */}
                {(vendor.leadTime || vendor.paymentTerms) && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {vendor.leadTime && (
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {vendor.leadTime}
                      </span>
                    )}
                    {vendor.paymentTerms && (
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-[10px]">$</span>
                        {vendor.paymentTerms}
                      </span>
                    )}
                  </div>
                )}

                {/* Stock Status Summary */}
                {stats.total > 0 && (
                  <div className="flex items-center justify-between">
                    <StockBadge inStock={stats.inStock} outOfStock={stats.outOfStock} total={stats.total} />
                    <span className="text-[11px] text-muted-foreground">{stats.total} products</span>
                  </div>
                )}

                {/* Expand Products Button */}
                {stats.total > 0 && (
                  <button
                    onClick={() => setExpandedVendor(isVendorExpanded ? null : vendor.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isVendorExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {isVendorExpanded ? "Hide products" : "View products"}
                  </button>
                )}

                {/* Expanded Product List */}
                {isVendorExpanded && vendor.outOfStockProducts && (
                  <div className="space-y-1.5 pl-1 border-l-2 border-muted">
                    {vendor.outOfStockProducts.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs py-1">
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="truncate">{p.title}</div>
                          {p.sku && <div className="text-[10px] text-muted-foreground font-mono">{p.sku}</div>}
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] shrink-0",
                          p.quantity > 0 ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200"
                        )}>
                          {p.quantity > 0 ? "In Stock" : "OOS"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Out-of-Stock Alert */}
                {hasOos && (
                  <div className={cn(
                    "rounded-lg border p-3 space-y-2",
                    "bg-red-50 border-red-200 dark:bg-red-950/15 dark:border-red-900/50"
                  )}>
                    <button
                      onClick={() => setExpandedOos(isOosExpanded ? null : vendor.id)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {stats.outOfStock} product{stats.outOfStock > 1 ? 's' : ''} out of stock
                      </div>
                      <span className="text-xs text-red-500">{isOosExpanded ? 'Hide' : 'Show'}</span>
                    </button>

                    {isOosExpanded && (
                      <div className="space-y-1.5 pt-1">
                        {vendor.outOfStockProducts?.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs bg-white/50 dark:bg-black/20 rounded px-2 py-1.5">
                            <div className="min-w-0 flex-1 mr-2">
                              <div className="truncate font-medium text-red-800 dark:text-red-300">{p.title}</div>
                              {p.sku && <div className="text-[10px] text-red-500/70 dark:text-red-400/70 font-mono">{p.sku}</div>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/30"
                                onClick={() => {
                                  setReplacingProduct(p.id);
                                  replaceMutation.mutate(p.id);
                                }}
                                disabled={replaceMutation.isPending && replacingProduct === p.id}
                                title="Auto-replace supplier"
                              >
                                {replaceMutation.isPending && replacingProduct === p.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <SwitchCamera className="w-3 h-3" />
                                )}
                              </Button>
                              <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                                OOS
                              </Badge>
                            </div>
                          </div>
                        ))}

                        {alts.length > 0 && (
                          <>
                            <Separator className="bg-red-200/50 dark:bg-red-900/30" />
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                                <RefreshCw className="w-3 h-3" />
                                Alternative suppliers available
                              </div>
                              {alts.map((alt: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-white/50 dark:bg-black/20 rounded px-2 py-1.5">
                                  <Store className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span className="truncate text-red-700 dark:text-red-300">{alt.productTitle}</span>
                                  <span className="text-muted-foreground shrink-0">→</span>
                                  <span className="font-medium text-emerald-700 dark:text-emerald-300 shrink-0">{alt.alternativeVendorName}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Health Metrics */}
                {vendor.healthScore && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <HealthMeter
                        label="Avg Shipping"
                        value={vendor.averageShippingDays}
                        icon={Truck}
                        good={false}
                      />
                      <HealthMeter
                        label="Cancel Rate"
                        value={vendor.cancellationRate ? `${vendor.cancellationRate}%` : null}
                        icon={XCircle}
                        good={parseFloat(vendor.cancellationRate ?? '99') < 5}
                      />
                      <HealthMeter
                        label="Stock Updates"
                        value={vendor.stockUpdateReliability ? (
                          <span className={cn(
                            vendor.stockUpdateReliability === 'high' && "text-emerald-600 dark:text-emerald-400",
                            vendor.stockUpdateReliability === 'medium' && "text-yellow-600 dark:text-yellow-400",
                            vendor.stockUpdateReliability === 'low' && "text-red-600 dark:text-red-400",
                          )}>
                            {vendor.stockUpdateReliability.charAt(0).toUpperCase() + vendor.stockUpdateReliability.slice(1)}
                          </span>
                        ) : null}
                        icon={Package}
                        good={vendor.stockUpdateReliability !== 'low'}
                      />
                      <HealthMeter
                        label="Return Rate"
                        value={vendor.returnRate ? `${vendor.returnRate}%` : null}
                        icon={ArrowLeftRight}
                        good={parseFloat(vendor.returnRate ?? '99') < 8}
                      />
                      <HealthMeter
                        label="Late Delivery"
                        value={vendor.lateDeliveryRate ? `${vendor.lateDeliveryRate}%` : null}
                        icon={Timer}
                        good={parseFloat(vendor.lateDeliveryRate ?? '99') < 10}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>{vendor.totalOrdersFulfilled?.toLocaleString()} orders fulfilled</span>
                      {vendor.lastHealthCheck && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="underline decoration-dotted underline-offset-2">
                              <span>Checked {new Date(vendor.lastHealthCheck).toLocaleDateString()}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {new Date(vendor.lastHealthCheck).toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </>
                )}

                {/* Notes */}
                {vendor.notes && (
                  <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5 italic border border-border/30">
                    {vendor.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filteredVendors.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
            <Users className="w-12 h-12 mb-4 text-muted-foreground/60" />
            <h3 className="text-lg font-medium text-foreground">
              {search || categoryFilter !== "all" ? "No matching vendors" : "No vendors added yet"}
            </h3>
            <p className="mt-1 mb-6 text-center max-w-sm">
              {search || categoryFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Add a supplier to source products and track their reliability."}
            </p>
            {!search && categoryFilter === "all" && (
              <Button onClick={() => setAddOpen(true)}>Add Your First Vendor</Button>
            )}
          </div>
        )}
      </div>

      {/* Edit Vendor Dialog */}
      <Dialog open={!!editVendor} onOpenChange={(v) => { if (!v) setEditVendor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          {editVendor && <VendorForm vendor={editVendor} onSuccess={() => setEditVendor(null)} />}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ImportVendorsDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Replacement History Dialog */}
      <Dialog open={showReplaceLogs} onOpenChange={setShowReplaceLogs}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Supplier Replacement History</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {replaceLogs.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <SwitchCamera className="w-10 h-10 mb-3" />
                <p className="text-sm">No replacements yet</p>
                <p className="text-xs mt-1">When a supplier goes OOS, auto-replace will log it here</p>
              </div>
            ) : (
              replaceLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg border border-border/50">
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center shrink-0 mt-0.5">
                    <SwitchCamera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{log.productTitle}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {log.productSku && <p className="text-xs font-mono text-muted-foreground">{log.productSku}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                      <span className="text-red-600 dark:text-red-400 truncate">{log.oldVendorName || 'None'}</span>
                      <ArrowLeftRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">{log.newVendorName}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px] capitalize">{log.reason.replace(/_/g, ' ')}</Badge>
                      <Badge variant="secondary" className="text-[9px] capitalize">{log.triggeredBy}</Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
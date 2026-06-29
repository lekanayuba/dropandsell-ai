import { useVendors, useCreateVendor, useDeleteVendor } from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users, HeartPulse, Loader2, Truck, XCircle, Package, ArrowLeftRight, Timer, AlertTriangle, RefreshCw, Store, SwitchCamera, History } from "lucide-react";
import { useState } from "react";
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

export default function Vendors() {
  const { data: vendors, isLoading } = useVendors();
  const deleteVendor = useDeleteVendor();
  const [open, setOpen] = useState(false);
  const [expandedOos, setExpandedOos] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  if (isLoading) return <div className="p-8">Loading vendors...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Vendors</h2>
          <p className="text-muted-foreground mt-2">Manage your suppliers and sources</p>
        </div>
        <div className="flex gap-2">
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              <VendorForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {vendors?.map((vendor: any) => {
          const stats = vendor.productStats || { total: 0, inStock: 0, outOfStock: 0, unknown: 0 };
          const hasOos = stats.outOfStock > 0;
          const alts = vendor.alternativeSuppliers || [];
          const isExpanded = expandedOos === vendor.id;

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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 ml-2"
                    onClick={() => deleteVendor.mutate(vendor.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StarRating score={vendor.healthScore} />
                    <ScoreBadge score={vendor.healthScore} />
                  </div>
                  <span className="text-[11px] text-muted-foreground capitalize px-2 py-0.5 bg-muted rounded-full">
                    {vendor.integrationType}
                  </span>
                </div>

                {/* Stock Status Summary */}
                {stats.total > 0 && (
                  <div className="flex items-center justify-between">
                    <StockBadge inStock={stats.inStock} outOfStock={stats.outOfStock} total={stats.total} />
                    <span className="text-[11px] text-muted-foreground">{stats.total} products</span>
                  </div>
                )}

                {/* Out-of-Stock Alert */}
                {hasOos && (
                  <div className={cn(
                    "rounded-lg border p-3 space-y-2",
                    "bg-red-50 border-red-200 dark:bg-red-950/15 dark:border-red-900/50"
                  )}>
                    <button
                      onClick={() => setExpandedOos(isExpanded ? null : vendor.id)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {stats.outOfStock} product{stats.outOfStock > 1 ? 's' : ''} out of stock
                      </div>
                      <span className="text-xs text-red-500">{isExpanded ? 'Hide' : 'Show'}</span>
                    </button>

                    {isExpanded && (
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

                        {/* Alternative Suppliers */}
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
              </CardContent>
            </Card>
          );
        })}
        {vendors?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
            <Users className="w-12 h-12 mb-4 text-muted-foreground/60" />
            <h3 className="text-lg font-medium text-foreground">No vendors added yet</h3>
            <p className="mt-1 mb-6 text-center max-w-sm">Add a supplier to source products and track their reliability.</p>
            <Button onClick={() => setOpen(true)}>Add Your First Vendor</Button>
          </div>
        )}
      </div>

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

function VendorForm({ onSuccess }: { onSuccess: () => void }) {
  const createVendor = useCreateVendor();
  const form = useForm<InsertVendor>({
    resolver: zodResolver(insertVendorSchema),
    defaultValues: {
      name: "",
      website: "",
      integrationType: "custom",
      config: {}
    }
  });

  const onSubmit = (data: InsertVendor) => {
    createVendor.mutate(data, { onSuccess });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor Name</FormLabel>
              <FormControl>
                <Input placeholder="Supplier Inc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full touch" disabled={createVendor.isPending}>
          {createVendor.isPending ? "Adding..." : "Add Vendor"}
        </Button>
      </form>
    </Form>
  );
}

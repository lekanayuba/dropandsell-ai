import { useProducts, useCreateProduct, useDeleteProduct } from "@/hooks/use-products";
import { useStores } from "@/hooks/use-stores";
import { useBulkAddToPublishQueue, usePricingRules } from "@/hooks/use-automation";
import { useVendors } from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, Filter, MoreHorizontal, Trash2, Send, AlertTriangle, Package, Image, Sparkles, Loader2, Store, HeartPulse, MapPin, ExternalLink, Check, X, SlidersHorizontal, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useProducts({ search });
  const { data: stores } = useStores();
  const { data: pricingRules } = usePricingRules();
  const { data: vendors } = useVendors();
  const deleteProduct = useDeleteProduct();
  const bulkAddToQueue = useBulkAddToPublishQueue();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [similarImageProduct, setSimilarImageProduct] = useState<any | null>(null);
  const [similarImageResults, setSimilarImageResults] = useState<any | null>(null);
  const [stockSettingsProduct, setStockSettingsProduct] = useState<any | null>(null);

  const findSimilarMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch(`/api/products/${productId}/find-similar-images`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to find similar images");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSimilarImageResults(data);
    },
    onError: (err: Error) => {
      toast({ title: "Search Failed", description: err.message, variant: "destructive" });
      setSimilarImageProduct(null);
    },
  });

  const queryClient = useQueryClient();

  const restockMutation = useMutation({
    mutationFn: async ({ ids, qty }: { ids: number[]; qty: number }) => {
      const res = await fetch("/api/products/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: ids, updates: { quantity: qty } }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Bulk restock failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Restocked", description: `${data.updated} products set in stock` });
      setSelectedProducts([]);
    },
    onError: (err: Error) => {
      toast({ title: "Restock Failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleProductSelection = (id: number) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedProducts.length === data?.items.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(data?.items.map((p) => p.id) || []);
    }
  };

  const handleAddToPublishQueue = async () => {
    if (selectedProducts.length === 0 || !selectedStore) {
      toast({ title: "Missing selection", description: "Please select products and a store", variant: "destructive" });
      return;
    }

    try {
      const activeRule = pricingRules?.find((r) => r.isActive);
      const items = selectedProducts.map((productId) => {
        const product = data?.items.find((p) => p.id === productId);
        const costPrice = Number(product?.costPrice) || 0;
        const sellingPrice = Number(product?.sellingPrice);
        let calculatedPrice = Number.isFinite(sellingPrice) ? sellingPrice : costPrice;

        if (activeRule) {
          const ruleValue = Number(activeRule.value);
          switch (activeRule.ruleType) {
            case "markup":
              calculatedPrice = costPrice * (1 + ruleValue / 100);
              break;
            case "margin":
              calculatedPrice = costPrice / (1 - ruleValue / 100);
              break;
            case "fixed":
              calculatedPrice = costPrice + ruleValue;
              break;
          }
        }

        return {
          productId,
          storeId: Number(selectedStore),
          calculatedPrice: Math.round(calculatedPrice * 100) / 100,
          pricingRuleId: activeRule?.id,
          quantity: product?.quantity || 1,
          postageType: product?.deliveryType || 'buyer_pays',
          postageCost: product?.deliveryCost || undefined,
        };
      });

      await bulkAddToQueue.mutateAsync(items);
      toast({ title: "Added to Queue", description: `${items.length} products added to publish queue` });

      setIsPublishDialogOpen(false);
      setSelectedProducts([]);
      setSelectedStore("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Inventory</h2>
          <p className="text-muted-foreground mt-2">Manage products across all channels</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <ProductForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search products by title or SKU..." 
            className="pl-9 bg-background border-border/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </Button>
        {selectedProducts.length > 0 && data?.items && (
          (() => {
            const oosSelected = selectedProducts.filter(id => {
              const p = data.items.find((x: any) => x.id === id);
              return p && Number(p.quantity) <= 0;
            });
            return oosSelected.length > 0 ? (
              <Button
                variant="outline"
                className="gap-2 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/20"
                onClick={() => restockMutation.mutate({ ids: oosSelected, qty: 1 })}
                disabled={restockMutation.isPending}
              >
                <Package className="w-4 h-4" />
                Restock {oosSelected.length} Selected
              </Button>
            ) : null;
          })()
        )}
        {selectedProducts.length > 0 && (
          <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-publish-selected">
                <Send className="w-4 h-4" />
                Publish {selectedProducts.length} to Store
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Publish Queue</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Store</Label>
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger data-testid="select-store-for-publish">
                      <SelectValue placeholder="Choose a store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name} ({s.platform})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedProducts.length} products will be added to the publish queue with pricing rules applied.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPublishDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddToPublishQueue}
                  disabled={!selectedStore || bulkAddToQueue.isPending}
                  data-testid="button-confirm-publish"
                >
                  {bulkAddToQueue.isPending ? "Adding..." : "Add to Queue"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={data?.items.length ? selectedProducts.length === data.items.length : false}
                  onCheckedChange={toggleAll}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Images</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Loading products...</TableCell>
              </TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12">
                  <p className="text-lg font-medium text-muted-foreground">No products found</p>
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((product) => (
                <TableRow key={product.id} className={selectedProducts.includes(product.id) ? "bg-primary/5" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                      data-testid={`checkbox-product-${product.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{product.title}</div>
                    {product.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {product.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {product.images && product.images.length > 0 ? (
                        <>
                          <Badge variant="outline" className={cn(
                            "text-xs gap-1",
                            product.images.length === 1
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                          )}>
                            <Image className="w-3 h-3" />
                            {product.images.length}
                          </Badge>
                          {product.images.length === 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
                              onClick={() => {
                                setSimilarImageProduct(product);
                                findSimilarMutation.mutate(product.id);
                              }}
                              disabled={findSimilarMutation.isPending && similarImageProduct?.id === product.id}
                              title="Find similar photos"
                            >
                              {findSimilarMutation.isPending && similarImageProduct?.id === product.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <EditableStockCell product={product} />
                  <VendorStockCell product={product} />
                  <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                  <TableCell>£{Number(product.costPrice).toFixed(2)}</TableCell>
                  <TableCell>£{Number(product.sellingPrice).toFixed(2)}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    £{(Number(product.sellingPrice) - Number(product.costPrice)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="outline" className={
                        product.deliveryType === 'free' ? 'bg-green-500/10 text-green-600 border-green-200' :
                        product.deliveryType === 'seller_pays' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                        product.deliveryType === 'buyer_pays' ? 'bg-amber-500/10 text-amber-600 border-amber-200' :
                        'bg-muted text-muted-foreground'
                      }>
                        {product.deliveryType === 'free' ? 'Free' : product.deliveryType === 'seller_pays' ? 'Seller Pays' : 'Buyer Pays'}
                      </Badge>
                      {product.deliveryType !== 'free' && (
                        <span className="text-xs text-muted-foreground">£{Number(product.deliveryCost || 0).toFixed(2)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      product.veroStatus === 'clean' ? 'bg-green-500/10 text-green-600 border-green-200' : 
                      product.veroStatus === 'flagged' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-200' : 
                      'bg-red-500/10 text-red-600 border-red-200'
                    }>
                      {product.veroStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Number(product.quantity) <= 0 && (
                          <DropdownMenuItem onClick={() => restockMutation.mutate({ ids: [product.id], qty: 1 })}>
                            <Package className="w-4 h-4 mr-2 text-green-600" />
                            Set In Stock (1)
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setStockSettingsProduct(product)}>
                          <SlidersHorizontal className="w-4 h-4 mr-2" />
                          Stock Rules
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteProduct.mutate(product.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>

      {/* Find Similar Photos Dialog */}
      <Dialog open={!!similarImageProduct && !!similarImageResults} onOpenChange={(open) => { if (!open) { setSimilarImageProduct(null); setSimilarImageResults(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Find Similar Photos</DialogTitle>
            <div className="flex items-center gap-3 mt-3">
              {similarImageProduct?.images?.[0] && (
                <div className="w-16 h-16 rounded-lg border overflow-hidden shrink-0 bg-muted">
                  <img src={similarImageProduct.images[0]} alt={similarImageProduct.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{similarImageProduct?.title}</p>
                <p className="text-xs text-muted-foreground">
                  {similarImageResults?.results?.length || 0} similar image{similarImageResults?.results?.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {findSimilarMutation.isPending ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : similarImageResults?.results?.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <Image className="w-10 h-10 mb-3" />
                <p className="text-sm">No similar images found in your catalog</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1">
                {similarImageResults?.results?.map((item: any, i: number) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="aspect-square bg-muted relative group">
                      <img
                        src={item.imageUrl}
                        alt={item.productTitle}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge className="text-[10px] gap-1 bg-black/60 text-white border-0">
                          <Sparkles className="w-2.5 h-2.5" />
                          {(item.matchScore * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-sm leading-tight line-clamp-2">{item.productTitle}</p>
                      <p className="text-[11px] text-muted-foreground">{item.matchReason}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <StockAutomationDialog
        product={stockSettingsProduct}
        vendors={vendors}
        open={!!stockSettingsProduct}
        onOpenChange={(open) => {
          if (!open) setStockSettingsProduct(null);
        }}
      />
    </>
  );
}

async function readApiJson(res: Response) {
  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      message = res.statusText || message;
    }
    throw new Error(message);
  }
  return res.json();
}

function StockAutomationDialog({
  product,
  vendors,
  open,
  onOpenChange,
}: {
  product: any | null;
  vendors?: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const productId = product?.id;
  const sourcesKey = [`/api/products/${productId}/stock-sources`];
  const ruleKey = [`/api/products/${productId}/stock-rule`];
  const evaluationKey = [`/api/products/${productId}/stock-evaluation`];
  const eventsKey = [`/api/products/${productId}/stock-events`];

  const sourcesQuery = useQuery({
    queryKey: sourcesKey,
    enabled: open && !!productId,
    queryFn: async () => readApiJson(await fetch(`/api/products/${productId}/stock-sources`, { credentials: "include" })),
  });

  const ruleQuery = useQuery({
    queryKey: ruleKey,
    enabled: open && !!productId,
    queryFn: async () => readApiJson(await fetch(`/api/products/${productId}/stock-rule`, { credentials: "include" })),
  });

  const evaluationQuery = useQuery({
    queryKey: evaluationKey,
    enabled: open && !!productId,
    queryFn: async () => readApiJson(await fetch(`/api/products/${productId}/stock-evaluation`, { credentials: "include" })),
  });

  const eventsQuery = useQuery({
    queryKey: eventsKey,
    enabled: open && !!productId,
    queryFn: async () => readApiJson(await fetch(`/api/products/${productId}/stock-events`, { credentials: "include" })),
  });

  const invalidateStockData = () => {
    queryClient.invalidateQueries({ queryKey: sourcesKey });
    queryClient.invalidateQueries({ queryKey: ruleKey });
    queryClient.invalidateQueries({ queryKey: evaluationKey });
    queryClient.invalidateQueries({ queryKey: eventsKey });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const sources = sourcesQuery.data || [];
  const evaluation = evaluationQuery.data;
  const events = eventsQuery.data || [];
  const isLoading = sourcesQuery.isLoading || ruleQuery.isLoading || evaluationQuery.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Stock Rules</DialogTitle>
          {product && (
            <p className="text-sm text-muted-foreground truncate">
              {product.title} · {product.sku}
            </p>
          )}
        </DialogHeader>
        <ScrollArea className="max-h-[72vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_1.25fr] gap-6">
              <section className="space-y-4">
                <StockRulePanel
                  key={`${productId}-${ruleQuery.data?.updatedAt || "default"}`}
                  productId={productId}
                  rule={ruleQuery.data}
                  sources={sources}
                  vendors={vendors}
                  onSaved={invalidateStockData}
                />

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Evaluation</span>
                    <Badge variant={evaluation?.shouldMarkOutOfStock ? "destructive" : "outline"}>
                      {evaluation?.stockStatus || "unknown"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Metric label="Effective Stock" value={evaluation?.effectiveQuantity ?? Number(product?.quantity || 0)} />
                    <Metric label="Active Sources" value={evaluation?.activeSourceCount ?? 0} />
                    <Metric label="OOS Action" value={evaluation?.shouldMarkOutOfStock ? "Yes" : "No"} />
                    <Metric label="Restock Need" value={evaluation?.shouldRestock ? "Yes" : "No"} />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <AddStockSourceForm
                  key={productId}
                  product={product}
                  vendors={vendors}
                  onSaved={invalidateStockData}
                />

                <div className="space-y-3">
                  {sources.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No vendor sources yet.
                    </div>
                  ) : (
                    sources.map((source: any) => (
                      <StockSourceRow
                        key={`${source.id}-${source.updatedAt || ""}-${source.stockQuantity}-${source.stockStatus}-${source.isEnabled}-${source.isPrimary}`}
                        source={source}
                        vendorName={vendors?.find((v: any) => v.id === source.vendorId)?.name || `Supplier #${source.vendorId}`}
                        productId={productId}
                        onSaved={invalidateStockData}
                      />
                    ))
                  )}
                </div>

                {events.length > 0 && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <span className="text-sm font-medium">Recent Events</span>
                    <div className="space-y-2">
                      {events.slice(0, 4).map((event: any) => (
                        <div key={event.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate">{event.action.replaceAll("_", " ")}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {event.newStatus || event.newQuantity || "logged"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StockRulePanel({
  productId,
  rule,
  sources,
  vendors,
  onSaved,
}: {
  productId: number;
  rule: any;
  sources: any[];
  vendors?: any[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [oosThreshold, setOosThreshold] = useState(String(rule?.oosThreshold ?? 0));
  const [oosAutomationEnabled, setOosAutomationEnabled] = useState(rule?.oosAutomationEnabled !== false);
  const [autoSwitchSupplier, setAutoSwitchSupplier] = useState(Boolean(rule?.autoSwitchSupplier));
  const [restockAutomationEnabled, setRestockAutomationEnabled] = useState(Boolean(rule?.restockAutomationEnabled));
  const [restockThreshold, setRestockThreshold] = useState(String(rule?.restockThreshold ?? 1));
  const [restockQuantity, setRestockQuantity] = useState(String(rule?.restockQuantity ?? 1));
  const [restockMode, setRestockMode] = useState(rule?.restockMode || "fixed");
  const [pinnedVendorSourceId, setPinnedVendorSourceId] = useState(rule?.pinnedVendorSourceId ? String(rule.pinnedVendorSourceId) : "none");

  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${productId}/stock-rule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oosThreshold: Number(oosThreshold),
          oosAutomationEnabled,
          autoSwitchSupplier,
          restockAutomationEnabled,
          restockThreshold: Number(restockThreshold),
          restockQuantity: Number(restockQuantity),
          restockMode,
          pinnedVendorSourceId: pinnedVendorSourceId === "none" ? null : Number(pinnedVendorSourceId),
        }),
      });
      return readApiJson(res);
    },
    onSuccess: () => {
      onSaved();
      toast({ title: "Stock rules saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save stock rules", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>OOS Automation</Label>
          <p className="text-xs text-muted-foreground">Mark listings OOS when stock reaches threshold.</p>
        </div>
        <Switch checked={oosAutomationEnabled} onCheckedChange={setOosAutomationEnabled} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="oos-threshold">OOS Threshold</Label>
          <Input id="oos-threshold" type="number" min="0" value={oosThreshold} onChange={(e) => setOosThreshold(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="restock-threshold">Restock Threshold</Label>
          <Input id="restock-threshold" type="number" min="0" value={restockThreshold} onChange={(e) => setRestockThreshold(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Auto-Restock</Label>
          <p className="text-xs text-muted-foreground">Evaluate restock need without placing vendor orders yet.</p>
        </div>
        <Switch checked={restockAutomationEnabled} onCheckedChange={setRestockAutomationEnabled} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="restock-quantity">Restock Qty</Label>
          <Input id="restock-quantity" type="number" min="1" value={restockQuantity} onChange={(e) => setRestockQuantity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Restock Mode</Label>
          <Select value={restockMode} onValueChange={setRestockMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed Qty</SelectItem>
              <SelectItem value="top_up_to">Top Up To</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Auto-Switch Supplier</Label>
          <p className="text-xs text-muted-foreground">Allow alternate sources before marking OOS.</p>
        </div>
        <Switch checked={autoSwitchSupplier} onCheckedChange={setAutoSwitchSupplier} />
      </div>

      <div className="space-y-1.5">
        <Label>Pinned Source</Label>
        <Select value={pinnedVendorSourceId} onValueChange={setPinnedVendorSourceId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Use enabled sources</SelectItem>
            {sources.map((source: any) => (
              <SelectItem key={source.id} value={String(source.id)}>
                {vendors?.find((v: any) => v.id === source.vendorId)?.name || `Supplier #${source.vendorId}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button className="w-full gap-2" onClick={() => saveRuleMutation.mutate()} disabled={saveRuleMutation.isPending}>
        {saveRuleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Save Rules
      </Button>
    </div>
  );
}

function AddStockSourceForm({
  product,
  vendors,
  onSaved,
}: {
  product: any;
  vendors?: any[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [sourceVendorId, setSourceVendorId] = useState(product?.vendorId ? String(product.vendorId) : "");
  const [sourceSku, setSourceSku] = useState(product?.sku || "");
  const [sourceUrl, setSourceUrl] = useState(product?.attributes?.sourceUrl || "");
  const [sourceQuantity, setSourceQuantity] = useState(String(Math.max(0, Number(product?.quantity || 0))));
  const [sourceStatus, setSourceStatus] = useState(Number(product?.quantity || 0) > 0 ? "in_stock" : "unknown");
  const [sourceIsPrimary, setSourceIsPrimary] = useState(false);

  const addSourceMutation = useMutation({
    mutationFn: async () => {
      if (!sourceVendorId) throw new Error("Choose a supplier");
      const res = await fetch(`/api/products/${product.id}/stock-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendorId: Number(sourceVendorId),
          vendorSku: sourceSku.trim() || null,
          sourceUrl: sourceUrl.trim() || null,
          isPrimary: sourceIsPrimary,
          isEnabled: true,
          stockQuantity: Number(sourceQuantity),
          stockStatus: sourceStatus,
        }),
      });
      return readApiJson(res);
    },
    onSuccess: () => {
      onSaved();
      setSourceIsPrimary(false);
      toast({ title: "Stock source saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save source", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label>Add Vendor Source</Label>
        {sourceIsPrimary && <Badge variant="outline">Primary</Badge>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Supplier</Label>
          <Select value={sourceVendorId} onValueChange={setSourceVendorId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose supplier" />
            </SelectTrigger>
            <SelectContent>
              {vendors?.map((vendor: any) => (
                <SelectItem key={vendor.id} value={String(vendor.id)}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-sku">Vendor SKU</Label>
          <Input id="source-sku" value={sourceSku} onChange={(e) => setSourceSku(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-quantity">Stock Qty</Label>
          <Input id="source-quantity" type="number" min="0" value={sourceQuantity} onChange={(e) => setSourceQuantity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Stock Status</Label>
          <Select value={sourceStatus} onValueChange={setSourceStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="source-url">Source URL</Label>
        <Input id="source-url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://supplier.example/product" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox checked={sourceIsPrimary} onCheckedChange={(checked) => setSourceIsPrimary(Boolean(checked))} />
          <Label>Primary source</Label>
        </div>
        <Button className="gap-2" onClick={() => addSourceMutation.mutate()} disabled={addSourceMutation.isPending || !sourceVendorId}>
          {addSourceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Save Source
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function StockSourceRow({
  source,
  vendorName,
  productId,
  onSaved,
}: {
  source: any;
  vendorName: string;
  productId: number;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(String(Number(source.stockQuantity || 0)));
  const [status, setStatus] = useState(source.stockStatus || "unknown");
  const [enabled, setEnabled] = useState(source.isEnabled !== false);
  const [primary, setPrimary] = useState(Boolean(source.isPrimary));

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${productId}/stock-sources/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stockQuantity: Number(quantity),
          stockStatus: status,
          isEnabled: enabled,
          isPrimary: primary,
        }),
      });
      return readApiJson(res);
    },
    onSuccess: () => {
      onSaved();
      toast({ title: "Source updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update source", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{vendorName}</div>
          <div className="text-xs text-muted-foreground truncate">{source.vendorSku || "No vendor SKU"}</div>
        </div>
        <Badge variant={status === "out_of_stock" ? "destructive" : "outline"}>{status}</Badge>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label>Qty</Label>
          <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="icon" variant="outline" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} title="Save source">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={enabled} onCheckedChange={(checked) => setEnabled(Boolean(checked))} />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={primary} onCheckedChange={(checked) => setPrimary(Boolean(checked))} />
          Primary
        </label>
        {source.sourceUrl && (
          <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" />
            Source
          </a>
        )}
      </div>
    </div>
  );
}

function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const createProduct = useCreateProduct();
  const { data: vendors } = useVendors();
  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      title: "",
      sku: "",
      costPrice: "0",
      sellingPrice: "0",
      quantity: 0,
      veroStatus: "clean",
      deliveryType: "buyer_pays",
      deliveryCost: "0"
    }
  });

  const onSubmit = (data: InsertProduct) => {
    createProduct.mutate(data, { onSuccess });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Product title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="SKU-123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="costPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost Price (£)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sellingPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Selling Price (£)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="deliveryType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || "buyer_pays"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-delivery-type">
                      <SelectValue placeholder="Select delivery type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="free">Free Delivery</SelectItem>
                    <SelectItem value="buyer_pays">Buyer Pays</SelectItem>
                    <SelectItem value="seller_pays">Seller Pays</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="deliveryCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery Cost (£)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    {...field} 
                    value={field.value ?? "0"}
                    onChange={e => field.onChange(e.target.value)}
                    disabled={form.watch("deliveryType") === "free"}
                    data-testid="input-delivery-cost"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Supplier / Vendor selection */}
        <FormField
          control={form.control}
          name="vendorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supplier</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val && val !== "none" ? Number(val) : null)}
                value={field.value?.toString() || "none"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier (optional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {vendors?.map((v: any) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{v.name}</span>
                        {v.healthScore && (
                          <span className="text-amber-500 text-xs">{'★'.repeat(v.healthScore)}</span>
                        )}
                        {v.isGlobal && (
                          <span className="text-[10px] text-blue-500 ml-1">Global</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                <a href="/vendors" className="text-primary underline">Add a supplier</a> to source products and track their reliability.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full mt-4" disabled={createProduct.isPending}>
          {createProduct.isPending ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </Form>
  );
}

function EditableStockCell({ product }: { product: any }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Number(product.quantity)));
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const updateMutation = useMutation({
    mutationFn: async (newQty: number) => {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update quantity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditing(false);
      toast({ title: "Stock updated", description: `Quantity set to ${value}` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setValue(String(Number(product.quantity)));
    },
  });

  const handleSave = () => {
    const newQty = parseInt(value, 10);
    if (isNaN(newQty) || newQty < 0) {
      toast({ title: "Invalid quantity", description: "Enter a valid number", variant: "destructive" });
      setValue(String(Number(product.quantity)));
      return;
    }
    if (newQty === Number(product.quantity)) {
      setEditing(false);
      return;
    }
    updateMutation.mutate(newQty);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setValue(String(Number(product.quantity)));
      setEditing(false);
    }
  };

  const sourceUrl = product.attributes?.sourceUrl;

  return (
    <TableCell>
      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              type="number"
              min="0"
              className="w-20 h-8 text-sm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setValue(String(Number(product.quantity))); setEditing(false); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <>
            {Number(product.quantity) > 0 ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 gap-1 cursor-pointer hover:bg-green-500/20" onClick={() => setEditing(true)}>
                <Package className="w-3 h-3" />
                {Number(product.quantity)}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200 gap-1 cursor-pointer hover:bg-red-500/20" onClick={() => setEditing(true)}>
                <AlertTriangle className="w-3 h-3" />
                Out of Stock
              </Badge>
            )}
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" title="Check source stock" className="text-blue-500 hover:text-blue-700">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </>
        )}
      </div>
    </TableCell>
  );
}

function VendorStockCell({ product }: { product: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const attrs = product.attributes || {};
  const vendorStatus = attrs.vendorStockStatus || 'unknown';
  const sourceUrl = attrs.sourceUrl;
  const hasVendor = !!product.vendorId;

  const toggleMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const newAttrs = { ...attrs, vendorStockStatus: newStatus, vendorStockManual: true };
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: newAttrs }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to update"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!hasVendor && vendorStatus === 'unknown') {
    return (
      <TableCell>
        <span className="text-xs text-muted-foreground">—</span>
      </TableCell>
    );
  }

  const isInStock = vendorStatus === 'in_stock';
  const isOOS = vendorStatus === 'out_of_stock';

  return (
    <TableCell>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 cursor-pointer select-none",
                isInStock && "bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20",
                isOOS && "bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20",
                vendorStatus === 'unknown' && "bg-muted text-muted-foreground border-border/50"
              )}
            >
              {isInStock && <Package className="w-3 h-3" />}
              {isOOS && <AlertTriangle className="w-3 h-3" />}
              {isInStock ? 'Vendor: In Stock' : isOOS ? 'Vendor: OOS' : 'Unknown'}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => toggleMutation.mutate('in_stock')} disabled={toggleMutation.isPending}>
              <Package className="w-4 h-4 mr-2 text-green-600" />
              Mark In Stock
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleMutation.mutate('out_of_stock')} disabled={toggleMutation.isPending}>
              <AlertTriangle className="w-4 h-4 mr-2 text-red-600" />
              Mark Out of Stock
            </DropdownMenuItem>
            {sourceUrl && (
              <DropdownMenuItem onClick={() => window.open(sourceUrl, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Check Source
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableCell>
  );
}

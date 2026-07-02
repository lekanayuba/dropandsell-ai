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
import { Search, Plus, Filter, MoreHorizontal, Trash2, Send, AlertTriangle, Package, Image, Sparkles, Loader2, Store, HeartPulse, MapPin } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
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
  const deleteProduct = useDeleteProduct();
  const bulkAddToQueue = useBulkAddToPublishQueue();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [similarImageProduct, setSimilarImageProduct] = useState<any | null>(null);
  const [similarImageResults, setSimilarImageResults] = useState<any | null>(null);

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
      const inStockSelected = selectedProducts.filter((productId) => {
        const product = data?.items.find((p) => p.id === productId);
        return Number(product?.quantity) > 0;
      });

      if (inStockSelected.length === 0) {
        toast({ title: "Out of stock", description: "Selected products are out of stock and can't be published.", variant: "destructive" });
        return;
      }
      if (inStockSelected.length < selectedProducts.length) {
        toast({ title: "Some skipped", description: `${selectedProducts.length - inStockSelected.length} out-of-stock product(s) were skipped.` });
      }

      const items = inStockSelected.map((productId) => {
        const product = data?.items.find((p) => p.id === productId);
        const costPrice = Number(product?.costPrice || 0);
        let calculatedPrice = Number(product?.sellingPrice || costPrice);

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
              <TableHead>SKU</TableHead>
              <TableHead>Stock</TableHead>
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
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading products...</TableCell>
              </TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {Number(product.quantity) > 0 ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 gap-1">
                          <Package className="w-3 h-3" />
                          {Number(product.quantity)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200 gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                  </TableCell>
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
    </>
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
                onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                value={field.value?.toString() || ""}
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

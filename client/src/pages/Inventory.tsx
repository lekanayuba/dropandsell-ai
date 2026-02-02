import { useProducts, useCreateProduct, useDeleteProduct } from "@/hooks/use-products";
import { useStores } from "@/hooks/use-stores";
import { useBulkAddToPublishQueue, usePricingRules } from "@/hooks/use-automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Plus, Filter, MoreHorizontal, Trash2, Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
              <TableHead>SKU</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading products...</TableCell>
              </TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
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
                  <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                  <TableCell>${Number(product.costPrice).toFixed(2)}</TableCell>
                  <TableCell>${Number(product.sellingPrice).toFixed(2)}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    ${(Number(product.sellingPrice) - Number(product.costPrice)).toFixed(2)}
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
  );
}

function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const createProduct = useCreateProduct();
  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      title: "",
      sku: "",
      costPrice: 0,
      sellingPrice: 0,
      quantity: 0,
      veroStatus: "clean"
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
                <FormLabel>Cost Price ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} />
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
                <FormLabel>Selling Price ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <Button type="submit" className="w-full mt-4" disabled={createProduct.isPending}>
          {createProduct.isPending ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </Form>
  );
}

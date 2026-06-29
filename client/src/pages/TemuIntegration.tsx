import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Globe, Import, RefreshCw, Loader2, Package, ShoppingBag, Image, Truck, DollarSign, PackageOpen, AlertTriangle, CheckCircle2, XCircle, ZoomIn, Search, Sparkles, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function TemuIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarResults, setSimilarResults] = useState<any[]>([]);

  const productsQuery = useQuery({
    queryKey: ['/api/platforms/temu/products'],
    queryFn: async () => {
      const res = await fetch('/api/platforms/temu/products', { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch Temu products");
      return res.json();
    },
  });

  const importMutation = useMutation({
    mutationFn: async (temuUrl: string) => {
      const res = await fetch('/api/platforms/temu/import', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: temuUrl }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/temu/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: data.imported ? "Imported" : "Already Imported",
        description: data.message,
      });
      setUrl("");
      setImportOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const syncPricesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/platforms/temu/sync-prices', {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Price sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/temu/products'] });
      toast({
        title: "Prices Synced",
        description: `${data.pricesUpdated} products had price changes out of ${data.totalTemuProducts}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const syncStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/platforms/temu/sync-stock', {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Stock sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/temu/products'] });
      const outCount = data.wentOutOfStock?.length ?? 0;
      const inCount = data.backInStock?.length ?? 0;
      toast({
        title: "Stock Synced",
        description: `${inCount} back in stock, ${outCount} went out of stock`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const similarMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch('/api/platforms/temu/similar-images', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Similar search failed");
      return res.json();
    },
    onSuccess: (data) => {
      setSimilarResults(data);
      setSimilarOpen(true);
    },
    onError: (err: Error) => {
      toast({ title: "Search Failed", description: err.message, variant: "destructive" });
    },
  });

  const upscaleMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const res = await fetch('/api/platforms/temu/upscale-image', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upscale failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Image Upscaled",
        description: "AI upscaled to 2x resolution",
      });
      // Open the upscaled image in a new tab so the user can see it
      window.open(data.upscaledUrl, '_blank');
    },
    onError: (err: Error) => {
      toast({ title: "Upscale Failed", description: err.message, variant: "destructive" });
    },
  });

  const products = productsQuery.data ?? [];
  const isLoading = productsQuery.isLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/5 rounded-lg">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-display tracking-tight">Temu Integration</h2>
              <p className="text-muted-foreground mt-1">Import products from Temu, track prices & stock</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncPricesMutation.mutate()}
            disabled={syncPricesMutation.isPending || products.length === 0}
          >
            {syncPricesMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4 mr-2" />
            )}
            Sync Prices
          </Button>
          <Button
            variant="outline"
            onClick={() => syncStockMutation.mutate()}
            disabled={syncStockMutation.isPending || products.length === 0}
          >
            {syncStockMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Package className="w-4 h-4 mr-2" />
            )}
            Sync Stock
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20">
                <Import className="w-4 h-4 mr-2" />
                Import from Temu
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Product from Temu</DialogTitle>
                <DialogDescription>
                  Paste a Temu product URL to pull in images, variations, shipping info, and pricing.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="https://www.temu.com/product-xxxxx.html"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={() => importMutation.mutate(url)}
                  disabled={!url.trim() || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Import className="w-4 h-4 mr-2" />
                  )}
                  Import Product
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {products.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-muted/20">
          <Globe className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Temu products imported</h3>
          <p className="text-muted-foreground mb-6 text-center max-w-sm">
            Import products from Temu by pasting a product URL. We&apos;ll pull in images, variations, shipping info, and pricing.
          </p>
          <Button onClick={() => setImportOpen(true)}>
            <Import className="w-4 h-4 mr-2" />
            Import Your First Product
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product: any) => (
          <Card
            key={product.id}
            className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => {
              setSelectedProduct(product);
              setDetailOpen(true);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{product.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    SKU: {product.sku}
                  </CardDescription>
                </div>
                <Badge variant={product.marketplaceStockStatus === 'in_stock' ? 'default' : 'destructive'} className="ml-2 shrink-0">
                  {product.marketplaceStockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {product.images?.[0] && (
                <div className="aspect-video rounded-md overflow-hidden bg-muted">
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  Temu: ${parseFloat(product.marketplacePrice || '0').toFixed(2)}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ShoppingBag className="w-3 h-3" />
                  Your: ${parseFloat(product.sellingPrice || '0').toFixed(2)}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Package className="w-3 h-3" />
                  {product.variations?.length ?? 0} variants
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Image className="w-3 h-3" />
                  {product.images?.length ?? 0} images
                </div>
              </div>
              {product.lastMarketplaceSync && (
                <p className="text-[10px] text-muted-foreground">
                  Synced: {new Date(product.lastMarketplaceSync).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ProductDetailDialog
        product={selectedProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpscale={(url) => upscaleMutation.mutate(url)}
        onFindSimilar={(productId) => similarMutation.mutate(productId)}
        upscaling={upscaleMutation.isPending}
      />

      <SimilarResultsDialog
        results={similarResults}
        open={similarOpen}
        onOpenChange={setSimilarOpen}
        products={products}
      />
    </div>
  );
}

function ProductDetailDialog({
  product, open, onOpenChange, onUpscale, onFindSimilar, upscaling,
}: {
  product: any; open: boolean; onOpenChange: (open: boolean) => void;
  onUpscale: (url: string) => void;
  onFindSimilar: (productId: number) => void;
  upscaling: boolean;
}) {
  if (!product) return null;

  const variations = product.variations ?? [];
  const allImages = product.images ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <ScrollArea className="pr-4">
          <DialogHeader>
            <DialogTitle>{product.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Image Carousel */}
            {allImages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Image className="w-4 h-4" /> Gallery ({allImages.length})
                  </h4>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => onFindSimilar(product.id)}
                    disabled={upscaling}
                  >
                    <Search className="w-3.5 h-3.5 mr-1" />
                    Find Similar
                  </Button>
                </div>
                <Carousel className="w-full">
                  <CarouselContent>
                    {allImages.map((img: string, i: number) => (
                      <CarouselItem key={i}>
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border group">
                          <img
                            src={img}
                            alt={`${product.title} ${i + 1}`}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm" variant="secondary"
                              className="h-8 text-xs shadow-lg"
                              onClick={(e) => { e.stopPropagation(); onUpscale(img); }}
                              disabled={upscaling}
                            >
                              {upscaling ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3 mr-1" />
                              )}
                              AI Upscale
                            </Button>
                            <Button
                              size="sm" variant="secondary"
                              className="h-8 text-xs shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(img, '_blank');
                              }}
                            >
                              <ZoomIn className="w-3 h-3 mr-1" />
                              View Full
                            </Button>
                          </div>
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm">
                              {i + 1} / {allImages.length}
                            </Badge>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </Carousel>
                {/* Thumbnail strip */}
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                  {allImages.map((img: string, i: number) => (
                    <button
                      key={i}
                      className="shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 border-transparent hover:border-primary transition-colors bg-muted"
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Variations */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <PackageOpen className="w-4 h-4" /> Variations ({variations.length})
              </h4>
              {variations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Image</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variations.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell className="text-xs font-mono">{v.sku}</TableCell>
                        <TableCell>${parseFloat(v.price || '0').toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={v.stock > 0 ? 'outline' : 'destructive'} className="text-xs">
                            {v.stock > 0 ? v.stock : 'Out'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {v.image ? (
                            <img src={v.image} alt={v.name} className="w-10 h-10 rounded object-cover border" loading="lazy" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No variations</p>
              )}
            </div>

            <Separator />

            {/* Shipping Info */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4" /> Shipping Info
              </h4>
              {product.shippingInfo ? (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Est. Delivery</p>
                    <p className="font-medium">{product.shippingInfo.estimatedDays}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Shipping Cost</p>
                    <p className="font-medium">{product.shippingInfo.cost}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Origin</p>
                    <p className="font-medium">{product.shippingInfo.origin}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No shipping info</p>
              )}
            </div>

            <Separator />

            {/* Pricing */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4" /> Pricing
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Temu Price</p>
                  <p className="font-medium">${parseFloat(product.marketplacePrice || '0').toFixed(2)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Your Cost</p>
                  <p className="font-medium">${parseFloat(product.costPrice || '0').toFixed(2)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Your Selling Price</p>
                  <p className="font-medium">${parseFloat(product.sellingPrice || '0').toFixed(2)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Stock Status */}
            <div className="flex items-center gap-2 text-sm">
              <h4 className="font-medium">Stock Status:</h4>
              {product.marketplaceStockStatus === 'in_stock' ? (
                <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" /> In Stock on Temu</Badge>
              ) : product.marketplaceStockStatus === 'out_of_stock' ? (
                <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Out of Stock on Temu</Badge>
              ) : (
                <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" /> Unknown</Badge>
              )}
            </div>

            {/* Store Listings */}
            {product.listings && product.listings.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-4 h-4" /> Listed on Stores ({product.listings.length})
                  </h4>
                  <div className="space-y-1">
                    {product.listings.map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between text-sm bg-muted/20 px-3 py-2 rounded-lg">
                        <span>Store #{l.storeId}</span>
                        <Badge variant={l.status === 'active' ? 'default' : 'secondary'}>{l.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SimilarResultsDialog({
  results, open, onOpenChange, products,
}: {
  results: any[]; open: boolean; onOpenChange: (open: boolean) => void;
  products: any[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Similar Products</DialogTitle>
          <DialogDescription>
            Products that match in category, keywords, and price range
          </DialogDescription>
        </DialogHeader>
        {results.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Search className="w-8 h-8 mb-2" />
            <p>No similar products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {results.map((item: any) => (
              <Card key={item.productId} className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium leading-tight line-clamp-2">{item.title}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">${item.costPrice.toFixed(2)}</span>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
                      {(item.matchScore * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  {item.matchReasons && item.matchReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.matchReasons.slice(0, 2).map((r: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

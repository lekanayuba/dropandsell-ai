import { useStores, useCreateStore, useDeleteStore, useUpdateStore, useMarketplaceListings } from "@/hooks/use-stores";
import { useProducts } from "@/hooks/use-products";
import { useAuth } from "@/hooks/use-auth";
import { useStoreFilter } from "@/hooks/use-store-filter";
import { StoreFilterDropdown } from "@/components/StoreFilterDropdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Store, RefreshCw, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ExternalLink, Pencil, Link2, Download, ShoppingBag, ImageOff } from "lucide-react";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { SiShopify, SiAmazon, SiEbay, SiTiktok } from "react-icons/si";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStoreSchema, type InsertStore } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadExcel } from "@/lib/export-excel";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useFeatureAccess } from "@/hooks/use-feature-flags";

const EBAY_SITES = [
  { id: "3", label: "eBay UK", currency: "GBP", flag: "🇬🇧" },
  { id: "0", label: "eBay US", currency: "USD", flag: "🇺🇸" },
  { id: "205", label: "eBay Ireland", currency: "EUR", flag: "🇮🇪" },
  { id: "77", label: "eBay Germany", currency: "EUR", flag: "🇩🇪" },
  { id: "71", label: "eBay France", currency: "EUR", flag: "🇫🇷" },
  { id: "101", label: "eBay Italy", currency: "EUR", flag: "🇮🇹" },
  { id: "186", label: "eBay Spain", currency: "EUR", flag: "🇪🇸" },
  { id: "146", label: "eBay Netherlands", currency: "EUR", flag: "🇳🇱" },
  { id: "23", label: "eBay Belgium", currency: "EUR", flag: "🇧🇪" },
  { id: "16", label: "eBay Austria", currency: "EUR", flag: "🇦🇹" },
  { id: "193", label: "eBay Switzerland", currency: "CHF", flag: "🇨🇭" },
  { id: "212", label: "eBay Poland", currency: "PLN", flag: "🇵🇱" },
  { id: "216", label: "eBay Sweden", currency: "SEK", flag: "🇸🇪" },
  { id: "15", label: "eBay Australia", currency: "AUD", flag: "🇦🇺" },
  { id: "2", label: "eBay Canada", currency: "CAD", flag: "🇨🇦" },
  { id: "215", label: "eBay Singapore", currency: "SGD", flag: "🇸🇬" },
  { id: "211", label: "eBay Philippines", currency: "PHP", flag: "🇵🇭" },
];

const JUMIA_COUNTRIES = [
  { id: "ng", label: "Nigeria", currency: "NGN", flag: "🇳🇬" },
  { id: "ke", label: "Kenya", currency: "KES", flag: "🇰🇪" },
  { id: "gh", label: "Ghana", currency: "GHS", flag: "🇬🇭" },
  { id: "eg", label: "Egypt", currency: "EGP", flag: "🇪🇬" },
  { id: "ci", label: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮" },
  { id: "sn", label: "Senegal", currency: "XOF", flag: "🇸🇳" },
  { id: "cm", label: "Cameroon", currency: "XAF", flag: "🇨🇲" },
  { id: "ug", label: "Uganda", currency: "UGX", flag: "🇺🇬" },
  { id: "tz", label: "Tanzania", currency: "TZS", flag: "🇹🇿" },
  { id: "ma", label: "Morocco", currency: "MAD", flag: "🇲🇦" },
  { id: "tn", label: "Tunisia", currency: "TND", flag: "🇹🇳" },
  { id: "dz", label: "Algeria", currency: "DZD", flag: "🇩🇿" },
];

const JUMIA_API_URLS: Record<string, string> = {
  'ng': 'https://seller-api.jumia.com.ng',
  'ke': 'https://seller-api.jumia.co.ke',
  'gh': 'https://seller-api.jumia.com.gh',
  'eg': 'https://seller-api.jumia.com.eg',
  'ci': 'https://seller-api.jumia.ci',
  'sn': 'https://seller-api.jumia.sn',
  'cm': 'https://seller-api.jumia.cm',
  'ug': 'https://seller-api.jumia.ug',
  'tz': 'https://seller-api.jumia.co.tz',
  'ma': 'https://seller-api.jumia.ma',
  'tn': 'https://seller-api.jumia.com.tn',
  'dz': 'https://seller-api.jumia.dz',
};

export default function Stores() {
  const { data: stores, isLoading } = useStores();
  const { user } = useAuth();
  const storeLimit = (user as any)?.storeLimit || 2;
  const deleteStore = useDeleteStore();
  const { data: allListings, isLoading: listingsLoading } = useMarketplaceListings();
  const { data: products, isLoading: productsLoading } = useProducts({});
  const [open, setOpen] = useState(false);
  const [editStore, setEditStore] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<number, { checked: boolean; connected: boolean; status?: string; message?: string }>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasAccess: hasJumiaAccess } = useFeatureAccess('jumia_marketplace');
  const allStoreIds = (stores || []).map((s: any) => s.id);
  const storeFilter = useStoreFilter(allStoreIds);
  const filteredListings = storeFilter.hasMultipleStores && !storeFilter.isAllSelected
    ? (allListings || []).filter((l: any) => storeFilter.selectedStoreIds.includes(l.storeId))
    : allListings || [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ebaySuccess = params.get('ebay_success');
    const ebayError = params.get('ebay_error');

    if (ebaySuccess) {
      toast({ title: "eBay Connected", description: "Your eBay account has been connected successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      window.history.replaceState({}, '', '/stores');
    } else if (ebayError) {
      toast({ title: "eBay Connection Failed", description: decodeURIComponent(ebayError), variant: "destructive" });
      window.history.replaceState({}, '', '/stores');
    }
  }, []);

  useEffect(() => {
    if (!stores || stores.length === 0) return;
    stores.forEach((store) => {
      if (connectionStatus[store.id]?.checked) return;
      setConnectionStatus((prev) => ({ ...prev, [store.id]: { checked: false, connected: false } }));
      fetch(`/api/stores/${store.id}/test-connection`, { method: 'POST', credentials: 'include' })
        .then((res) => res.json())
        .then((data: { success: boolean; status?: string; message: string }) => {
          setConnectionStatus((prev) => ({ ...prev, [store.id]: { checked: true, connected: data.success, status: data.status, message: data.message } }));
        })
        .catch(() => {
          setConnectionStatus((prev) => ({ ...prev, [store.id]: { checked: true, connected: false, status: 'not_connected', message: 'Could not check connection' } }));
        });
    });
  }, [stores]);

  const handleRefreshConnection = (storeId: number) => {
    setConnectionStatus((prev) => ({ ...prev, [storeId]: { checked: false, connected: false } }));
    fetch(`/api/stores/${storeId}/test-connection`, { method: 'POST', credentials: 'include' })
      .then((res) => res.json())
      .then((data: { success: boolean; status?: string; message: string }) => {
        setConnectionStatus((prev) => ({ ...prev, [storeId]: { checked: true, connected: data.success, status: data.status, message: data.message } }));
        queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      })
      .catch(() => {
        setConnectionStatus((prev) => ({ ...prev, [storeId]: { checked: true, connected: false, status: 'not_connected', message: 'Could not check connection' } }));
      });
  };

  if (isLoading) return <div className="p-8">Loading stores...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">Stores</h2>
          <p className="text-muted-foreground mt-2">Manage your connected marketplaces and published listings</p>
        </div>
        <div className="flex items-center gap-2">
          <PageRefreshButton />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button 
                className="shadow-lg shadow-primary/20" 
                data-testid="button-connect-store-dialog"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Store
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Connect a New Store</DialogTitle>
                <DialogDescription>
                  {(stores?.length || 0) >= storeLimit 
                    ? `You've reached the limit of ${storeLimit} stores on your current plan. Please disconnect a store or upgrade your plan to connect more.`
                    : `${stores?.length || 0} of ${storeLimit} store connections used.`}
                </DialogDescription>
              </DialogHeader>
              {(stores?.length || 0) >= storeLimit ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Go to your connected stores and disconnect one to free up a slot, or upgrade your plan for more store connections.
                  </p>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                </div>
              ) : (
                <StoreForm onSuccess={() => setOpen(false)} />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="stores">
        <TabsList>
          <TabsTrigger value="stores" data-testid="tab-stores">Connected Stores</TabsTrigger>
          <TabsTrigger value="listings" data-testid="tab-listings">
            Published Listings {allListings?.length ? `(${allListings.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stores?.map((store) => (
              <Card key={store.id} className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-colors" data-testid={`card-store-${store.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-primary/5 rounded-lg">
                      {store.platform === 'shopify' ? <SiShopify className="w-6 h-6 text-green-600" /> :
                       store.platform === 'amazon' ? <SiAmazon className="w-6 h-6 text-orange-500" /> :
                       store.platform === 'ebay' ? <SiEbay className="w-6 h-6 text-blue-600" /> :
                       store.platform === 'tiktokshop' ? <SiTiktok className="w-6 h-6 text-black dark:text-white" /> :
                       store.platform === 'jumia' ? <ShoppingBag className="w-6 h-6 text-orange-500" /> :
                       <Store className="w-6 h-6 text-primary" />}
                    </div>
                    <Badge variant={store.status === 'active' ? 'default' : 'secondary'} className="capitalize" data-testid={`badge-status-${store.id}`}>
                      {store.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{store.name}</CardTitle>
                  {store.platform === 'ebay' && (store.credentials as any)?.ebayUsername && (
                    <p className="text-xs text-muted-foreground" data-testid={`text-ebay-username-${store.id}`}>@{(store.credentials as any).ebayUsername}</p>
                  )}
                  <CardDescription className="capitalize">
                    {store.platform === 'tiktokshop' ? 'TikTok Shop' : store.platform}
                    {store.platform === 'ebay' && (() => {
                      const siteId = (store.credentials as any)?.siteId;
                      const site = EBAY_SITES.find(s => s.id === siteId);
                      return site ? ` ${site.flag} ${site.currency}` : '';
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Last sync: {store.lastSync ? new Date(store.lastSync).toLocaleDateString() : 'Never'}
                  </div>
                  <div className="flex gap-2">
                    <div 
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        !connectionStatus[store.id]?.checked
                          ? 'border-border bg-muted/50 text-muted-foreground'
                          : connectionStatus[store.id]?.status === 'connected'
                            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                            : connectionStatus[store.id]?.status === 'invalid'
                              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                              : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
                      }`}
                      onClick={() => handleRefreshConnection(store.id)}
                      title={connectionStatus[store.id]?.message || 'Click to refresh'}
                      data-testid={`status-connection-${store.id}`}
                    >
                      {!connectionStatus[store.id]?.checked ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Checking...</>
                      ) : connectionStatus[store.id]?.status === 'connected' ? (
                        <><CheckCircle2 className="w-4 h-4" />Connected</>
                      ) : connectionStatus[store.id]?.status === 'invalid' ? (
                        <><AlertCircle className="w-4 h-4" />Invalid</>
                      ) : (
                        <><AlertCircle className="w-4 h-4" />Not Connected</>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() => { setEditStore(store); setEditOpen(true); }}
                      data-testid={`button-edit-store-${store.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteConfirmId(store.id)}
                      disabled={deleteStore.isPending}
                      data-testid={`button-delete-store-${store.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {stores?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-muted/20">
                <Store className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No stores connected</h3>
                <p className="text-muted-foreground mb-6 text-center max-w-sm">
                  Connect your Shopify, Amazon, or eBay store to start publishing products.
                </p>
                <Button onClick={() => setOpen(true)} data-testid="button-connect-first-store">Connect First Store</Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="listings" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Published Products</CardTitle>
                <CardDescription>Products currently listed on your connected marketplaces</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {storeFilter.hasMultipleStores && (
                  <StoreFilterDropdown
                    stores={(stores || []).map((s: any) => ({ id: s.id, name: s.name, platform: s.platform, status: s.status }))}
                    selectedStoreIds={storeFilter.selectedStoreIds}
                    onToggleStore={storeFilter.toggleStore}
                    onSelectAll={storeFilter.selectAll}
                    isAllSelected={storeFilter.isAllSelected}
                  />
                )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!filteredListings?.length) return;
                  const prods = products?.items || [];
                  downloadExcel(filteredListings.map((l: any) => {
                    const prod = prods.find((p: any) => p.id === l.productId);
                    return {
                      Product: prod?.title || `Product #${l.productId}`,
                      SKU: prod?.sku || '',
                      Store: l.storeName,
                      Platform: l.platform,
                      'Listing ID': l.externalId,
                      Status: l.status,
                      URL: l.listingUrl || '',
                    };
                  }), 'published-listings');
                }}
                disabled={!filteredListings?.length}
                data-testid="button-download-listings"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              </div>
            </CardHeader>
            <CardContent>
              {listingsLoading || productsLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Loading listings...</p>
                </div>
              ) : !filteredListings || filteredListings.length === 0 ? (
                <div className="text-center py-12">
                  <ExternalLink className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No published listings yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Publish products from the Inventory page to see them here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Listing ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.map((listing: any) => {
                      const product = products?.items.find((p: any) => p.id === listing.productId);
                      return (
                        <TableRow key={listing.id} data-testid={`row-listing-${listing.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {Array.isArray(product?.images) && product.images.length > 0 ? (
                                <img
                                  src={product.images[0]}
                                  alt={product?.title || ''}
                                  className="w-10 h-10 rounded-md object-cover border border-border flex-shrink-0"
                                  data-testid={`img-listing-${listing.id}`}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                  <ImageOff className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium truncate max-w-[180px]">{product?.title || `Product #${listing.productId}`}</p>
                                <p className="text-xs text-muted-foreground">{product?.sku || ''}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{listing.storeName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize gap-1">
                              {listing.platform === 'ebay' && <SiEbay className="w-3 h-3" />}
                              {listing.platform === 'shopify' && <SiShopify className="w-3 h-3" />}
                              {listing.platform === 'amazon' && <SiAmazon className="w-3 h-3" />}
                              {listing.platform === 'tiktokshop' && <SiTiktok className="w-3 h-3" />}
                              {listing.platform === 'jumia' && <ShoppingBag className="w-3 h-3" />}
                              {listing.platform === 'tiktokshop' ? 'TikTok Shop' : listing.platform}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{listing.externalId}</TableCell>
                          <TableCell>
                            <Badge variant={listing.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                              {listing.status === 'active' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              {listing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {listing.listingUrl ? (
                              <a
                                href={listing.listingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline text-sm inline-flex items-center gap-1"
                                data-testid={`link-listing-${listing.id}`}
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditStore(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Store Credentials</DialogTitle>
          </DialogHeader>
          {editStore && (
            <EditStoreForm
              store={editStore}
              onSuccess={() => { setEditOpen(false); setEditStore(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Disconnect Store</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{' '}
              <span className="font-semibold text-foreground">
                {stores?.find(s => s.id === deleteConfirmId)?.name}
              </span>
              ? This will remove the store connection and all associated listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId !== null) {
                  deleteStore.mutate(deleteConfirmId, {
                    onSuccess: () => setDeleteConfirmId(null),
                  });
                }
              }}
              disabled={deleteStore.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteStore.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Disconnecting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" />Disconnect Store</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditStoreForm({ store, onSuccess }: { store: any; onSuccess: () => void }) {
  const updateStore = useUpdateStore();
  const platform = store.platform;
  const creds = (store.credentials || {}) as any;

  const [ebaySiteId, setEbaySiteId] = useState(creds.siteId || "3");
  const [ebayUsername, setEbayUsername] = useState(creds.ebayUsername || "");
  const [ebayEmail, setEbayEmail] = useState(creds.ebayEmail || store.email || "");
  const [credError, setCredError] = useState("");
  const [storeName, setStoreName] = useState(store.name);

  const handleSave = () => {
    let credentials: any;
    if (platform === "ebay") {
      credentials = { ...creds, siteId: ebaySiteId, ebayUsername: creds.ebayUsername || ebayUsername, ebayEmail: creds.ebayEmail || ebayEmail };
    } else if (platform === "shopify") {
      credentials = creds;
    } else if (platform === "tiktokshop") {
      credentials = creds;
    } else if (platform === "amazon") {
      credentials = creds;
    }

    updateStore.mutate(
      { id: store.id, data: { name: storeName, credentials } },
      { onSuccess }
    );
  };

  const handleReconnectEbay = () => {
    if (!ebayUsername.trim() || !ebayEmail.trim()) {
      setCredError("eBay username and email are required to reconnect.");
      return;
    }
    setCredError("");
    window.location.href = `/api/ebay/auth?storeName=${encodeURIComponent(storeName)}&siteId=${encodeURIComponent(ebaySiteId)}&ebayUsername=${encodeURIComponent(ebayUsername)}&ebayEmail=${encodeURIComponent(ebayEmail)}`;
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-1">
        <Label className="text-sm">Store Name</Label>
        <Input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="Store name"
          data-testid="input-edit-store-name"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Platform:</span>
        <Badge variant="outline" className="capitalize">{platform}</Badge>
      </div>

      {credError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{credError}</AlertDescription>
        </Alert>
      )}

      {platform === "ebay" && (
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <SiEbay className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium">eBay Connection</p>
          </div>

          {creds.authToken && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Account connected via OAuth</span>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-sm">eBay Username</Label>
            <Input
              value={ebayUsername}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              placeholder="Your eBay username"
              data-testid="input-edit-ebay-username"
            />
            <p className="text-xs text-muted-foreground">Username is set during eBay connection and cannot be changed manually. To switch accounts, disconnect this store and create a new one.</p>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">eBay Email</Label>
            <Input
              value={ebayEmail}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              placeholder="Your eBay email address"
              type="email"
              data-testid="input-edit-ebay-email"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">eBay Site</Label>
            <Select value={ebaySiteId} onValueChange={setEbaySiteId}>
              <SelectTrigger data-testid="select-edit-ebay-site">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {EBAY_SITES.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.flag} {site.label} ({site.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleReconnectEbay}
            data-testid="button-reconnect-ebay"
          >
            <Link2 className="w-4 h-4 mr-2" />
            {creds.authToken ? "Reconnect eBay Account" : "Connect eBay Account"}
          </Button>
        </div>
      )}

      {platform === "shopify" && (
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <SiShopify className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium">Shopify Connection</p>
          </div>
          {creds.accessToken && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">
                Account connected via OAuth{creds.shopName ? ` — ${creds.shopName}` : creds.shopDomain ? ` — ${creds.shopDomain}` : ''}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              const domain = creds.shopDomain || '';
              window.location.href = `/api/shopify/auth?storeName=${encodeURIComponent(storeName)}&shopDomain=${encodeURIComponent(domain)}`;
            }}
            data-testid="button-reconnect-shopify"
          >
            <SiShopify className="w-4 h-4 mr-2" />
            {creds.accessToken ? "Reconnect Shopify Store" : "Connect Shopify Store"}
          </Button>
        </div>
      )}

      {platform === "amazon" && (
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <SiAmazon className="w-5 h-5 text-orange-500" />
            <p className="text-sm font-medium">Amazon Seller Details</p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Seller ID</Label>
            <Input
              value={creds.sellerId || ""}
              readOnly
              className="bg-muted"
              data-testid="input-edit-amazon-seller-id"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Email Address</Label>
            <Input
              value={creds.email || ""}
              readOnly
              className="bg-muted"
              data-testid="input-edit-amazon-email"
            />
          </div>
        </div>
      )}

      {platform === "tiktokshop" && (
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <SiTiktok className="w-5 h-5" />
            <p className="text-sm font-medium">TikTok Shop Connection</p>
          </div>
          {creds.accessToken && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">
                Account connected via OAuth{creds.shopName ? ` — ${creds.shopName}` : ''}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = `/api/tiktok/auth?storeName=${encodeURIComponent(storeName)}`;
            }}
            data-testid="button-reconnect-tiktok"
          >
            <SiTiktok className="w-4 h-4 mr-2" />
            {creds.accessToken ? "Reconnect TikTok Shop" : "Connect TikTok Shop"}
          </Button>
        </div>
      )}

      {platform === "jumia" && (
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-500" />
            <p className="text-sm font-medium">Jumia Connection</p>
          </div>
          {creds.apiKey && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Connected to Jumia {JUMIA_COUNTRIES.find(c => c.id === creds.country)?.label || ''}</span>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-sm">Seller Email / User ID</Label>
            <Input
              value={creds.userId || ""}
              readOnly
              className="bg-muted"
              data-testid="input-edit-jumia-user-id"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Country</Label>
            <Input
              value={JUMIA_COUNTRIES.find(c => c.id === creds.country)?.label || creds.country || ""}
              readOnly
              className="bg-muted"
              data-testid="input-edit-jumia-country"
            />
          </div>
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleSave}
        disabled={updateStore.isPending}
        data-testid="button-save-store"
      >
        {updateStore.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

function CredentialInput({ label, value, onChange, placeholder, helpText, required = true }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  helpText?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-sm">
        {label}
        {!required && <span className="text-muted-foreground ml-1">(optional)</span>}
      </Label>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={`input-cred-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => setVisible(!visible)}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function StoreForm({ onSuccess }: { onSuccess: () => void }) {
  const createStore = useCreateStore();
  const { hasAccess: hasJumiaAccess } = useFeatureAccess('jumia_marketplace');
  const form = useForm<InsertStore>({
    resolver: zodResolver(insertStoreSchema),
    defaultValues: {
      name: "",
      platform: "ebay",
      credentials: {},
      status: "active"
    }
  });

  const platform = form.watch("platform");

  const [ebayStoreName, setEbayStoreName] = useState("My eBay Store");
  const [ebayUsername, setEbayUsername] = useState("");
  const [ebayEmail, setEbayEmail] = useState("");
  const [ebaySiteId, setEbaySiteId] = useState("3");

  const [amazonMarketplace, setAmazonMarketplace] = useState("uk");
  const [amazonStoreName, setAmazonStoreName] = useState("My Amazon Store");

  const [tiktokStoreName, setTiktokStoreName] = useState("My TikTok Shop");

  const [shopifyStoreName, setShopifyStoreName] = useState("My Shopify Store");
  const [shopifyDomain, setShopifyDomain] = useState("");

  const [jumiaStoreName, setJumiaStoreName] = useState("My Jumia Store");
  const [jumiaCountry, setJumiaCountry] = useState("ng");
  const [jumiaApiKey, setJumiaApiKey] = useState("");
  const [jumiaUserId, setJumiaUserId] = useState("");

  const [credError, setCredError] = useState("");

  const handleShopifyOAuth = () => {
    if (!shopifyStoreName.trim()) {
      setCredError("Please enter a store name.");
      return;
    }
    if (!shopifyDomain.trim()) {
      setCredError("Please enter your Shopify store domain.");
      return;
    }
    setCredError("");
    window.location.href = `/api/shopify/auth?storeName=${encodeURIComponent(shopifyStoreName)}&shopDomain=${encodeURIComponent(shopifyDomain)}`;
  };

  const handleTikTokOAuth = () => {
    if (!tiktokStoreName.trim()) {
      setCredError("Please enter a store name.");
      return;
    }
    setCredError("");
    window.location.href = `/api/tiktok/auth?storeName=${encodeURIComponent(tiktokStoreName)}`;
  };

  const handleEbayOAuth = () => {
    if (!ebayStoreName.trim()) {
      setCredError("Please enter a store name.");
      return;
    }
    if (!ebayUsername.trim()) {
      setCredError("Please enter your eBay username.");
      return;
    }
    if (!ebayEmail.trim()) {
      setCredError("Please enter the email address linked to this eBay account.");
      return;
    }
    setCredError("");
    window.location.href = `/api/ebay/auth?storeName=${encodeURIComponent(ebayStoreName)}&siteId=${encodeURIComponent(ebaySiteId)}&ebayUsername=${encodeURIComponent(ebayUsername)}&ebayEmail=${encodeURIComponent(ebayEmail)}`;
  };

  const onSubmit = (data: InsertStore) => {
    if (platform === "ebay") {
      handleEbayOAuth();
      return;
    }

    if (platform === "tiktokshop") {
      handleTikTokOAuth();
      return;
    }

    if (platform === "shopify") {
      handleShopifyOAuth();
      return;
    }

    if (platform === "jumia") {
      if (!jumiaApiKey.trim()) {
        setCredError("Please enter your Jumia API Key.");
        return;
      }
      if (!jumiaUserId.trim()) {
        setCredError("Please enter your Jumia Seller Email / User ID.");
        return;
      }
      setCredError("");
      const apiUrl = JUMIA_API_URLS[jumiaCountry] || JUMIA_API_URLS['ng'];
      const credentials = {
        apiKey: jumiaApiKey.trim(),
        userId: jumiaUserId.trim(),
        apiUrl,
        country: jumiaCountry,
      };
      const country = JUMIA_COUNTRIES.find(c => c.id === jumiaCountry);
      const storeName = jumiaStoreName.trim() || `Jumia ${country?.label || 'Store'}`;
      createStore.mutate({ ...data, name: storeName, platform: 'jumia', credentials }, { onSuccess });
      return;
    }

  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <FormField
          control={form.control}
          name="platform"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Platform</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ebay">eBay</SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="tiktokshop">TikTok Shop</SelectItem>
                  {hasJumiaAccess && <SelectItem value="jumia">Jumia</SelectItem>}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {credError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{credError}</AlertDescription>
          </Alert>
        )}

        {platform === "ebay" && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <SiEbay className="w-6 h-6 text-blue-600" />
              <p className="text-sm font-medium">Connect Your eBay Account</p>
            </div>
            <p className="text-xs text-muted-foreground">
              You'll be redirected to eBay to securely authorize DropandSell Automation App to manage your listings. No API keys needed.
            </p>

            <div className="space-y-1">
              <Label className="text-sm">eBay Username</Label>
              <Input
                value={ebayUsername}
                onChange={(e) => setEbayUsername(e.target.value)}
                placeholder="your_ebay_username"
                data-testid="input-ebay-username"
              />
              <p className="text-xs text-muted-foreground">Your eBay account username (seller ID)</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">eBay Email Address</Label>
              <Input
                type="email"
                value={ebayEmail}
                onChange={(e) => setEbayEmail(e.target.value)}
                placeholder="your.email@example.com"
                data-testid="input-ebay-email"
              />
              <p className="text-xs text-muted-foreground">The email address linked to this eBay account</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Store Name</Label>
              <Input
                value={ebayStoreName}
                onChange={(e) => setEbayStoreName(e.target.value)}
                placeholder="My eBay Store"
                data-testid="input-ebay-store-name"
              />
              <p className="text-xs text-muted-foreground">A friendly name for this store (e.g. "My eBay UK")</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">eBay Site</Label>
              <Select value={ebaySiteId} onValueChange={setEbaySiteId}>
                <SelectTrigger data-testid="select-ebay-site">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {EBAY_SITES.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.flag} {site.label} ({site.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select the eBay marketplace for your location</p>
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={handleEbayOAuth}
              data-testid="button-connect-ebay-oauth"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Connect to eBay
            </Button>
          </div>
        )}

        {platform === "shopify" && (
          <>
            <div className="space-y-3">
              <Label className="text-sm">Store Name</Label>
              <Input
                value={shopifyStoreName}
                onChange={(e) => setShopifyStoreName(e.target.value)}
                placeholder="My Shopify Store"
                data-testid="input-shopify-store-name"
              />
            </div>
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <SiShopify className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium">Connect via Shopify</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your Shopify store domain below, then click Connect. You'll be redirected to Shopify to authorize access, then brought back automatically.
              </p>
              <div className="space-y-1">
                <Label className="text-sm">Shop Domain</Label>
                <Input
                  value={shopifyDomain}
                  onChange={(e) => setShopifyDomain(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  data-testid="input-shopify-domain"
                />
                <p className="text-xs text-muted-foreground">Your Shopify store URL (e.g. your-store.myshopify.com or just your-store)</p>
              </div>
            </div>
            <Button type="submit" className="w-full" data-testid="button-connect-shopify-store">
              <SiShopify className="w-4 h-4 mr-2" />
              Connect Shopify Store
            </Button>
          </>
        )}

        {platform === "amazon" && (
          <>
            <div className="space-y-1">
              <Label className="text-sm">Store Name</Label>
              <Input
                value={amazonStoreName}
                onChange={(e) => setAmazonStoreName(e.target.value)}
                placeholder="My Amazon Store"
                data-testid="input-store-name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Amazon Marketplace</Label>
              <Select value={amazonMarketplace} onValueChange={setAmazonMarketplace}>
                <SelectTrigger data-testid="select-amazon-marketplace">
                  <SelectValue placeholder="Select your marketplace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uk">United Kingdom (amazon.co.uk)</SelectItem>
                  <SelectItem value="us">United States (amazon.com)</SelectItem>
                  <SelectItem value="de">Germany (amazon.de)</SelectItem>
                  <SelectItem value="fr">France (amazon.fr)</SelectItem>
                  <SelectItem value="ca">Canada (amazon.ca)</SelectItem>
                  <SelectItem value="it">Italy (amazon.it)</SelectItem>
                  <SelectItem value="es">Spain (amazon.es)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <SiAmazon className="w-5 h-5 text-orange-500" />
                <p className="text-sm font-medium">Sign in with Amazon</p>
              </div>
              <p className="text-xs text-muted-foreground">
                You'll be taken to Amazon Seller Central to securely approve access. We never see your Amazon password.
              </p>
            </div>
            {credError && <p className="text-sm text-red-500">{credError}</p>}
            <Button
              type="button"
              className="w-full bg-orange-500 hover:bg-orange-600"
              data-testid="button-connect-amazon"
              onClick={() => {
                const params = new URLSearchParams({
                  marketplace: amazonMarketplace,
                  storeName: amazonStoreName.trim() || "My Amazon Store",
                });
                window.location.href = `/api/amazon/auth?${params.toString()}`;
              }}
            >
              <SiAmazon className="w-4 h-4 mr-2" />
              Connect with Amazon
            </Button>
          </>
        )}

        {platform === "tiktokshop" && (
          <>
            <div className="space-y-3">
              <Label className="text-sm">Store Name</Label>
              <Input
                value={tiktokStoreName}
                onChange={(e) => setTiktokStoreName(e.target.value)}
                placeholder="My TikTok Shop"
                data-testid="input-tiktok-store-name"
              />
            </div>
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <SiTiktok className="w-5 h-5" />
                <p className="text-sm font-medium">Connect via TikTok Shop</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the button below to securely connect your TikTok Shop account. You'll be redirected to TikTok to authorize access, then brought back automatically.
              </p>
            </div>
            <Button type="submit" className="w-full" data-testid="button-connect-tiktok-store">
              <SiTiktok className="w-4 h-4 mr-2" />
              Connect TikTok Shop
            </Button>
          </>
        )}

        {platform === "jumia" && (
          <>
            <div className="space-y-3">
              <Label className="text-sm">Store Name</Label>
              <Input
                value={jumiaStoreName}
                onChange={(e) => setJumiaStoreName(e.target.value)}
                placeholder="My Jumia Store"
                data-testid="input-jumia-store-name"
              />
            </div>
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
                <p className="text-sm font-medium">Connect Your Jumia Seller Account</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your Jumia Seller Center API credentials below. You can find your API Key in Jumia Seller Center under Settings → Integration Management → API tab.
              </p>

              <div className="space-y-1">
                <Label className="text-sm">Country <span className="text-red-500">*</span></Label>
                <Select value={jumiaCountry} onValueChange={setJumiaCountry}>
                  <SelectTrigger data-testid="select-jumia-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {JUMIA_COUNTRIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.flag} {c.label} ({c.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select the Jumia marketplace country</p>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Seller Email / User ID <span className="text-red-500">*</span></Label>
                <Input
                  value={jumiaUserId}
                  onChange={(e) => setJumiaUserId(e.target.value)}
                  placeholder="your.seller@email.com"
                  data-testid="input-jumia-user-id"
                />
                <p className="text-xs text-muted-foreground">The email used to log in to Jumia Seller Center</p>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">API Key <span className="text-red-500">*</span></Label>
                <Input
                  type="password"
                  value={jumiaApiKey}
                  onChange={(e) => setJumiaApiKey(e.target.value)}
                  placeholder="Your Jumia API Key"
                  data-testid="input-jumia-api-key"
                />
                <p className="text-xs text-muted-foreground">Found in Seller Center → Settings → Integration Management → API</p>
              </div>
            </div>
            {credError && <p className="text-sm text-red-500">{credError}</p>}
            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={createStore.isPending}
              data-testid="button-connect-jumia"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              {createStore.isPending ? "Connecting..." : "Connect Jumia Store"}
            </Button>
          </>
        )}
      </form>
    </Form>
  );
}

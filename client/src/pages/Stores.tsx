import { useStores, useCreateStore, useDeleteStore } from "@/hooks/use-stores";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Store, RefreshCw, Loader2, History, Lock, Unlock, CheckCircle2, AlertCircle, PauseCircle, AlertTriangle, ArrowLeftRight, ListX, Globe, ShoppingBag, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStoreSchema, type InsertStore } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString();
}

export default function Stores() {
  const { data: stores, isLoading } = useStores();
  const { user } = useAuth();
  const deleteStore = useDeleteStore();
  const [open, setOpen] = useState(false);
  const [logsStoreId, setLogsStoreId] = useState<number | null>(null);
  const [listingsStoreId, setListingsStoreId] = useState<number | null>(null);
  const [syncingStoreIds, setSyncingStoreIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isSubscriber = user?.subscriptionStatus === 'active';

  // Listen for OAuth popup success → refresh stores data and close popup
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'ebay-oauth-success' || e.data === 'shopify-oauth-success' || e.data === 'amazon-oauth-success') {
        queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
        toast({ title: "Authorization successful", description: "Store credentials updated." });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [queryClient, toast]);

  // Poll sync status every 10s for stores that might be syncing
  useEffect(() => {
    if (syncingStoreIds.size === 0) return;
    const interval = setInterval(async () => {
      for (const storeId of syncingStoreIds) {
        try {
          const res = await fetch(`/api/stores/${storeId}/sync-status`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            if (!data.syncing) {
              setSyncingStoreIds(prev => { const next = new Set(prev); next.delete(storeId); return next; });
              queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
            }
          }
        } catch { /* ignore */}
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [syncingStoreIds, queryClient]);

  const syncMutation = useMutation({
    mutationFn: async (storeId: number) => {
      setSyncingStoreIds(prev => new Set(prev).add(storeId));
      const res = await fetch(`/api/stores/${storeId}/sync`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Sync failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
      toast({ title: "Sync Complete", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
    onSettled: (_data, _error, storeId) => {
      setSyncingStoreIds(prev => { const next = new Set(prev); next.delete(storeId); return next; });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/stores/sync-all', { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Sync all failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
      toast({
        title: "All Stores Synced",
        description: `${data.storesSynced} synced, ${data.storesFailed} failed out of ${data.totalStores}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const isAnySyncing = syncMutation.isPending || syncAllMutation.isPending || syncingStoreIds.size > 0;

  const autoSettingsMutation = useMutation({
    mutationFn: async ({ storeId, settings }: { storeId: number; settings: Record<string, boolean | number> }) => {
      const res = await fetch(`/api/stores/${storeId}/auto-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update auto-settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-8">Loading stores...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Stores</h2>
          <p className="text-muted-foreground mt-2">Manage your connected marketplaces</p>
        </div>
        <div className="flex gap-2">
          {stores && stores.length > 0 && (
            <Button
              variant="outline"
              onClick={() => syncAllMutation.mutate()}
              disabled={isAnySyncing}
            >
              {syncAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync All
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                Connect Store
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect New Store</DialogTitle>
              </DialogHeader>
              <StoreForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isAnySyncing && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
          <Loader2 className="w-4 h-4 animate-spin" />
          Syncing stores in the background&hellip;
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stores?.map((store) => (
          <StoreCard
            key={store.id}
            store={store}
            isSubscriber={isSubscriber}
            isSyncing={syncingStoreIds.has(store.id) || syncMutation.isPending}
            onSync={() => syncMutation.mutate(store.id)}
            onDelete={() => deleteStore.mutate(store.id)}
            onAutoSetting={(setting, enabled) => autoSettingsMutation.mutate({ storeId: store.id, settings: { [setting]: enabled } })}
            onShowLogs={() => setLogsStoreId(store.id)}
            onShowListings={() => setListingsStoreId(store.id)}
            autoSettingsPending={autoSettingsMutation.isPending}
            deletePending={deleteStore.isPending}
          />
        ))}
        {stores?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-muted/20">
            <Store className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No stores connected</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-sm">
              Connect your Shopify, Amazon, eBay, Jumia, or WooCommerce store to start syncing products.
            </p>
            <Button onClick={() => setOpen(true)}>Connect First Store</Button>
          </div>
        )}
      </div>

      <RestockLogsDialog
        storeId={logsStoreId}
        onClose={() => setLogsStoreId(null)}
        storeName={stores?.find(s => s.id === logsStoreId)?.name ?? ''}
      />
      <ListingsDialog
        storeId={listingsStoreId}
        onClose={() => setListingsStoreId(null)}
        storeName={stores?.find(s => s.id === listingsStoreId)?.name ?? ''}
      />
    </div>
  );
}

const autoSettings = [
  { key: 'autoRestock', label: 'Auto-Restock', icon: RefreshCw },
  { key: 'autoPauseListings', label: 'Auto-Pause Listings', icon: PauseCircle },
  { key: 'autoMarkOutOfStock', label: 'Auto-Mark Out of Stock', icon: AlertTriangle },
  { key: 'autoSwitchSupplier', label: 'Auto-Switch Supplier', icon: ArrowLeftRight },
] as const;

const platformMeta: Record<string, { icon: React.ElementType; color: string }> = {
  shopify: { icon: ShoppingBag, color: 'text-green-600 bg-green-100 dark:bg-green-950/30' },
  amazon: { icon: Store, color: 'text-orange-600 bg-orange-100 dark:bg-orange-950/30' },
  ebay: { icon: Store, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/30' },
  jumia: { icon: Globe, color: 'text-orange-600 bg-orange-100 dark:bg-orange-950/30' },
  woocommerce: { icon: ShoppingBag, color: 'text-purple-600 bg-purple-100 dark:bg-purple-950/30' },
};

function OAuthStoreSection({ store }: { store: any }) {
  const creds = (store.credentials as any) || {};
  const plat = store.platform;

  const isAuthorized = plat === 'ebay' ? !!creds?.ebayRefreshToken
    : plat === 'shopify' ? !!creds?.accessToken
    : plat === 'woocommerce' ? !!(creds?.consumerKey && creds?.consumerSecret)
    : false;

  const authUrl = plat === 'ebay' ? `/api/ebay/auth?storeId=${store.id}`
    : plat === 'shopify' ? `/api/oauth/shopify/auth?storeId=${store.id}`
    : plat === 'woocommerce' ? `/api/oauth/woocommerce/auth?storeId=${store.id}`
    : plat === 'amazon' ? `/api/oauth/amazon/auth?storeId=${store.id}`
    : plat === 'jumia' ? `/api/oauth/jumia/auth?storeId=${store.id}`
    : null;

  const platformLabel = plat.charAt(0).toUpperCase() + plat.slice(1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg text-sm">
        <span className="text-muted-foreground">{platformLabel} Auth</span>
        {isAuthorized ? (
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Authorized
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <AlertCircle className="w-3 h-3" /> Not Authorized
          </Badge>
        )}
      </div>
      {authUrl && (
        <Button
          variant={isAuthorized ? "outline" : "default"}
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => window.open(authUrl, '_blank')}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {isAuthorized ? `Re-authorize with ${platformLabel}` : `Authorize with ${platformLabel}`}
        </Button>
      )}
    </div>
  );
}

function StoreCard({
  store, isSubscriber, isSyncing, onSync, onDelete, onAutoSetting, onShowLogs, onShowListings, autoSettingsPending, deletePending,
}: {
  store: any;
  isSubscriber: boolean;
  isSyncing: boolean;
  onSync: () => void;
  onDelete: () => void;
  onAutoSetting: (key: string, enabled: boolean) => void;
  onShowLogs: () => void;
  onShowListings: () => void;
  autoSettingsPending: boolean;
  deletePending: boolean;
}) {
  const { toast } = useToast();

  function handleToggle(key: string, checked: boolean) {
    if (!isSubscriber) {
      toast({
        title: "Subscriber Feature",
        description: "Auto-settings are only available on paid plans. Upgrade to enable.",
        variant: "destructive",
      });
      return;
    }
    onAutoSetting(key, checked);
  }

      const PlatMeta = platformMeta[store.platform] ?? platformMeta.shopify;
  const PlatIcon = PlatMeta.icon;

  return (
    <Card className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-colors">
      {isSyncing && (
        <div className="absolute inset-0 bg-primary/5 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-background/80 px-4 py-2 rounded-full shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary">Syncing&hellip;</span>
          </div>
        </div>
      )}
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className={`p-2 rounded-lg ${PlatMeta.color}`}>
            <PlatIcon className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            {store.lastSync && (
              <Badge variant="outline" className="text-xs font-mono bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Synced
              </Badge>
            )}
            <Badge variant={store.status === 'active' ? 'default' : 'secondary'} className="capitalize">
              {store.status}
            </Badge>
          </div>
        </div>
        <CardTitle className="mt-4">{store.name}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="capitalize">{store.platform}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <OAuthStoreSection store={store} />
        <div className="flex items-center text-sm">
          <RefreshCw className={`w-3 h-3 mr-2 ${isSyncing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          {store.lastSync ? (
            <span className={isSyncing ? 'text-primary font-medium' : 'text-muted-foreground'}>
              {isSyncing ? 'Syncing now&hellip;' : `Last sync: ${timeAgo(store.lastSync)}`}
            </span>
          ) : (
            <span className="text-muted-foreground">Never synced</span>
          )}
        </div>

        <div className="space-y-2">
          {autoSettings.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                {isSubscriber ? (
                  <Unlock className="w-4 h-4 text-green-500" />
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                )}
                <Icon className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium cursor-pointer">{label}</Label>
              </div>
              <Switch
                checked={(store as any)[key] ?? false}
                disabled={!isSubscriber || autoSettingsPending}
                onCheckedChange={(checked) => handleToggle(key, checked)}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync Now
          </Button>
          <Button variant="outline" size="icon" onClick={onShowLogs} title="Restock History">
            <History className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onShowListings} title="View Listings">
            <ListX className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete} disabled={deletePending}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RestockLogsDialog({
  storeId, onClose, storeName,
}: {
  storeId: number | null; onClose: () => void; storeName: string;
}) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['restock-logs', storeId],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/restock-logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch restock logs");
      return res.json();
    },
    enabled: !!storeId,
  });

  return (
    <Dialog open={!!storeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Restock History — {storeName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : logs && logs.length > 0 ? (
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Previous Qty</TableHead>
                  <TableHead>New Qty</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>#{log.productId}</TableCell>
                    <TableCell>{log.previousQuantity}</TableCell>
                    <TableCell>{log.newQuantity}</TableCell>
                    <TableCell>
                      <Badge variant={log.triggeredBy === 'auto' ? 'secondary' : 'default'}>
                        {log.triggeredBy === 'auto' ? 'Auto' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-center py-8">No restock events recorded yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ListingsDialog({
  storeId, onClose, storeName,
}: {
  storeId: number | null; onClose: () => void; storeName: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: listings, isLoading } = useQuery({
    queryKey: ['store-listings', storeId],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/listings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json();
    },
    enabled: !!storeId,
  });

  const endListingMutation = useMutation({
    mutationFn: async (listingId: number) => {
      const res = await fetch(`/api/marketplace-listings/${listingId}/end`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to end listing");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-listings', storeId] });
      toast({ title: "Listing ended" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkEndMutation = useMutation({
    mutationFn: async () => {
      const ids = listings?.filter((l: any) => l.status === 'active').map((l: any) => l.id) ?? [];
      if (ids.length === 0) throw new Error("No active listings to end");
      const res = await fetch('/api/marketplace-listings/bulk-end', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: ids }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to end listings");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['store-listings', storeId] });
      toast({ title: `${data.ended} listing${data.ended !== 1 ? 's' : ''} ended` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const activeCount = listings?.filter((l: any) => l.status === 'active').length ?? 0;

  return (
    <Dialog open={!!storeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Listings — {storeName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : listings && listings.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{activeCount} active / {listings.length} total</p>
              {activeCount > 0 && (
                <Button
                  variant="destructive" size="sm"
                  onClick={() => bulkEndMutation.mutate()}
                  disabled={bulkEndMutation.isPending}
                >
                  {bulkEndMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ListX className="w-3 h-3 mr-1" />}
                  End All Active
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((listing: any) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-medium">
                        {listing.product?.title ?? `#${listing.productId}`}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {listing.externalId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                          {listing.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={listing.stockStatus === 'in_stock' ? 'outline' : 'destructive'}>
                          {listing.stockStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {listing.lastSync ? new Date(listing.lastSync).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {listing.status === 'active' && (
                          <Button
                            variant="outline" size="sm"
                            onClick={() => endListingMutation.mutate(listing.id)}
                            disabled={endListingMutation.isPending}
                          >
                            End
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        ) : (
          <p className="text-muted-foreground text-center py-8">No listings yet. Publish products to create listings.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StoreForm({ onSuccess }: { onSuccess: () => void }) {
  const createStore = useCreateStore();
  const form = useForm<InsertStore>({
    resolver: zodResolver(insertStoreSchema),
    defaultValues: { name: "", platform: "shopify", credentials: {}, status: "active" },
  });
  const plat = form.watch('platform');

  function getOAuthUrl(storeId: number, platform: string): string | null {
    const urls: Record<string, string> = {
      ebay: `/api/ebay/auth?storeId=${storeId}`,
      shopify: `/api/oauth/shopify/auth?storeId=${storeId}`,
      woocommerce: `/api/oauth/woocommerce/auth?storeId=${storeId}`,
      amazon: `/api/oauth/amazon/auth?storeId=${storeId}`,
      jumia: `/api/oauth/jumia/auth?storeId=${storeId}`,
    };
    return urls[platform] || null;
  }

  const onSubmit = (data: InsertStore) => {
    data.credentials = {};
    createStore.mutate(data, {
      onSuccess: (store) => {
        onSuccess();
        const authUrl = getOAuthUrl(store.id, store.platform);
        if (authUrl) {
          window.open(authUrl, '_blank');
        }
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="platform" render={({ field }) => (
          <FormItem>
            <FormLabel>Platform</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="ebay">eBay</SelectItem>
                <SelectItem value="jumia">Jumia</SelectItem>
                <SelectItem value="woocommerce">WooCommerce</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Store Name</FormLabel>
            <FormControl><Input placeholder="My Awesome Store" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p>After connecting, you'll be redirected to {plat.charAt(0).toUpperCase() + plat.slice(1)} to authorize access.</p>
          <p>API credentials are configured by the admin in Settings &gt; Integrations.</p>
        </div>
        <Button type="submit" className="w-full" disabled={createStore.isPending}>
          {createStore.isPending ? "Creating..." : "Connect Store"}
        </Button>
      </form>
    </Form>
  );
}

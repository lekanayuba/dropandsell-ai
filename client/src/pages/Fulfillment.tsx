import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { useCurrency } from "@/hooks/use-currency";
import {
  Link2, CreditCard, History, Plus, Trash2, Loader2,
  CheckCircle2, XCircle, Clock, RefreshCw, Settings2,
  Zap, ArrowRightLeft, Star, ToggleLeft, AlertTriangle, Pencil
} from "lucide-react";

export default function Fulfillment() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { format: fc } = useCurrency();
  const [activeTab, setActiveTab] = useState("sku-mappings");
  const [skuDialogOpen, setSkuDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

  const [newSku, setNewSku] = useState({ ebaySku: '', vendorSku: '', vendorName: '', vendorProductUrl: '', costPrice: '', priceThreshold: '' });
  const [newCard, setNewCard] = useState({ lastFour: '', brand: 'visa', expiryMonth: '', expiryYear: '', tokenizedId: '', isDefault: false });
  const [editSkuDialogOpen, setEditSkuDialogOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<any>(null);
  const [skuFilter, setSkuFilter] = useState<'all' | 'unmapped' | 'mapped'>('all');

  const isAdmin = user?.isAdmin === 'true' || user?.email === 'dropandsellauth@gmail.com';

  const { data: skuMappings, isLoading: skuLoading } = useQuery<any[]>({ queryKey: ['/api/sku-mappings'] });
  const { data: paymentCards, isLoading: cardsLoading } = useQuery<any[]>({ queryKey: ['/api/payment-cards'] });
  const { data: fulfillmentJobs, isLoading: jobsLoading } = useQuery<any[]>({ queryKey: ['/api/fulfillment-jobs'] });
  const { data: auditLogs, isLoading: logsLoading } = useQuery<any[]>({ queryKey: ['/api/audit-logs'] });
  const { data: walletPayment } = useQuery<any>({ queryKey: ['/api/wallet/payment-methods'] });
  const createSkuMapping = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/sku-mappings', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sku-mappings'] });
      setSkuDialogOpen(false);
      setNewSku({ ebaySku: '', vendorSku: '', vendorName: '', vendorProductUrl: '', costPrice: '', priceThreshold: '' });
      toast({ title: "SKU Mapping Created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSkuMapping = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/sku-mappings/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sku-mappings'] });
      toast({ title: "SKU Mapping Deleted" });
    },
  });

  const autoGenerateMappings = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sku-mappings/auto-generate');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sku-mappings'] });
      toast({ title: "Auto-Generate Complete", description: `${data.created} new mapping${data.created !== 1 ? 's' : ''} created, ${data.skipped} skipped (${data.total} products scanned)` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSkuMapping = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/sku-mappings/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sku-mappings'] });
      setEditSkuDialogOpen(false);
      setEditingSku(null);
      toast({ title: "SKU Mapping Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isUnmapped = (m: any) => !m.vendorSku && !m.vendorProductUrl;

  const filteredMappings = (skuMappings || []).filter((m: any) => {
    if (skuFilter === 'unmapped') return isUnmapped(m);
    if (skuFilter === 'mapped') return !isUnmapped(m);
    return true;
  });

  const unmappedCount = (skuMappings || []).filter(isUnmapped).length;

  const createPaymentCard = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/payment-cards', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-cards'] });
      setCardDialogOpen(false);
      setNewCard({ lastFour: '', brand: 'visa', expiryMonth: '', expiryYear: '', tokenizedId: '', isDefault: false });
      toast({ title: "Payment Card Added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deletePaymentCard = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/payment-cards/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-cards'] });
      toast({ title: "Payment Card Removed" });
    },
  });

  const setDefaultCard = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/payment-cards/${id}`, { isDefault: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-cards'] });
      toast({ title: "Default Card Updated" });
    },
  });

  const retryFulfillment = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/fulfillment-jobs/${id}/retry`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fulfillment-jobs'] });
      toast({ title: "Fulfillment Retried" });
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight" data-testid="text-fulfillment-title">Fulfillment</h2>
          <p className="text-muted-foreground mt-2">Manage automated order fulfillment, SKU mappings, and payment methods</p>
        </div>
        <PageRefreshButton />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="sku-mappings" data-testid="tab-sku-mappings">
            <Link2 className="w-4 h-4 mr-1 hidden sm:inline" /> SKU Maps
          </TabsTrigger>
          <TabsTrigger value="payment" data-testid="tab-payment">
            <CreditCard className="w-4 h-4 mr-1 hidden sm:inline" /> Payment
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Zap className="w-4 h-4 mr-1 hidden sm:inline" /> Jobs
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="w-4 h-4 mr-1 hidden sm:inline" /> Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sku-mappings" className="space-y-4">
          {unmappedCount > 0 && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="banner-unmapped-skus">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{unmappedCount} SKU{unmappedCount !== 1 ? 's' : ''} need vendor mapping</strong> — these were pulled from eBay orders not listed through this app. Click the edit button to add vendor details for fulfillment.
              </p>
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SKU Mappings</CardTitle>
                  <CardDescription>Map eBay product SKUs to vendor product SKUs for automated fulfillment. Orders synced from eBay auto-create mappings.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => autoGenerateMappings.mutate()}
                    disabled={autoGenerateMappings.isPending}
                    data-testid="button-auto-generate-mappings"
                  >
                    {autoGenerateMappings.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Sync from Inventory
                  </Button>
                  <Button onClick={() => setSkuDialogOpen(true)} data-testid="button-add-sku-mapping">
                    <Plus className="w-4 h-4 mr-2" /> Add Mapping
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant={skuFilter === 'all' ? 'default' : 'outline'} onClick={() => setSkuFilter('all')} data-testid="filter-all-skus">
                  All ({skuMappings?.length || 0})
                </Button>
                <Button size="sm" variant={skuFilter === 'unmapped' ? 'default' : 'outline'} onClick={() => setSkuFilter('unmapped')} data-testid="filter-unmapped-skus">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Needs Mapping ({unmappedCount})
                </Button>
                <Button size="sm" variant={skuFilter === 'mapped' ? 'default' : 'outline'} onClick={() => setSkuFilter('mapped')} data-testid="filter-mapped-skus">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Mapped ({(skuMappings?.length || 0) - unmappedCount})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {skuLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>eBay SKU</TableHead>
                      <TableHead>eBay Product</TableHead>
                      <TableHead>Sale Price</TableHead>
                      <TableHead>Vendor SKU</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Product URL</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMappings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {skuFilter === 'unmapped' ? 'All SKUs have been mapped.' : skuFilter === 'mapped' ? 'No mapped SKUs yet.' : 'No SKU mappings. Sync eBay orders to auto-create mappings.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMappings.map((m: any) => {
                        const needsMapping = isUnmapped(m);
                        return (
                          <TableRow key={m.id} data-testid={`row-sku-${m.id}`} className={needsMapping ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                            <TableCell className="font-mono text-xs">{m.ebaySku}</TableCell>
                            <TableCell className="max-w-[200px]">
                              {m.ebayTitle ? (
                                <span className="text-xs truncate block" title={m.ebayTitle}>{m.ebayTitle}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>{m.ebayPrice ? fc(Number(m.ebayPrice)) : '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {m.vendorSku || <span className="text-amber-600 text-xs italic">Not set</span>}
                            </TableCell>
                            <TableCell>{m.vendorName || <span className="text-amber-600 text-xs italic">Not set</span>}</TableCell>
                            <TableCell>
                              {m.vendorProductUrl ? (
                                <a
                                  href={m.vendorProductUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline text-xs max-w-[200px] truncate block"
                                  title={m.vendorProductUrl}
                                  data-testid={`link-vendor-url-${m.id}`}
                                >
                                  {(() => { try { return new URL(m.vendorProductUrl).hostname; } catch { return 'View'; } })()}
                                </a>
                              ) : (
                                <span className="text-amber-600 text-xs italic">Not set</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {m.costPrice ? fc(Number(m.costPrice)) : '-'}
                              {m.costPrice && m.ebayPrice && (
                                <span className="block text-xs text-green-600">
                                  +{fc(Number(m.ebayPrice) - Number(m.costPrice))} profit
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {needsMapping ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> Needs Mapping
                                </Badge>
                              ) : (
                                <Badge variant="outline" className={m.isActive ? 'bg-green-500/10 text-green-600' : 'bg-gray-100 text-gray-600'}>
                                  {m.isActive ? 'Mapped' : 'Inactive'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={needsMapping ? "default" : "ghost"}
                                  className={needsMapping ? "text-xs" : ""}
                                  onClick={() => {
                                    setEditingSku({
                                      id: m.id,
                                      ebaySku: m.ebaySku,
                                      ebayTitle: m.ebayTitle || '',
                                      ebayPrice: m.ebayPrice || '',
                                      vendorSku: m.vendorSku || '',
                                      vendorName: m.vendorName || '',
                                      vendorProductUrl: m.vendorProductUrl || '',
                                      costPrice: m.costPrice || '',
                                      priceThreshold: m.priceThreshold || '',
                                    });
                                    setEditSkuDialogOpen(true);
                                  }}
                                  data-testid={`button-edit-sku-${m.id}`}
                                >
                                  <Pencil className="w-3 h-3 mr-1" /> {needsMapping ? 'Map Now' : 'Edit'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => deleteSkuMapping.mutate(m.id)}
                                  data-testid={`button-delete-sku-${m.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>Manage cards used for vendor checkout. Primary card is charged first, wallet balance as fallback.</CardDescription>
                </div>
                <Button onClick={() => setCardDialogOpen(true)} data-testid="button-add-card">
                  <Plus className="w-4 h-4 mr-2" /> Add Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cardsLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-3">
                  {walletPayment?.subscriptionCard && (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30" data-testid="card-wallet-saved">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-primary" />
                        <div>
                          <p className="font-medium">{(walletPayment.subscriptionCard.brand || 'card').toUpperCase()} **** {walletPayment.subscriptionCard.last4}</p>
                          <p className="text-xs text-muted-foreground">Expires {String(walletPayment.subscriptionCard.expMonth).padStart(2, '0')}/{walletPayment.subscriptionCard.expYear}</p>
                        </div>
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Wallet Card</Badge>
                      </div>
                    </div>
                  )}
                  {!paymentCards || paymentCards.length === 0 ? (
                    !walletPayment?.subscriptionCard && (
                      <div className="text-center py-8 text-muted-foreground">
                        No payment cards added. Add a card to enable automated vendor checkout.
                      </div>
                    )
                  ) : (
                    paymentCards.map((card) => (
                      <div key={card.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`card-payment-${card.id}`}>
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-8 h-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{card.brand.toUpperCase()} **** {card.lastFour}</p>
                            <p className="text-xs text-muted-foreground">Expires {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}</p>
                          </div>
                          {card.isDefault && (
                            <Badge className="bg-primary/10 text-primary">Default</Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!card.isDefault && (
                            <Button size="sm" variant="outline" onClick={() => setDefaultCard.mutate(card.id)} data-testid={`button-set-default-${card.id}`}>
                              <Star className="w-4 h-4 mr-1" /> Set Default
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deletePaymentCard.mutate(card.id)} data-testid={`button-delete-card-${card.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Jobs</CardTitle>
              <CardDescription>Monitor and manage active and completed fulfillment jobs</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!fulfillmentJobs || fulfillmentJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No fulfillment jobs yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      fulfillmentJobs.map((job) => (
                        <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                          <TableCell className="font-mono text-xs">#{job.id}</TableCell>
                          <TableCell className="font-mono text-xs">#{job.orderId}</TableCell>
                          <TableCell>{job.vendorName || 'Unassigned'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              job.status === 'shipped' ? 'bg-green-500/10 text-green-600 border-green-200' :
                              job.status === 'processing' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                              job.status === 'failed' ? 'bg-red-500/10 text-red-600 border-red-200' :
                              'bg-yellow-500/10 text-yellow-600 border-yellow-200'
                            }>
                              {job.status === 'shipped' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              {job.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                              {job.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{job.paymentMethod || '-'}</TableCell>
                          <TableCell>
                            {job.trackingNumber ? (
                              <span className="font-mono text-xs">{job.trackingNumber}</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{job.retryCount}</TableCell>
                          <TableCell className="text-xs">
                            {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            {job.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => retryFulfillment.mutate(job.id)}
                                disabled={retryFulfillment.isPending}
                                data-testid={`button-retry-${job.id}`}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Complete audit trail of all fulfillment activities</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!auditLogs || auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No audit logs yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => (
                        <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                          <TableCell className="text-xs">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action.replace(/_/g, ' ')}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.orderId ? `#${log.orderId}` : '-'}</TableCell>
                          <TableCell>{log.source || '-'}</TableCell>
                          <TableCell>{log.vendorUsed || '-'}</TableCell>
                          <TableCell>{log.paymentMethod || '-'}</TableCell>
                          <TableCell>{log.fulfillmentStatus || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={skuDialogOpen} onOpenChange={setSkuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add SKU Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">eBay SKU *</label>
              <Input value={newSku.ebaySku} onChange={(e) => setNewSku(s => ({ ...s, ebaySku: e.target.value }))} placeholder="eBay product SKU" className="mt-1" data-testid="input-ebay-sku" />
            </div>
            <div>
              <label className="text-sm font-medium">Vendor SKU *</label>
              <Input value={newSku.vendorSku} onChange={(e) => setNewSku(s => ({ ...s, vendorSku: e.target.value }))} placeholder="Vendor product SKU" className="mt-1" data-testid="input-vendor-sku" />
            </div>
            <div>
              <label className="text-sm font-medium">Vendor Name</label>
              <Input value={newSku.vendorName} onChange={(e) => setNewSku(s => ({ ...s, vendorName: e.target.value }))} placeholder="e.g. Amazon, AliExpress" className="mt-1" data-testid="input-vendor-name" />
            </div>
            <div>
              <label className="text-sm font-medium">Vendor Product URL</label>
              <Input value={newSku.vendorProductUrl} onChange={(e) => setNewSku(s => ({ ...s, vendorProductUrl: e.target.value }))} placeholder="https://..." className="mt-1" data-testid="input-vendor-url" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cost Price</label>
                <Input type="number" step="0.01" value={newSku.costPrice} onChange={(e) => setNewSku(s => ({ ...s, costPrice: e.target.value }))} placeholder="0.00" className="mt-1" data-testid="input-cost-price" />
              </div>
              <div>
                <label className="text-sm font-medium">Price Threshold</label>
                <Input type="number" step="0.01" value={newSku.priceThreshold} onChange={(e) => setNewSku(s => ({ ...s, priceThreshold: e.target.value }))} placeholder="Max acceptable price" className="mt-1" data-testid="input-price-threshold" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkuDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSkuMapping.mutate({
                ...newSku,
                costPrice: newSku.costPrice || undefined,
                priceThreshold: newSku.priceThreshold || undefined,
              })}
              disabled={!newSku.ebaySku || createSkuMapping.isPending}
              data-testid="button-save-sku"
            >
              {createSkuMapping.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSkuDialogOpen} onOpenChange={(open) => { setEditSkuDialogOpen(open); if (!open) setEditingSku(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SKU Mapping</DialogTitle>
          </DialogHeader>
          {editingSku && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-xs text-muted-foreground">eBay SKU</p>
                <p className="font-mono text-sm font-medium" data-testid="text-edit-ebay-sku">{editingSku.ebaySku}</p>
                {editingSku.ebayTitle && (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">eBay Product Title</p>
                    <p className="text-sm">{editingSku.ebayTitle}</p>
                  </>
                )}
                {editingSku.ebayPrice && (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">Sale Price</p>
                    <p className="text-sm font-medium">{fc(Number(editingSku.ebayPrice))}</p>
                  </>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Vendor Name *</label>
                <Input value={editingSku.vendorName} onChange={(e) => setEditingSku((s: any) => ({ ...s, vendorName: e.target.value }))} placeholder="e.g. Amazon, AliExpress, CJDropshipping" className="mt-1" data-testid="input-edit-vendor-name" />
              </div>
              <div>
                <label className="text-sm font-medium">Vendor SKU / ASIN</label>
                <Input value={editingSku.vendorSku} onChange={(e) => setEditingSku((s: any) => ({ ...s, vendorSku: e.target.value }))} placeholder="Vendor product identifier" className="mt-1" data-testid="input-edit-vendor-sku" />
              </div>
              <div>
                <label className="text-sm font-medium">Vendor Product URL *</label>
                <Input value={editingSku.vendorProductUrl} onChange={(e) => setEditingSku((s: any) => ({ ...s, vendorProductUrl: e.target.value }))} placeholder="https://www.amazon.co.uk/dp/..." className="mt-1" data-testid="input-edit-vendor-url" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Cost Price</label>
                  <Input type="number" step="0.01" value={editingSku.costPrice} onChange={(e) => setEditingSku((s: any) => ({ ...s, costPrice: e.target.value }))} placeholder="0.00" className="mt-1" data-testid="input-edit-cost-price" />
                  {editingSku.costPrice && editingSku.ebayPrice && (
                    <p className="text-xs text-green-600 mt-1">Profit: {fc(Number(editingSku.ebayPrice) - Number(editingSku.costPrice))}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Price Threshold</label>
                  <Input type="number" step="0.01" value={editingSku.priceThreshold} onChange={(e) => setEditingSku((s: any) => ({ ...s, priceThreshold: e.target.value }))} placeholder="Max acceptable" className="mt-1" data-testid="input-edit-price-threshold" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditSkuDialogOpen(false); setEditingSku(null); }}>Cancel</Button>
            <Button
              onClick={() => editingSku && updateSkuMapping.mutate({
                id: editingSku.id,
                data: {
                  vendorSku: editingSku.vendorSku || '',
                  vendorName: editingSku.vendorName || undefined,
                  vendorProductUrl: editingSku.vendorProductUrl || undefined,
                  costPrice: editingSku.costPrice || undefined,
                  priceThreshold: editingSku.priceThreshold || undefined,
                },
              })}
              disabled={updateSkuMapping.isPending}
              data-testid="button-save-edit-sku"
            >
              {updateSkuMapping.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Card Token ID *</label>
              <Input value={newCard.tokenizedId} onChange={(e) => setNewCard(c => ({ ...c, tokenizedId: e.target.value }))} placeholder="Tokenized card identifier" className="mt-1" data-testid="input-token-id" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Last 4 Digits *</label>
                <Input maxLength={4} value={newCard.lastFour} onChange={(e) => setNewCard(c => ({ ...c, lastFour: e.target.value }))} placeholder="1234" className="mt-1" data-testid="input-last-four" />
              </div>
              <div>
                <label className="text-sm font-medium">Brand</label>
                <Select value={newCard.brand} onValueChange={(v) => setNewCard(c => ({ ...c, brand: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-card-brand">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="mastercard">Mastercard</SelectItem>
                    <SelectItem value="amex">Amex</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Expiry Month *</label>
                <Input type="number" min={1} max={12} value={newCard.expiryMonth} onChange={(e) => setNewCard(c => ({ ...c, expiryMonth: e.target.value }))} placeholder="MM" className="mt-1" data-testid="input-expiry-month" />
              </div>
              <div>
                <label className="text-sm font-medium">Expiry Year *</label>
                <Input type="number" min={2024} value={newCard.expiryYear} onChange={(e) => setNewCard(c => ({ ...c, expiryYear: e.target.value }))} placeholder="YYYY" className="mt-1" data-testid="input-expiry-year" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newCard.isDefault} onCheckedChange={(v) => setNewCard(c => ({ ...c, isDefault: v }))} data-testid="switch-default-card" />
              <label className="text-sm">Set as default card</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createPaymentCard.mutate({
                ...newCard,
                expiryMonth: Number(newCard.expiryMonth),
                expiryYear: Number(newCard.expiryYear),
                priority: newCard.isDefault ? 1 : 0,
              })}
              disabled={!newCard.lastFour || !newCard.tokenizedId || !newCard.expiryMonth || !newCard.expiryYear || createPaymentCard.isPending}
              data-testid="button-save-card"
            >
              {createPaymentCard.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

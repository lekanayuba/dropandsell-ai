import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import {
  Truck, Package, Clock, ChevronDown, ChevronUp, RotateCcw,
  MapPin, FileText, Play, RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Filter, Search, ExternalLink, Copy, Check, ShoppingCart, ArrowRight, ClipboardCopy, Ban, ShieldAlert, Download, ShoppingBag, ImageOff
} from "lucide-react";
import { SiAmazon, SiTiktok } from "react-icons/si";
import { useFeatureAccess } from "@/hooks/use-feature-flags";

const CARRIER_LABELS: Record<string, string> = {
  'AMAZON': 'Amazon Logistics',
  'AMAZON_LOGISTICS': 'Amazon Logistics',
  'ROYAL_MAIL': 'Royal Mail',
  'DPD': 'DPD',
  'HERMES': 'Hermes / Evri',
  'DHL': 'DHL',
  'DHL_GLOBAL_MAIL': 'DHL eCommerce',
  'FEDEX': 'FedEx',
  'UPS': 'UPS',
  'YODEL': 'Yodel',
  'PARCELFORCE': 'Parcelforce',
  'TNT': 'TNT',
  'CAINIAO': 'Cainiao / AliExpress',
  'YANWEN': 'Yanwen',
  'CHINA_POST': 'China Post',
  '4PX': '4PX',
  'COLLECT_PLUS': 'CollectPlus',
  'USPS': 'USPS',
  'OTHER': 'Other',
};

function detectEbayCarrier(trackingNumber: string): { carrier: string; label: string } | null {
  const cleaned = trackingNumber.trim().replace(/\s+/g, '');
  if (/^TBA\d{12,}$/i.test(cleaned)) return { carrier: 'AMAZON', label: 'Amazon Logistics' };
  if (/^1Z[A-Z0-9]{16}$/i.test(cleaned)) return { carrier: 'UPS', label: 'UPS' };
  if (/^\d{12,22}$/.test(cleaned) && (cleaned.startsWith('94') || cleaned.startsWith('92') || cleaned.startsWith('93') || cleaned.startsWith('420')))
    return { carrier: 'USPS', label: 'USPS' };
  if (/^\d{12}$/.test(cleaned)) return { carrier: 'FEDEX', label: 'FedEx' };
  if (/^[A-Z]{2}\d{9}CN$/i.test(cleaned)) return { carrier: 'CHINA_POST', label: 'China Post' };
  if (/^[A-Z]{2}\d{9}GB$/i.test(cleaned)) return { carrier: 'ROYAL_MAIL', label: 'Royal Mail' };
  if (/^LP\d{14,}$/i.test(cleaned) || /^CJPAK/i.test(cleaned)) return { carrier: 'CAINIAO', label: 'Cainiao / AliExpress' };
  if (/^YT\d{16}$/i.test(cleaned) || /^YP\d+$/i.test(cleaned)) return { carrier: 'YANWEN', label: 'Yanwen' };
  if (/^4PX/i.test(cleaned)) return { carrier: '4PX', label: '4PX' };
  if (/^JD\d{13,18}$/i.test(cleaned) || /^JJD\d{12,18}$/i.test(cleaned)) return { carrier: 'DPD', label: 'DPD' };
  if (/^H\d{14,}$/i.test(cleaned)) return { carrier: 'HERMES', label: 'Hermes / Evri' };
  return null;
}

function TrackingPreview({ trackingNumber, carrier }: { trackingNumber: string; carrier: string }) {
  const detected = detectEbayCarrier(trackingNumber);
  const ebayCarrierMap: Record<string, string> = {
    'AMAZON_LOGISTICS': 'AMAZON', 'HERMES': 'HERMES', 'EVRI': 'HERMES',
    'DHL_EXPRESS': 'DHL', 'DHL_ECOMMERCE': 'DHL_GLOBAL_MAIL',
    'ALIEXPRESS': 'CAINIAO', 'ALIEXPRESS_STANDARD': 'CAINIAO',
  };
  const mappedCarrier = ebayCarrierMap[carrier?.toUpperCase()] || carrier;
  const finalCarrier = detected?.carrier || mappedCarrier;
  const finalLabel = detected?.label || CARRIER_LABELS[finalCarrier] || finalCarrier;

  return (
    <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md text-xs" data-testid="tracking-preview">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
        <span className="text-green-700 dark:text-green-300">
          Will sync to eBay as: <strong>{finalLabel}</strong>
          {detected && <span className="ml-1 text-green-500">(auto-detected)</span>}
        </span>
      </div>
    </div>
  );
}

export default function Orders() {
  const { toast } = useToast();
  const { format: fc } = useCurrency();
  const { hasAccess: hasJumiaAccess } = useFeatureAccess('jumia_marketplace');
  const [activeTab, setActiveTab] = useState("all");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [trackingJobId, setTrackingJobId] = useState<number | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [fulfillOrderId, setFulfillOrderId] = useState<number | null>(null);
  const [fulfillStep, setFulfillStep] = useState<'prepare' | 'tracking'>('prepare');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fulfillTrackingNumber, setFulfillTrackingNumber] = useState("");
  const [fulfillCarrier, setFulfillCarrier] = useState("");
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeOrderId, setDisputeOrderId] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [orderTrackingNumber, setOrderTrackingNumber] = useState("");
  const [orderTrackingCarrier, setOrderTrackingCarrier] = useState("");
  const [showTrackingConverter, setShowTrackingConverter] = useState(false);
  const [converterTracking, setConverterTracking] = useState("");
  const [converterCarrier, setConverterCarrier] = useState("OTHER");
  const [converterEbayOrderId, setConverterEbayOrderId] = useState("");
  const [converterStoreId, setConverterStoreId] = useState("");
  const [converterResult, setConverterResult] = useState<null | {
    trackingNumber: string;
    shippingCarrierCode: string;
    autoDetected?: boolean;
    ebayOrderId: string;
    replaced?: number;
    carrierTrackingUrl?: string | null;
    carrierLabel?: string;
    ebayOrderUrl?: string;
  }>(null);

  const { data: orders, isLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: fulfilledOrders, isLoading: isFulfilledLoading } = useQuery<any[]>({
    queryKey: ['/api/fulfilled-orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/fulfilled-orders?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch fulfilled orders');
      return res.json();
    },
  });

  const { data: returnRequests } = useQuery<any[]>({
    queryKey: ['/api/return-requests'],
  });

  const { data: storesData } = useQuery<any[]>({
    queryKey: ['/api/stores'],
  });

  const ebayStores = (storesData || []).filter((s: any) => s.platform === 'ebay' && s.status === 'active');

  const pushTrackingToEbay = useMutation({
    mutationFn: async (data: { trackingNumber: string; carrier: string; ebayOrderId: string; storeId?: string }) => {
      const res = await apiRequest('POST', '/api/tracking/push-to-ebay', data);
      return res.json();
    },
    onSuccess: (data: any) => {
      const replacedNote = data.replaced && data.replaced > 0
        ? ` Previous tracking on this eBay order was removed and replaced.`
        : '';
      toast({
        title: "Tracking synced to eBay",
        description: `${data.trackingNumber} (${data.shippingCarrierCode}${data.autoDetected ? ', auto-detected' : ''}) is now live on eBay order ${data.ebayOrderId}.${replacedNote}`,
      });
      setConverterResult({
        trackingNumber: data.trackingNumber,
        shippingCarrierCode: data.shippingCarrierCode,
        autoDetected: data.autoDetected,
        ebayOrderId: data.ebayOrderId,
        replaced: data.replaced,
        carrierTrackingUrl: data.carrierTrackingUrl,
        carrierLabel: data.carrierLabel,
        ebayOrderUrl: data.ebayOrderUrl,
      });
    },
    onError: (err: any) => {
      toast({ title: "Push Failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: cancelledOrders, isLoading: isCancelledLoading } = useQuery<any[]>({
    queryKey: ['/api/cancelled-orders'],
  });

  const { data: prepareData, isLoading: isPrepareLoading } = useQuery<any>({
    queryKey: ['/api/fulfillment-jobs/prepare', fulfillOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/fulfillment-jobs/prepare/${fulfillOrderId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to prepare fulfillment');
      return res.json();
    },
    enabled: !!fulfillOrderId && fulfillDialogOpen,
  });

  const completeJob = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await apiRequest('POST', `/api/fulfillment-jobs/${jobId}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fulfillment-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
    },
  });

  const triggerFulfillment = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('POST', '/api/fulfillment-jobs/trigger', { orderId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfillment-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      toast({ title: "Fulfillment Started", description: "Order fulfillment has been triggered" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const submitReturn = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      const res = await apiRequest('POST', '/api/return-requests', { orderId, reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/return-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setReturnDialogOpen(false);
      setReturnReason("");
      toast({ title: "Return Requested", description: "Your return request has been submitted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const acceptCancellation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/accept-cancellation`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cancelled-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: "Cancellation Accepted", description: "The order cancellation has been accepted and refund initiated" });
      if (data.ebayWarning) {
        toast({ title: "eBay Warning", description: data.ebayWarning, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const disputeCancellation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/dispute-cancellation`, { reason });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cancelled-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setDisputeDialogOpen(false);
      setDisputeReason("");
      toast({ title: "Cancellation Disputed", description: "The order has been restored to processing" });
      if (data.ebayWarning) {
        toast({ title: "eBay Warning", description: data.ebayWarning, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateTracking = useMutation({
    mutationFn: async ({ jobId, trackingNumber, carrier }: { jobId: number; trackingNumber: string; carrier: string }) => {
      const res = await apiRequest('POST', `/api/fulfillment-jobs/${jobId}/update-tracking`, { trackingNumber, carrier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfillment-jobs'] });
      setTrackingDialogOpen(false);
      setTrackingNumber("");
      setTrackingCarrier("");
      toast({ title: "Tracking Updated", description: "Tracking data has been synced to eBay" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateOrderTracking = useMutation({
    mutationFn: async ({ orderId, trackingNumber, carrier }: { orderId: number; trackingNumber: string; carrier: string }) => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/update-tracking`, { trackingNumber, carrier });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      setOrderTrackingNumber("");
      setOrderTrackingCarrier("");
      if (data.ebaySynced) {
        toast({ title: "Tracking Synced to eBay", description: `Converted to ${data.ebayCarrierCode}${data.autoDetected ? ' (auto-detected)' : ''} and pushed to eBay` });
      } else if (data.ebayError) {
        toast({ title: "Tracking Saved", description: "Tracking saved but eBay sync failed. Check audit logs.", variant: "destructive" });
      } else if (data.syncSkippedReason) {
        toast({ title: "Tracking Saved", description: `eBay sync skipped: ${data.syncSkippedReason}` });
      } else {
        toast({ title: "Tracking Saved", description: "Tracking information has been added to the order" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markDelivered = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/mark-delivered`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      toast({ title: "Order Delivered", description: "Order has been marked as delivered" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markAllDelivered = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/mark-all-delivered');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      toast({ title: "Orders Updated", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const syncAmazonOrders = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/amazon/sync-orders');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      const msg = `${data.newOrders || 0} new, ${data.updatedOrders || 0} updated`;
      toast({ title: "Amazon Sync Complete", description: msg });
      if (data.errors?.length) {
        toast({ title: "Some stores had issues", description: data.errors.join("; "), variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Amazon Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const syncJumiaOrders = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/jumia/sync-orders');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      const msg = `${data.newOrders || 0} new, ${data.updatedOrders || 0} updated`;
      toast({ title: "Jumia Sync Complete", description: msg });
      if (data.errors?.length) {
        toast({ title: "Some stores had issues", description: data.errors.join("; "), variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Jumia Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const manualEbaySync = useRef(false);

  const syncEbayOrders = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ebay/sync-orders');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
      const parts = [];
      if (data.newOrders > 0) parts.push(`${data.newOrders} new`);
      if (data.updatedOrders > 0) parts.push(`${data.updatedOrders} updated`);
      if (parts.length > 0) {
        toast({ title: "eBay Sync Complete", description: parts.join(', ') });
      }
    },
    onError: (err: any) => {
      if (!manualEbaySync.current) return;
      toast({ title: "eBay Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const autoSyncDone = useRef(false);
  useEffect(() => {
    if (autoSyncDone.current) return;
    autoSyncDone.current = true;
    syncEbayOrders.mutate();
  }, []);

  const syncTikTokOrders = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/tiktok/sync-orders');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fulfilled-orders'] });
      const msg = `${data.newOrders || 0} new, ${data.updatedOrders || 0} updated`;
      toast({ title: "TikTok Sync Complete", description: msg });
      if (data.errors?.length) {
        toast({ title: "Some stores had issues", description: data.errors.join("; "), variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "TikTok Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({ title: "Copied!", description: `${field} copied to clipboard` });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  const openFulfillDialog = (orderId: number) => {
    setFulfillOrderId(orderId);
    setFulfillStep('prepare');
    setFulfillTrackingNumber("");
    setFulfillCarrier("");
    setCopiedField(null);
    setFulfillDialogOpen(true);
  };

  const handleFulfillAndTrack = async () => {
    if (!fulfillOrderId) return;
    triggerFulfillment.mutate(fulfillOrderId, {
      onSuccess: (job) => {
        setFulfillStep('tracking');
        setTrackingJobId(job.id);
      },
    });
  };

  const statusPriority: Record<string, number> = {
    'pending': 0,
    'processing': 1,
    'shipped': 2,
    'delivered': 3,
    'cancelled': 4,
  };

  const fulfillmentPriority: Record<string, number> = {
    'unfulfilled': 0,
    'in_progress': 1,
    'fulfilled': 2,
  };

  const filteredOrders = orders?.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.customerName?.toLowerCase().includes(q) ||
      order.externalOrderId?.toLowerCase().includes(q) ||
      String(order.id).includes(q)
    );
  })?.sort((a, b) => {
    const fA = fulfillmentPriority[a.fulfillmentStatus] ?? 1;
    const fB = fulfillmentPriority[b.fulfillmentStatus] ?? 1;
    if (fA !== fB) return fA - fB;
    const sA = statusPriority[a.status] ?? 2;
    const sB = statusPriority[b.status] ?? 2;
    if (sA !== sB) return sA - sB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const pendingCount = orders?.filter(o => o.status === 'pending').length || 0;
  const unfulfilledCount = orders?.filter(o => o.fulfillmentStatus === 'unfulfilled').length || 0;
  const shippedCount = orders?.filter(o => o.fulfillmentStatus === 'fulfilled').length || 0;
  const cancelledCount = cancelledOrders?.length || 0;

  if (isLoading) {
    return (
      <div className="space-y-8 p-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight" data-testid="text-orders-title">Orders</h2>
          <p className="text-muted-foreground mt-2">Track, manage, and fulfill customer orders</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { manualEbaySync.current = true; syncEbayOrders.mutate(); }}
            disabled={syncEbayOrders.isPending}
            data-testid="button-sync-ebay"
          >
            {syncEbayOrders.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2 text-blue-500" />
            )}
            {syncEbayOrders.isPending ? "Syncing..." : "Sync eBay"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncAmazonOrders.mutate()}
            disabled={syncAmazonOrders.isPending}
            data-testid="button-sync-amazon"
          >
            {syncAmazonOrders.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <SiAmazon className="w-4 h-4 mr-2 text-orange-500" />
            )}
            {syncAmazonOrders.isPending ? "Syncing..." : "Sync Amazon"}
          </Button>
          {hasJumiaAccess && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncJumiaOrders.mutate()}
              disabled={syncJumiaOrders.isPending}
              data-testid="button-sync-jumia"
            >
              {syncJumiaOrders.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShoppingBag className="w-4 h-4 mr-2 text-orange-500" />
              )}
              {syncJumiaOrders.isPending ? "Syncing..." : "Sync Jumia"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncTikTokOrders.mutate()}
            disabled={syncTikTokOrders.isPending}
            data-testid="button-sync-tiktok"
          >
            {syncTikTokOrders.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <SiTiktok className="w-4 h-4 mr-2" />
            )}
            {syncTikTokOrders.isPending ? "Syncing..." : "Sync TikTok"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllDelivered.mutate()}
            disabled={markAllDelivered.isPending}
            data-testid="button-mark-all-delivered"
          >
            {markAllDelivered.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
            )}
            {markAllDelivered.isPending ? "Updating..." : "Mark All Delivered"}
          </Button>
          <PageRefreshButton />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Pending Processing</CardTitle>
            <Clock className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700" data-testid="text-pending-count">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">Awaiting Fulfillment</CardTitle>
            <Package className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700" data-testid="text-unfulfilled-count">{unfulfilledCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Fulfilled</CardTitle>
            <Truck className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700" data-testid="text-shipped-count">{shippedCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Cancelled</CardTitle>
            <Ban className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700" data-testid="text-cancelled-count">{cancelledCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20" data-testid="card-tracking-converter">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTrackingConverter(!showTrackingConverter)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">eBay Tracking Converter & Sync</CardTitle>
              <Badge variant="outline" className="text-xs">Drop&Sell Tracking Converter</Badge>
            </div>
            {showTrackingConverter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Convert any tracking number to eBay format and push directly — even for products not listed on this app</p>
        </CardHeader>
        {showTrackingConverter && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tracking Number *</label>
                <Input
                  placeholder="e.g. TBA123456789012"
                  value={converterTracking}
                  onChange={(e) => setConverterTracking(e.target.value)}
                  data-testid="input-converter-tracking"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Carrier</label>
                <Select value={converterCarrier} onValueChange={setConverterCarrier}>
                  <SelectTrigger data-testid="select-converter-carrier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OTHER">Auto-detect / Other</SelectItem>
                    <SelectItem value="AMAZON">Amazon Logistics</SelectItem>
                    <SelectItem value="ROYAL_MAIL">Royal Mail</SelectItem>
                    <SelectItem value="DPD">DPD</SelectItem>
                    <SelectItem value="HERMES">Hermes / Evri</SelectItem>
                    <SelectItem value="DHL">DHL</SelectItem>
                    <SelectItem value="FEDEX">FedEx</SelectItem>
                    <SelectItem value="UPS">UPS</SelectItem>
                    <SelectItem value="USPS">USPS</SelectItem>
                    <SelectItem value="YODEL">Yodel</SelectItem>
                    <SelectItem value="PARCELFORCE">Parcelforce</SelectItem>
                    <SelectItem value="TNT">TNT</SelectItem>
                    <SelectItem value="CAINIAO">Cainiao / AliExpress</SelectItem>
                    <SelectItem value="YANWEN">Yanwen</SelectItem>
                    <SelectItem value="CHINA_POST">China Post</SelectItem>
                    <SelectItem value="4PX">4PX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">eBay Order ID *</label>
                <Input
                  placeholder="e.g. 12-34567-89012"
                  value={converterEbayOrderId}
                  onChange={(e) => setConverterEbayOrderId(e.target.value)}
                  data-testid="input-converter-ebay-order"
                />
              </div>
              {ebayStores.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">eBay Store</label>
                  <Select value={converterStoreId} onValueChange={setConverterStoreId}>
                    <SelectTrigger data-testid="select-converter-store">
                      <SelectValue placeholder="Auto (first store)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (first store)</SelectItem>
                      {ebayStores.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {converterTracking && (
              <TrackingPreview trackingNumber={converterTracking} carrier={converterCarrier} />
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setConverterResult(null);
                  pushTrackingToEbay.mutate({
                    trackingNumber: converterTracking,
                    carrier: converterCarrier,
                    ebayOrderId: converterEbayOrderId,
                    storeId: converterStoreId && converterStoreId !== 'auto' ? converterStoreId : undefined,
                  });
                }}
                disabled={!converterTracking || !converterEbayOrderId || pushTrackingToEbay.isPending}
                data-testid="button-push-tracking"
              >
                {pushTrackingToEbay.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {pushTrackingToEbay.isPending ? "Pushing..." : "Convert & Push to eBay"}
              </Button>
              {ebayStores.length === 0 && (
                <p className="text-xs text-amber-600">No active eBay stores connected. Connect one in Settings first.</p>
              )}
            </div>

            {converterResult && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-4 space-y-3" data-testid="panel-tracking-result">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">✓</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      Tracking is now live on eBay order {converterResult.ebayOrderId}
                    </p>
                    {converterResult.replaced && converterResult.replaced > 0 ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                        We removed {converterResult.replaced} existing tracking record{converterResult.replaced > 1 ? 's' : ''} from the eBay order and replaced them with the converted one below.
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                        No previous tracking was on this order — the converted tracking has been added.
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="bg-white dark:bg-zinc-900 rounded border border-emerald-100 dark:border-emerald-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Converted tracking number</p>
                    <p className="font-mono font-semibold break-all" data-testid="text-result-tracking">{converterResult.trackingNumber}</p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline mt-1"
                      onClick={() => {
                        navigator.clipboard.writeText(converterResult.trackingNumber);
                        toast({ title: "Copied", description: "Tracking number copied to clipboard" });
                      }}
                      data-testid="button-copy-tracking"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 rounded border border-emerald-100 dark:border-emerald-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Carrier (eBay code)</p>
                    <p className="font-semibold" data-testid="text-result-carrier">
                      {converterResult.carrierLabel || converterResult.shippingCarrierCode}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      eBay code: <span className="font-mono">{converterResult.shippingCarrierCode}</span>
                      {converterResult.autoDetected && <span className="ml-1">· auto-detected</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {converterResult.carrierTrackingUrl && (
                    <a
                      href={converterResult.carrierTrackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                      data-testid="link-track-live"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Track Live on {converterResult.carrierLabel || 'Carrier'}
                    </a>
                  )}
                  {converterResult.ebayOrderUrl && (
                    <a
                      href={converterResult.ebayOrderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent"
                      data-testid="link-view-on-ebay"
                    >
                      View on eBay
                    </a>
                  )}
                  <a
                    href={`https://www.17track.net/en/track?nums=${encodeURIComponent(converterResult.trackingNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent"
                    data-testid="link-track-universal"
                  >
                    Universal tracker (17track)
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setConverterResult(null);
                      setConverterTracking("");
                      setConverterEbayOrderId("");
                      setConverterCarrier("OTHER");
                    }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                    data-testid="button-clear-result"
                  >
                    Convert another
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="all" data-testid="tab-all-orders">All Orders</TabsTrigger>
          <TabsTrigger value="fulfilled" data-testid="tab-fulfilled-orders">Fulfilled</TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-cancelled-orders">
            Cancelled {cancelledCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{cancelledCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="returns" data-testid="tab-returns">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-orders"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No orders found</TableCell>
                  </TableRow>
                ) : (
                  filteredOrders?.map((order) => (
                    <>
                      <TableRow
                        key={order.id}
                        className={`cursor-pointer hover:bg-muted/30 transition-colors ${(order.status === 'shipped' || order.status === 'delivered') && !order.trackingNumber ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                        onClick={() => {
                          const newId = expandedOrderId === order.id ? null : order.id;
                          setExpandedOrderId(newId);
                          if (newId !== null) { setOrderTrackingNumber(""); setOrderTrackingCarrier(""); }
                        }}
                        data-testid={`row-order-${order.id}`}
                      >
                        <TableCell>
                          {expandedOrderId === order.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{order.externalOrderId || `#${order.id}`}</TableCell>
                        <TableCell>
                          {(() => {
                            const items = order.lineItems && Array.isArray(order.lineItems) ? order.lineItems : [];
                            const firstImg = items.find((li: any) => li.imageUrl)?.imageUrl;
                            const count = items.length;
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                                  {firstImg ? (
                                    <img src={firstImg} alt="Product" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                      <Package className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate max-w-[120px]">{items[0]?.title || '-'}</p>
                                  {count > 1 && <p className="text-[10px] text-muted-foreground">+{count - 1} more</p>}
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>{fc(Number(order.totalAmount))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300' :
                            order.status === 'processing' || order.status === 'paid' ? 'bg-green-500/10 text-green-600 border-green-200' :
                            order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-200' :
                            order.status === 'shipped' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                            order.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border-red-200' :
                            'bg-gray-100 text-gray-600'
                          }>
                            {order.status === 'delivered' ? 'Delivered' : order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            order.fulfillmentStatus === 'fulfilled' ? 'bg-green-500/10 text-green-600 border-green-200' :
                            order.fulfillmentStatus === 'unfulfilled' ? 'bg-red-500/10 text-red-600 border-red-200' :
                            order.fulfillmentStatus === 'in_progress' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                            'bg-gray-100 text-gray-600'
                          }>
                            {order.fulfillmentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {order.fulfillmentStatus === 'unfulfilled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs bg-primary/5 hover:bg-primary/10 border-primary/30 text-primary"
                                onClick={() => openFulfillDialog(order.id)}
                                data-testid={`button-fulfill-${order.id}`}
                              >
                                <ShoppingCart className="w-3 h-3 mr-1" />
                                Fulfill
                              </Button>
                            )}
                            {order.fulfillmentStatus === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600"
                                onClick={() => openFulfillDialog(order.id)}
                                data-testid={`button-continue-fulfill-${order.id}`}
                              >
                                <ArrowRight className="w-3 h-3 mr-1" />
                                Continue
                              </Button>
                            )}
                            {(order.status === 'shipped' || order.status === 'delivered') && !order.trackingNumber && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700"
                                onClick={() => {
                                  setExpandedOrderId(order.id);
                                  setOrderTrackingNumber("");
                                  setOrderTrackingCarrier("");
                                }}
                                data-testid={`button-add-order-tracking-${order.id}`}
                              >
                                <Truck className="w-3 h-3 mr-1" />
                                Add Tracking
                              </Button>
                            )}
                            {order.status === 'shipped' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                                onClick={(e) => { e.stopPropagation(); markDelivered.mutate(order.id); }}
                                disabled={markDelivered.isPending}
                                data-testid={`button-mark-delivered-${order.id}`}
                              >
                                {markDelivered.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                Mark Delivered
                              </Button>
                            )}
                            {order.fulfillmentStatus === 'fulfilled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs text-red-600"
                                onClick={() => { setReturnOrderId(order.id); setReturnDialogOpen(true); }}
                                data-testid={`button-return-${order.id}`}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Return
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedOrderId === order.id && (
                        <TableRow key={`${order.id}-details`}>
                          <TableCell colSpan={9} className="bg-muted/20 p-4">
                            {order.lineItems && Array.isArray(order.lineItems) && order.lineItems.length > 0 && (
                              <div className="mb-4">
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                  <Package className="w-4 h-4" /> Items ({order.lineItems.length})
                                </h4>
                                <div className="space-y-2">
                                  {order.lineItems.map((li: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-background border" data-testid={`order-item-${order.id}-${idx}`}>
                                      <div className="w-12 h-12 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                                        {li.imageUrl ? (
                                          <img src={li.imageUrl} alt={li.title || 'Product'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                            <ImageOff className="w-5 h-5" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{li.title || 'Unknown Item'}</p>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                          {li.sku && <span className="font-mono">SKU: {li.sku}</span>}
                                          <span>Qty: {li.quantity || 1}</span>
                                          {li.price && <span>{fc(Number(li.price))}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                  <MapPin className="w-4 h-4" /> Shipping Address
                                </h4>
                                {order.shippingAddress ? (
                                  <div className="text-sm space-y-1">
                                    <p className="font-medium">{order.shippingAddress.name}</p>
                                    <p>{order.shippingAddress.addressLine1}</p>
                                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                                    <p>{order.shippingAddress.city}, {order.shippingAddress.stateOrProvince} {order.shippingAddress.postalCode}</p>
                                    <p>{order.shippingAddress.countryCode}</p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No address available</p>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                  <FileText className="w-4 h-4" /> Order Details
                                </h4>
                                <div className="text-sm space-y-1">
                                  <p>Order ID: <span className="font-mono">{order.externalOrderId || order.id}</span></p>
                                  <p>Store ID: {order.storeId || 'N/A'}</p>
                                  <p>Created: {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}</p>
                                  <p>Updated: {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : 'N/A'}</p>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                  <Truck className="w-4 h-4" /> Tracking
                                </h4>
                                <div className="text-sm space-y-2">
                                  {order.trackingNumber ? (
                                    <>
                                      <p>Tracking: <span className="font-mono">{order.trackingNumber}</span></p>
                                      <p>Carrier: {order.carrier}</p>
                                    </>
                                  ) : (
                                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                      <p className="text-muted-foreground text-xs mb-2">No tracking information yet</p>
                                      <Input
                                        placeholder="Tracking number"
                                        value={expandedOrderId === order.id ? orderTrackingNumber : ""}
                                        onChange={(e) => setOrderTrackingNumber(e.target.value)}
                                        className="h-8 text-xs"
                                        data-testid={`input-order-tracking-${order.id}`}
                                      />
                                      {orderTrackingNumber.trim() && (
                                        <TrackingPreview trackingNumber={orderTrackingNumber} carrier={orderTrackingCarrier} />
                                      )}
                                      <Select value={orderTrackingCarrier} onValueChange={setOrderTrackingCarrier}>
                                        <SelectTrigger className="h-8 text-xs" data-testid={`select-order-carrier-${order.id}`}>
                                          <SelectValue placeholder="Select carrier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Royal Mail">Royal Mail</SelectItem>
                                          <SelectItem value="DPD">DPD</SelectItem>
                                          <SelectItem value="Hermes">Hermes / Evri</SelectItem>
                                          <SelectItem value="DHL">DHL</SelectItem>
                                          <SelectItem value="UPS">UPS</SelectItem>
                                          <SelectItem value="FedEx">FedEx</SelectItem>
                                          <SelectItem value="Yodel">Yodel</SelectItem>
                                          <SelectItem value="Amazon Logistics">Amazon Logistics</SelectItem>
                                          <SelectItem value="ParcelForce">ParcelForce</SelectItem>
                                          <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 text-xs"
                                          disabled={!orderTrackingNumber.trim() || !orderTrackingCarrier || updateOrderTracking.isPending}
                                          onClick={() => updateOrderTracking.mutate({ orderId: order.id, trackingNumber: orderTrackingNumber, carrier: orderTrackingCarrier })}
                                          data-testid={`button-save-order-tracking-${order.id}`}
                                        >
                                          {updateOrderTracking.isPending ? (
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          ) : (
                                            <Check className="w-3 h-3 mr-1" />
                                          )}
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="flex-1 text-xs bg-[#285261] hover:bg-[#1e3f4d]"
                                          disabled={!orderTrackingNumber.trim() || !orderTrackingCarrier || updateOrderTracking.isPending}
                                          onClick={() => updateOrderTracking.mutate({ orderId: order.id, trackingNumber: orderTrackingNumber, carrier: orderTrackingCarrier })}
                                          data-testid={`button-convert-sync-ebay-${order.id}`}
                                        >
                                          {updateOrderTracking.isPending ? (
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          ) : (
                                            <ExternalLink className="w-3 h-3 mr-1" />
                                          )}
                                          Update Tracking
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="fulfilled" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Buyer Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Fulfilled Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFulfilledLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : fulfilledOrders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      No fulfilled orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  fulfilledOrders?.map((item) => {
                    const lineItems = item.order?.lineItems && Array.isArray(item.order.lineItems) ? item.order.lineItems : [];
                    const firstImg = lineItems.find((li: any) => li.imageUrl)?.imageUrl;
                    const itemCount = lineItems.length;
                    return (
                    <TableRow key={item.id} data-testid={`row-fulfilled-${item.id}`}>
                      <TableCell className="font-mono text-xs">{item.order?.externalOrderId || `#${item.orderId}`}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                            {firstImg ? (
                              <img src={firstImg} alt="Product" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate max-w-[120px]">{lineItems[0]?.title || '-'}</p>
                            {itemCount > 1 && <p className="text-[10px] text-muted-foreground">+{itemCount - 1} more</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.order?.customerName || 'N/A'}</TableCell>
                      <TableCell>{item.vendorName || 'N/A'}</TableCell>
                      <TableCell className="text-sm">
                        {item.order?.createdAt ? new Date(item.order.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.fulfilledAt ? new Date(item.fulfilledAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          item.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300' :
                          item.status === 'shipped' ? 'bg-green-500/10 text-green-600 border-green-200' :
                          item.status === 'processing' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                          item.status === 'failed' ? 'bg-red-500/10 text-red-600 border-red-200' :
                          'bg-yellow-500/10 text-yellow-600 border-yellow-200'
                        }>
                          {item.status === 'delivered' ? 'Delivered' : item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.paymentMethod || '-'}</TableCell>
                      <TableCell>
                        {item.trackingNumber ? (
                          <div className="text-xs">
                            <span className="font-mono">{item.trackingNumber}</span>
                            <br />
                            <span className="text-muted-foreground">{item.carrier}</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!item.trackingNumber && item.status !== 'failed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => { setTrackingJobId(item.id); setTrackingDialogOpen(true); }}
                              data-testid={`button-add-tracking-${item.id}`}
                            >
                              <Truck className="w-3 h-3 mr-1" />
                              Add Tracking
                            </Button>
                          )}
                          {item.status === 'shipped' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                                onClick={() => markDelivered.mutate(item.orderId)}
                                disabled={markDelivered.isPending}
                                data-testid={`button-mark-delivered-fulfilled-${item.id}`}
                              >
                                {markDelivered.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                Delivered
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs text-red-600"
                                onClick={() => { setReturnOrderId(item.orderId); setReturnDialogOpen(true); }}
                                data-testid={`button-return-fulfilled-${item.id}`}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Return
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>eBay Order</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isCancelledLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !cancelledOrders || cancelledOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No cancelled orders
                    </TableCell>
                  </TableRow>
                ) : (
                  cancelledOrders.map((order) => {
                    const cItems = order.lineItems && Array.isArray(order.lineItems) ? order.lineItems : [];
                    const cFirstImg = cItems.find((li: any) => li.imageUrl)?.imageUrl;
                    const cCount = cItems.length;
                    return (
                    <TableRow key={order.id} data-testid={`row-cancelled-${order.id}`}>
                      <TableCell className="font-mono text-xs">{order.externalOrderId || `#${order.id}`}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                            {cFirstImg ? (
                              <img src={cFirstImg} alt="Product" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate max-w-[120px]">{cItems[0]?.title || '-'}</p>
                            {cCount > 1 && <p className="text-[10px] text-muted-foreground">+{cCount - 1} more</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>{fc(Number(order.totalAmount))}</TableCell>
                      <TableCell>
                        {order.externalOrderId ? (
                          <a
                            href={`https://www.ebay.co.uk/mesh/ord/details?orderid=${order.externalOrderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            data-testid={`link-ebay-order-${order.id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on eBay
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          order.fulfillmentStatus === 'cancelled' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                          'bg-red-500/10 text-red-600 border-red-200'
                        }>
                          {order.fulfillmentStatus === 'cancelled' ? 'Resolved' : 'Pending Action'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.fulfillmentStatus !== 'cancelled' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => acceptCancellation.mutate(order.id)}
                              disabled={acceptCancellation.isPending}
                              data-testid={`button-accept-cancel-${order.id}`}
                            >
                              {acceptCancellation.isPending ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                              onClick={() => { setDisputeOrderId(order.id); setDisputeDialogOpen(true); }}
                              data-testid={`button-dispute-cancel-${order.id}`}
                            >
                              <ShieldAlert className="w-3 h-3 mr-1" />
                              Dispute
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="returns" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Return ID</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Refund Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!returnRequests || returnRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No return requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  returnRequests.map((ret) => (
                    <TableRow key={ret.id} data-testid={`row-return-${ret.id}`}>
                      <TableCell className="font-mono text-xs">#{ret.id}</TableCell>
                      <TableCell className="font-mono text-xs">#{ret.orderId}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{ret.reason}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          ret.status === 'approved' ? 'bg-green-500/10 text-green-600 border-green-200' :
                          ret.status === 'declined' ? 'bg-red-500/10 text-red-600 border-red-200' :
                          'bg-yellow-500/10 text-yellow-600 border-yellow-200'
                        }>
                          {ret.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{ret.refundAmount ? fc(Number(ret.refundAmount)) : '-'}</TableCell>
                      <TableCell className="text-sm">
                        {ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Return Reason</label>
              <Textarea
                placeholder="Please describe the reason for return..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="mt-1"
                data-testid="textarea-return-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => returnOrderId && submitReturn.mutate({ orderId: returnOrderId, reason: returnReason })}
              disabled={!returnReason.trim() || submitReturn.isPending}
              data-testid="button-submit-return"
            >
              {submitReturn.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute Cancellation</DialogTitle>
            <DialogDescription>
              Provide a reason for disputing this cancellation. The order will be restored to processing status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Dispute Reason</label>
              <Textarea
                placeholder="e.g. Item has already been shipped, tracking number provided..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="mt-1"
                data-testid="textarea-dispute-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => disputeOrderId && disputeCancellation.mutate({ orderId: disputeOrderId, reason: disputeReason })}
              disabled={!disputeReason.trim() || disputeCancellation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-submit-dispute"
            >
              {disputeCancellation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Dispute Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tracking Number</label>
              <Input
                placeholder="Paste tracking number from vendor"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="mt-1"
                data-testid="input-tracking-number"
              />
              {trackingNumber.trim() && (
                <TrackingPreview trackingNumber={trackingNumber} carrier={trackingCarrier} />
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Carrier / Shipping Provider</label>
              <Select value={trackingCarrier} onValueChange={setTrackingCarrier}>
                <SelectTrigger className="mt-1" data-testid="select-carrier">
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROYAL_MAIL">Royal Mail</SelectItem>
                  <SelectItem value="DPD">DPD</SelectItem>
                  <SelectItem value="HERMES">Hermes / Evri</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="DHL_GLOBAL_MAIL">DHL eCommerce / Global Mail</SelectItem>
                  <SelectItem value="FEDEX">FedEx</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="YODEL">Yodel</SelectItem>
                  <SelectItem value="PARCELFORCE">Parcelforce</SelectItem>
                  <SelectItem value="TNT">TNT</SelectItem>
                  <SelectItem value="AMAZON_LOGISTICS">Amazon Logistics</SelectItem>
                  <SelectItem value="CAINIAO">Cainiao / AliExpress Standard</SelectItem>
                  <SelectItem value="YANWEN">Yanwen</SelectItem>
                  <SelectItem value="CHINA_POST">China Post</SelectItem>
                  <SelectItem value="4PX">4PX</SelectItem>
                  <SelectItem value="COLLECT_PLUS">CollectPlus</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <strong>Auto-conversion:</strong> The system automatically converts vendor tracking IDs (Amazon TBA, AliExpress, etc.) to eBay-recognized formats before syncing.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => trackingJobId && updateTracking.mutate({ jobId: trackingJobId, trackingNumber, carrier: trackingCarrier })}
              disabled={!trackingNumber.trim() || !trackingCarrier || updateTracking.isPending}
              data-testid="button-submit-tracking"
            >
              {updateTracking.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fulfillDialogOpen} onOpenChange={(open) => { if (!open) setFulfillDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {fulfillStep === 'prepare' ? 'Fulfill Order' : 'Add Tracking'}
            </DialogTitle>
            <DialogDescription>
              {fulfillStep === 'prepare'
                ? 'Review order details, copy shipping address, and place the vendor order'
                : 'Enter the tracking number from your vendor order'}
            </DialogDescription>
          </DialogHeader>

          {isPrepareLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : prepareData && fulfillStep === 'prepare' ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 font-medium">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  Copy Address
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium">
                  <span className="w-5 h-5 rounded-full bg-muted-foreground/30 text-muted-foreground flex items-center justify-center text-[10px] font-bold">2</span>
                  Order from Vendor
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium">
                  <span className="w-5 h-5 rounded-full bg-muted-foreground/30 text-muted-foreground flex items-center justify-center text-[10px] font-bold">3</span>
                  Add Tracking
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="w-4 h-4" /> Order Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">eBay Order</span>
                      <span className="font-mono text-xs" data-testid="text-fulfill-order-id">{prepareData.order.externalOrderId || `#${prepareData.order.id}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{prepareData.order.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Product</span>
                      <span className="text-right max-w-[200px] truncate" title={prepareData.product.title}>{prepareData.product.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SKU</span>
                      <span className="font-mono text-xs">{prepareData.product.sku || 'N/A'}</span>
                    </div>
                    {prepareData.product.variationAspects && prepareData.product.variationAspects.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-dashed">
                        <span className="text-muted-foreground text-xs font-medium">Chosen Variation</span>
                        {prepareData.product.variationAspects.map((v: any, i: number) => (
                          <div key={i} className="flex justify-between items-center" data-testid={`text-variation-${i}`}>
                            <span className="text-muted-foreground text-xs">{v.name || v.type}</span>
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200 text-xs">
                              {v.value || (Array.isArray(v.values) ? v.values.join(', ') : '—')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Qty</span>
                      <span>{prepareData.product.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-semibold">{fc(Number(prepareData.order.totalAmount))}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Shipping Address
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => copyToClipboard(prepareData.shipping.formatted, 'Shipping address')}
                        data-testid="button-copy-address"
                      >
                        {copiedField === 'Shipping address' ? <Check className="w-3 h-3 mr-1 text-green-600" /> : <Copy className="w-3 h-3 mr-1" />}
                        {copiedField === 'Shipping address' ? 'Copied!' : 'Copy'}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-line font-mono" data-testid="text-shipping-address">
                      {prepareData.shipping.formatted || 'No shipping address available'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {prepareData.vendor ? (
                <Card className="border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" /> Vendor Match Found
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Vendor</span>
                        <p className="font-medium">{prepareData.vendor.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vendor SKU</span>
                        <p className="font-mono text-xs">{prepareData.vendor.sku}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cost Price</span>
                        <p className="font-semibold">{fc(Number(prepareData.vendor.costPrice))}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Profit</span>
                        <p className="font-semibold text-green-600">
                          {fc(Number(prepareData.order.totalAmount) - Number(prepareData.vendor.costPrice))}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          copyToClipboard(prepareData.shipping.formatted, 'Shipping address');
                          const raw = prepareData.vendor.productUrl;
                          if (raw) {
                            // Many vendor URLs are stored without a scheme
                            // (e.g. "www.amazon.co.uk/...") which would make
                            // window.open treat them as a relative path on
                            // dropandsell.online and 404. Normalise the
                            // protocol before opening so the browser sends
                            // the user to the real vendor site.
                            const trimmed = String(raw).trim();
                            const href = /^https?:\/\//i.test(trimmed)
                              ? trimmed
                              : `https://${trimmed.replace(/^\/+/, '')}`;
                            window.open(href, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        data-testid="button-open-vendor"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Copy Address & Open Vendor Page
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(
                          `${prepareData.shipping.formatted}\n\nProduct: ${prepareData.product.title}\nVendor SKU: ${prepareData.vendor.sku}\nQty: ${prepareData.product.quantity}`,
                          'Full details'
                        )}
                        title="Copy all details"
                        data-testid="button-copy-all"
                      >
                        <ClipboardCopy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/30 dark:bg-yellow-950/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" /> No Vendor Mapping
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No SKU mapping found for this product. Set up a mapping in the Fulfillment page to enable one-click vendor ordering.
                    </p>
                  </CardContent>
                </Card>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setFulfillDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleFulfillAndTrack}
                  disabled={triggerFulfillment.isPending}
                  data-testid="button-placed-order"
                >
                  {triggerFulfillment.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  I've Placed the Vendor Order — Add Tracking
                </Button>
              </DialogFooter>
            </div>
          ) : fulfillStep === 'tracking' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Order Placed
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 font-medium">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  Add Tracking
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Fulfillment job created. Enter the tracking number from your vendor order below. This will be synced back to eBay automatically.
              </div>

              <div>
                <label className="text-sm font-medium">Tracking Number</label>
                <Input
                  placeholder="Enter tracking number from vendor"
                  value={fulfillTrackingNumber}
                  onChange={(e) => setFulfillTrackingNumber(e.target.value)}
                  className="mt-1"
                  data-testid="input-fulfill-tracking"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Carrier / Shipping Provider</label>
                <Select value={fulfillCarrier} onValueChange={setFulfillCarrier}>
                  <SelectTrigger className="mt-1" data-testid="select-fulfill-carrier">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROYAL_MAIL">Royal Mail</SelectItem>
                    <SelectItem value="DPD">DPD</SelectItem>
                    <SelectItem value="HERMES">Hermes / Evri</SelectItem>
                    <SelectItem value="DHL">DHL</SelectItem>
                    <SelectItem value="DHL_GLOBAL_MAIL">DHL eCommerce / Global Mail</SelectItem>
                    <SelectItem value="FEDEX">FedEx</SelectItem>
                    <SelectItem value="UPS">UPS</SelectItem>
                    <SelectItem value="YODEL">Yodel</SelectItem>
                    <SelectItem value="PARCELFORCE">Parcelforce</SelectItem>
                    <SelectItem value="TNT">TNT</SelectItem>
                    <SelectItem value="AMAZON_LOGISTICS">Amazon Logistics</SelectItem>
                    <SelectItem value="CAINIAO">Cainiao / AliExpress Standard</SelectItem>
                    <SelectItem value="YANWEN">Yanwen</SelectItem>
                    <SelectItem value="CHINA_POST">China Post</SelectItem>
                    <SelectItem value="4PX">4PX</SelectItem>
                    <SelectItem value="COLLECT_PLUS">CollectPlus</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {fulfillTrackingNumber.trim() && (
                <TrackingPreview trackingNumber={fulfillTrackingNumber} carrier={fulfillCarrier} />
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFulfillDialogOpen(false);
                    toast({ title: "Fulfillment Started", description: "Come back to add tracking once you have it" });
                  }}
                >
                  Add Tracking Later
                </Button>
                <Button
                  onClick={() => {
                    if (trackingJobId) {
                      updateTracking.mutate(
                        { jobId: trackingJobId, trackingNumber: fulfillTrackingNumber, carrier: fulfillCarrier },
                        {
                          onSuccess: () => {
                            setFulfillDialogOpen(false);
                            toast({ title: "Order Fulfilled!", description: "Tracking synced to eBay" });
                          },
                        }
                      );
                    }
                  }}
                  disabled={!fulfillTrackingNumber.trim() || !fulfillCarrier || updateTracking.isPending}
                  data-testid="button-submit-fulfill-tracking"
                >
                  {updateTracking.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Truck className="w-4 h-4 mr-2" />
                  )}
                  Sync Tracking to eBay
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

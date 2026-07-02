import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { VENDOR_DIRECTORY } from "@shared/vendor-directory";
import {
  ShoppingBag, Package, Loader2, Star, Users, PoundSterling, Check,
  ChevronRight, Clock, Truck, CheckCircle2, XCircle, UserPlus, Plus, Minus,
  Trash2, AlertTriangle, MessageSquare, Zap, Settings, ThumbsUp,
  Eye, Wallet, Timer, BarChart3, Shield, ArrowRight, CreditCard,
  ChevronsUpDown, X, RefreshCw,
} from "lucide-react";

const LISTING_INCREMENT = 120;

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
    awaiting_assignment: { label: "Awaiting Assignment", className: "bg-blue-500/10 text-blue-600 border-blue-200" },
    in_progress: { label: "In Progress", className: "bg-purple-500/10 text-purple-600 border-purple-200" },
    partially_completed: { label: "Partially Done", className: "bg-orange-500/10 text-orange-600 border-orange-200" },
    awaiting_approval: { label: "Awaiting Approval", className: "bg-cyan-500/10 text-cyan-600 border-cyan-200" },
    completed: { label: "Completed", className: "bg-green-500/10 text-green-600 border-green-200" },
    cancelled: { label: "Cancelled", className: "bg-red-500/10 text-red-600 border-red-200" },
  };
  const s = map[status] || { label: status, className: "bg-gray-500/10 text-gray-600 border-gray-200" };
  return <Badge variant="outline" className={s.className} data-testid={`badge-status-${status}`}>{s.label}</Badge>;
}

function getPaymentBadge(status: string) {
  return status === 'paid'
    ? <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Paid</Badge>
    : <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">Unpaid</Badge>;
}

function getPayoutBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
    credited: { label: "Credited", cls: "bg-green-500/10 text-green-600 border-green-200" },
    withdrawn: { label: "Withdrawn", cls: "bg-blue-500/10 text-blue-600 border-blue-200" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-500/10 text-gray-600 border-gray-200" };
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

function DeadlineCountdown({ deadline }: { deadline: string | null }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Overdue");
        setIsOverdue(true);
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${hrs}h ${mins}m`);
      setIsOverdue(false);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-amber-600'}`} data-testid="text-deadline">
      <Timer className="w-3 h-3 inline mr-1" />
      {timeLeft}
    </span>
  );
}

export default function DropAndSell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.isAdmin === 'true' || user?.email === 'dropandsellauth@gmail.com';

  const [setCount, setSetCount] = useState(1);
  const [activeTab, setActiveTab] = useState("request");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignOrderId, setAssignOrderId] = useState<number | null>(null);
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<string>("");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusOrderId, setStatusOrderId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [deliveryLinks, setDeliveryLinks] = useState("");
  const [deliveryDescription, setDeliveryDescription] = useState("");
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackOrderId, setFeedbackOrderId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [surveyYears, setSurveyYears] = useState("");
  const [surveyHasCommunity, setSurveyHasCommunity] = useState(false);
  const [surveyCommunityName, setSurveyCommunityName] = useState("");
  const [surveyReferrals, setSurveyReferrals] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deliveryViewOpen, setDeliveryViewOpen] = useState(false);
  const [viewingDelivery, setViewingDelivery] = useState<any>(null);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressOrderId, setProgressOrderId] = useState<number | null>(null);
  const [progressValue, setProgressValue] = useState("");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payOrderId, setPayOrderId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [newCard, setNewCard] = useState({ lastFour: '', brand: 'visa', expiryMonth: '', expiryYear: '', tokenizedId: '', isDefault: false });
  const [assignmentFilter, setAssignmentFilter] = useState("");

  const { data: orders, isLoading } = useQuery<any[]>({
    queryKey: ['/api/drop-and-sell/orders'],
  });

  const { data: freelancers } = useQuery<any[]>({
    queryKey: ['/api/drop-and-sell/freelancers'],
    enabled: isAdmin,
  });

  const { data: myApplication } = useQuery<{ application: any }>({
    queryKey: ['/api/drop-and-sell/my-application'],
    enabled: !isAdmin,
  });

  const isApprovedLister = myApplication?.application?.applicationStatus === 'approved';

  const { data: myAssignments, isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/drop-and-sell/my-assignments'],
    enabled: !isAdmin && isApprovedLister,
  });

  const { data: myListings, isLoading: myListingsLoading } = useQuery<any[]>({
    queryKey: ['/api/drop-and-sell/my-listings'],
    enabled: !isAdmin && isApprovedLister,
  });

  // === Customer-catalog dialog (lister can browse ALL of a customer's
  // products and edit selling prices that push to eBay) ===
  const [catalogCustomerId, setCatalogCustomerId] = useState<string | null>(null);
  const [catalogCustomerName, setCatalogCustomerName] = useState<string>("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogPriceDrafts, setCatalogPriceDrafts] = useState<Record<number, string>>({});
  const [catalogSavingId, setCatalogSavingId] = useState<number | null>(null);

  const { data: customerCatalog, isLoading: catalogLoading } = useQuery<any[]>({
    queryKey: ['/api/drop-and-sell/customers', catalogCustomerId, 'products'],
    queryFn: async () => {
      const r = await fetch(`/api/drop-and-sell/customers/${catalogCustomerId}/products`, { credentials: 'include' });
      if (!r.ok) throw new Error((await r.json()).message || 'Failed to load catalog');
      return r.json();
    },
    enabled: !!catalogCustomerId,
  });

  const updateCustomerProductPrice = useMutation({
    mutationFn: async ({ productId, sellingPrice }: { productId: number; sellingPrice: string }) => {
      const r = await apiRequest(
        'PATCH',
        `/api/drop-and-sell/customers/${catalogCustomerId}/products/${productId}`,
        { sellingPrice },
      );
      return r.json();
    },
    onMutate: (vars) => setCatalogSavingId(vars.productId),
    onSettled: () => setCatalogSavingId(null),
    onSuccess: (data: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/customers', catalogCustomerId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-listings'] });
      setCatalogPriceDrafts(prev => {
        const next = { ...prev };
        delete next[vars.productId];
        return next;
      });
      const sync = data?.ebaySync as { synced: number; failed: number; errors: string[] } | undefined;
      if (sync && sync.synced > 0 && sync.failed === 0) {
        toast({
          title: "Price updated on eBay",
          description: `Live on ${sync.synced} eBay listing${sync.synced === 1 ? '' : 's'}. Buyers will see the new price within a minute.`,
        });
      } else if (sync && sync.failed > 0) {
        toast({
          title: "Saved, but eBay push failed",
          description: `Local price saved. eBay rejected the update on ${sync.failed} listing${sync.failed === 1 ? '' : 's'}: ${sync.errors[0] || 'unknown error'}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Price updated", description: "Saved to the customer's inventory. No live eBay listing to update." });
      }
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const openCustomerCatalog = (customerUserId: string, customerName: string) => {
    setCatalogCustomerId(customerUserId);
    setCatalogCustomerName(customerName);
    setCatalogSearch("");
    setCatalogPriceDrafts({});
  };

  const { data: pricingData } = useQuery<{ pricePerSet: number; increment: number; listerShare: number; platformShare: number; deadlineHours: number }>({
    queryKey: ['/api/drop-and-sell/pricing'],
  });

  const { data: paymentCards } = useQuery<any[]>({
    queryKey: ['/api/drop-and-sell/payment-cards'],
    enabled: !isAdmin,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidOrder = params.get('paid_order');
    const sessionId = params.get('session_id');
    const cancelled = params.get('cancelled_order');
    if (paidOrder && sessionId) {
      apiRequest('POST', `/api/drop-and-sell/orders/${paidOrder}/activate-payment`, { sessionId })
        .then(r => r.json())
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
          toast({ title: "Payment confirmed", description: "Your order is now awaiting freelancer assignment." });
          window.history.replaceState({}, '', '/drop-and-sell');
        })
        .catch((err: any) => toast({ title: "Payment confirmation failed", description: err.message || 'Please refresh and contact support.', variant: 'destructive' }));
    } else if (cancelled) {
      toast({ title: "Payment cancelled", description: "Your order is still unpaid. You can try again any time.", variant: 'destructive' });
      window.history.replaceState({}, '', '/drop-and-sell');
    }
  }, []);

  const pricePerSet = pricingData?.pricePerSet || 40;
  const listerShare = pricingData?.listerShare || 30;
  const platformShare = pricingData?.platformShare || 10;

  // Customer auto-listing preferences popup state.
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [prefCategoriesText, setPrefCategoriesText] = useState("");
  const [prefCategoriesNA, setPrefCategoriesNA] = useState(false);
  const [prefQuantity, setPrefQuantity] = useState<string>("1");
  const [prefPriceRange, setPrefPriceRange] = useState<string>("na"); // 'low' | 'high' | 'na'
  // Question — preferred profit margin markup (whole %). Empty string +
  // checkbox = "N/A (no preference)".
  const [prefMarginPercent, setPrefMarginPercent] = useState<string>("");
  const [prefMarginNA, setPrefMarginNA] = useState(true);
  // Question 4 — preferred supplier sites. Picked from the in-app Vendors
  // directory (1,200+ entries). Empty selection + "N/A" checked = no preference.
  const [prefVendors, setPrefVendors] = useState<string[]>([]);
  const [prefVendorsNA, setPrefVendorsNA] = useState(false);
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);

  // Admin "Assign Lister" dialog mode — 'assign' for first-time assignment,
  // 'reassign' to swap an underperforming lister for a new one.
  const [assignMode, setAssignMode] = useState<'assign' | 'reassign'>('assign');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [currentFreelancerId, setCurrentFreelancerId] = useState<number | null>(null);

  const createOrder = useMutation({
    mutationFn: async (payload: { count: number; categories: string[]; defaultQuantity: number; pricePreference: 'low' | 'high' | null; profitMarginPercent: number | null; preferredVendors: string[] }) => {
      const res = await apiRequest('POST', '/api/drop-and-sell/orders', {
        listingCount: payload.count,
        categories: payload.categories,
        defaultQuantity: payload.defaultQuantity,
        pricePreference: payload.pricePreference,
        profitMarginPercent: payload.profitMarginPercent,
        preferredVendors: payload.preferredVendors,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      toast({ title: "Order Created", description: `Request for ${setCount * LISTING_INCREMENT} listings submitted with your preferences. Your listings will be completed within 7 days.` });
      setPreferencesOpen(false);
      setActiveTab("orders");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const submitPreferencesAndOrder = () => {
    const categories = prefCategoriesNA
      ? []
      : prefCategoriesText
          .split(/[,\n]/)
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .slice(0, 25);
    const qty = Math.max(1, Math.min(999, parseInt(prefQuantity, 10) || 1));
    const pricePref = prefPriceRange === 'low' || prefPriceRange === 'high' ? prefPriceRange : null;
    // Profit margin: only honour a numeric value when N/A is unticked AND the
    // input parses to a sensible whole percentage (1–500). Otherwise null
    // means "no preference".
    let marginPct: number | null = null;
    if (!prefMarginNA) {
      const m = parseInt(prefMarginPercent, 10);
      if (Number.isFinite(m) && m >= 1 && m <= 500) marginPct = m;
    }
    const preferredVendors = prefVendorsNA ? [] : prefVendors.slice(0, 50);
    createOrder.mutate({
      count: totalProducts,
      categories,
      defaultQuantity: qty,
      pricePreference: pricePref as 'low' | 'high' | null,
      profitMarginPercent: marginPct,
      preferredVendors,
    });
  };

  const payOrder = useMutation({
    mutationFn: async ({ orderId }: { orderId: number }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/pay`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Payment Failed", description: "Could not start Stripe checkout — please try again.", variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "Payment Failed", description: err.message, variant: "destructive" }),
  });

  const resetPayment = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/reset-payment`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      toast({ title: "Payment reset", description: "Order is now unpaid. The customer can re-pay through Stripe." });
    },
    onError: (err: any) => toast({ title: "Reset failed", description: err.message, variant: "destructive" }),
  });

  const [listProductOpen, setListProductOpen] = useState(false);
  const [listProductOrderId, setListProductOrderId] = useState<number | null>(null);
  const emptyListingForm = {
    vendorUrl: '',
    title: '',
    description: '',
    brand: '',
    sku: '',
    costPrice: '',
    sellingPrice: '',
    quantity: '1',
    imagesText: '',
    deliveryType: 'buyer_pays' as 'buyer_pays' | 'seller_pays' | 'free',
    deliveryCost: '0',
    // Empty string = "use the order's pinned default" (server falls
    // back to order.storeId or the lone connected store). Populated
    // with a numeric id (stringified) when the lister picks a store
    // from the dropdown — required when the customer has more than
    // one eBay store connected.
    storeId: '',
  };
  const [listingForm, setListingForm] = useState(emptyListingForm);
  // The assignment row that opened the dialog — kept around so the
  // dialog can read the customer's connected eBay stores and show the
  // picker.
  const activeListingAssignment = (myAssignments || []).find((a: any) => a.id === listProductOrderId);

  const listProduct = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: number; payload: any }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/list-product`, payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-listings'] });
      setListProductOpen(false);
      setListingForm(emptyListingForm);
      toast({
        title: data.complete ? "Order completed!" : "Listed on eBay",
        description: data.complete
          ? `All ${data.total} listings done — order moved to awaiting approval.`
          : `Listing ${data.progress} of ${data.total} published${data.listingUrl ? '' : ''}.`,
      });
    },
    onError: (err: any) => toast({ title: "Listing failed", description: err.message, variant: "destructive" }),
  });

  // === MY LISTINGS — edit / delete / AI optimize state + mutations ===
  const [editListingOpen, setEditListingOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState<number | null>(null);
  const emptyEditForm = {
    title: '',
    description: '',
    brand: '',
    sellingPrice: '',
    costPrice: '',
    sku: '',
    quantity: '1',
    imagesText: '',
    deliveryType: 'buyer_pays' as 'buyer_pays' | 'seller_pays' | 'free',
    deliveryCost: '0',
    variationsText: '',
  };
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiOptimizingTitle, setAiOptimizingTitle] = useState(false);
  const [editItemSpecifics, setEditItemSpecifics] = useState<Record<string, string> | null>(null);
  const [deleteListingId, setDeleteListingId] = useState<number | null>(null);

  const openEditListing = (l: any) => {
    setEditingListingId(l.productId);
    const variationsArr = Array.isArray(l.variations) ? l.variations : [];
    setEditForm({
      title: l.title || '',
      description: l.description || '',
      brand: l.brand || '',
      sellingPrice: String(l.sellingPrice || ''),
      costPrice: String(l.costPrice || ''),
      sku: l.sku || '',
      quantity: String(l.quantity ?? 1),
      imagesText: Array.isArray(l.images) ? l.images.join('\n') : '',
      deliveryType: l.deliveryType || 'buyer_pays',
      deliveryCost: String(l.deliveryCost || '0'),
      variationsText: variationsArr.length
        ? variationsArr.map((v: any) => `${v.type || 'Option'}|${v.value || ''}|${v.price ?? ''}|${v.quantity ?? ''}`).join('\n')
        : '',
    });
    const existingSpecs = (l.attributes && l.attributes.itemSpecifics) || null;
    setEditItemSpecifics(existingSpecs && typeof existingSpecs === 'object' ? existingSpecs : null);
    setEditListingOpen(true);
  };

  const updateMyListing = useMutation({
    mutationFn: async ({ productId, payload }: { productId: number; payload: any }) => {
      const res = await apiRequest('PATCH', `/api/drop-and-sell/my-listings/${productId}`, payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-listings'] });
      setEditListingOpen(false);
      setEditingListingId(null);
      setEditForm(emptyEditForm);
      const sync = data?.ebaySync as { synced: number; failed: number; errors: string[] } | undefined;
      if (sync && sync.synced > 0 && sync.failed === 0) {
        toast({
          title: "Price updated on eBay",
          description: `New price is live on ${sync.synced} eBay listing${sync.synced === 1 ? '' : 's'}. Buyers will see it within a minute.`,
        });
      } else if (sync && sync.failed > 0) {
        toast({
          title: "Saved, but eBay push failed",
          description: `Local changes saved. eBay rejected the update on ${sync.failed} listing${sync.failed === 1 ? '' : 's'}: ${sync.errors[0] || 'unknown error'}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Listing updated", description: "Changes saved. The customer's auto-fulfillment will use the new values." });
      }
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const deleteMyListing = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest('DELETE', `/api/drop-and-sell/my-listings/${productId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-listings'] });
      setDeleteListingId(null);
      const live = Array.isArray(data?.liveListingIds) ? data.liveListingIds : [];
      toast({
        title: "Listing removed",
        description: live.length
          ? `Removed from inventory. Note: the eBay listing (${live[0]?.slice(0, 12)}…) is still live and may need to be ended manually by the customer.`
          : 'Removed from the customer inventory.',
      });
    },
    onError: (err: any) => {
      setDeleteListingId(null);
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const aiOptimizeMyListing = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/my-listings/${productId}/ai-optimize-description`, {
        title: editForm.title,
        description: editForm.description,
        brand: editForm.brand,
      });
      return res.json();
    },
    onMutate: () => setAiOptimizing(true),
    onSettled: () => setAiOptimizing(false),
    onSuccess: (data: any) => {
      if (data?.description) {
        setEditForm(prev => ({
          ...prev,
          description: data.description,
          brand: (!prev.brand?.trim() && data?.itemSpecifics?.Brand) ? String(data.itemSpecifics.Brand).trim() : prev.brand,
        }));
        if (data?.itemSpecifics && typeof data.itemSpecifics === 'object') {
          setEditItemSpecifics(data.itemSpecifics);
        }
        const specCount = data?.itemSpecifics ? Object.keys(data.itemSpecifics).length : 0;
        toast({ title: "AI rewrote the description", description: specCount > 0 ? `Description + ${specCount} eBay item specifics (Brand, Type, MPN, Colour…) saved. Review and save.` : 'Review the result before saving.' });
      }
    },
    onError: (err: any) => toast({ title: "AI optimize failed", description: err.message, variant: "destructive" }),
  });

  const aiOptimizeMyListingTitle = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/my-listings/${productId}/ai-optimize-title`, {
        title: editForm.title,
        description: editForm.description,
        brand: editForm.brand,
      });
      return res.json();
    },
    onMutate: () => setAiOptimizingTitle(true),
    onSettled: () => setAiOptimizingTitle(false),
    onSuccess: (data: any) => {
      if (data?.title) {
        setEditForm(prev => ({ ...prev, title: data.title }));
        toast({ title: "AI rewrote the title", description: 'Review the result before saving.' });
      } else {
        toast({ title: "AI title failed", description: data?.message || 'No title returned.', variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "AI title failed", description: err.message, variant: "destructive" }),
  });

  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const deleteOrder = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('DELETE', `/api/drop-and-sell/orders/${orderId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      setDeleteOrderId(null);
      toast({ title: "Order deleted", description: "Your request has been removed." });
    },
    onError: (err: any) => {
      setDeleteOrderId(null);
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    },
  });

  const createPaymentCard = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/drop-and-sell/payment-cards', data);
      return res.json();
    },
    onSuccess: (newCardData: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/payment-cards'] });
      setAddCardOpen(false);
      setNewCard({ lastFour: '', brand: 'visa', expiryMonth: '', expiryYear: '', tokenizedId: '', isDefault: false });
      if (newCardData?.id) setSelectedCardId(String(newCardData.id));
      toast({ title: "Card Added", description: "Payment card saved successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignOrder = useMutation({
    mutationFn: async ({ orderId, freelancerId }: { orderId: number; freelancerId: number }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/assign`, { freelancerId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      setAssignDialogOpen(false);
      toast({ title: "Freelancer Assigned", description: "7-day countdown started" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const extendDeadline = useMutation({
    mutationFn: async ({ orderId, hours }: { orderId: number; hours: number }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/extend-deadline`, { hours });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      const newDate = data?.newDeadline ? new Date(data.newDeadline).toLocaleString() : 'updated';
      toast({ title: 'Deadline extended', description: `+${data?.hoursAdded || 72} hours added. New deadline: ${newDate}.` });
    },
    onError: (err: any) => toast({ title: 'Could not extend deadline', description: err.message, variant: 'destructive' }),
  });

  const reassignOrder = useMutation({
    mutationFn: async ({ orderId, freelancerId, reason }: { orderId: number; freelancerId: number; reason?: string }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/reassign`, { freelancerId, reason });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      setAssignDialogOpen(false);
      setReassignReason('');
      setSelectedFreelancerId('');
      toast({ title: "Lister Reassigned", description: `Order moved to ${data?.assignedFreelancer || 'the new lister'} — 7-day timer restarted.` });
    },
    onError: (err: any) => toast({ title: "Reassign Failed", description: err.message, variant: "destructive" }),
  });

  const autoAssign = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/auto-assign`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      toast({ title: "Auto-Assigned", description: `Assigned to ${data.assignedFreelancer || 'best available freelancer'}` });
    },
    onError: (err: any) => toast({ title: "Auto-Assign Failed", description: err.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ orderId, status, notes, deliverySummary }: { orderId: number; status: string; notes?: string; deliverySummary?: any }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/status`, { status, notes, deliverySummary });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      setStatusDialogOpen(false);
      setDeliveryLinks("");
      setDeliveryDescription("");
      toast({ title: "Status Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ orderId, progressCount }: { orderId: number; progressCount: number }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/progress`, { progressCount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      setProgressDialogOpen(false);
      setProgressValue("");
      toast({ title: "Progress Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveDelivery = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      toast({ title: "Delivery Approved", description: "Lister payment has been credited." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectDelivery = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      setRejectDialogOpen(false);
      setRejectReason("");
      toast({ title: "Revision Requested", description: "The freelancer will be notified to make changes." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const submitFeedback = useMutation({
    mutationFn: async ({ orderId, feedback, rating }: { orderId: number; feedback: string; rating: number }) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/orders/${orderId}/feedback`, { feedback, rating });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/orders'] });
      setFeedbackDialogOpen(false);
      toast({ title: "Feedback Submitted", description: "Thank you for your feedback" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const applyAsLister = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/drop-and-sell/apply', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-application'] });
      setApplyDialogOpen(false);
      setSurveyYears("");
      setSurveyHasCommunity(false);
      setSurveyCommunityName("");
      setSurveyReferrals("");
      toast({ title: "Application Submitted", description: "Your application is under review. You will be notified once approved." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveLister = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/freelancers/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      toast({ title: "Lister Approved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectLister = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/drop-and-sell/freelancers/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      toast({ title: "Application Rejected" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteFreelancer = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/drop-and-sell/freelancers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/freelancers'] });
      toast({ title: "Freelancer Removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePricing = useMutation({
    mutationFn: async (price: number) => {
      const res = await apiRequest('POST', '/api/drop-and-sell/pricing', { pricePerSet: price });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/pricing'] });
      setPricingDialogOpen(false);
      toast({ title: "Pricing Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalProducts = setCount * LISTING_INCREMENT;
  const totalPrice = setCount * pricePerSet;
  const pendingOrders = orders?.filter(o => o.status === 'pending' || o.status === 'awaiting_assignment') || [];
  const activeOrders = orders?.filter(o => o.status === 'in_progress' || o.status === 'partially_completed' || o.status === 'awaiting_approval') || [];
  const completedOrders = orders?.filter(o => o.status === 'completed') || [];

  const totalFreelancerEarnings = freelancers?.reduce((sum, f) => sum + parseFloat(f.totalEarnings || '0'), 0) || 0;
  const totalPlatformRevenue = orders?.filter(o => o.status === 'completed').reduce((sum: number, o: any) => sum + parseFloat(o.platformFee || '0'), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <ShoppingBag className="w-6 h-6 text-[#285261]" />
            Drop&Sell Auto-Listing
          </h1>
          <p className="text-muted-foreground mt-1">We list winning products for you — fast, professionally, and at scale</p>
        </div>
        <PageRefreshButton />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Pending</CardTitle>
            <Clock className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700" data-testid="text-pending-count">{pendingOrders.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">In Progress</CardTitle>
            <Truck className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700" data-testid="text-active-count">{activeOrders.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700" data-testid="text-completed-count">{completedOrders.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Total Orders</CardTitle>
            <Package className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700" data-testid="text-total-count">{orders?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="request" data-testid="tab-request">Request Service</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">My Orders ({orders?.length || 0})</TabsTrigger>
          {!isAdmin && isApprovedLister && <TabsTrigger value="assignments" data-testid="tab-assignments">My Assignments ({myAssignments?.length || 0})</TabsTrigger>}
          {!isAdmin && isApprovedLister && <TabsTrigger value="my-listings" data-testid="tab-my-listings">My Listings ({myListings?.length || 0})</TabsTrigger>}
          {isAdmin && <TabsTrigger value="admin" data-testid="tab-admin">Admin Panel</TabsTrigger>}
          {isAdmin && <TabsTrigger value="freelancers" data-testid="tab-freelancers">Listers</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="request" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card className="border-2 border-[#285261]/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#285261]" />
                    Choose Your Package
                  </CardTitle>
                  <CardDescription>
                    Select a listing package. Turnaround: within 7 days.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Number of Sets</label>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSetCount(Math.max(1, setCount - 1))}
                        disabled={setCount <= 1}
                        data-testid="button-decrease-sets"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <div className="flex-1 text-center">
                        <span className="text-3xl font-bold text-[#285261]" data-testid="text-set-count">{setCount}</span>
                        <p className="text-xs text-muted-foreground">{setCount === 1 ? 'set' : 'sets'}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSetCount(setCount + 1)}
                        data-testid="button-increase-sets"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{setCount} {setCount === 1 ? 'set' : 'sets'} × {LISTING_INCREMENT} products</span>
                      <span className="font-medium">{totalProducts} products</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{setCount} {setCount === 1 ? 'set' : 'sets'} × £{pricePerSet}</span>
                      <span className="font-medium">£{totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Delivery timeframe</span>
                      <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> Within 7 days</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-[#285261]" data-testid="text-total-price">{totalProducts} products — £{totalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-[#285261] hover:bg-[#1e3f4d] text-white"
                    size="lg"
                    onClick={() => {
                      // Reset preference inputs to defaults each time the
                      // customer opens the popup so previous selections don't
                      // leak between separate orders.
                      setPrefCategoriesText("");
                      setPrefCategoriesNA(false);
                      setPrefQuantity("1");
                      setPrefPriceRange("na");
                      setPreferencesOpen(true);
                    }}
                    disabled={createOrder.isPending}
                    data-testid="button-submit-request"
                  >
                    {createOrder.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Order {totalProducts} Listings — £{totalPrice.toFixed(2)}
                  </Button>
                </CardContent>
              </Card>

              {!isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <UserPlus className="w-4 h-4 text-[#285261]" />
                      Become a Freelance Lister
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {myApplication?.application?.applicationStatus === 'approved' ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm font-medium">You are an approved freelance lister</span>
                      </div>
                    ) : myApplication?.application?.applicationStatus === 'pending' ? (
                      <div className="flex items-center gap-2 text-amber-600">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm font-medium">Your application is under review</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Want to earn by listing products for other sellers? Apply to become a freelance lister.</p>
                        <Button className="w-full bg-[#285261] hover:bg-[#1e3f4d]" onClick={() => setApplyDialogOpen(true)} data-testid="button-apply-lister">
                          <UserPlus className="w-4 h-4 mr-2" /> Apply to Become a Lister
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#285261]" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: "1", title: "Select Sets", desc: `Choose how many sets you need — each set is ${LISTING_INCREMENT} products for £${pricePerSet}. Add as many sets as you like.` },
                    { step: "2", title: "Make Payment", desc: "Pay with your card on file. Your order is placed in the queue once paid." },
                    { step: "3", title: "Lister Assignment", desc: "A verified expert lister is assigned to your order. The 7-day countdown begins." },
                    { step: "4", title: "Products Listed", desc: "Your lister researches and lists winning, trending products on your connected store." },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#285261] text-white flex items-center justify-center text-xs font-bold">
                        {item.step}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>{isAdmin ? 'All Customer Orders' : 'Your Orders'}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !orders?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{isAdmin ? 'No customer orders yet.' : 'No orders yet. Submit your first request to get started.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        {isAdmin && <TableHead>Customer</TableHead>}
                        <TableHead>Products</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => {
                        const progress = order.progressCount || 0;
                        const pct = order.listingCount > 0 ? Math.round((progress / order.listingCount) * 100) : 0;
                        return (
                          <TableRow key={order.id} data-testid={`row-das-order-${order.id}`}>
                            <TableCell className="font-mono text-xs">DAS-{order.id}</TableCell>
                            {isAdmin && (
                              <TableCell className="text-xs">
                                <div className="font-medium" data-testid={`text-customer-name-${order.id}`}>{order.customerName || 'Unknown'}</div>
                                <div className="text-muted-foreground" data-testid={`text-customer-email-${order.id}`}>{order.customerEmail || '-'}</div>
                              </TableCell>
                            )}
                            <TableCell className="font-medium">{order.listingCount}</TableCell>
                            <TableCell>£{parseFloat(order.totalPrice).toFixed(2)}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>
                              <div className="min-w-[80px]">
                                <div className="flex items-center gap-1 text-xs mb-1">
                                  <span className="font-medium">{progress}/{order.listingCount}</span>
                                  <span className="text-muted-foreground">({pct}%)</span>
                                </div>
                                <Progress value={pct} className="h-1.5" />
                              </div>
                            </TableCell>
                            <TableCell><DeadlineCountdown deadline={order.deadline} /></TableCell>
                            <TableCell>{getPaymentBadge(order.paymentStatus)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {/* Approve auto-listing on the customer's behalf — useful
                                      when the customer hasn't logged in to click Approve and the
                                      job is sitting in "Awaiting Approval". Re-uses the same
                                      server endpoint; the lister gets paid + notified as usual. */}
                                  {order.status === 'awaiting_approval' && (
                                    <Button
                                      size="sm"
                                      className="text-xs bg-green-600 hover:bg-green-700"
                                      onClick={() => approveDelivery.mutate(order.id)}
                                      disabled={approveDelivery.isPending}
                                      data-testid={`button-admin-approve-${order.id}`}
                                    >
                                      <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                                    </Button>
                                  )}
                                  {/* Admin tidy-up: server only allows admin delete on
                                      status='cancelled', so this stays hidden otherwise. */}
                                  {order.status === 'cancelled' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                      onClick={() => setDeleteOrderId(order.id)}
                                      data-testid={`button-admin-delete-order-${order.id}`}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                                    </Button>
                                  )}
                                  {order.status !== 'awaiting_approval' && order.status !== 'cancelled' && (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            {!isAdmin && (
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {order.paymentStatus === 'unpaid' && order.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      className="text-xs bg-[#285261] hover:bg-[#1e3f4d]"
                                      onClick={() => {
                                        setPayOrderId(order.id);
                                        const defaultCard = (paymentCards || []).find((c: any) => c.isDefault);
                                        setSelectedCardId(defaultCard ? String(defaultCard.id) : "");
                                        setPayDialogOpen(true);
                                      }}
                                      data-testid={`button-pay-${order.id}`}
                                    >
                                      <CreditCard className="w-3 h-3 mr-1" />
                                      Pay Now
                                    </Button>
                                  )}
                                  {order.paymentStatus !== 'paid' && !order.freelancerId && (order.status === 'pending' || order.status === 'cancelled') && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                      onClick={() => setDeleteOrderId(order.id)}
                                      data-testid={`button-delete-order-${order.id}`}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" />
                                      Delete
                                    </Button>
                                  )}
                                  {(order.status === 'awaiting_approval' || (order.status === 'completed' && order.deliverySummary)) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={() => { setViewingDelivery(order.deliverySummary); setDeliveryViewOpen(true); }}
                                      data-testid={`button-view-delivery-${order.id}`}
                                    >
                                      <Eye className="w-3 h-3 mr-1" /> View
                                    </Button>
                                  )}
                                  {order.status === 'awaiting_approval' && (
                                    <>
                                      <Button
                                        size="sm"
                                        className="text-xs bg-green-600 hover:bg-green-700"
                                        onClick={() => approveDelivery.mutate(order.id)}
                                        disabled={approveDelivery.isPending}
                                        data-testid={`button-approve-${order.id}`}
                                      >
                                        <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="text-xs"
                                        onClick={() => { setRejectOrderId(order.id); setRejectDialogOpen(true); }}
                                        data-testid={`button-reject-${order.id}`}
                                      >
                                        <XCircle className="w-3 h-3 mr-1" /> Revise
                                      </Button>
                                    </>
                                  )}
                                  {order.status === 'completed' && !order.userFeedback && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={() => { setFeedbackOrderId(order.id); setFeedbackDialogOpen(true); }}
                                      data-testid={`button-feedback-${order.id}`}
                                    >
                                      <MessageSquare className="w-3 h-3 mr-1" /> Feedback
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {!isAdmin && isApprovedLister && (
          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#285261]" />
                    My Assignments
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Filter by eBay username..."
                      value={assignmentFilter}
                      onChange={(e) => setAssignmentFilter(e.target.value)}
                      className="w-56 h-8 text-sm"
                      data-testid="input-assignment-filter"
                    />
                  </div>
                </div>
                <CardDescription>Orders assigned to you. List products directly to the requester's eBay store.</CardDescription>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : !myAssignments?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No assignments yet. Orders will appear here once assigned to you.</p>
                  </div>
                ) : (() => {
                  const filtered = myAssignments.filter((a: any) => {
                    if (!assignmentFilter) return true;
                    const search = assignmentFilter.toLowerCase();
                    return (a.ebayUsername || '').toLowerCase().includes(search) ||
                           (a.requesterName || '').toLowerCase().includes(search) ||
                           (a.requesterEmail || '').toLowerCase().includes(search);
                  });
                  return !filtered.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No assignments match "{assignmentFilter}"</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Requester</TableHead>
                            <TableHead>eBay Store</TableHead>
                            <TableHead>Products</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Deadline</TableHead>
                            <TableHead>Assigned</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((a: any) => {
                            const pct = a.listingCount > 0 ? Math.round((a.progressCount / a.listingCount) * 100) : 0;
                            return (
                              <TableRow key={a.id} data-testid={`row-assignment-${a.id}`}>
                                <TableCell className="font-mono text-xs align-top">
                                  <div>DAS-{a.id}</div>
                                  {/* Customer auto-listing preferences — surfaces what
                                      this specific buyer wants so the lister can
                                      tailor the work. "N/A" means no preference. */}
                                  <div className="mt-2 space-y-1 text-[11px] font-sans font-normal text-muted-foreground border-t pt-2 max-w-[220px]">
                                    <div data-testid={`text-pref-categories-${a.id}`}>
                                      <span className="font-semibold text-foreground">Categories:</span>{' '}
                                      {Array.isArray(a.categories) && a.categories.length > 0
                                        ? a.categories.join(', ')
                                        : <span className="italic">N/A (any)</span>}
                                    </div>
                                    <div data-testid={`text-pref-quantity-${a.id}`}>
                                      <span className="font-semibold text-foreground">Qty per product:</span>{' '}
                                      {a.defaultQuantity ?? 1}
                                    </div>
                                    <div data-testid={`text-pref-price-${a.id}`}>
                                      <span className="font-semibold text-foreground">Price range:</span>{' '}
                                      {a.pricePreference === 'low'
                                        ? 'Low-price products'
                                        : a.pricePreference === 'high'
                                          ? 'High-price products'
                                          : <span className="italic">N/A (any)</span>}
                                    </div>
                                    <div data-testid={`text-pref-margin-${a.id}`}>
                                      <span className="font-semibold text-foreground">Profit margin:</span>{' '}
                                      {typeof (a as any).profitMarginPercent === 'number' && (a as any).profitMarginPercent > 0
                                        ? `+${(a as any).profitMarginPercent}% on top of vendor cost`
                                        : <span className="italic">N/A (lister decides)</span>}
                                    </div>
                                    <div data-testid={`text-pref-vendors-${a.id}`}>
                                      <span className="font-semibold text-foreground">Preferred vendors:</span>{' '}
                                      {Array.isArray(a.preferredVendors) && a.preferredVendors.length > 0
                                        ? (
                                          <span className="inline-flex flex-wrap gap-1 mt-0.5 align-middle">
                                            {a.preferredVendors.slice(0, 8).map((v: string) => (
                                              <span
                                                key={v}
                                                className="inline-block px-1.5 py-0.5 rounded bg-[#285261]/10 text-[#285261] border border-[#285261]/20 text-[10px]"
                                              >
                                                {v}
                                              </span>
                                            ))}
                                            {a.preferredVendors.length > 8 && (
                                              <span className="text-[10px] italic">+{a.preferredVendors.length - 8} more</span>
                                            )}
                                          </span>
                                        )
                                        : <span className="italic">N/A (any vendor)</span>}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="text-sm font-medium">{a.requesterName}</p>
                                    <p className="text-xs text-muted-foreground">{a.requesterEmail}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {a.ebayUsername ? (
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <ShoppingBag className="w-3.5 h-3.5 text-[#285261]" />
                                        <a
                                          href={`https://www.ebay.com/usr/${a.ebayUsername}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium text-[#285261] hover:underline"
                                          data-testid={`link-ebay-store-${a.id}`}
                                        >
                                          @{a.ebayUsername}
                                        </a>
                                      </div>
                                      {a.ebayStoreReady ? (
                                        <Badge variant="outline" className="w-fit text-[10px] border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30" data-testid={`badge-store-linked-${a.id}`}>
                                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Linked &amp; ready
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="w-fit text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                                          <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Reconnect needed
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No eBay store linked</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{a.listingCount}</TableCell>
                                <TableCell>
                                  <div className="min-w-[80px]">
                                    <div className="text-xs font-medium mb-1">{a.progressCount}/{a.listingCount} ({pct}%)</div>
                                    <Progress value={pct} className="h-1.5" />
                                  </div>
                                </TableCell>
                                <TableCell>{getStatusBadge(a.status)}</TableCell>
                                <TableCell><DeadlineCountdown deadline={a.deadline} /></TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : '-'}
                                </TableCell>
                                <TableCell>
                                  {a.ebayStoreReady && ['in_progress', 'partially_completed'].includes(a.status) && a.progressCount < a.listingCount ? (
                                    <Button
                                      size="sm"
                                      className="text-xs bg-[#285261] hover:bg-[#1e3f4d]"
                                      onClick={() => {
                                        setListProductOrderId(a.id);
                                        // Pre-select whichever connected eBay store
                                        // the order is pinned to (funma70 for
                                        // Margaret etc). The lister can change it
                                        // in the dialog before publishing.
                                        const stores: Array<{ id: number; isDefault?: boolean }> = Array.isArray(a.ebayStores) ? a.ebayStores : [];
                                        // Only auto-pick when there's a real
                                        // pinned default or one connected
                                        // store; otherwise force the lister
                                        // to choose explicitly.
                                        const def = stores.find(s => s.isDefault) || (stores.length === 1 ? stores[0] : undefined);
                                        setListingForm({
                                          ...emptyListingForm,
                                          storeId: def ? String(def.id) : '',
                                        });
                                        setListProductOpen(true);
                                      }}
                                      data-testid={`button-list-product-${a.id}`}
                                    >
                                      <Plus className="w-3 h-3 mr-1" /> List Product
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!isAdmin && isApprovedLister && (
          <TabsContent value="my-listings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[#285261]" />
                  My Listings
                </CardTitle>
                <CardDescription>
                  Every product you've published into a customer's eBay store. Click the eBay link to view the live listing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-[#285261]/5 border border-[#285261]/20 rounded-md flex items-start gap-3" data-testid="banner-my-listings-tip">
                  <Zap className="w-5 h-5 text-[#285261] flex-shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong className="text-[#285261]">TIP:</strong> Use the Chrome extension on any vendor page (Amazon, AliExpress, Walmart, Etsy, Shein, eBay).
                    Pick this customer in the extension's <em>"List Into → Drop-and-Sell"</em> dropdown — title, images, variations and price are filled in automatically.
                    No more manual entry.
                  </div>
                </div>
                {myListingsLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : !myListings?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No listings yet. Once you publish products via "List Product" on an assignment, they'll show here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Order</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>eBay Store</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Cost / eBay</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>eBay Listing</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myListings.map((l: any) => (
                          <TableRow key={l.productId} data-testid={`row-my-listing-${l.productId}`}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {l.orderId ? `DAS-${l.orderId}` : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {l.customerUserId ? (
                                <button
                                  type="button"
                                  className="text-[#285261] hover:underline font-medium text-left"
                                  onClick={() => openCustomerCatalog(l.customerUserId, l.customerName)}
                                  data-testid={`button-open-customer-catalog-${l.productId}`}
                                  title="Open this customer's full catalog"
                                >
                                  {l.customerName}
                                </button>
                              ) : (
                                l.customerName
                              )}
                            </TableCell>
                            <TableCell>
                              {l.customerEbayUsername ? (
                                <a
                                  href={`https://www.ebay.com/usr/${l.customerEbayUsername}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#285261] hover:underline"
                                  data-testid={`link-customer-ebay-${l.productId}`}
                                >
                                  @{l.customerEbayUsername}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm max-w-[260px] truncate" title={l.title} data-testid={`text-listing-title-${l.productId}`}>
                              {l.title}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{l.sku}</TableCell>
                            <TableCell className="text-right text-xs whitespace-nowrap">
                              <div>£{Number(l.costPrice || 0).toFixed(2)}</div>
                              <div className="text-[#285261] font-semibold">£{Number(l.sellingPrice || 0).toFixed(2)}</div>
                            </TableCell>
                            <TableCell>
                              {l.vendorUrl ? (
                                <a
                                  href={l.vendorUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                  data-testid={`link-vendor-${l.productId}`}
                                >
                                  {l.vendorName || 'Vendor'}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">{l.vendorName || '-'}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {l.listingUrl ? (
                                <a
                                  href={l.listingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[#285261] hover:underline inline-flex items-center gap-1"
                                  data-testid={`link-ebay-listing-${l.productId}`}
                                >
                                  <Eye className="w-3 h-3" /> View
                                </a>
                              ) : l.externalId ? (
                                <span className="font-mono text-[10px] text-muted-foreground" title={l.externalId}>{l.externalId.slice(0, 12)}…</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  l.listingStatus === 'active' ? 'bg-green-500/10 text-green-700 border-green-200' :
                                  l.listingStatus === 'ended' ? 'bg-gray-500/10 text-gray-700 border-gray-200' :
                                  'bg-yellow-500/10 text-yellow-700 border-yellow-200'
                                }
                              >
                                {l.listingStatus || 'pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => openEditListing(l)}
                                  data-testid={`button-edit-listing-${l.productId}`}
                                >
                                  <Settings className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteListingId(l.productId)}
                                  data-testid={`button-delete-listing-${l.productId}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-600">Platform Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">£{totalPlatformRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">From completed jobs</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-600">Lister Payouts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">£{totalFreelancerEarnings.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Total earned by listers</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-600">Active Listers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700">{freelancers?.filter(f => f.isAvailable).length || 0}</div>
                  <p className="text-xs text-muted-foreground">Available for assignment</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Jobs (Admin View)</CardTitle>
                <CardDescription>Manage all listing orders, assign listers, and track progress</CardDescription>
              </CardHeader>
              <CardContent>
                {!orders?.length ? (
                  <p className="text-center py-8 text-muted-foreground">No orders yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Products</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Split</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Lister</TableHead>
                          <TableHead>Payout</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order: any) => {
                          const progress = order.progressCount || 0;
                          const pct = order.listingCount > 0 ? Math.round((progress / order.listingCount) * 100) : 0;
                          return (
                            <TableRow key={order.id} data-testid={`row-admin-order-${order.id}`}>
                              <TableCell className="font-mono text-xs align-top">
                                <div>DAS-{order.id}</div>
                                {/* Customer auto-listing preferences (questionnaire
                                    answers) so admins can see what the buyer asked
                                    for. "N/A" means no preference. */}
                                <div className="mt-2 space-y-1 text-[11px] font-sans font-normal text-muted-foreground border-t pt-2 max-w-[220px]">
                                  <div data-testid={`text-pref-categories-admin-${order.id}`}>
                                    <span className="font-semibold text-foreground">Categories:</span>{' '}
                                    {Array.isArray(order.categories) && order.categories.length > 0
                                      ? order.categories.join(', ')
                                      : <span className="italic">N/A (any)</span>}
                                  </div>
                                  <div data-testid={`text-pref-quantity-admin-${order.id}`}>
                                    <span className="font-semibold text-foreground">Qty per product:</span>{' '}
                                    {order.defaultQuantity ?? 1}
                                  </div>
                                  <div data-testid={`text-pref-price-admin-${order.id}`}>
                                    <span className="font-semibold text-foreground">Price range:</span>{' '}
                                    {order.pricePreference === 'low'
                                      ? 'Low-price products'
                                      : order.pricePreference === 'high'
                                        ? 'High-price products'
                                        : <span className="italic">N/A (any)</span>}
                                  </div>
                                  <div data-testid={`text-pref-margin-admin-${order.id}`}>
                                    <span className="font-semibold text-foreground">Profit margin:</span>{' '}
                                    {typeof order.profitMarginPercent === 'number' && order.profitMarginPercent > 0
                                      ? `+${order.profitMarginPercent}% on top of vendor cost`
                                      : <span className="italic">N/A (lister decides)</span>}
                                  </div>
                                  <div data-testid={`text-pref-vendors-admin-${order.id}`}>
                                    <span className="font-semibold text-foreground">Preferred vendors:</span>{' '}
                                    {Array.isArray(order.preferredVendors) && order.preferredVendors.length > 0
                                      ? (
                                        <span className="inline-flex flex-wrap gap-1 mt-0.5 align-middle">
                                          {order.preferredVendors.slice(0, 8).map((v: string) => (
                                            <span
                                              key={v}
                                              className="inline-block px-1.5 py-0.5 rounded bg-[#285261]/10 text-[#285261] border border-[#285261]/20 text-[10px]"
                                            >
                                              {v}
                                            </span>
                                          ))}
                                          {order.preferredVendors.length > 8 && (
                                            <span className="text-[10px] italic">+{order.preferredVendors.length - 8} more</span>
                                          )}
                                        </span>
                                      )
                                      : <span className="italic">N/A (any vendor)</span>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div>{order.customerName || '-'}</div>
                                <div className="text-muted-foreground">{order.customerEmail || ''}</div>
                              </TableCell>
                              <TableCell className="font-medium">{order.listingCount}</TableCell>
                              <TableCell>£{parseFloat(order.totalPrice).toFixed(2)}</TableCell>
                              <TableCell className="text-xs">
                                <div>Lister: £{parseFloat(order.listerEarnings || '0').toFixed(2)}</div>
                                <div className="text-muted-foreground">Platform: £{parseFloat(order.platformFee || '0').toFixed(2)}</div>
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <div className="min-w-[80px]">
                                  <div className="text-xs font-medium mb-1">{progress}/{order.listingCount}</div>
                                  <Progress value={pct} className="h-1.5" />
                                </div>
                              </TableCell>
                              <TableCell><DeadlineCountdown deadline={order.deadline} /></TableCell>
                              <TableCell className="text-xs">
                                {order.freelancer?.name ? (
                                  <div className="flex flex-col gap-1">
                                    <span>{order.freelancer.name}</span>
                                    {['in_progress', 'partially_completed'].includes(order.status) && (
                                      <button
                                        className="text-[10px] text-orange-700 hover:underline font-medium cursor-pointer text-left"
                                        onClick={() => {
                                          setAssignMode('reassign');
                                          setAssignOrderId(order.id);
                                          setCurrentFreelancerId(order.freelancerId);
                                          setSelectedFreelancerId('');
                                          setReassignReason('');
                                          setAssignDialogOpen(true);
                                        }}
                                        data-testid={`link-reassign-lister-${order.id}`}
                                      >
                                        ↻ Reassign
                                      </button>
                                    )}
                                  </div>
                                ) : order.paymentStatus === 'paid' && !order.freelancerId ? (
                                  <button
                                    className="text-[#285261] hover:underline font-medium cursor-pointer"
                                    onClick={() => { setAssignMode('assign'); setAssignOrderId(order.id); setCurrentFreelancerId(null); setAssignDialogOpen(true); }}
                                    data-testid={`link-assign-lister-${order.id}`}
                                  >
                                    Assign Lister
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{getPayoutBadge(order.payoutStatus || 'pending')}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {!order.freelancerId && order.paymentStatus === 'paid' && (
                                    <>
                                      <Button size="sm" variant="outline" className="text-xs"
                                        onClick={() => { setAssignMode('assign'); setAssignOrderId(order.id); setCurrentFreelancerId(null); setAssignDialogOpen(true); }}
                                        data-testid={`button-assign-${order.id}`}
                                      >
                                        <UserPlus className="w-3 h-3 mr-1" /> Assign
                                      </Button>
                                      <Button size="sm" className="text-xs bg-[#285261] hover:bg-[#1e3f4d]"
                                        onClick={() => autoAssign.mutate(order.id)}
                                        disabled={autoAssign.isPending}
                                        data-testid={`button-auto-assign-${order.id}`}
                                      >
                                        <Zap className="w-3 h-3 mr-1" /> Auto
                                      </Button>
                                    </>
                                  )}
                                  {order.freelancerId && ['in_progress', 'partially_completed'].includes(order.status) && (
                                    <>
                                      <Button size="sm" variant="outline" className="text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                                        onClick={() => {
                                          setAssignMode('reassign');
                                          setAssignOrderId(order.id);
                                          setCurrentFreelancerId(order.freelancerId);
                                          setSelectedFreelancerId('');
                                          setReassignReason('');
                                          setAssignDialogOpen(true);
                                        }}
                                        data-testid={`button-reassign-${order.id}`}
                                      >
                                        <RefreshCw className="w-3 h-3 mr-1" /> Reassign
                                      </Button>
                                      <Button size="sm" variant="outline" className="text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                                        onClick={() => {
                                          if (window.confirm(`Extend the deadline for order DAS-${order.id} by 72 hours (3 days)?\n\nThis is logged in the order's notes for the audit trail. Click Cancel if you'd rather Reassign.`)) {
                                            extendDeadline.mutate({ orderId: order.id, hours: 72 });
                                          }
                                        }}
                                        disabled={extendDeadline.isPending}
                                        data-testid={`button-extend-deadline-${order.id}`}
                                      >
                                        <Timer className="w-3 h-3 mr-1" /> +3 days
                                      </Button>
                                    </>
                                  )}
                                  {order.freelancerId && ['in_progress', 'partially_completed'].includes(order.status) && (
                                    <Button size="sm" variant="outline" className="text-xs"
                                      onClick={() => { setProgressOrderId(order.id); setProgressValue(String(order.progressCount || 0)); setProgressDialogOpen(true); }}
                                      data-testid={`button-progress-${order.id}`}
                                    >
                                      <BarChart3 className="w-3 h-3 mr-1" /> Progress
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="text-xs"
                                    onClick={() => { setStatusOrderId(order.id); setNewStatus(order.status); setStatusNotes(order.notes || ''); setStatusDialogOpen(true); }}
                                    data-testid={`button-status-${order.id}`}
                                  >
                                    <Settings className="w-3 h-3 mr-1" /> Status
                                  </Button>
                                  {order.status === 'cancelled' && (
                                    <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => setDeleteOrderId(order.id)}
                                      data-testid={`button-delete-${order.id}`}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                                    </Button>
                                  )}
                                  {order.paymentStatus === 'paid' && !order.freelancerId && (
                                    <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => {
                                        if (window.confirm(`Reset payment for order #${order.id}?\n\nThis flips the order back to "Unpaid" so the customer can re-pay through Stripe. Only use this when no money actually arrived in Stripe.`)) {
                                          resetPayment.mutate(order.id);
                                        }
                                      }}
                                      disabled={resetPayment.isPending}
                                      data-testid={`button-reset-payment-${order.id}`}
                                    >
                                      <XCircle className="w-3 h-3 mr-1" /> Reset Payment
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="freelancers" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Freelance Listers</h2>
              <p className="text-sm text-muted-foreground">Review applications and manage approved listers</p>
            </div>

            {(() => {
              const pending = (freelancers || []).filter((f: any) => f.applicationStatus === 'pending');
              const approved = (freelancers || []).filter((f: any) => f.applicationStatus !== 'pending' && f.applicationStatus !== 'rejected');
              const rejected = (freelancers || []).filter((f: any) => f.applicationStatus === 'rejected');
              return (
                <>
                  {pending.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Pending Applications ({pending.length})
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {pending.map((f: any) => (
                          <Card key={f.id} className="border-amber-200 dark:border-amber-800" data-testid={`card-application-${f.id}`}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-base">{f.name}</CardTitle>
                                  <p className="text-xs text-muted-foreground">{f.email}</p>
                                </div>
                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Pending</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="bg-muted/30 border rounded-lg p-3 space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Application Responses</p>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Experience</span>
                                  <span className="font-medium">{
                                    f.yearsExperience === 'less_than_1' ? '< 1 year' :
                                    f.yearsExperience === '1_2' ? '1–2 years' :
                                    f.yearsExperience === '3_5' ? '3–5 years' :
                                    f.yearsExperience === '5_plus' ? '5+ years' : 'Not specified'
                                  }</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Has Community</span>
                                  <span className="font-medium">{f.hasCommunity ? (f.communityName || 'Yes') : 'No'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Referrals Made</span>
                                  <span className="font-medium">{f.referralsMade || 0}</span>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  className="text-xs flex-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => approveLister.mutate(f.id)}
                                  disabled={approveLister.isPending}
                                  data-testid={`button-approve-${f.id}`}
                                >
                                  <Check className="w-3 h-3 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs flex-1"
                                  onClick={() => rejectLister.mutate(f.id)}
                                  disabled={rejectLister.isPending}
                                  data-testid={`button-reject-application-${f.id}`}
                                >
                                  <XCircle className="w-3 h-3 mr-1" /> Reject
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Approved Listers ({approved.length})
                    </h3>
                    {!approved.length ? (
                      <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No approved listers yet.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Lister</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>Jobs</TableHead>
                                <TableHead>Active</TableHead>
                                <TableHead>Earned</TableHead>
                                <TableHead>Wallet</TableHead>
                                <TableHead>Experience</TableHead>
                                <TableHead>Community</TableHead>
                                <TableHead>Referrals</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {approved.map((f: any) => (
                                <TableRow key={f.id} data-testid={`row-freelancer-${f.id}`}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium text-sm">{f.name}</p>
                                      <p className="text-xs text-muted-foreground">{f.email}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={f.isAvailable ? "default" : "secondary"} className={f.isAvailable ? "bg-green-600 text-[11px]" : "text-[11px]"}>
                                      {f.isAvailable ? "Available" : "Busy"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="flex items-center gap-1 text-sm">
                                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                      {parseFloat(f.rating || '5').toFixed(1)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-sm">{f.completedJobs}</TableCell>
                                  <TableCell className="text-sm">{f.activeJobCount || 0}</TableCell>
                                  <TableCell className="text-sm font-medium">£{parseFloat(f.totalEarnings || '0').toFixed(2)}</TableCell>
                                  <TableCell>
                                    <span className="text-sm font-semibold text-green-700">£{parseFloat(f.walletBalance || '0').toFixed(2)}</span>
                                  </TableCell>
                                  <TableCell className="text-sm">{
                                    f.yearsExperience === 'less_than_1' ? '< 1 yr' :
                                    f.yearsExperience === '1_2' ? '1–2 yrs' :
                                    f.yearsExperience === '3_5' ? '3–5 yrs' :
                                    f.yearsExperience === '5_plus' ? '5+ yrs' : '—'
                                  }</TableCell>
                                  <TableCell className="text-sm">{f.hasCommunity ? (f.communityName || 'Yes') : '—'}</TableCell>
                                  <TableCell className="text-sm">{f.referralsMade || 0}</TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                      onClick={() => deleteFreelancer.mutate(f.id)}
                                      disabled={deleteFreelancer.isPending}
                                      data-testid={`button-delete-freelancer-${f.id}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </>
              );
            })()}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Pricing Configuration
                </CardTitle>
                <CardDescription>Configure the pricing for the Drop&Sell Auto-Listing service</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">Price Per Set (120 products)</div>
                    <div className="text-2xl font-bold text-[#285261]">£{pricePerSet}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">Lister Earns (per set)</div>
                    <div className="text-2xl font-bold text-green-600">£{listerShare}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">Platform Keeps (per set)</div>
                    <div className="text-2xl font-bold text-amber-600">£{platformShare}</div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground">Delivery Deadline</div>
                  <div className="text-lg font-bold">{pricingData?.deadlineHours || 72} hours</div>
                </div>
                <Button
                  onClick={() => { setNewPrice(String(pricePerSet)); setPricingDialogOpen(true); }}
                  variant="outline"
                  data-testid="button-open-pricing"
                >
                  <Settings className="w-4 h-4 mr-2" /> Update Price Per Set
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment & Payout Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>User pays upfront. Payment is deducted from their wallet balance.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Lister earns £{listerShare} per set ONLY when 100% listings are completed and verified.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Platform keeps £{platformShare} per set as a service fee.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Earnings are credited to the lister's wallet upon job completion/approval.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span>Hard stop: Once a lister completes all listings, system locks further access and marks job as complete.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignMode === 'reassign' ? 'Reassign Lister' : 'Assign Lister'} for Order DAS-{assignOrderId}
            </DialogTitle>
            <DialogDescription>
              {assignMode === 'reassign'
                ? 'Pick a different lister to take over this order. The current lister will be unassigned and the 7-day delivery clock restarts. Any listings already pushed remain credited.'
                : 'Select a lister. A 7-day countdown will begin upon assignment.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedFreelancerId} onValueChange={setSelectedFreelancerId}>
              <SelectTrigger data-testid="select-freelancer">
                <SelectValue placeholder={assignMode === 'reassign' ? 'Select a different lister' : 'Select a lister'} />
              </SelectTrigger>
              <SelectContent>
                {freelancers
                  ?.filter(f => f.isAvailable && (assignMode !== 'reassign' || f.id !== currentFreelancerId))
                  .map((f: any) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name} — {f.completedJobs} jobs · {parseFloat(f.rating || '5').toFixed(1)} rating · {f.activeJobCount || 0} active
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {assignMode === 'reassign' && (
              <div className="space-y-1.5">
                <Label htmlFor="reassign-reason" className="text-sm">Reason for reassignment (optional)</Label>
                <Textarea
                  id="reassign-reason"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Lister has gone silent, missed deadline, low quality, requested removal..."
                  rows={2}
                  data-testid="input-reassign-reason"
                />
                <p className="text-xs text-muted-foreground">Saved on the order's notes for the audit trail.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className={assignMode === 'reassign' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#285261] hover:bg-[#1e3f4d]'}
              disabled={!selectedFreelancerId || assignOrder.isPending || reassignOrder.isPending}
              onClick={() => {
                if (!assignOrderId || !selectedFreelancerId) return;
                if (assignMode === 'reassign') {
                  reassignOrder.mutate({ orderId: assignOrderId, freelancerId: Number(selectedFreelancerId), reason: reassignReason.trim() || undefined });
                } else {
                  assignOrder.mutate({ orderId: assignOrderId, freelancerId: Number(selectedFreelancerId) });
                }
              }}
              data-testid="button-confirm-assign"
            >
              {(assignOrder.isPending || reassignOrder.isPending)
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : (assignMode === 'reassign' ? <RefreshCw className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />)}
              {assignMode === 'reassign' ? 'Reassign & Restart Timer' : 'Assign & Start 7-Day Timer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status — DAS-{statusOrderId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="awaiting_assignment">Awaiting Assignment</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="partially_completed">Partially Completed</SelectItem>
                <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Notes (optional)" value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} data-testid="input-status-notes" />
            {newStatus === 'awaiting_approval' && (
              <>
                <Input placeholder="Delivery links (comma-separated)" value={deliveryLinks} onChange={(e) => setDeliveryLinks(e.target.value)} data-testid="input-delivery-links" />
                <Textarea placeholder="Delivery description" value={deliveryDescription} onChange={(e) => setDeliveryDescription(e.target.value)} data-testid="input-delivery-desc" />
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d]"
              disabled={!newStatus || updateStatus.isPending}
              onClick={() => {
                const deliverySummary = newStatus === 'awaiting_approval' && (deliveryLinks || deliveryDescription) ? { links: deliveryLinks.split(',').map(l => l.trim()).filter(Boolean), description: deliveryDescription } : undefined;
                statusOrderId && updateStatus.mutate({ orderId: statusOrderId, status: newStatus, notes: statusNotes || undefined, deliverySummary });
              }}
              data-testid="button-confirm-status"
            >
              {updateStatus.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Progress — DAS-{progressOrderId}</DialogTitle>
            <DialogDescription>Enter the number of products completed so far. System will auto-complete the job at 100%.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Products Completed</Label>
              <Input
                type="number"
                min="0"
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.value)}
                placeholder="e.g. 60"
                data-testid="input-progress"
              />
            </div>
            {progressValue && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm">
                  {Number(progressValue)} / {orders?.find(o => o.id === progressOrderId)?.listingCount || '?'} products
                </div>
                <Progress value={Math.min(100, (Number(progressValue) / (orders?.find(o => o.id === progressOrderId)?.listingCount || 1)) * 100)} className="h-2 mt-2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d]"
              disabled={!progressValue || updateProgress.isPending}
              onClick={() => progressOrderId && updateProgress.mutate({ orderId: progressOrderId, progressCount: Number(progressValue) })}
              data-testid="button-confirm-progress"
            >
              {updateProgress.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
              Update Progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(r => (
                <button
                  key={r}
                  onClick={() => setFeedbackRating(r)}
                  className="p-1"
                  data-testid={`button-rating-${r}`}
                >
                  <Star className={`w-6 h-6 ${r <= feedbackRating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
            <Textarea placeholder="Your feedback (optional)" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} data-testid="input-feedback" />
          </div>
          <DialogFooter>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d]"
              disabled={submitFeedback.isPending}
              onClick={() => feedbackOrderId && submitFeedback.mutate({ orderId: feedbackOrderId, feedback: feedbackText, rating: feedbackRating })}
              data-testid="button-confirm-feedback"
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>Explain what needs to be changed. The lister will be notified.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Describe the issues..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} data-testid="input-reject-reason" />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectDelivery.isPending}
              onClick={() => rejectOrderId && rejectDelivery.mutate({ orderId: rejectOrderId, reason: rejectReason })}
              data-testid="button-confirm-reject"
            >
              {rejectDelivery.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Send Revision Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === EDIT MY LISTING DIALOG === */}
      <Dialog open={editListingOpen} onOpenChange={(open) => { if (!open) { setEditListingOpen(false); setEditingListingId(null); setEditForm(emptyEditForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-my-listing">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
            <DialogDescription>
              Editing this listing updates the product in the customer's inventory and adjusts their auto-fulfillment SKU mapping. The eBay listing itself isn't re-published — the customer's hourly sync does that.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="edit-title">Title *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={aiOptimizingTitle || !editingListingId}
                  onClick={() => editingListingId && aiOptimizeMyListingTitle.mutate(editingListingId)}
                  data-testid="button-ai-optimize-title"
                >
                  {aiOptimizingTitle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  {aiOptimizingTitle ? 'Rewriting…' : 'AI Optimise Title'}
                </Button>
              </div>
              <Input id="edit-title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} maxLength={80} data-testid="input-edit-title" />
              <p className="text-[10px] text-muted-foreground mt-1">{editForm.title.length}/80 characters — eBay's hard limit.</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="edit-description">Description</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={aiOptimizing || !editingListingId}
                  onClick={() => editingListingId && aiOptimizeMyListing.mutate(editingListingId)}
                  data-testid="button-ai-optimize"
                >
                  {aiOptimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  {aiOptimizing ? 'Rewriting…' : 'AI Optimize for eBay'}
                </Button>
              </div>
              <Textarea id="edit-description" rows={6} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} data-testid="input-edit-description" />
              {editItemSpecifics && Object.keys(editItemSpecifics).length > 0 && (
                <div className="mt-2 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2" data-testid="block-item-specifics">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-violet-700 dark:text-violet-300">eBay Item Specifics ({Object.keys(editItemSpecifics).length})</div>
                    <span className="text-[10px] text-muted-foreground">Buyers use these to search & filter.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {Object.entries(editItemSpecifics).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2 min-w-0" data-testid={`spec-row-${k.toLowerCase().replace(/\s+/g, '-')}`}>
                        <span className="text-[11px] text-muted-foreground truncate">{k}</span>
                        <span className="text-[11px] font-medium truncate" title={String(v)}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-brand">Brand</Label>
                <Input id="edit-brand" value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} data-testid="input-edit-brand" />
              </div>
              <div>
                <Label htmlFor="edit-sku">SKU *</Label>
                <Input id="edit-sku" value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} data-testid="input-edit-sku" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="edit-cost">Cost £</Label>
                <Input id="edit-cost" type="number" step="0.01" min="0" value={editForm.costPrice} onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })} data-testid="input-edit-cost-price" />
              </div>
              <div>
                <Label htmlFor="edit-sell">eBay Price £ *</Label>
                <Input id="edit-sell" type="number" step="0.01" min="0" value={editForm.sellingPrice} onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })} data-testid="input-edit-selling-price" />
              </div>
              <div>
                <Label htmlFor="edit-qty">Qty</Label>
                <Input id="edit-qty" type="number" min="0" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} data-testid="input-edit-quantity" />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-images">Image URLs (one per line)</Label>
              <Textarea id="edit-images" rows={3} value={editForm.imagesText} onChange={(e) => setEditForm({ ...editForm, imagesText: e.target.value })} data-testid="input-edit-images" />
            </div>
            <div>
              <Label htmlFor="edit-variations">Variations (one per line — Type|Value|Price|Qty)</Label>
              <Textarea id="edit-variations" rows={3} placeholder="Colour|Red|29.99|10&#10;Size|Large|29.99|5" value={editForm.variationsText} onChange={(e) => setEditForm({ ...editForm, variationsText: e.target.value })} data-testid="input-edit-variations" />
              <p className="text-[11px] text-muted-foreground mt-1">Leave price/qty blank to inherit the listing's defaults.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Delivery</Label>
                <Select value={editForm.deliveryType} onValueChange={(v: any) => setEditForm({ ...editForm, deliveryType: v })}>
                  <SelectTrigger data-testid="select-edit-delivery-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer_pays">Buyer pays</SelectItem>
                    <SelectItem value="seller_pays">Seller pays</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.deliveryType !== 'free' && (
                <div>
                  <Label htmlFor="edit-delivery-cost">Delivery Cost £</Label>
                  <Input id="edit-delivery-cost" type="number" step="0.01" min="0" value={editForm.deliveryCost} onChange={(e) => setEditForm({ ...editForm, deliveryCost: e.target.value })} data-testid="input-edit-delivery-cost" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditListingOpen(false); setEditingListingId(null); setEditForm(emptyEditForm); }} data-testid="button-cancel-edit">Cancel</Button>
            <Button
              disabled={updateMyListing.isPending || !editingListingId}
              onClick={() => {
                if (!editingListingId) return;
                if (!editForm.title.trim() || !editForm.sku.trim() || !editForm.sellingPrice) {
                  toast({ title: "Missing details", description: "Title, SKU and eBay price are required.", variant: "destructive" });
                  return;
                }
                const images = editForm.imagesText.split('\n').map(s => s.trim()).filter(Boolean);
                const variations = editForm.variationsText
                  .split('\n')
                  .map(line => line.trim())
                  .filter(Boolean)
                  .map(line => {
                    const [type, value, priceStr, qtyStr] = line.split('|').map(s => (s || '').trim());
                    if (!type || !value) return null;
                    const v: any = { type, value, available: true };
                    if (priceStr) {
                      const p = parseFloat(priceStr);
                      if (!isNaN(p) && p >= 0) v.price = String(p);
                    }
                    if (qtyStr) {
                      const q = parseInt(qtyStr, 10);
                      if (!isNaN(q) && q >= 0) v.quantity = q;
                    }
                    return v;
                  })
                  .filter(Boolean);
                const payload: any = {
                  title: editForm.title.trim(),
                  description: editForm.description,
                  brand: editForm.brand,
                  sellingPrice: editForm.sellingPrice,
                  sku: editForm.sku.trim(),
                  quantity: parseInt(editForm.quantity, 10) || 0,
                  deliveryType: editForm.deliveryType,
                  deliveryCost: editForm.deliveryCost,
                };
                if (editForm.costPrice) payload.costPrice = editForm.costPrice;
                if (images.length) payload.images = images;
                if (variations.length) payload.variations = variations;
                updateMyListing.mutate({ productId: editingListingId, payload });
              }}
              data-testid="button-save-edit"
            >
              {updateMyListing.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DELETE MY LISTING CONFIRMATION === */}
      <Dialog open={deleteListingId !== null} onOpenChange={(open) => { if (!open) setDeleteListingId(null); }}>
        <DialogContent data-testid="dialog-delete-my-listing">
          <DialogHeader>
            <DialogTitle>Remove this listing?</DialogTitle>
            <DialogDescription>
              The product will be removed from the customer's inventory and the SKU-to-vendor mapping deleted. The eBay listing itself will stay live until the customer ends it manually on eBay (we'll show you the eBay ID after deletion).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteListingId(null)} data-testid="button-cancel-delete-listing">Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMyListing.isPending}
              onClick={() => deleteListingId && deleteMyListing.mutate(deleteListingId)}
              data-testid="button-confirm-delete-listing"
            >
              {deleteMyListing.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Remove Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={listProductOpen} onOpenChange={(open) => { if (!open) { setListProductOpen(false); setListingForm(emptyListingForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>List Product on Requester's eBay Store</DialogTitle>
            <DialogDescription>
              Order DAS-{listProductOrderId} — paste the vendor product page first. The listing is published to the requester's eBay and the vendor URL is saved with the SKU so their auto-fulfillment can source the item when an order comes in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {Array.isArray(activeListingAssignment?.ebayStores) && activeListingAssignment!.ebayStores.length > 1 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <Label htmlFor="lp-store" className="text-amber-900 font-semibold">
                  Publish to which eBay store? <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={listingForm.storeId}
                  onValueChange={(v) => setListingForm({ ...listingForm, storeId: v })}
                >
                  <SelectTrigger id="lp-store" className="mt-1 bg-white" data-testid="select-listing-store">
                    <SelectValue placeholder="Pick a store" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeListingAssignment!.ebayStores.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)} data-testid={`option-listing-store-${s.id}`}>
                        @{s.username || `store-${s.id}`}{s.isDefault ? ' — default' : ''}{s.ready === false ? ' (not linked)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-amber-900/80 mt-1.5">
                  This customer has more than one eBay store connected. Double-check you're publishing into the right one — the default is pre-selected.
                </p>
              </div>
            )}
            <div className="rounded-md border border-[#285261]/20 bg-[#285261]/5 p-3">
              <Label htmlFor="lp-vendor-url" className="text-[#285261] font-semibold">Vendor Product URL <span className="text-red-500">*</span></Label>
              <Input
                id="lp-vendor-url"
                value={listingForm.vendorUrl}
                onChange={(e) => setListingForm({ ...listingForm, vendorUrl: e.target.value })}
                placeholder="https://www.amazon.co.uk/dp/B0XXXXXXXX  or  https://www.aliexpress.com/item/..."
                className="mt-1"
                data-testid="input-listing-vendor-url"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                The vendor page where you'll source the item. Saved into the customer's SKU mapping so their auto-fulfillment knows where to order from.
              </p>
            </div>
            <div>
              <Label htmlFor="lp-title">Title <span className="text-red-500">*</span></Label>
              <Input id="lp-title" value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} maxLength={200} placeholder="e.g. Apple AirPods Pro 2nd Generation — White" data-testid="input-listing-title" />
            </div>
            <div>
              <Label htmlFor="lp-desc">Description</Label>
              <Textarea id="lp-desc" value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} rows={4} placeholder="Detailed product description..." data-testid="input-listing-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lp-brand">Brand</Label>
                <Input id="lp-brand" value={listingForm.brand} onChange={(e) => setListingForm({ ...listingForm, brand: e.target.value })} placeholder="e.g. Apple" data-testid="input-listing-brand" />
              </div>
              <div>
                <Label htmlFor="lp-sku">SKU <span className="text-red-500">*</span></Label>
                <Input id="lp-sku" value={listingForm.sku} onChange={(e) => setListingForm({ ...listingForm, sku: e.target.value })} placeholder="e.g. AIRPODS-PRO-2" data-testid="input-listing-sku" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="lp-cost-price">Vendor Cost (£)</Label>
                <Input id="lp-cost-price" type="number" step="0.01" min="0" value={listingForm.costPrice} onChange={(e) => setListingForm({ ...listingForm, costPrice: e.target.value })} placeholder="14.99" data-testid="input-listing-cost-price" />
                <p className="text-[10px] text-muted-foreground mt-0.5">What you'll pay the vendor</p>
              </div>
              <div>
                <Label htmlFor="lp-selling-price">eBay Price (£) <span className="text-red-500">*</span></Label>
                <Input id="lp-selling-price" type="number" step="0.01" min="0" value={listingForm.sellingPrice} onChange={(e) => setListingForm({ ...listingForm, sellingPrice: e.target.value })} placeholder="29.99" data-testid="input-listing-selling-price" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Price on the customer's eBay</p>
              </div>
              <div>
                <Label htmlFor="lp-qty">Quantity</Label>
                <Input id="lp-qty" type="number" min="1" value={listingForm.quantity} onChange={(e) => setListingForm({ ...listingForm, quantity: e.target.value })} data-testid="input-listing-quantity" />
              </div>
            </div>
            <div>
              <Label htmlFor="lp-images">Image URLs <span className="text-red-500">*</span> <span className="text-xs text-muted-foreground">(one per line, 1-24 images)</span></Label>
              <Textarea id="lp-images" value={listingForm.imagesText} onChange={(e) => setListingForm({ ...listingForm, imagesText: e.target.value })} rows={3} placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" data-testid="input-listing-images" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lp-delivery">Delivery</Label>
                <Select value={listingForm.deliveryType} onValueChange={(v: any) => setListingForm({ ...listingForm, deliveryType: v })}>
                  <SelectTrigger id="lp-delivery" data-testid="select-listing-delivery"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer_pays">Buyer pays</SelectItem>
                    <SelectItem value="seller_pays">Seller pays</SelectItem>
                    <SelectItem value="free">Free shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {listingForm.deliveryType !== 'free' && (
                <div>
                  <Label htmlFor="lp-delivery-cost">Delivery cost (£)</Label>
                  <Input id="lp-delivery-cost" type="number" step="0.01" min="0" value={listingForm.deliveryCost} onChange={(e) => setListingForm({ ...listingForm, deliveryCost: e.target.value })} data-testid="input-listing-delivery-cost" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setListProductOpen(false); setListingForm(emptyListingForm); }} data-testid="button-cancel-listing">
              Cancel
            </Button>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d]"
              disabled={listProduct.isPending}
              onClick={() => {
                if (!listProductOrderId) return;
                const images = listingForm.imagesText.split('\n').map(s => s.trim()).filter(Boolean);
                if (!listingForm.vendorUrl.trim() || !listingForm.title.trim() || !listingForm.sku.trim() || !listingForm.sellingPrice || images.length === 0) {
                  toast({ title: "Missing info", description: "Vendor URL, title, SKU, eBay price and at least one image URL are required.", variant: "destructive" });
                  return;
                }
                try { new URL(listingForm.vendorUrl.trim()); } catch {
                  toast({ title: "Invalid vendor URL", description: "Paste a full product page link starting with https://", variant: "destructive" });
                  return;
                }
                // If the customer has >1 connected eBay store, the lister
                // MUST have picked one. The server also enforces this but
                // checking here gives a clearer toast.
                const choices: any[] = Array.isArray(activeListingAssignment?.ebayStores) ? activeListingAssignment!.ebayStores : [];
                if (choices.length > 1 && !listingForm.storeId) {
                  toast({ title: "Pick a store", description: "This customer has multiple eBay stores connected — choose which one to publish into.", variant: "destructive" });
                  return;
                }
                listProduct.mutate({
                  orderId: listProductOrderId,
                  payload: {
                    vendorUrl: listingForm.vendorUrl.trim(),
                    title: listingForm.title.trim(),
                    description: listingForm.description,
                    brand: listingForm.brand,
                    sku: listingForm.sku.trim(),
                    sellingPrice: listingForm.sellingPrice,
                    costPrice: listingForm.costPrice || listingForm.sellingPrice,
                    quantity: Number(listingForm.quantity) || 1,
                    images,
                    deliveryType: listingForm.deliveryType,
                    deliveryCost: listingForm.deliveryType === 'free' ? '0' : listingForm.deliveryCost,
                    ...(listingForm.storeId ? { storeId: Number(listingForm.storeId) } : {}),
                  },
                });
              }}
              data-testid="button-submit-listing"
            >
              {listProduct.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Publish to eBay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOrderId !== null} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this order?</DialogTitle>
            <DialogDescription>
              This will permanently remove order DAS-{deleteOrderId}. Customers can only delete unpaid orders that no lister has picked up yet; admins can additionally clean up cancelled orders from the All Jobs table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOrderId(null)} data-testid="button-cancel-delete-order">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteOrder.isPending}
              onClick={() => deleteOrderId && deleteOrder.mutate(deleteOrderId)}
              data-testid="button-confirm-delete-order"
            >
              {deleteOrder.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Yes, delete it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveryViewOpen} onOpenChange={setDeliveryViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delivery Summary</DialogTitle>
          </DialogHeader>
          {viewingDelivery ? (
            <div className="space-y-3">
              {viewingDelivery.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{viewingDelivery.description}</p>
                </div>
              )}
              {viewingDelivery.links?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Product Links</Label>
                  <ul className="mt-1 space-y-1">
                    {viewingDelivery.links.map((link: string, i: number) => (
                      <li key={i}>
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No delivery summary available yet.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Freelance Lister Application</DialogTitle>
            <DialogDescription>Complete the survey below to apply as a freelance lister. Your application will be reviewed by our team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">1. How many years of professional experience do you have in dropshipping? <span className="text-red-500">*</span></Label>
                <Select value={surveyYears} onValueChange={setSurveyYears}>
                  <SelectTrigger data-testid="select-years-experience">
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="less_than_1">Less than 1 year</SelectItem>
                    <SelectItem value="1_2">1–2 years</SelectItem>
                    <SelectItem value="3_5">3–5 years</SelectItem>
                    <SelectItem value="5_plus">5+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">2. Are you currently operating or managing a dropshipping community?</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" size="sm" variant={surveyHasCommunity ? "default" : "outline"} className={surveyHasCommunity ? "bg-[#285261] hover:bg-[#1e3f4d]" : ""} onClick={() => setSurveyHasCommunity(true)} data-testid="button-community-yes">Yes</Button>
                  <Button type="button" size="sm" variant={!surveyHasCommunity ? "default" : "outline"} className={!surveyHasCommunity ? "bg-[#285261] hover:bg-[#1e3f4d]" : ""} onClick={() => { setSurveyHasCommunity(false); setSurveyCommunityName(""); }} data-testid="button-community-no">No</Button>
                </div>
              </div>

              {surveyHasCommunity && (
                <div className="space-y-2 pl-4 border-l-2 border-[#285261]/20">
                  <Label className="text-sm">3. What is the name of your community?</Label>
                  <Input placeholder="Enter community name" value={surveyCommunityName} onChange={(e) => setSurveyCommunityName(e.target.value)} data-testid="input-community-name" />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">{surveyHasCommunity ? "4" : "3"}. How many individuals have you successfully referred to date?</Label>
                <Input type="number" min="0" placeholder="e.g. 10" value={surveyReferrals} onChange={(e) => setSurveyReferrals(e.target.value)} data-testid="input-referrals-made" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d]"
              disabled={!surveyYears || applyAsLister.isPending}
              onClick={() => applyAsLister.mutate({ yearsExperience: surveyYears, hasCommunity: surveyHasCommunity, communityName: surveyHasCommunity ? surveyCommunityName : '', referralsMade: surveyReferrals })}
              data-testid="button-submit-application"
            >
              {applyAsLister.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Pricing</DialogTitle>
            <DialogDescription>Set the price per set of 120 listings (in GBP)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Price per 120 listings (£)</Label>
              <Input
                type="number"
                min="1"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="40"
                data-testid="input-new-price"
              />
            </div>
            {newPrice && Number(newPrice) > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p>120 products = <strong>£{Number(newPrice).toFixed(2)}</strong></p>
                <p>240 products = <strong>£{(Number(newPrice) * 2).toFixed(2)}</strong></p>
                <p className="text-xs text-muted-foreground mt-2">Lister: £{listerShare} · Platform: £{platformShare} per set</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d]"
              disabled={!newPrice || Number(newPrice) < 1 || updatePricing.isPending}
              onClick={() => updatePricing.mutate(Number(newPrice))}
              data-testid="button-confirm-pricing"
            >
              {updatePricing.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Update Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={(open) => { setPayDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay for Listing Order</DialogTitle>
            <DialogDescription>
              {payOrderId && orders ? (() => {
                const o = orders.find((o: any) => o.id === payOrderId);
                return o ? `${o.listingCount} products — £${parseFloat(o.totalPrice).toFixed(2)}` : '';
              })() : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-[#285261]/5 border border-[#285261]/20 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="text-foreground font-medium mb-1">Secure payment via Stripe</p>
              <p>You'll be taken to Stripe's secure checkout to enter your card details and complete payment. Your order will be assigned to a lister as soon as Stripe confirms the payment.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d]"
              disabled={payOrder.isPending}
              onClick={() => payOrderId && payOrder.mutate({ orderId: payOrderId })}
              data-testid="button-confirm-stripe-payment"
            >
              {payOrder.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Continue to Stripe — Pay £{payOrderId && orders ? parseFloat((orders.find((o: any) => o.id === payOrderId)?.totalPrice || '0')).toFixed(2) : '0.00'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Listing Preferences popup — shown to the customer right after
          they click "Order N Listings" but before the order is created. The
          answers are saved on the order and shown to the assigned lister so
          they can match the work to what the customer actually wants. */}
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-listing-preferences">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#285261]">
              <Zap className="w-5 h-5" /> Auto-Listing Preferences
            </DialogTitle>
            <DialogDescription>
              Please answer a few short questions so the assigned lister can tailor
              your {totalProducts} listings to your preferences. Choose <strong>N/A</strong> on
              any question if you have no preference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="pref-categories" className="text-sm font-medium">
                1. Categories of products you would like to be listed
              </Label>
              <p className="text-xs text-muted-foreground">
                Enter one or more categories separated by commas (e.g. <em>Home &amp; Garden, Pet Supplies, Kitchen</em>),
                or tick "N/A" if you do not mind which categories the lister chooses.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pref-categories-na"
                  checked={prefCategoriesNA}
                  onChange={(e) => setPrefCategoriesNA(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#285261] focus:ring-[#285261]"
                  data-testid="checkbox-categories-na"
                />
                <Label htmlFor="pref-categories-na" className="text-sm cursor-pointer">
                  N/A — I do not mind any category
                </Label>
              </div>
              <Textarea
                id="pref-categories"
                value={prefCategoriesText}
                onChange={(e) => setPrefCategoriesText(e.target.value)}
                placeholder="e.g. Home & Garden, Pet Supplies, Kitchen Gadgets"
                rows={2}
                disabled={prefCategoriesNA}
                data-testid="input-pref-categories"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pref-quantity" className="text-sm font-medium">
                2. Quantity for each product
              </Label>
              <p className="text-xs text-muted-foreground">
                The default is <strong>1</strong> per product, which suits most stores.
                Increase this if you want every listing published with a higher stock count.
              </p>
              <Input
                id="pref-quantity"
                type="number"
                min={1}
                max={999}
                value={prefQuantity}
                onChange={(e) => setPrefQuantity(e.target.value)}
                className="max-w-[140px]"
                data-testid="input-pref-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                3. Range of prices for products
              </Label>
              <p className="text-xs text-muted-foreground">
                Should the lister focus on <strong>low-price</strong> items (volume sellers)
                or <strong>high-price</strong> items (higher margin)? Pick N/A if you do not mind.
              </p>
              <Select value={prefPriceRange} onValueChange={setPrefPriceRange}>
                <SelectTrigger className="max-w-xs" data-testid="select-pref-price-range">
                  <SelectValue placeholder="Choose a price range preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" data-testid="option-price-low">Low-price products</SelectItem>
                  <SelectItem value="high" data-testid="option-price-high">High-price products</SelectItem>
                  <SelectItem value="na" data-testid="option-price-na">N/A — I do not mind</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pref-margin" className="text-sm font-medium">
                4. Preferred profit margin markup (%)
              </Label>
              <p className="text-xs text-muted-foreground">
                The percentage you'd like added on top of the vendor's cost as
                your profit (e.g. <strong>30</strong> means each item is listed
                at vendor price + 30%). Tick "N/A" if you have no preference and
                the lister can use their own judgement.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pref-margin-na"
                  checked={prefMarginNA}
                  onChange={(e) => {
                    setPrefMarginNA(e.target.checked);
                    if (e.target.checked) setPrefMarginPercent("");
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-[#285261] focus:ring-[#285261]"
                  data-testid="checkbox-margin-na"
                />
                <Label htmlFor="pref-margin-na" className="text-sm cursor-pointer">
                  N/A — I do not mind, lister decides
                </Label>
              </div>
              <div className="flex items-center gap-2 max-w-[180px]">
                <Input
                  id="pref-margin"
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  inputMode="numeric"
                  value={prefMarginPercent}
                  onChange={(e) => setPrefMarginPercent(e.target.value)}
                  placeholder="e.g. 30"
                  disabled={prefMarginNA}
                  data-testid="input-pref-margin"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                5. Preferred vendors / supplier sites
              </Label>
              <p className="text-xs text-muted-foreground">
                Pick one or more vendors from our directory ({VENDOR_DIRECTORY.length.toLocaleString()} sites worldwide)
                that you would like the lister to source products from. Leave blank or tick "N/A" if you have no
                preference and the lister can choose any vendor.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pref-vendors-na"
                  checked={prefVendorsNA}
                  onChange={(e) => {
                    setPrefVendorsNA(e.target.checked);
                    if (e.target.checked) setPrefVendors([]);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-[#285261] focus:ring-[#285261]"
                  data-testid="checkbox-vendors-na"
                />
                <Label htmlFor="pref-vendors-na" className="text-sm cursor-pointer">
                  N/A — I do not mind which vendor
                </Label>
              </div>
              <Popover open={vendorPickerOpen} onOpenChange={setVendorPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={prefVendorsNA}
                    className="w-full justify-between font-normal"
                    data-testid="button-open-vendor-picker"
                  >
                    {prefVendors.length === 0
                      ? 'Select preferred vendors...'
                      : `${prefVendors.length} vendor${prefVendors.length === 1 ? '' : 's'} selected`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      // value is the lowercased "name|country|website" payload we set
                      // on each CommandItem. Match if every search token appears.
                      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
                      return tokens.every(t => value.includes(t)) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Search by name, country, or site..." data-testid="input-vendor-search" />
                    <CommandList className="max-h-72">
                      <CommandEmpty>No vendors match your search.</CommandEmpty>
                      <CommandGroup>
                        {VENDOR_DIRECTORY.map((v) => {
                          const checked = prefVendors.includes(v.name);
                          const payload = `${v.name}|${v.country}|${v.website}`.toLowerCase();
                          return (
                            <CommandItem
                              key={`${v.name}-${v.website}`}
                              value={payload}
                              onSelect={() => {
                                setPrefVendors(prev =>
                                  prev.includes(v.name)
                                    ? prev.filter(n => n !== v.name)
                                    : prev.length >= 50 ? prev : [...prev, v.name]
                                );
                              }}
                              data-testid={`option-vendor-${v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            >
                              <Check className={`mr-2 h-4 w-4 ${checked ? 'opacity-100' : 'opacity-0'}`} />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-sm">{v.name}</span>
                                <span className="truncate text-[11px] text-muted-foreground">{v.country} · {v.category}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {prefVendors.length > 0 && !prefVendorsNA && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {prefVendors.map((name) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="bg-[#285261]/10 border-[#285261]/30 text-[#285261] gap-1 pr-1"
                      data-testid={`chip-vendor-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setPrefVendors(prev => prev.filter(n => n !== name))}
                        className="hover:bg-[#285261]/20 rounded-sm p-0.5"
                        aria-label={`Remove ${name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {prefVendors.length >= 50 && (
                    <span className="text-[11px] text-amber-600">Maximum of 50 vendors reached.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreferencesOpen(false)} data-testid="button-cancel-preferences">
              Cancel
            </Button>
            <Button
              className="bg-[#285261] hover:bg-[#1e3f4d] text-white"
              onClick={submitPreferencesAndOrder}
              disabled={createOrder.isPending}
              data-testid="button-submit-preferences"
            >
              {createOrder.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Submit &amp; Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer catalog — lets the lister see ALL of a customer's products
          and edit the selling price (which pushes to the live eBay listing). */}
      <Dialog open={!!catalogCustomerId} onOpenChange={(o) => { if (!o) setCatalogCustomerId(null); }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#285261]" />
              {catalogCustomerName}'s products
            </DialogTitle>
            <DialogDescription>
              Edit the selling price of any product. Changes save to the customer's inventory and push to the live eBay listing automatically. Cost / SKU are read-only here.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-2">
            <Input
              placeholder="Search by title or SKU…"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              data-testid="input-catalog-search"
            />
          </div>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {catalogLoading ? (
              <div className="space-y-2 py-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !customerCatalog || customerCatalog.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                This customer has no products in their inventory yet.
              </div>
            ) : (() => {
              const q = catalogSearch.trim().toLowerCase();
              const filtered = q
                ? customerCatalog.filter((p: any) =>
                    String(p.title || '').toLowerCase().includes(q) ||
                    String(p.sku || '').toLowerCase().includes(q),
                  )
                : customerCatalog;
              if (filtered.length === 0) {
                return <div className="text-center py-8 text-muted-foreground text-sm">No products match "{catalogSearch}".</div>;
              }
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right w-[200px]">Selling price (£)</TableHead>
                      <TableHead>eBay</TableHead>
                      <TableHead className="text-right w-[120px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p: any) => {
                      const draft = catalogPriceDrafts[p.productId];
                      const currentPrice = draft !== undefined ? draft : String(Number(p.sellingPrice || 0).toFixed(2));
                      const numericDraft = Number(currentPrice);
                      const isValid = Number.isFinite(numericDraft) && numericDraft > 0;
                      const hasChanged = draft !== undefined && Number(draft) !== Number(p.sellingPrice || 0);
                      const saving = catalogSavingId === p.productId;
                      return (
                        <TableRow key={p.productId} data-testid={`row-catalog-product-${p.productId}`}>
                          <TableCell>
                            {p.image ? (
                              <img src={p.image} alt="" className="w-10 h-10 rounded object-cover border" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[280px]" title={p.title}>
                            <div className="truncate">{p.title}</div>
                            {p.listedByThisFreelancer && (
                              <div className="text-[10px] text-[#285261] mt-0.5">Listed by you</div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">£{Number(p.costPrice || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={currentPrice}
                              onChange={(e) =>
                                setCatalogPriceDrafts(prev => ({ ...prev, [p.productId]: e.target.value }))
                              }
                              className="text-right h-8"
                              data-testid={`input-catalog-price-${p.productId}`}
                            />
                          </TableCell>
                          <TableCell>
                            {p.ebayListingUrl ? (
                              <a
                                href={p.ebayListingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#285261] hover:underline inline-flex items-center gap-1"
                                data-testid={`link-catalog-ebay-${p.productId}`}
                              >
                                <Eye className="w-3 h-3" /> View
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No live listing</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={!hasChanged || !isValid || saving}
                              onClick={() => updateCustomerProductPrice.mutate({ productId: p.productId, sellingPrice: String(numericDraft.toFixed(2)) })}
                              data-testid={`button-save-catalog-price-${p.productId}`}
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCatalogCustomerId(null)} data-testid="button-close-catalog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
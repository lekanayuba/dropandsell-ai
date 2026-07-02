import { useProducts, useCreateProduct, useDeleteProduct, useUpdateProduct } from "@/hooks/use-products";
import { useStores, useMarketplaceListings } from "@/hooks/use-stores";
import { useVendors } from "@/hooks/use-vendors";
import { useStoreFilter } from "@/hooks/use-store-filter";
import { StoreFilterDropdown } from "@/components/StoreFilterDropdown";
import { useBulkAddToPublishQueue, usePricingRules, usePublishItems } from "@/hooks/use-automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Filter, MoreHorizontal, Trash2, Send, CheckCircle2, RefreshCw, Pencil, Download, AlertTriangle, ExternalLink, TrendingUp, Lock, Percent, ChevronLeft, ChevronRight, ImagePlus, X, GripVertical, Package, Star, ShieldCheck, ImageOff, Upload, Loader2, ShoppingCart, Store, Award, BarChart3, Tag, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { downloadExcel } from "@/lib/export-excel";
import { useCurrency } from "@/hooks/use-currency";

export default function Inventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { symbol: currSym, format: fc } = useCurrency();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useProducts({ search: debouncedSearch });
  const { data: stores } = useStores();
  const { data: userVendors } = useVendors();
  const vendorWebsiteMap = useMemo(() => {
    const map = new Map<string, string>();
    if (userVendors) {
      for (const v of userVendors) {
        if (v.website) {
          map.set(v.name.toLowerCase(), v.website);
        }
      }
    }
    return map;
  }, [userVendors]);
  const { data: allListings } = useMarketplaceListings();
  const allStoreIds = (stores || []).map((s: any) => s.id);
  const storeFilter = useStoreFilter(allStoreIds);
  const { data: pricingRules } = usePricingRules();
  // Customer eBay stores the lister can publish into via Drop-and-Sell
  // (returns [] for non-listers). Shown in the Publish dialog dropdown.
  const { data: customerStores } = useQuery<Array<{
    orderId: number;
    customerName: string;
    ebayUsername: string | null;
    remaining: number;
    total: number;
    ebayStores?: Array<{ id: number; username: string | null; isDefault?: boolean }>;
  }>>({
    queryKey: ['/api/drop-and-sell/lister-customer-stores'],
  });
  // When the lister picks a DAS order whose customer has more than one
  // connected eBay store, they must say which one — otherwise the server
  // refuses to publish. This holds the chosen store id (as a string for
  // the Select component); defaulted whenever they switch DAS targets.
  const [dasStoreId, setDasStoreId] = useState<string>('');
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();
  const bulkAddToQueue = useBulkAddToPublishQueue();
  const publishItems = usePublishItems();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isOptimizingDescription, setIsOptimizingDescription] = useState(false);
  const [isOptimizingTitle, setIsOptimizingTitle] = useState(false);
  const [editItemSpecifics, setEditItemSpecifics] = useState<Record<string, string> | null>(null);
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [globalMarkup, setGlobalMarkup] = useState("");
  const [isApplyingMarkup, setIsApplyingMarkup] = useState(false);
  const [editingMarkupId, setEditingMarkupId] = useState<number | null>(null);
  const [editingMarkupValue, setEditingMarkupValue] = useState("");
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [editingStockValue, setEditingStockValue] = useState("");
  const [savingStockId, setSavingStockId] = useState<number | null>(null);
  const [editVariations, setEditVariations] = useState<{ type: string; value: string; available: boolean; price?: string; quantity?: string; image?: string; images?: string[] }[]>([]);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editQuantity, setEditQuantity] = useState("0");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editDeliveryType, setEditDeliveryType] = useState("buyer_pays");
  const [editDeliveryCost, setEditDeliveryCost] = useState("0");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [stockCheckResult, setStockCheckResult] = useState<{ total: number; inStock: number; outOfStock: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "unpublished">("all");
  const [autoSyncUserId, setAutoSyncUserId] = useState<string | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (user?.id && user.id !== autoSyncUserId) {
      setAutoSyncUserId(null);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user || autoSyncUserId === user.id || isAutoSyncing) return;
    const syncKey = `autoSync_${user.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(syncKey)) { setAutoSyncUserId(user.id); return; }
    setIsAutoSyncing(true);
    apiRequest('POST', '/api/products/auto-sync-on-login')
      .then(res => res.json())
      .then((data: any) => {
        sessionStorage.setItem(syncKey, '1');
        setAutoSyncUserId(user.id);
        if (data.synced && (data.priceChanges > 0 || data.shippingChanges > 0 || data.ebayUpdates > 0)) {
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          const parts: string[] = [];
          if (data.priceChanges > 0) parts.push(`${data.priceChanges} price${data.priceChanges > 1 ? 's' : ''} updated`);
          if (data.shippingChanges > 0) parts.push(`${data.shippingChanges} delivery cost${data.shippingChanges > 1 ? 's' : ''} updated`);
          if (data.ebayUpdates > 0) parts.push(`${data.ebayUpdates} eBay listing${data.ebayUpdates > 1 ? 's' : ''} synced`);
          toast({
            title: "Inventory Auto-Synced",
            description: `${data.totalChecked} products checked. ${parts.join(', ')}.`,
          });
        } else if (data.synced && data.totalChecked > 0) {
          toast({
            title: "Inventory Up to Date",
            description: `${data.totalChecked} products checked — no changes needed.`,
          });
        }
      })
      .catch(() => { setAutoSyncUserId(user?.id || null); })
      .finally(() => setIsAutoSyncing(false));
  }, [user, autoSyncUserId, isAutoSyncing]);

  const rawItems = Array.isArray(data?.items) ? data!.items : [];
  const listingsLoaded = Array.isArray(allListings);
  const storeFilterActive = storeFilter.hasMultipleStores && !storeFilter.isAllSelected;
  const filteredListings = listingsLoaded && storeFilterActive
    ? allListings.filter((l: any) => storeFilter.selectedStoreIds.includes(l.storeId))
    : allListings || [];
  const allItems = rawItems.filter((p: any) => {
    if (!listingsLoaded && statusFilter === "all") return true;
    const relevantListings = storeFilterActive ? filteredListings : (allListings || []);
    const isPublishedInScope = relevantListings.some((l: any) => l.productId === p.id && l.status === 'active');
    if (statusFilter === "published") return isPublishedInScope;
    if (statusFilter === "unpublished") return !isPublishedInScope;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = allItems.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  const tableRef = useRef<HTMLDivElement>(null);
  const pinnedBarRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const [barState, setBarState] = useState({ show: false, left: 0, width: 0, scrollW: 0 });

  const recalc = useCallback(() => {
    const el = tableRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    if (!hasOverflow) { setBarState(s => ({ ...s, show: false })); return; }
    const r = el.getBoundingClientRect();
    setBarState({ show: true, left: r.left, width: r.width, scrollW: el.scrollWidth });
  }, []);

  useEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (tableRef.current) ro.observe(tableRef.current);
    window.addEventListener('resize', recalc);
    return () => { ro.disconnect(); window.removeEventListener('resize', recalc); };
  }, [recalc, safeCurrentPage, allItems.length]);

  const onTableScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (tableRef.current && pinnedBarRef.current)
      pinnedBarRef.current.scrollLeft = tableRef.current.scrollLeft;
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  const onBarScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (pinnedBarRef.current && tableRef.current)
      tableRef.current.scrollLeft = pinnedBarRef.current.scrollLeft;
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  const openEditDialog = async (product: any) => {
    // The list endpoint (GET /api/products) truncates long descriptions to
    // keep the payload small. If we seeded the form from that row, saving the
    // product would persist the truncated description back to the database
    // and silently destroy the user's content. Always refetch the full
    // product first so the edit form has the complete description.
    let full = product;
    if (product?.descriptionTruncated && product?.id) {
      try {
        const r = await fetch(`/api/products/${product.id}`, { credentials: 'include' });
        if (r.ok) full = await r.json();
      } catch {
        /* fall back to list row; user can re-edit description manually */
      }
    }
    setEditingProduct(full);
    setEditTitle(full.title || "");
    setEditBrand(full.brand || "");
    setEditDescription(full.description || "");
    const existingSpecs = (full.attributes && full.attributes.itemSpecifics) || null;
    setEditItemSpecifics(existingSpecs && typeof existingSpecs === 'object' ? existingSpecs : null);
    setEditCostPrice(String(full.costPrice || "0"));
    setEditSellingPrice(String(full.sellingPrice || "0"));
    setEditImages(Array.isArray(full.images) ? [...full.images] : []);
    setEditQuantity(String(full.quantity ?? 0));
    setNewImageUrl("");
    setEditDeliveryType(full.deliveryType || "buyer_pays");
    setEditDeliveryCost(String(full.deliveryCost || "0"));
    const attrs = full.attributes || {};
    setEditVariations(
      (attrs.variations && Array.isArray(attrs.variations))
        ? attrs.variations.map((v: any) => {
            const imgs: string[] = Array.isArray(v.images)
              ? v.images.filter((u: any) => typeof u === 'string' && u)
              : (typeof v.image === 'string' && v.image ? [v.image] : []);
            return {
              type: v.type || 'Option',
              value: v.value || '',
              available: v.available !== false,
              price: v.price != null ? String(v.price) : '',
              quantity: v.quantity != null ? String(v.quantity) : '',
              image: imgs[0] || '',
              images: imgs,
            };
          })
        : []
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxImages = 24;
    if (editImages.length >= maxImages) {
      toast({ title: "Image limit reached", description: `Maximum ${maxImages} images allowed per product`, variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const remaining = maxImages - editImages.length;
    const filesToUpload = Array.from(files).slice(0, remaining);

    setIsUploadingImage(true);
    let uploaded = 0;
    try {
      for (const file of filesToUpload) {
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: "File too large", description: `${file.name} exceeds 5MB limit`, variant: "destructive" });
          continue;
        }
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/products/upload-image', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setEditImages(prev => [...prev, data.url]);
          uploaded++;
        } else {
          const err = await res.json().catch(() => ({ message: 'Upload failed' }));
          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        }
      }
      if (uploaded > 0) {
        toast({ title: "Images uploaded", description: `${uploaded} image${uploaded > 1 ? 's' : ''} added successfully` });
      }
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [uploadingVariationIdx, setUploadingVariationIdx] = useState<number | null>(null);
  const [pendingVariationIdx, setPendingVariationIdx] = useState<number | null>(null);
  const variationFileInputRef = useRef<HTMLInputElement>(null);

  const handleVariationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: `${file.name} exceeds 5MB limit`, variant: "destructive" });
      if (variationFileInputRef.current) variationFileInputRef.current.value = '';
      return;
    }
    setUploadingVariationIdx(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/products/upload-image', { method: 'POST', body: formData, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEditVariations(prev => prev.map((item, i) => {
          if (i !== idx) return item;
          const existing = Array.isArray(item.images) ? [...item.images] : (item.image ? [item.image] : []);
          if (!existing.includes(data.url)) existing.push(data.url);
          return { ...item, image: existing[0], images: existing };
        }));
        setEditImages(prev => prev.includes(data.url) ? prev : [...prev, data.url]);
        toast({ title: "Image added", description: "Variation image uploaded" });
      } else {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setUploadingVariationIdx(null);
      if (variationFileInputRef.current) variationFileInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    if (!editTitle.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
      return;
    }
    const selling = parseFloat(editSellingPrice) || 0;
    const qty = parseInt(editQuantity) || 0;
    const deliveryCostVal = editDeliveryType === 'free' ? '0' : String(parseFloat(editDeliveryCost) || 0);
    const validVariations = editVariations
      .filter(v => v.type.trim() && v.value.trim())
      .map(v => {
        const out: any = { type: v.type.trim(), value: v.value.trim(), available: v.available !== false };
        if (v.price && v.price.trim() && !isNaN(parseFloat(v.price))) out.price = String(parseFloat(v.price));
        if (v.quantity && v.quantity.trim() && !isNaN(parseInt(v.quantity))) out.quantity = parseInt(v.quantity);
        // Accept both http(s) URLs and inline data: URLs (the latter come from
        // "Add Pic" uploads on a variation row). Persist BOTH the legacy
        // single `image` field and the multi-image `images` array so the
        // listing's gallery can swap correctly on eBay when the buyer picks a
        // colour.
        const isOk = (u: any): u is string => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:'));
        const arr: string[] = [];
        if (Array.isArray(v.images)) for (const u of v.images) if (isOk(u) && !arr.includes(u)) arr.push(u);
        if (isOk(v.image) && !arr.includes(v.image)) arr.unshift(v.image);
        if (arr.length > 0) {
          out.image = arr[0];
          out.images = arr;
        }
        return out;
      });
    updateProduct.mutate(
      { id: editingProduct.id, data: { title: editTitle.trim(), brand: editBrand.trim(), description: editDescription.trim(), sellingPrice: String(selling), quantity: qty, deliveryType: editDeliveryType, deliveryCost: deliveryCostVal, images: editImages.length > 0 ? editImages : null, variations: validVariations } as any },
      {
        onSuccess: () => {
          setEditingProduct(null);
          apiRequest('POST', `/api/products/${editingProduct.id}/sync-ebay-listing`)
            .then(res => res.json())
            .then((data: any) => {
              if (data.synced > 0) {
                const failed = data.results?.filter((r: any) => !r.success) || [];
                if (failed.length > 0) {
                  toast({ title: "eBay Sync Partial", description: `${data.synced - failed.length}/${data.synced} listings updated. ${failed[0]?.error || 'Some failed.'}`, variant: "destructive" });
                } else {
                  toast({ title: "eBay Synced", description: `${data.synced} listing(s) updated with new price, stock, photos & details` });
                }
              }
            })
            .catch(() => {});
        }
      }
    );
  };

  const applyGlobalMarkup = async () => {
    const pct = parseFloat(globalMarkup);
    if (isNaN(pct) || pct < 0) {
      toast({ title: "Invalid Markup", description: "Please enter a valid markup percentage", variant: "destructive" });
      return;
    }
    const items = data?.items || [];
    if (items.length === 0) return;
    setIsApplyingMarkup(true);
    try {
      for (const product of items) {
        const baseCost = Number(product.costPrice);
        const delivery = Number(product.deliveryCost || 0);
        const totalCost = baseCost + delivery;
        if (totalCost > 0) {
          const newSelling = (totalCost * (1 + pct / 100)).toFixed(2);
          await apiRequest("PATCH", `/api/products/${product.id}`, { sellingPrice: String(newSelling) });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Markup Applied", description: `${pct}% markup applied to all ${items.length} products` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to apply markup", variant: "destructive" });
    } finally {
      setIsApplyingMarkup(false);
    }
  };

  const applyProductMarkup = (productId: number, costPrice: number) => {
    const pct = parseFloat(editingMarkupValue);
    if (isNaN(pct) || pct < 0) {
      toast({ title: "Invalid Markup", description: "Please enter a valid percentage", variant: "destructive" });
      return;
    }
    const newSelling = (costPrice * (1 + pct / 100)).toFixed(2);
    updateProduct.mutate(
      { id: productId, data: { sellingPrice: String(newSelling) } },
      { onSuccess: () => { setEditingMarkupId(null); setEditingMarkupValue(""); } }
    );
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const pageIds = paginatedItems.map((p) => p.id);
    const allPageSelected = pageIds.every(id => selectedProducts.includes(id));
    if (allPageSelected) {
      setSelectedProducts(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedProducts(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  const handleAddToPublishQueue = async () => {
    if (user) {
      const subStatus = (user as any)?.subscriptionStatus;
      if (subStatus !== 'active' && subStatus !== 'trialing') {
        toast({ title: "Subscription required", description: "Please subscribe to a plan before publishing products", variant: "destructive" });
        navigate("/subscription");
        return;
      }
    }

    if (selectedProducts.length === 0 || !selectedStore) {
      toast({ title: "Missing selection", description: "Please select products and a store", variant: "destructive" });
      return;
    }

    // Drop-and-Sell publish branch: when the lister picks a customer's
    // eBay store, send each product through the lister-publish endpoint
    // instead of the normal publish-queue flow. The product appears in
    // the customer's inventory and in the lister's "My Listings" tab.
    if (selectedStore.startsWith('das:')) {
      const orderId = Number(selectedStore.slice(4));
      const cs = customerStores?.find(c => c.orderId === orderId);
      if (!cs) {
        toast({ title: "Customer store not found", description: "Refresh and try again.", variant: "destructive" });
        return;
      }
      // If the customer has more than one connected eBay store, the
      // lister must pick which one. (Server enforces this too — checking
      // here gives a clearer toast.)
      const choices = Array.isArray(cs.ebayStores) ? cs.ebayStores : [];
      if (choices.length > 1 && !dasStoreId) {
        toast({ title: "Pick a store", description: "This customer has multiple eBay stores connected — choose which one to publish into.", variant: "destructive" });
        return;
      }
      if (selectedProducts.length > cs.remaining) {
        toast({
          title: "Not enough remaining slots",
          description: `Order DAS-${orderId} has ${cs.remaining} listing slot${cs.remaining === 1 ? '' : 's'} left, but you selected ${selectedProducts.length}.`,
          variant: "destructive",
        });
        return;
      }
      setIsPublishing(true);
      let success = 0;
      const failures: string[] = [];
      for (const productId of selectedProducts) {
        try {
          const res = await apiRequest('POST', '/api/drop-and-sell/lister-publish-from-inventory', {
            productId,
            orderId,
            ...(dasStoreId ? { storeId: Number(dasStoreId) } : {}),
          });
          const json = await res.json();
          if (json?.success) { success++; } else { failures.push(`#${productId}: ${json?.message || 'failed'}`); }
        } catch (err: any) {
          failures.push(`#${productId}: ${err?.message || 'failed'}`);
        }
      }
      setIsPublishing(false);
      setIsPublishDialogOpen(false);
      setSelectedProducts([]);
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/lister-customer-stores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drop-and-sell/my-assignments'] });
      if (success > 0 && failures.length === 0) {
        toast({ title: "Published to customer's eBay", description: `${success} product${success > 1 ? 's' : ''} listed under @${cs.ebayUsername || cs.customerName}. View in DROSEL → My Listings.` });
      } else if (success > 0) {
        toast({ title: "Partially published", description: `${success} listed, ${failures.length} failed: ${failures.slice(0, 3).join('; ')}` });
      } else {
        toast({ title: "Publishing failed", description: failures.slice(0, 3).join('; ') || 'Could not publish to customer\'s eBay store.', variant: "destructive" });
      }
      return;
    }

    try {
      const activeRule = pricingRules?.find((r) => r.isActive);
      const targetStoreIds = selectedStore === "all"
        ? (stores || []).filter(s => s.status === 'active').map(s => s.id)
        : [Number(selectedStore)];

      console.log('[PUBLISH DEBUG] selectedStore value:', selectedStore, 'type:', typeof selectedStore);
      console.log('[PUBLISH DEBUG] targetStoreIds:', targetStoreIds);
      console.log('[PUBLISH DEBUG] available stores:', (stores || []).map(s => ({ id: s.id, name: s.name, status: s.status })));

      if (targetStoreIds.length === 0) {
        toast({ title: "No active stores", description: "You have no active stores to publish to", variant: "destructive" });
        return;
      }

      setIsPublishing(true);
      let totalSuccess = 0;
      let totalFail = 0;
      let allFailMessages: string[] = [];

      for (const storeId of targetStoreIds) {
        const storeName = stores?.find(s => s.id === storeId)?.name || `Store ${storeId}`;
        const items = selectedProducts.map((productId) => {
          const product = data?.items.find((p) => p.id === productId);
          // The price shown in the Inventory "Price" column (sellingPrice) is
          // the single source of truth for what gets listed on eBay. We do
          // NOT re-derive a price from cost + active markup rule here —
          // that historically produced an eBay price that didn't match the
          // user's edited Price column. If a user wants to apply a markup
          // rule they can do so per-row from the Markup column, which writes
          // sellingPrice directly.
          const livePrice = Number(product?.sellingPrice || 0);
          return {
            productId,
            storeId,
            calculatedPrice: Math.round(livePrice * 100) / 100,
            pricingRuleId: undefined,
            quantity: product?.quantity || 1,
            postageType: product?.deliveryType || 'buyer_pays',
            postageCost: product?.deliveryCost || undefined,
          };
        });

        try {
          const queueResult = await bulkAddToQueue.mutateAsync(items);
          const queueItemIds = Array.isArray(queueResult) ? queueResult.map((q: any) => q.id) : [];

          if (queueItemIds.length > 0) {
            if (targetStoreIds.length > 1) {
              toast({ title: "Publishing...", description: `Sending ${queueItemIds.length} products to ${storeName}` });
            } else {
              toast({ title: "Publishing...", description: `Sending ${queueItemIds.length} products to your store` });
            }
            const publishResult = await publishItems.mutateAsync(queueItemIds);
            const successCount = publishResult.results?.filter((r: any) => r.status === "published").length || 0;
            const skippedCount = publishResult.results?.filter((r: any) => r.status === "skipped").length || 0;
            const failCount = publishResult.results?.filter((r: any) => r.status === "failed").length || 0;
            const failMessages = publishResult.results?.filter((r: any) => r.status === "failed").map((r: any) => `${storeName}: ${r.message}`) || [];
            totalSuccess += successCount + skippedCount;
            totalFail += failCount;
            allFailMessages.push(...failMessages);
          }
        } catch (storeErr: any) {
          totalFail += items.length;
          allFailMessages.push(`${storeName}: ${storeErr.message || 'Failed to publish'}`);
        }
      }

      if (totalSuccess > 0 && totalFail === 0) {
        const storeLabel = targetStoreIds.length > 1 ? `${targetStoreIds.length} stores` : 'your store';
        toast({ title: "Published Successfully", description: `${totalSuccess} product${totalSuccess > 1 ? 's' : ''} published to ${storeLabel}` });
      } else if (totalSuccess > 0 && totalFail > 0) {
        toast({ title: "Partially Published", description: `${totalSuccess} published, ${totalFail} failed: ${allFailMessages.join('; ')}` });
      } else {
        toast({ title: "Publishing Failed", description: allFailMessages.join('; ') || "Failed to publish products", variant: "destructive" });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/marketplace-listings"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
      setIsPublishDialogOpen(false);
      setSelectedProducts([]);
      setSelectedStore("");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">Inventory</h2>
          <p className="text-muted-foreground mt-2">Manage products across all channels</p>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="best-sellers" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Best Sellers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <div className="flex items-center gap-2">
            {isAutoSyncing && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 text-xs font-medium animate-pulse" data-testid="text-auto-syncing">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Auto-syncing inventory...
              </div>
            )}
            <PageRefreshButton />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isFetching}
              data-testid="button-refresh-inventory"
              title="Refresh inventory"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const items = data?.items || [];
                if (items.length === 0) return;
                downloadExcel(items.map((p: any) => {
                  const isBlocked = p.veroStatus === 'blocked';
                  const isFlagged = p.veroStatus === 'flagged';
                  const isPublished = allListings?.some((l: any) => l.productId === p.id && l.status === 'active');
                  const listingStatus = isBlocked ? 'Policy Violation' : isFlagged ? 'Brand Advisory' : isPublished ? 'Published' : 'Unpublished';
                  const baseCost = Number(p.costPrice);
                  const delCost = Number(p.deliveryCost || 0);
                  const totalCost = baseCost + delCost;
                  const profit = Number(p.sellingPrice) - totalCost;
                  return {
                    Title: p.title,
                    SKU: p.sku || '',
                    Vendor: p.vendorName || '',
                    'Cost Price': fc(baseCost),
                    'Delivery Cost': fc(delCost),
                    'Total Cost (incl. delivery)': fc(totalCost),
                    'Selling Price': fc(p.sellingPrice),
                    'Profit': fc(profit),
                    'Listing Status': listingStatus,
                    Description: p.description || '',
                  };
                }), 'inventory');
              }}
              disabled={!data?.items?.length}
              data-testid="button-download-inventory"
              title="Download as Excel"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                setIsCheckingStock(true);
                setStockCheckResult(null);
                try {
                  const res = await apiRequest('POST', '/api/products/check-all-vendor-stock');
                  const result = await res.json();
                  setStockCheckResult({ total: result.total, inStock: result.inStock, outOfStock: result.outOfStock });
                  queryClient.invalidateQueries({ queryKey: ['/api/products'] });
                  const priceNote = result.priceChanges > 0 ? `. ${result.priceChanges} price(s) updated` : '';
                  toast({
                    title: 'Stock & Price Check Complete',
                    description: `${result.inStock} in stock, ${result.outOfStock} out of stock (${result.total} checked)${priceNote}`,
                    variant: result.outOfStock > 0 ? 'destructive' : 'default',
                  });
                } catch (err: any) {
                  toast({ title: 'Stock check failed', description: err.message, variant: 'destructive' });
                } finally {
                  setIsCheckingStock(false);
                }
              }}
              disabled={isCheckingStock || !data?.items?.length}
              data-testid="button-check-all-stock"
              title="Check vendor stock for all products"
            >
              {isCheckingStock ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              {isCheckingStock ? 'Checking...' : 'Check Stock'}
            </Button>
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
            <div className="ml-auto flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-500" />
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="Markup %"
                className="w-24 h-9 text-sm"
                value={globalMarkup}
                onChange={(e) => setGlobalMarkup(e.target.value)}
                data-testid="input-global-markup"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={applyGlobalMarkup}
                disabled={isApplyingMarkup || !globalMarkup || !data?.items?.length}
                data-testid="button-apply-global-markup"
              >
                {isApplyingMarkup ? "Applying..." : "Apply to All"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products by title or SKU..."
                className="pl-9 bg-background border-border/50"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(val: any) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] gap-2" data-testid="select-status-filter">
                <Filter className="w-4 h-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="unpublished">Unpublished</SelectItem>
              </SelectContent>
            </Select>
            {storeFilter.hasMultipleStores && (
              <StoreFilterDropdown
                stores={(stores || []).map((s: any) => ({ id: s.id, name: s.name, platform: s.platform, status: s.status }))}
                selectedStoreIds={storeFilter.selectedStoreIds}
                onToggleStore={storeFilter.toggleStore}
                onSelectAll={storeFilter.selectAll}
                isAllSelected={storeFilter.isAllSelected}
              />
            )}
            {selectedProducts.length > 0 && (
              <Dialog open={isPublishDialogOpen} onOpenChange={(open) => { setIsPublishDialogOpen(open); if (open) { setSelectedStore(""); setDasStoreId(""); } }}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-publish-selected">
                    <Send className="w-4 h-4" />
                    Publish {selectedProducts.length} to Store
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Publish to Store</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Select Store</Label>
                      <Select value={selectedStore} onValueChange={(v) => {
                        setSelectedStore(v);
                        // Whenever the lister switches to a DAS order,
                        // pre-select that order's pinned default store
                        // (e.g. funma70 for Margaret). They can still
                        // change it via the picker below.
                        if (v.startsWith('das:')) {
                          const oid = Number(v.slice(4));
                          const cs = customerStores?.find(c => c.orderId === oid);
                          const stores = cs?.ebayStores || [];
                          // Only pre-select when there's a real pinned
                          // default, or a single connected store. For
                          // multi-store customers without a pinned
                          // default, leave empty so the lister must
                          // pick explicitly.
                          const def = stores.find(s => s.isDefault) || (stores.length === 1 ? stores[0] : undefined);
                          setDasStoreId(def ? String(def.id) : '');
                        } else {
                          setDasStoreId('');
                        }
                      }}>
                        <SelectTrigger data-testid="select-store-for-publish">
                          <SelectValue placeholder="Choose a store" />
                        </SelectTrigger>
                        <SelectContent>
                          {(stores || []).filter(s => s.status === 'active').length > 1 && (
                            <SelectItem value="all">All Stores</SelectItem>
                          )}
                          {(stores || []).filter(s => s.status === 'active').map((s) => {
                            const ebayUser = (s.credentials as any)?.ebayUsername;
                            const storeSiteId = (s.credentials as any)?.siteId;
                            const siteCurrencyMap: Record<string, string> = { '0': 'USD', '2': 'CAD', '3': 'GBP', '15': 'AUD', '16': 'EUR', '23': 'EUR', '71': 'EUR', '77': 'EUR', '101': 'EUR', '146': 'EUR', '186': 'EUR', '193': 'CHF', '205': 'EUR', '211': 'PHP', '212': 'PLN', '215': 'SGD', '216': 'SEK' };
                            const storeCurrency = storeSiteId ? siteCurrencyMap[storeSiteId] : null;
                            return (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                {s.name} ({s.platform}){ebayUser ? ` — @${ebayUser}` : ''}{storeCurrency ? ` [${storeCurrency}]` : ''}
                              </SelectItem>
                            );
                          })}
                          {(customerStores || []).length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                                Customer eBay Stores (Drop-and-Sell)
                              </div>
                              {(customerStores || []).map((cs) => (
                                <SelectItem
                                  key={`das-${cs.orderId}`}
                                  value={`das:${cs.orderId}`}
                                  data-testid={`option-das-store-${cs.orderId}`}
                                >
                                  DAS-{cs.orderId} · {cs.customerName}{cs.ebayUsername ? ` — @${cs.ebayUsername}` : ''} ({cs.remaining}/{cs.total} left)
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedStore && selectedStore.startsWith('das:') && (() => {
                      const orderId = Number(selectedStore.slice(4));
                      const cs = customerStores?.find(c => c.orderId === orderId);
                      if (!cs) return null;
                      return (
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20" data-testid="banner-das-publish-target">
                          <p className="text-sm text-primary font-semibold">
                            Publishing to customer's eBay store (Drop-and-Sell order DAS-{cs.orderId})
                          </p>
                          <p className="text-xs text-primary/80 mt-1">
                            Customer: {cs.customerName}{cs.ebayUsername ? ` — @${cs.ebayUsername}` : ''} · {cs.remaining} of {cs.total} listing slot{cs.total === 1 ? '' : 's'} left
                          </p>
                          <p className="text-xs text-primary/80 mt-1">
                            Each product needs a vendor URL on its details page; published items appear in DROSEL → My Listings.
                          </p>
                          {Array.isArray(cs.ebayStores) && cs.ebayStores.length > 1 && (
                            <div className="mt-3 pt-3 border-t border-primary/20">
                              <Label className="text-primary font-semibold text-xs">
                                Which eBay store? <span className="text-red-500">*</span>
                              </Label>
                              <Select value={dasStoreId} onValueChange={setDasStoreId}>
                                <SelectTrigger className="mt-1 bg-white" data-testid="select-das-target-store">
                                  <SelectValue placeholder="Pick a store" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cs.ebayStores.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)} data-testid={`option-das-target-store-${s.id}`}>
                                      @{s.username || `store-${s.id}`}{s.isDefault ? ' — default' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-[11px] text-primary/70 mt-1">
                                Customer has {cs.ebayStores.length} eBay stores connected. Default is pre-selected — change it if needed.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {selectedStore && selectedStore !== "all" && !selectedStore.startsWith('das:') && (() => {
                      const store = stores?.find(s => s.id === Number(selectedStore));
                      const ebayUser = (store?.credentials as any)?.ebayUsername;
                      const siteId = (store?.credentials as any)?.siteId;
                      const EBAY_SITE_CURRENCIES: Record<string, { label: string; currency: string }> = {
                        '0': { label: 'US', currency: 'USD' },
                        '2': { label: 'Canada', currency: 'CAD' },
                        '3': { label: 'UK', currency: 'GBP' },
                        '15': { label: 'Australia', currency: 'AUD' },
                        '16': { label: 'Austria', currency: 'EUR' },
                        '23': { label: 'Belgium', currency: 'EUR' },
                        '71': { label: 'France', currency: 'EUR' },
                        '77': { label: 'Germany', currency: 'EUR' },
                        '101': { label: 'Italy', currency: 'EUR' },
                        '146': { label: 'Netherlands', currency: 'EUR' },
                        '186': { label: 'Spain', currency: 'EUR' },
                        '193': { label: 'Switzerland', currency: 'CHF' },
                        '205': { label: 'Ireland', currency: 'EUR' },
                        '211': { label: 'Philippines', currency: 'PHP' },
                        '212': { label: 'Poland', currency: 'PLN' },
                        '215': { label: 'Singapore', currency: 'SGD' },
                        '216': { label: 'Sweden', currency: 'SEK' },
                      };
                      const siteInfo = siteId ? EBAY_SITE_CURRENCIES[siteId] : null;
                      return (
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-sm text-primary font-semibold">
                            Publishing to: {store?.name || selectedStore}
                          </p>
                          {ebayUser && (
                            <p className="text-xs text-primary/80 mt-1">
                              eBay account: @{ebayUser}
                              {siteInfo && ` | ${siteInfo.label} (${siteInfo.currency})`}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-sm text-muted-foreground">
                      {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} will be published to {selectedStore === "all" ? "all connected stores" : "the selected store"} with pricing rules applied.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPublishDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddToPublishQueue}
                      disabled={!selectedStore || isPublishing || bulkAddToQueue.isPending}
                      data-testid="button-confirm-publish"
                    >
                      {isPublishing ? "Publishing..." : bulkAddToQueue.isPending ? "Preparing..." :
                        selectedStore && selectedStore !== "all"
                          ? `Publish to @${(stores?.find(s => s.id === Number(selectedStore))?.credentials as any)?.ebayUsername || stores?.find(s => s.id === Number(selectedStore))?.name || 'Store'}`
                          : "Publish Now"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div
            ref={tableRef}
            onScroll={onTableScroll}
            className="inventory-table-wrap rounded-xl border border-border/50 bg-card shadow-sm overflow-x-auto [&>div]:!overflow-visible"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={paginatedItems.length > 0 && paginatedItems.every(p => selectedProducts.includes(p.id))}
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Markup</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Variations</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Vendor Stock</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Listing Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Loading products...</TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3" data-testid="state-products-error">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                        <div>
                          <p className="text-lg font-semibold text-destructive">Couldn't load your products</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Your products are safe — we just couldn't reach the server.{' '}
                            {(error as any)?.message ? <span className="opacity-70">({(error as any).message})</span> : null}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetch()}
                          data-testid="button-retry-products"
                          disabled={isFetching}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                          {isFetching ? 'Retrying…' : 'Retry'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rawItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12">
                      <p className="text-lg font-medium text-muted-foreground" data-testid="state-products-empty">No products found</p>
                      <p className="text-sm text-muted-foreground mt-1">Add your first product or import a list to get started.</p>
                    </TableCell>
                  </TableRow>
                ) : allItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3" data-testid="state-products-filtered">
                        <Filter className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <p className="text-lg font-semibold">No products match your filters</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            You have {rawItems.length} product{rawItems.length === 1 ? '' : 's'} hidden by the current filter or search.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('all');
                            if (storeFilter.hasMultipleStores && !storeFilter.isAllSelected) storeFilter.selectAll();
                          }}
                          data-testid="button-clear-filters"
                        >
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((product) => (
                    <TableRow key={product.id} className={selectedProducts.includes(product.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                          data-testid={`checkbox-product-${product.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {Array.isArray(product.images) && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.title}
                              className="w-10 h-10 rounded-md object-cover border border-border flex-shrink-0"
                              data-testid={`img-product-${product.id}`}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0" data-testid={`img-placeholder-${product.id}`}>
                              <ImageOff className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[180px]">{product.title}</div>
                            {product.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground" data-testid={`text-vendor-${product.id}`}>
                          {(product as any).vendorName || (product as any)?.attributes?.vendorName || ((product as any)?.attributes?.vendorType ? (product as any).attributes.vendorType.charAt(0).toUpperCase() + (product as any).attributes.vendorType.slice(1) : "—")}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell>
                        {(() => {
                          const baseCost = Number(product.costPrice);
                          const delivery = Number(product.deliveryCost || 0);
                          const totalCost = baseCost + delivery;
                          return (
                            <div className="flex flex-col" data-testid={`text-total-cost-${product.id}`}>
                              <span className="font-medium">{fc(totalCost)}</span>
                              {delivery > 0 && (
                                <span className="text-[10px] text-muted-foreground leading-tight">
                                  {fc(baseCost)} + {fc(delivery)} delivery
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{fc(Number(product.sellingPrice))}</TableCell>
                      <TableCell>
                        {(() => {
                          const baseCost = Number(product.costPrice);
                          const delivery = Number(product.deliveryCost || 0);
                          const totalCost = baseCost + delivery;
                          const sell = Number(product.sellingPrice);
                          if (editingMarkupId === product.id) {
                            return (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="w-16 h-7 text-xs px-1"
                                  value={editingMarkupValue}
                                  onChange={(e) => setEditingMarkupValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") applyProductMarkup(product.id, totalCost);
                                    if (e.key === "Escape") { setEditingMarkupId(null); setEditingMarkupValue(""); }
                                  }}
                                  autoFocus
                                  data-testid={`input-markup-${product.id}`}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            );
                          }
                          if (totalCost > 0) {
                            const pct = ((sell - totalCost) / totalCost * 100).toFixed(0);
                            return (
                              <Badge
                                variant="outline"
                                className="bg-purple-500/10 text-purple-600 border-purple-200 cursor-pointer hover:bg-purple-500/20"
                                onClick={() => { setEditingMarkupId(product.id); setEditingMarkupValue(pct); }}
                                data-testid={`text-markup-${product.id}`}
                              >
                                {pct}%
                              </Badge>
                            );
                          }
                          return (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground cursor-pointer hover:bg-muted"
                              onClick={() => { setEditingMarkupId(product.id); setEditingMarkupValue(""); }}
                            >
                              —
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {fc(Number(product.sellingPrice) - Number(product.costPrice) - Number(product.deliveryCost || 0))}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const sourceUrl = (product as any)?.attributes?.sourceUrl || (product as any)?.vendorWebsite;
                          if (sourceUrl) {
                            return (
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:underline"
                                data-testid={`link-source-${product.id}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </a>
                            );
                          }
                          return <span className="text-muted-foreground text-xs">—</span>;
                        })()}
                      </TableCell>
                      <TableCell data-testid={`text-variations-${product.id}`}>
                        {(() => {
                          const attrs = (product as any)?.attributes || {};
                          const variations = attrs.variations;
                          if (variations && Array.isArray(variations) && variations.length > 0) {
                            const grouped: Record<string, string[]> = {};
                            for (const v of variations) {
                              const type = v.type || v.name || 'Option';
                              if (!grouped[type]) grouped[type] = [];
                              if (v.value && !grouped[type].includes(v.value)) grouped[type].push(v.value);
                            }
                            const types = Object.keys(grouped);
                            return (
                              <div className="flex flex-col gap-1">
                                {types.slice(0, 3).map((t: string, i: number) => (
                                  <div key={i} className="flex flex-wrap items-center gap-1">
                                    <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-200 text-[10px] px-1.5 py-0 font-semibold">
                                      {t}
                                    </Badge>
                                    {grouped[t].slice(0, 4).map((val: string, j: number) => (
                                      <Badge key={j} variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[10px] px-1.5 py-0">
                                        {val}
                                      </Badge>
                                    ))}
                                    {grouped[t].length > 4 && (
                                      <span className="text-[10px] text-muted-foreground">+{grouped[t].length - 4}</span>
                                    )}
                                  </div>
                                ))}
                                <span className="text-[10px] text-muted-foreground">{variations.length} total</span>
                              </div>
                            );
                          }
                          return <span className="text-muted-foreground text-xs">—</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const isEditing = editingStockId === product.id;
                          const isSaving = savingStockId === product.id;
                          const currentQty = product.quantity ?? 0;
                          const saveStock = async () => {
                            const v = parseInt(editingStockValue);
                            if (isNaN(v) || v < 0) {
                              toast({ title: "Invalid Stock", description: "Stock must be 0 or higher", variant: "destructive" });
                              return;
                            }
                            if (v === currentQty) {
                              setEditingStockId(null);
                              setEditingStockValue("");
                              return;
                            }
                            setSavingStockId(product.id);
                            try {
                              await apiRequest("PUT", `/api/products/${product.id}`, { quantity: v });
                              queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                              setEditingStockId(null);
                              setEditingStockValue("");
                              // Push the new stock to any active eBay listing(s) for this product.
                              try {
                                const sres = await apiRequest("POST", `/api/products/${product.id}/sync-ebay-listing`);
                                const sjson: any = await sres.json().catch(() => ({}));
                                if (sjson?.synced > 0) {
                                  const failed = (sjson.results || []).filter((r: any) => !r.success);
                                  if (failed.length > 0) {
                                    toast({ title: "eBay Sync Partial", description: `${sjson.synced - failed.length}/${sjson.synced} listings updated. ${failed[0]?.error || ''}`, variant: "destructive" });
                                  } else {
                                    toast({ title: "Stock Synced to eBay", description: `${sjson.synced} listing(s) updated to ${v}` });
                                  }
                                } else {
                                  toast({ title: "Stock Updated", description: `Set to ${v}. No active eBay listing to sync.` });
                                }
                              } catch (syncErr: any) {
                                toast({ title: "Stock Saved", description: `Set to ${v}. eBay sync failed: ${syncErr?.message || 'unknown error'}`, variant: "destructive" });
                              }
                            } catch (err: any) {
                              toast({ title: "Save Failed", description: err?.message || "Could not update stock", variant: "destructive" });
                            } finally {
                              setSavingStockId(null);
                            }
                          };
                          if (isEditing) {
                            return (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="w-16 h-7 text-xs px-1"
                                  value={editingStockValue}
                                  onChange={(e) => setEditingStockValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveStock();
                                    if (e.key === "Escape") { setEditingStockId(null); setEditingStockValue(""); }
                                  }}
                                  onBlur={saveStock}
                                  autoFocus
                                  disabled={isSaving}
                                  data-testid={`input-stock-${product.id}`}
                                />
                                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                              </div>
                            );
                          }
                          const isLow = currentQty <= 0;
                          return (
                            <button
                              type="button"
                              onClick={() => { setEditingStockId(product.id); setEditingStockValue(String(currentQty)); }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-sm font-medium transition-colors ${
                                isLow
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20'
                              }`}
                              data-testid={`button-edit-stock-${product.id}`}
                              title="Click to edit stock and sync to eBay"
                            >
                              <Package className="w-3 h-3" />
                              {currentQty}
                              <Pencil className="w-2.5 h-2.5 opacity-50" />
                            </button>
                          );
                        })()}
                      </TableCell>
                      <TableCell data-testid={`text-vendor-stock-${product.id}`}>
                        {(() => {
                          const attrs = (product as any)?.attributes || {};
                          const vs = attrs.vendorStock;
                          const hasSourceUrl = !!attrs.sourceUrl;
                          if (vs) {
                            const qty = vs.quantity != null ? vs.quantity : null;
                            const isOutOfStock = !vs.inStock || qty === 0;
                            // Confidence: 'high' (latest scrape worked), 'medium' (1-2 failed
                            // since last success), 'low' (3+ failures — stock data is stale).
                            // Older products may have no confidence field — fall back to
                            // judging by lastChecked age.
                            let confidence: 'high' | 'medium' | 'low' = 'high';
                            if (vs.confidence === 'low' || vs.confidence === 'medium' || vs.confidence === 'high') {
                              confidence = vs.confidence;
                            } else if (vs.lastChecked) {
                              const ageDays = (Date.now() - new Date(vs.lastChecked).getTime()) / (1000 * 60 * 60 * 24);
                              confidence = ageDays > 7 ? 'low' : ageDays > 2 ? 'medium' : 'high';
                            }
                            const fromExtension = vs.source === 'extension';
                            const dotColor = fromExtension
                              ? 'bg-blue-500'
                              : (confidence === 'high' ? 'bg-green-500' : confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500');
                            const dotTitle = fromExtension
                              ? `Verified by your Chrome extension on ${vs.lastChecked ? new Date(vs.lastChecked).toLocaleString() : 'the last vendor visit'} — most reliable signal`
                              : confidence === 'high'
                                ? 'Stock data is fresh — last check succeeded'
                                : confidence === 'medium'
                                  ? `Stock check failed ${vs.failedScrapeCount || 1} time(s) — showing last known value`
                                  : `Stock data may be unreliable — ${vs.failedScrapeCount || 'multiple'} failed checks. Visit the vendor page with your Chrome extension to refresh.`;
                            return (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${dotColor} flex-shrink-0`}
                                    title={dotTitle}
                                    data-testid={`dot-stock-confidence-${product.id}`}
                                  />
                                  {isOutOfStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                                  <span className={`text-sm font-medium ${isOutOfStock ? 'text-amber-600' : 'text-green-600'}`}>
                                    {qty != null ? qty : (vs.inStock ? 'In Stock' : '0')}
                                  </span>
                                  {fromExtension && (
                                    <span
                                      className="text-[9px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1 py-0.5 rounded"
                                      title="Stock confirmed by your Chrome extension on the live vendor page"
                                      data-testid={`badge-extension-source-${product.id}`}
                                    >
                                      EXT
                                    </span>
                                  )}
                                </div>
                                {vs.currentPrice && (
                                  <span className="text-[10px] text-muted-foreground">Vendor: {fc(vs.currentPrice)}</span>
                                )}
                                {vs.lastChecked && (
                                  <span className="text-[10px] text-muted-foreground">{new Date(vs.lastChecked).toLocaleDateString()}</span>
                                )}
                              </div>
                            );
                          }
                          if (hasSourceUrl) {
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                                data-testid={`button-check-stock-${product.id}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const btn = e.currentTarget;
                                  btn.disabled = true;
                                  btn.textContent = 'Checking...';
                                  try {
                                    await apiRequest('POST', `/api/products/${product.id}/check-vendor-stock`);
                                    queryClient.invalidateQueries({ queryKey: ['/api/products'] });
                                  } catch {
                                    btn.textContent = 'Failed';
                                  }
                                }}
                              >
                                <RefreshCw className="w-3 h-3" />
                                Check
                              </Button>
                            );
                          }
                          return <span className="text-muted-foreground text-xs">—</span>;
                        })()}
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
                            <span className="text-xs text-muted-foreground">{fc(product.deliveryCost || 0)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const isBlocked = product.veroStatus === 'blocked';
                          const isFlagged = product.veroStatus === 'flagged';
                          const isPublished = allListings?.some((l: any) => l.productId === product.id && l.status === 'active');
                          if (isBlocked) {
                            return (
                              <div className="flex items-center gap-1.5" data-testid={`status-violation-${product.id}`}>
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                                  Policy Violation
                                </Badge>
                              </div>
                            );
                          }
                          if (isFlagged) {
                            return (
                              <div className="flex items-center gap-1.5" data-testid={`status-advisory-${product.id}`}>
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                                  Brand Advisory
                                </Badge>
                              </div>
                            );
                          }
                          if (isPublished) {
                            return (
                              <div className="flex items-center gap-1.5" data-testid={`status-published-${product.id}`}>
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                                  Published
                                </Badge>
                              </div>
                            );
                          }
                          return (
                            <Badge variant="outline" className="bg-muted text-muted-foreground" data-testid={`status-unpublished-${product.id}`}>
                              Unpublished
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(product)} data-testid={`button-edit-product-${product.id}`}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
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

          {barState.show && (
            <div
              ref={pinnedBarRef}
              onScroll={onBarScroll}
              className="pinned-hscroll"
              style={{
                position: 'fixed',
                bottom: 0,
                left: barState.left,
                width: barState.width,
                zIndex: 9999,
                overflowX: 'auto',
                overflowY: 'hidden',
                background: 'hsl(var(--card))',
                borderTop: '1px solid hsl(var(--border) / 0.4)',
              }}
              data-testid="pinned-scrollbar"
            >
              <div style={{ width: barState.scrollW, height: 1 }} />
            </div>
          )}

          {allItems.length > ITEMS_PER_PAGE && (
            <div className="sticky bottom-0 z-10 flex items-center justify-between bg-card/95 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-border/50 shadow-sm" data-testid="pagination-controls-bottom">
              <span className="text-sm text-muted-foreground">
                Showing {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safeCurrentPage * ITEMS_PER_PAGE, allItems.length)} of {allItems.length} products
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  data-testid="button-prev-page-bottom"
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {(() => {
                    const pages: (number | string)[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (safeCurrentPage > 3) pages.push('...');
                      for (let i = Math.max(2, safeCurrentPage - 1); i <= Math.min(totalPages - 1, safeCurrentPage + 1); i++) pages.push(i);
                      if (safeCurrentPage < totalPages - 2) pages.push('...');
                      pages.push(totalPages);
                    }
                    return pages.map((page, idx) =>
                      typeof page === 'string' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                      ) : (
                        <Button
                          key={page}
                          variant={page === safeCurrentPage ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    );
                  })()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  data-testid="button-next-page-bottom"
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="best-sellers">
          <BestSellersTab />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Title</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1.5 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:from-violet-100 hover:to-blue-100"
                  data-testid="button-ai-optimize-title"
                  disabled={isOptimizingTitle || !editingProduct}
                  onClick={async () => {
                    if (!editingProduct) return;
                    setIsOptimizingTitle(true);
                    try {
                      const res = await apiRequest('POST', `/api/products/${editingProduct.id}/ai-optimize-title`, {
                        title: editTitle,
                        description: editDescription,
                        brand: editBrand,
                      });
                      const data: any = await res.json();
                      if (data?.title) {
                        setEditTitle(data.title);
                        toast({ title: 'Title optimised', description: 'AI-generated eBay title applied. Review and save.' });
                      } else {
                        toast({ title: 'Optimisation failed', description: data?.message || 'Could not generate a new title.', variant: 'destructive' });
                      }
                    } catch (err: any) {
                      toast({ title: 'Optimisation failed', description: err?.message || 'Network error', variant: 'destructive' });
                    } finally {
                      setIsOptimizingTitle(false);
                    }
                  }}
                >
                  {isOptimizingTitle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {isOptimizingTitle ? 'Optimising…' : 'AI Optimise Title'}
                </Button>
              </div>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Product title"
                maxLength={80}
                data-testid="input-edit-title"
              />
              <p className="text-[10px] text-muted-foreground">{editTitle.length}/80 characters — eBay's hard limit.</p>
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input
                value={editBrand}
                onChange={(e) => setEditBrand(e.target.value)}
                placeholder="Brand name (used for VeRO compliance)"
                data-testid="input-edit-brand"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1.5 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:from-violet-100 hover:to-blue-100"
                  data-testid="button-ai-optimize-description"
                  disabled={isOptimizingDescription || !editingProduct}
                  onClick={async () => {
                    if (!editingProduct) return;
                    setIsOptimizingDescription(true);
                    try {
                      const res = await apiRequest('POST', `/api/products/${editingProduct.id}/ai-optimize-description`, {
                        title: editTitle,
                        description: editDescription,
                        brand: editBrand,
                      });
                      const data: any = await res.json();
                      if (data?.description) {
                        setEditDescription(data.description);
                        if (data?.itemSpecifics && typeof data.itemSpecifics === 'object') {
                          setEditItemSpecifics(data.itemSpecifics);
                          if (typeof data.itemSpecifics.Brand === 'string' && data.itemSpecifics.Brand.trim() && !editBrand.trim()) {
                            setEditBrand(data.itemSpecifics.Brand.trim());
                          }
                        }
                        const specCount = data?.itemSpecifics ? Object.keys(data.itemSpecifics).length : 0;
                        toast({ title: 'Description optimised', description: specCount > 0 ? `Description + ${specCount} eBay item specifics filled (Brand, Type, MPN, Colour…). Review and save.` : 'AI-generated eBay-ready description applied. Review and save.' });
                      } else {
                        toast({ title: 'Optimisation failed', description: data?.message || 'Could not generate a new description.', variant: 'destructive' });
                      }
                    } catch (err: any) {
                      toast({ title: 'Optimisation failed', description: err?.message || 'Network error', variant: 'destructive' });
                    } finally {
                      setIsOptimizingDescription(false);
                    }
                  }}
                >
                  {isOptimizingDescription ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {isOptimizingDescription ? 'Optimising…' : 'AI Optimise for eBay'}
                </Button>
              </div>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Product description"
                rows={8}
                className="resize-y"
                data-testid="input-edit-description"
              />
              <p className="text-[10px] text-muted-foreground">
                Click <span className="font-medium text-violet-600 dark:text-violet-400">AI Optimise for eBay</span> to rewrite the description into a clean, semantic-HTML eBay-ready listing AND auto-fill the eBay Item Specifics (Brand, Type, MPN, Colour, Material…) buyers search by.
              </p>
              {editItemSpecifics && Object.keys(editItemSpecifics).length > 0 && (
                <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2" data-testid="block-item-specifics">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Product Images</Label>
                <span className="text-xs text-muted-foreground">{editImages.length} image{editImages.length !== 1 ? 's' : ''}</span>
              </div>
              {editImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg border">
                  {editImages.map((url, i) => (
                    <div key={i} className="relative group aspect-square rounded-md overflow-hidden border bg-white">
                      <img src={url} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 15 3-3 3 3"/><circle cx="9" cy="9" r="1"/></svg>'; }} />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {i > 0 && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-white hover:text-white hover:bg-white/20" data-testid={`button-move-image-up-${i}`} onClick={() => setEditImages(prev => { const arr = [...prev]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; return arr; })}>
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-300 hover:text-red-100 hover:bg-red-500/30" data-testid={`button-remove-image-${i}`} onClick={() => setEditImages(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        {i < editImages.length - 1 && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-white hover:text-white hover:bg-white/20" data-testid={`button-move-image-down-${i}`} onClick={() => setEditImages(prev => { const arr = [...prev]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; return arr; })}>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {i === 0 && <span className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground text-[9px] px-1 rounded">Main</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Paste image URL..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newImageUrl.trim()) { e.preventDefault(); setEditImages(prev => [...prev, newImageUrl.trim()]); setNewImageUrl(""); } }}
                  className="flex-1"
                  data-testid="input-add-image-url"
                />
                <Button type="button" variant="outline" size="sm" className="gap-1" data-testid="button-add-image" onClick={() => {
                  if (newImageUrl.trim()) {
                    setEditImages(prev => [...prev, newImageUrl.trim()]);
                    setNewImageUrl("");
                  } else {
                    fileInputRef.current?.click();
                  }
                }}>
                  <ImagePlus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-upload-image-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 w-full"
                  data-testid="button-upload-image"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {isUploadingImage ? 'Uploading...' : 'Upload from device'}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-muted-foreground">Cost Price ({currSym}) <Lock className="w-3 h-3" /></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editCostPrice}
                  disabled
                  className="bg-muted cursor-not-allowed"
                  data-testid="input-edit-cost-price"
                />
                <span className="text-[10px] text-muted-foreground">Auto-synced from vendor</span>
                {Number(editDeliveryCost || 0) > 0 && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
                    Total cost: {fc(Number(editCostPrice) + Number(editDeliveryCost))} (incl. {fc(Number(editDeliveryCost))} delivery)
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Selling Price ({currSym})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editSellingPrice}
                  onChange={(e) => setEditSellingPrice(e.target.value)}
                  data-testid="input-edit-selling-price"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Stock</Label>
                <Input
                  type="number"
                  min="0"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  data-testid="input-edit-quantity"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Type</Label>
                <Select value={editDeliveryType} onValueChange={(val) => { setEditDeliveryType(val); if (val === 'free') setEditDeliveryCost('0'); }}>
                  <SelectTrigger data-testid="select-edit-delivery-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free Delivery</SelectItem>
                    <SelectItem value="buyer_pays">Buyer Pays</SelectItem>
                    <SelectItem value="seller_pays">Seller Pays</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delivery Cost ({currSym})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editDeliveryCost}
                  onChange={(e) => setEditDeliveryCost(e.target.value)}
                  disabled={editDeliveryType === 'free'}
                  className={editDeliveryType === 'free' ? 'bg-muted cursor-not-allowed' : ''}
                  data-testid="input-edit-delivery-cost"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variations</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  data-testid="button-add-variation"
                  onClick={() => setEditVariations(prev => [...prev, { type: 'Colour', value: '', available: true, price: '', quantity: '', image: '' }])}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
              {editVariations.length > 0 ? (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border max-h-72 overflow-y-auto">
                  <input
                    ref={variationFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    data-testid="input-variation-file-upload"
                    onChange={(e) => {
                      const idx = pendingVariationIdx;
                      setPendingVariationIdx(null);
                      if (idx === null) return;
                      handleVariationImageUpload(e, idx);
                    }}
                  />
                  <div className="grid grid-cols-[6rem_1fr_5rem_3.5rem_1fr_5rem_2rem] gap-2 text-[10px] text-muted-foreground font-medium px-1">
                    <span>Type</span>
                    <span>Value</span>
                    <span>Price</span>
                    <span>Qty</span>
                    <span>Pictures (multi)</span>
                    <span>Add Pic</span>
                    <span></span>
                  </div>
                  {editVariations.map((v, i) => (
                    <div key={i} className="grid grid-cols-[6rem_1fr_5rem_3.5rem_1fr_5rem_2rem] gap-2 items-center">
                      <Select
                        value={v.type}
                        onValueChange={(val) => setEditVariations(prev => prev.map((item, idx) => idx === i ? { ...item, type: val } : item))}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-variation-type-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Colour">Colour</SelectItem>
                          <SelectItem value="Size">Size</SelectItem>
                          <SelectItem value="Material">Material</SelectItem>
                          <SelectItem value="Style">Style</SelectItem>
                          <SelectItem value="Option">Option</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-xs"
                        placeholder="e.g. Red, Large..."
                        value={v.value}
                        onChange={(e) => setEditVariations(prev => prev.map((item, idx) => idx === i ? { ...item, value: e.target.value } : item))}
                        data-testid={`input-variation-value-${i}`}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-xs"
                        placeholder="Base"
                        value={v.price || ''}
                        onChange={(e) => setEditVariations(prev => prev.map((item, idx) => idx === i ? { ...item, price: e.target.value } : item))}
                        data-testid={`input-variation-price-${i}`}
                      />
                      <Input
                        type="number"
                        min="0"
                        className="h-8 text-xs"
                        placeholder="1"
                        value={v.quantity || ''}
                        onChange={(e) => setEditVariations(prev => prev.map((item, idx) => idx === i ? { ...item, quantity: e.target.value } : item))}
                        data-testid={`input-variation-quantity-${i}`}
                      />
                      <div className="flex flex-wrap gap-1 items-center min-h-8 p-1 bg-background rounded border" data-testid={`variation-images-${i}`}>
                        {(v.images && v.images.length > 0 ? v.images : (v.image ? [v.image] : [])).map((img, imgIdx) => (
                          <div key={`${img}-${imgIdx}`} className="relative group">
                            <img src={img} className="w-7 h-7 object-cover rounded" alt={`Picture ${imgIdx + 1}`} />
                            <button
                              type="button"
                              className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-3.5 h-3.5 text-[8px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-remove-variation-image-${i}-${imgIdx}`}
                              onClick={() => setEditVariations(prev => prev.map((item, idx) => {
                                if (idx !== i) return item;
                                const arr = (item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : [])).filter((_, k) => k !== imgIdx);
                                return { ...item, image: arr[0] || '', images: arr };
                              }))}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <Select
                          value=""
                          onValueChange={(val) => {
                            if (!val || val === 'none') return;
                            setEditVariations(prev => prev.map((item, idx) => {
                              if (idx !== i) return item;
                              const arr = item.images && item.images.length > 0 ? [...item.images] : (item.image ? [item.image] : []);
                              if (!arr.includes(val)) arr.push(val);
                              return { ...item, image: arr[0], images: arr };
                            }));
                          }}
                        >
                          <SelectTrigger className="h-6 w-6 p-0 text-[10px] flex items-center justify-center" data-testid={`select-variation-image-add-${i}`}>
                            <Plus className="w-3 h-3" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground text-xs">Pick from gallery…</span>
                            </SelectItem>
                            {editImages.map((img, imgIdx) => (
                              <SelectItem key={imgIdx} value={img}>
                                <div className="flex items-center gap-2">
                                  <img src={img} className="w-8 h-8 object-cover rounded" alt="" />
                                  <span className="text-xs">Image {imgIdx + 1}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] gap-1 px-2"
                        data-testid={`button-add-variation-picture-${i}`}
                        disabled={uploadingVariationIdx !== null}
                        onClick={() => {
                          setPendingVariationIdx(i);
                          if (variationFileInputRef.current) {
                            variationFileInputRef.current.value = '';
                            variationFileInputRef.current.click();
                          }
                        }}
                      >
                        {uploadingVariationIdx === i ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-3 h-3" />
                            Add
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                        data-testid={`button-remove-variation-${i}`}
                        onClick={() => setEditVariations(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground px-1 pt-1">Leave Price blank to use the main selling price. Click "Add" to upload a picture directly for a variation — it will appear in the Image dropdown and be shown on eBay when the buyer selects that option.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg border">No variations added. Click "Add" to create colours or sizes, each with its own price (e.g. Black £12.99, Red £14.99).</p>
              )}
            </div>
            {editingProduct?.attributes?.vendorStock && (() => {
              const vs = editingProduct.attributes.vendorStock;
              const isOutOfStock = !vs.inStock || vs.quantity === 0;
              let confidence: 'high' | 'medium' | 'low' = 'high';
              if (vs.confidence === 'low' || vs.confidence === 'medium' || vs.confidence === 'high') {
                confidence = vs.confidence;
              } else if (vs.lastChecked) {
                const ageDays = (Date.now() - new Date(vs.lastChecked).getTime()) / (1000 * 60 * 60 * 24);
                confidence = ageDays > 7 ? 'low' : ageDays > 2 ? 'medium' : 'high';
              }
              const confidenceLabel = confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence';
              const confidenceColor = confidence === 'high' ? 'bg-green-500' : confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500';
              const confidenceExplain = confidence === 'high'
                ? 'The latest stock check from the vendor succeeded.'
                : confidence === 'medium'
                  ? `Stock check has failed ${vs.failedScrapeCount || 1} time(s). Showing the last known value — recheck recommended.`
                  : `Stock data may be unreliable — ${vs.failedScrapeCount || 'multiple'} failed checks in a row. The vendor may be blocking us. Try opening the source URL directly to verify.`;
              return (
                <div className="space-y-2">
                  <Label>Vendor Stock Status</Label>
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${isOutOfStock ? 'bg-amber-500/5 border-amber-200' : 'bg-muted/30'}`}>
                    {isOutOfStock && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    <Badge variant="outline" className={isOutOfStock ? 'bg-amber-500/10 text-amber-600 border-amber-200' : 'bg-green-500/10 text-green-600 border-green-200'}>
                      {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                    </Badge>
                    {vs.quantity != null && (
                      <span className="text-sm text-muted-foreground">Qty: {vs.quantity}</span>
                    )}
                    {vs.lastChecked && (
                      <span className="text-xs text-muted-foreground ml-auto">Last checked: {new Date(vs.lastChecked).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg border bg-muted/20" data-testid="section-stock-confidence">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${confidenceColor} flex-shrink-0 mt-1.5`} />
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">{confidenceLabel}</p>
                      <p className="text-[11px] text-muted-foreground">{confidenceExplain}</p>
                      {vs.lastSuccessfulCheck && confidence !== 'high' && (
                        <p className="text-[11px] text-muted-foreground">Last successful check: {new Date(vs.lastSuccessfulCheck).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateProduct.isPending} data-testid="button-save-edit">
              {updateProduct.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const { symbol: currSym } = useCurrency();
  const createProduct = useCreateProduct();
  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      title: "",
      brand: "",
      sku: "",
      costPrice: "0",
      sellingPrice: "0",
      quantity: 10,
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
                <Input placeholder="Product title" {...field} data-testid="input-product-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand</FormLabel>
              <FormControl>
                <Input placeholder="Brand name (used for VeRO compliance)" {...field} value={field.value || ''} data-testid="input-product-brand" />
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
                <FormLabel>Cost Price ({currSym})</FormLabel>
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
                <FormLabel>Selling Price ({currSym})</FormLabel>
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
                <FormLabel>Delivery Cost ({currSym})</FormLabel>
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
        
        <Button type="submit" className="w-full mt-4" disabled={createProduct.isPending}>
          {createProduct.isPending ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </Form>
  );
}

function BestSellersTab() {
  const { format: fc } = useCurrency();
  const [, navigate] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: addonPurchasesData, isLoading: addonsLoading } = useQuery<{ purchases: any[] }>({
    queryKey: ["/api/addons/purchases"],
  });

  const hasAddon = (addonPurchasesData?.purchases || []).some((p: any) => p.addonId === "trending-products" && p.status === "active");

  const { data: trendingData, isLoading, isFetching, refetch } = useQuery<{ products: any[] }>({
    queryKey: ["/api/addons/trending-products"],
    enabled: !!hasAddon,
  });

  if (addonsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
    );
  }

  if (!hasAddon) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-xl font-semibold">Best Sellers Add-on Required</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Subscribe to the Trending Products add-on to access best-selling products and their prices across all major platforms.
        </p>
        <Button onClick={() => navigate("/addons")} className="gap-2" data-testid="button-unlock-best-sellers">
          <TrendingUp className="w-4 h-4" />
          View Add-ons
        </Button>
      </div>
    );
  }

  const products = trendingData?.products || [];

  const reliabilityLabel = (r: string) => r === 'excellent' ? 'Excellent' : r === 'very_good' ? 'Very Good' : 'Good';
  const reliabilityColor = (r: string) => r === 'excellent' ? 'text-green-600 dark:text-green-400' : r === 'very_good' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Top-performing products across major e-commerce platforms. Click any product to view details and source directly.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
          data-testid="button-refresh-best-sellers"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Top Seller</TableHead>
              <TableHead className="w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading best sellers...</TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <p className="text-muted-foreground">No best sellers data available yet. Check back soon!</p>
                </TableCell>
              </TableRow>
            ) : (
              products.map((item: any, idx: number) => (
                <TableRow
                  key={item.id || idx}
                  data-testid={`row-best-seller-${item.id || idx}`}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedProduct(item)}
                >
                  <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.title || item.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.category || "General"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{item.platform || "Various"}</TableCell>
                  <TableCell className="font-semibold">{item.price ? fc(Number(item.price)) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {item.trend || "Hot"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.vendorName ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          {item.vendorReliability === 'excellent' ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate max-w-[120px]" title={item.vendorName} data-testid={`text-vendor-name-${item.id || idx}`}>{item.vendorName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {item.vendorRating || "—"}
                          </span>
                          <span>({item.vendorReviews ? Number(item.vendorReviews).toLocaleString() : "—"} reviews)</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-7 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800"
                      onClick={(e) => { e.stopPropagation(); setSelectedProduct(item); }}
                      data-testid={`button-view-product-${item.id || idx}`}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Source
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedProduct} onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto" data-testid="sheet-product-detail">
          {selectedProduct && (
            <div className="space-y-6 pt-2">
              <SheetHeader className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20">{selectedProduct.platform}</Badge>
                  <Badge variant="outline">{selectedProduct.category || "General"}</Badge>
                </div>
                <SheetTitle className="text-xl leading-tight" data-testid="text-product-title">{selectedProduct.title || selectedProduct.name}</SheetTitle>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-card p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    <Tag className="w-3.5 h-3.5" />
                    Price
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-product-price">
                    {selectedProduct.price ? fc(Number(selectedProduct.price)) : "—"}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Sales Volume
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-sales-volume">
                    {selectedProduct.salesVolume ? Number(selectedProduct.salesVolume).toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold">Highest Rated Seller</span>
                </div>
                {selectedProduct.vendorName ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {selectedProduct.vendorReliability === 'excellent' ? (
                        <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                      <span className="text-base font-semibold" data-testid="text-detail-vendor-name">{selectedProduct.vendorName}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-lg font-bold" data-testid="text-detail-vendor-rating">{selectedProduct.vendorRating || "—"}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Rating</div>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <div className="text-lg font-bold" data-testid="text-detail-vendor-reviews">{selectedProduct.vendorReviews ? Number(selectedProduct.vendorReviews).toLocaleString() : "—"}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Reviews</div>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <div className={`text-sm font-bold ${reliabilityColor(selectedProduct.vendorReliability || '')}`} data-testid="text-detail-vendor-reliability">
                          {reliabilityLabel(selectedProduct.vendorReliability || '')}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Reliability</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No vendor information available.</p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                {selectedProduct.productUrl && (
                  <a
                    href={selectedProduct.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-colors"
                    data-testid="link-source-product"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Source from {selectedProduct.vendorName || selectedProduct.platform}
                  </a>
                )}
                <p className="text-[11px] text-center text-muted-foreground leading-tight">
                  Opens the product on {selectedProduct.vendorName || selectedProduct.platform}. You can purchase or list this product directly from the seller's page.
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

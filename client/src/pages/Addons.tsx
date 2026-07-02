import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useVendors } from "@/hooks/use-vendors";
import { useCurrency } from "@/hooks/use-currency";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Lock, Unlock, TrendingUp, ShoppingCart, BarChart3, Crown, Loader2,
  Package, Sparkles, ExternalLink, RefreshCw, Download, Scale, ArrowUpDown,
  ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle, Mail, Send,
  Search, ShoppingBag
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

interface AddonPurchase {
  id: number;
  addonId: string;
  status: string;
  purchasedAt: string;
}

interface TrendingProduct {
  id: number;
  platform: string;
  title: string;
  category: string | null;
  price: string | null;
  currency: string | null;
  salesVolume: number | null;
  rank: number | null;
  monthYear: string | null;
  productUrl?: string | null;
}

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

const AVAILABLE_ADDONS = [
  {
    id: "trending-products",
    name: "Trending Products Database",
    description: "Access monthly best-selling products from all major e-commerce platforms including Amazon, eBay, Shopify, Walmart, CJ Dropshipping, Costco, Home Bargains, TikTok Shop, Temu, and Shein. Includes sales volume data, pricing, and cross-platform analytics.",
    price: 3.99,
    icon: TrendingUp,
    features: [
      "Best-sellers from 9 platforms updated monthly",
      "Sales volume & ranking data",
      "Cross-platform analytics with charts",
      "Category breakdown & price analysis",
    ],
  },
  {
    id: "price-comparison",
    name: "Cross-Platform Price Comparison",
    description: "Compare prices for best-selling products across 14 UK vendors including Amazon, eBay, Argos, Currys, John Lewis, Very, AO.com, Boots, and more. Find the lowest Total Effective Price including shipping, tax, and discounts to maximise your margins.",
    price: 1.99,
    icon: Scale,
    features: [
      "Real-time price comparison across 14 UK vendors",
      "Total Effective Price (TEP) with shipping & tax",
      "Best Value & Lowest Price indicators",
      "Seller ratings & delivery time estimates",
      "30 best-selling products tracked weekly",
    ],
  },
];

export default function Addons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { format: fc } = useCurrency();
  const { user } = useAuth();
  const [location] = useLocation();
  const [platformFilter, setPlatformFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const isAdmin = user?.isAdmin === "true" || user?.email === "dropandsellauth@gmail.com";

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

  const { data: purchasesData } = useQuery<{ purchases: AddonPurchase[] }>({
    queryKey: ["/api/addons/purchases"],
  });

  const purchases = purchasesData?.purchases || [];
  const hasTrending = purchases.some(p => p.addonId === "trending-products" && p.status === "active");
  const hasPriceComparison = purchases.some(p => p.addonId === "price-comparison" && p.status === "active");
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [comparisonPlatformFilter, setComparisonPlatformFilter] = useState("all");
  const [comparisonCategoryFilter, setComparisonCategoryFilter] = useState("all");
  const [comparisonSort, setComparisonSort] = useState<"tep" | "savings" | "delivery">("tep");
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCountry, setSearchCountry] = useState("GB");
  const [searchCategory, setSearchCategory] = useState("all");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showAllResults, setShowAllResults] = useState(false);

  const { data: countriesData } = useQuery<{ countries: { code: string; name: string; flag: string; currency: string; vendorCount: number; categories: { name: string; count: number }[] }[] }>({
    queryKey: ["/api/addons/price-comparison/countries"],
    enabled: hasPriceComparison,
  });
  const countries = countriesData?.countries || [];
  const selectedCountryMeta = countries.find(c => c.code === searchCountry);
  const availableCategories = selectedCountryMeta?.categories || [];

  const searchMutation = useMutation({
    mutationFn: async (vars: { query: string; country: string; category: string }) => {
      const res = await apiRequest("POST", "/api/addons/price-comparison/search", vars);
      return res.json();
    },
    onSuccess: (data: any) => {
      setSearchResults(data);
      setShowAllResults(false);
    },
    onError: (err: any) => {
      toast({ title: "Search Failed", description: err.message || "Could not search", variant: "destructive" });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim().length < 2) {
      toast({ title: "Enter a product name", description: "Type at least 2 characters to search", variant: "destructive" });
      return;
    }
    searchMutation.mutate({ query: searchQuery.trim(), country: searchCountry, category: searchCategory });
  };

  // Reset category when country changes (categories differ per country)
  const handleCountryChange = (code: string) => {
    setSearchCountry(code);
    setSearchCategory("all");
  };

  const { data: trendingData, isLoading: trendingLoading } = useQuery<{ products: TrendingProduct[] }>({
    queryKey: ["/api/addons/trending-products"],
    enabled: hasTrending,
  });

  const { data: priceCompData, isLoading: priceCompLoading } = useQuery<{ products: any[] }>({
    queryKey: ["/api/addons/price-comparison"],
    enabled: hasPriceComparison,
  });

  const notifyMutation = useMutation({
    mutationFn: async (addon: { name: string; price: string; description: string }) => {
      const res = await apiRequest("POST", "/api/admin/notify-new-addon", {
        addonName: addon.name,
        addonPrice: addon.price,
        addonDescription: addon.description,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Notifications Sent", description: `Sent to ${data.sent} users (${data.failed} failed)` });
      setNotifyDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send notifications", variant: "destructive" });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (addonId: string) => {
      const res = await apiRequest("POST", "/api/addons/purchase", { addonId });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to start checkout", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ addonId, sessionId }: { addonId: string; sessionId: string }) => {
      const res = await apiRequest("POST", "/api/addons/activate", { addonId, sessionId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addons/purchases"] });
      toast({ title: "Add-on Activated", description: "You now have access to this add-on." });
    },
    onError: (err: any) => {
      toast({ title: "Activation Failed", description: err.message || "Could not verify payment", variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchased = params.get("purchased");
    const sessionId = params.get("session_id");
    if (purchased && sessionId) {
      activateMutation.mutate({ addonId: purchased, sessionId });
      window.history.replaceState({}, "", "/addons");
    }
  }, []);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/seed-trending");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/addons/trending-products"] });
      toast({ title: "Database Populated", description: `${data.count} products loaded for ${data.monthYear}` });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const trendingProducts = trendingData?.products || [];

  const filteredProducts = trendingProducts.filter((p) => {
    const matchesPlatform = platformFilter === "all" || p.platform === platformFilter;
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchesPlatform && matchesCategory;
  });

  const platforms = [...new Set(trendingProducts.map(p => p.platform))];
  const categories = [...new Set(trendingProducts.map(p => p.category).filter(Boolean))] as string[];

  const salesByPlatform = useMemo(() => {
    const totals: Record<string, number> = {};
    trendingProducts.forEach(p => {
      totals[p.platform] = (totals[p.platform] || 0) + (p.salesVolume || 0);
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [trendingProducts]);

  const productsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    trendingProducts.forEach(p => {
      const cat = p.category || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [trendingProducts]);

  const avgPriceByPlatform = useMemo(() => {
    const sums: Record<string, { total: number; count: number }> = {};
    trendingProducts.forEach(p => {
      if (p.price) {
        if (!sums[p.platform]) sums[p.platform] = { total: 0, count: 0 };
        sums[p.platform].total += Number(p.price);
        sums[p.platform].count++;
      }
    });
    return Object.entries(sums)
      .map(([name, { total, count }]) => ({ name, avgPrice: Math.round(total / count * 100) / 100 }))
      .sort((a, b) => b.avgPrice - a.avgPrice);
  }, [trendingProducts]);

  const topProductsAllPlatforms = useMemo(() => {
    return [...trendingProducts]
      .sort((a, b) => (b.salesVolume || 0) - (a.salesVolume || 0))
      .slice(0, 10);
  }, [trendingProducts]);

  const priceCompProducts = priceCompData?.products || [];
  const comparisonPlatforms = useMemo(() => {
    const set = new Set<string>();
    priceCompProducts.forEach((p: any) => p.platforms?.forEach((l: any) => set.add(l.platform)));
    return [...set].sort();
  }, [priceCompProducts]);
  const comparisonCategories = useMemo(() => {
    return [...new Set(priceCompProducts.map((p: any) => p.category))].sort();
  }, [priceCompProducts]);
  const filteredCompProducts = useMemo(() => {
    let items = priceCompProducts;
    if (comparisonCategoryFilter !== "all") {
      items = items.filter((p: any) => p.category === comparisonCategoryFilter);
    }
    return items.map((p: any) => {
      let listings = p.platforms || [];
      if (comparisonPlatformFilter !== "all") {
        listings = listings.filter((l: any) => l.platform === comparisonPlatformFilter);
      }
      const minTep = listings.length > 0 ? Math.min(...listings.map((l: any) => l.totalEffectivePrice)) : 0;
      const maxTep = listings.length > 0 ? Math.max(...listings.map((l: any) => l.totalEffectivePrice)) : 0;
      const savings = maxTep - minTep;
      return { ...p, platforms: listings, minTep, maxTep, savings };
    }).filter((p: any) => p.platforms.length > 0)
    .sort((a: any, b: any) => {
      if (comparisonSort === "savings") return b.savings - a.savings;
      if (comparisonSort === "delivery") {
        const aMin = Math.min(...a.platforms.map((l: any) => l.deliveryDays));
        const bMin = Math.min(...b.platforms.map((l: any) => l.deliveryDays));
        return aMin - bMin;
      }
      return a.minTep - b.minTep;
    });
  }, [priceCompProducts, comparisonPlatformFilter, comparisonCategoryFilter, comparisonSort]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight" data-testid="text-addons-title">
            Add-ons
          </h2>
          <p className="text-muted-foreground mt-2">
            Enhance your dropshipping business with premium tools and data
          </p>
        </div>
        {isAdmin && (
          <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-notify-users">
                <Mail className="w-4 h-4" />
                Notify Users of New Add-on
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Add-on Notification Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Choose which add-on to notify all verified users about:
                </p>
                {AVAILABLE_ADDONS.map(addon => (
                  <div key={addon.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <addon.icon className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{addon.name}</p>
                        <p className="text-xs text-muted-foreground">{fc(addon.price)}/month</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => notifyMutation.mutate({
                        name: addon.name,
                        price: `£${addon.price.toFixed(2)}/month`,
                        description: addon.description,
                      })}
                      disabled={notifyMutation.isPending}
                      data-testid={`button-send-notify-${addon.id}`}
                    >
                      {notifyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {AVAILABLE_ADDONS.map((addon) => {
          const isPurchased = purchases.some(p => p.addonId === addon.id && p.status === "active");
          const Icon = addon.icon;

          return (
            <Card key={addon.id} className={`relative overflow-hidden ${isPurchased ? "border-green-500/30" : "border-primary/20"}`} data-testid={`card-addon-${addon.id}`}>
              {isPurchased && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                    <Unlock className="w-3 h-3" />
                    Unlocked
                  </Badge>
                </div>
              )}
              {!isPurchased && (
                <div className="absolute top-3 right-3">
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    Locked
                  </Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{addon.name}</CardTitle>
                    <p className="text-2xl font-bold text-primary mt-1">{fc(addon.price)}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                  </div>
                </div>
                <CardDescription>{addon.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {addon.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isPurchased ? (
                  <Button
                    className="w-full gap-2"
                    onClick={() => purchaseMutation.mutate(addon.id)}
                    disabled={purchaseMutation.isPending}
                    data-testid={`button-purchase-${addon.id}`}
                  >
                    {purchaseMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Crown className="w-4 h-4" />
                    )}
                    Unlock for {fc(addon.price)}/month
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full gap-2 text-green-600" disabled>
                    <Unlock className="w-4 h-4" />
                    Active
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card className="border-dashed border-2 flex items-center justify-center min-h-[300px]" data-testid="card-addon-coming-soon">
          <CardContent className="text-center py-8">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">More Add-ons Coming Soon</h3>
            <p className="text-sm text-muted-foreground/70 max-w-[200px] mx-auto">
              New premium tools and data features are on the way
            </p>
          </CardContent>
        </Card>
      </div>

      {hasTrending && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-bold">Trending Products Database</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = '/api/addons/trending-products/download';
                }}
                className="gap-2"
                data-testid="button-download-excel"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  className="gap-2"
                  data-testid="button-seed-trending"
                >
                  {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh Data
                </Button>
              )}
            </div>
          </div>

          <Tabs defaultValue="products" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-[450px]">
              <TabsTrigger value="products" className="gap-2" data-testid="tab-products">
                <ShoppingCart className="w-4 h-4" />
                Products
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="top10" className="gap-2" data-testid="tab-top10">
                <TrendingUp className="w-4 h-4" />
                Top 10
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Best-Selling Products</CardTitle>
                      <CardDescription>{filteredProducts.length} products across {platforms.length} platforms</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="w-[160px]" data-testid="select-platform-filter">
                          <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Platforms</SelectItem>
                          {platforms.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {trendingLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Sales Volume</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => (
                            <TableRow key={product.id} data-testid={`row-trending-${product.id}`}>
                              <TableCell className="font-bold text-muted-foreground">{product.rank}</TableCell>
                              <TableCell>
                                {product.productUrl ? (
                                  <a
                                    href={product.productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-primary hover:underline inline-flex items-center gap-1.5"
                                    data-testid={`link-product-${product.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {product.title}
                                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                                  </a>
                                ) : (
                                  <p className="font-medium">{product.title}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  product.platform === "Amazon" ? "border-orange-500/30 text-orange-600" :
                                  product.platform === "eBay" ? "border-blue-500/30 text-blue-600" :
                                  product.platform === "Shopify" ? "border-green-500/30 text-green-600" :
                                  product.platform === "Walmart" ? "border-indigo-500/30 text-indigo-600" :
                                  product.platform === "CJ Dropshipping" ? "border-amber-500/30 text-amber-600" :
                                  product.platform === "Costco" ? "border-red-500/30 text-red-600" :
                                  product.platform === "Home Bargains" ? "border-emerald-500/30 text-emerald-600" :
                                  product.platform === "TikTok Shop" ? "border-pink-500/30 text-pink-600" :
                                  product.platform === "Temu" ? "border-violet-500/30 text-violet-600" :
                                  product.platform === "Shein" ? "border-fuchsia-500/30 text-fuchsia-600" :
                                  "border-gray-500/30 text-gray-600"
                                }>
                                  {product.platform}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{product.category || "—"}</TableCell>
                              <TableCell>{product.price ? fc(Number(product.price)) : "—"}</TableCell>
                              <TableCell>
                                <span className="font-semibold">{(product.salesVolume || 0).toLocaleString()}</span>
                                <span className="text-xs text-muted-foreground ml-1">units</span>
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

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card data-testid="card-sales-by-platform">
                  <CardHeader>
                    <CardTitle>Total Sales Volume by Platform</CardTitle>
                    <CardDescription>Aggregate sales across all best-selling products</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesByPlatform}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                        <Tooltip formatter={(value: any) => [Number(value).toLocaleString() + " units", "Sales"]} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Sales Volume">
                          {salesByPlatform.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-products-by-category">
                  <CardHeader>
                    <CardTitle>Products by Category</CardTitle>
                    <CardDescription>Category distribution of best-selling products</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={productsByCategory} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {productsByCategory.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-avg-price-by-platform">
                  <CardHeader>
                    <CardTitle>Average Price by Platform</CardTitle>
                    <CardDescription>Average product price of best-sellers per platform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={avgPriceByPlatform} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => fc(v)} />
                        <YAxis type="category" dataKey="name" width={80} />
                        <Tooltip formatter={(value: any) => [fc(value), "Avg Price"]} />
                        <Bar dataKey="avgPrice" fill="#6366f1" radius={[0, 4, 4, 0]} name="Average Price" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-platform-share">
                  <CardHeader>
                    <CardTitle>Platform Market Share</CardTitle>
                    <CardDescription>Sales volume share across platforms</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={salesByPlatform} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {salesByPlatform.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [Number(value).toLocaleString() + " units", "Sales"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="top10">
              <Card data-testid="card-top10">
                <CardHeader>
                  <CardTitle>Top 10 Best-Selling Products (All Platforms)</CardTitle>
                  <CardDescription>Products with the highest sales volume this month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topProductsAllPlatforms.map((product, idx) => (
                      <div key={product.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`top10-product-${idx}`}>
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{product.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{product.platform}</Badge>
                            {product.category && (
                              <span className="text-xs text-muted-foreground">{product.category}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-lg">{(product.salesVolume || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">units sold</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">{product.price ? fc(Number(product.price)) : "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!hasTrending && (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="py-16 text-center">
            <Lock className="w-16 h-16 mx-auto text-muted-foreground/30 mb-6" />
            <h3 className="text-xl font-bold mb-2">Unlock Trending Products Data</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Purchase the Trending Products add-on above to access best-selling product data, 
              cross-platform analytics, and sales insights.
            </p>
          </CardContent>
        </Card>
      )}

      {hasPriceComparison && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-bold">Cross-Platform Price Comparison</h3>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Any Product
              </CardTitle>
              <CardDescription>
                Pick a country and paste any product name to compare prices across that country's top vendors instantly. Each card opens live product results from that vendor — click any product to land on the vendor's checkout page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-2">
                <Select value={searchCountry} onValueChange={handleCountryChange}>
                  <SelectTrigger className="w-full lg:w-[240px]" data-testid="select-search-country">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {countries.length === 0 ? (
                      <SelectItem value="GB" data-testid="option-country-GB">🇬🇧 United Kingdom</SelectItem>
                    ) : (
                      countries.map(c => (
                        <SelectItem key={c.code} value={c.code} data-testid={`option-country-${c.code}`}>
                          {c.flag} {c.name} <span className="text-muted-foreground ml-1">· {c.vendorCount} vendors</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Select value={searchCategory} onValueChange={setSearchCategory}>
                  <SelectTrigger className="w-full lg:w-[200px]" data-testid="select-search-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    <SelectItem value="all" data-testid="option-category-all">All Categories</SelectItem>
                    {availableCategories.map(c => (
                      <SelectItem key={c.name} value={c.name} data-testid={`option-category-${c.name}`}>
                        {c.name} <span className="text-muted-foreground ml-1">· {c.count}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="e.g. iPhone 15 case, Nike Air Max 90, Samsung charger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-price-search"
                  className="flex-1"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchMutation.isPending}
                  data-testid="button-price-search"
                >
                  {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                  Compare
                </Button>
              </div>

              {searchResults && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm text-muted-foreground" data-testid="text-search-summary">
                      Showing results for <span className="font-semibold text-foreground">"{searchResults.query}"</span> in{" "}
                      <span className="font-semibold text-foreground" data-testid="text-search-country">
                        {(countries.find(c => c.code === searchResults.country)?.flag || "")} {countries.find(c => c.code === searchResults.country)?.name || searchResults.country}
                      </span>
                      {searchResults.category && searchResults.category !== "all" && (
                        <> · <span className="font-semibold text-foreground">{searchResults.category}</span></>
                      )}
                      {" · "}
                      <span data-testid="text-search-vendor-count">
                        {searchResults.platforms?.length || 0}
                        {typeof searchResults.totalAvailable === "number" && searchResults.totalAvailable > (searchResults.platforms?.length || 0)
                          ? ` of ${searchResults.totalAvailable}`
                          : ""}
                        {" "}vendors
                      </span>
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => { setSearchResults(null); setSearchQuery(""); setShowAllResults(false); }} data-testid="button-clear-search">
                      Clear
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {(showAllResults ? searchResults.platforms : (searchResults.platforms || []).slice(0, 24))?.map((p: any, idx: number) => {
                      const name = String(p.platform || "").toLowerCase();
                      const platformColor =
                        name.includes("amazon") ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        name.includes("ebay") ? "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20" :
                        name.includes("argos") ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" :
                        name.includes("currys") ? "border-sky-500/40 bg-sky-50/50 dark:bg-sky-950/20" :
                        name.includes("john lewis") ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20" :
                        name.includes("very") ? "border-pink-500/40 bg-pink-50/50 dark:bg-pink-950/20" :
                        name.includes("ao.com") ? "border-cyan-500/40 bg-cyan-50/50 dark:bg-cyan-950/20" :
                        name.includes("boots") ? "border-blue-600/40 bg-blue-50/50 dark:bg-blue-950/20" :
                        name.includes("superdrug") ? "border-fuchsia-500/40 bg-fuchsia-50/50 dark:bg-fuchsia-950/20" :
                        name.includes("onbuy") ? "border-teal-500/40 bg-teal-50/50 dark:bg-teal-950/20" :
                        name.includes("robert dyas") ? "border-amber-600/40 bg-amber-50/50 dark:bg-amber-950/20" :
                        name.includes("richer sounds") ? "border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/20" :
                        name.includes("cj dropshipping") ? "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20" :
                        name.includes("costco") ? "border-red-400/40 bg-red-50/50 dark:bg-red-950/20" :
                        name.includes("home bargains") ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20" :
                        name.includes("temu") ? "border-violet-500/40 bg-violet-50/50 dark:bg-violet-950/20" :
                        name.includes("walmart") ? "border-blue-700/40 bg-blue-50/50 dark:bg-blue-950/20" :
                        name.includes("target") ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" :
                        name.includes("best buy") ? "border-yellow-500/40 bg-yellow-50/50 dark:bg-yellow-950/20" :
                        name.includes("home depot") ? "border-orange-600/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        name.includes("aliexpress") || name.includes("alibaba") ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        name.includes("jumia") ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        name.includes("konga") ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" :
                        name.includes("flipkart") ? "border-yellow-500/40 bg-yellow-50/50 dark:bg-yellow-950/20" :
                        name.includes("noon") ? "border-yellow-500/40 bg-yellow-50/50 dark:bg-yellow-950/20" :
                        name.includes("mercado") ? "border-yellow-500/40 bg-yellow-50/50 dark:bg-yellow-950/20" :
                        name.includes("rakuten") ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" :
                        name.includes("shopee") ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        name.includes("lazada") ? "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20" :
                        name.includes("zalando") ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        name.includes("otto") ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" :
                        name.includes("mediamarkt") || name.includes("media markt") ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" :
                        name.includes("takealot") ? "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20" :
                        name.includes("etsy") ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        name.includes("dhgate") ? "border-pink-500/40 bg-pink-50/50 dark:bg-pink-950/20" :
                        name.includes("banggood") ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" :
                        "border-gray-500/40 bg-gray-50/50 dark:bg-gray-950/20";

                      return (
                        <div
                          key={idx}
                          className={`flex flex-col border rounded-lg p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${platformColor}`}
                          data-testid={`card-search-platform-${idx}`}
                        >
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {p.faviconUrl && (
                                <img
                                  src={p.faviconUrl}
                                  alt=""
                                  className="w-5 h-5 rounded shrink-0"
                                  loading="lazy"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              <span className="font-bold text-sm truncate" data-testid={`text-platform-name-${idx}`}>{p.platform}</span>
                            </div>
                          </div>
                          {p.category && (
                            <Badge variant="outline" className="text-[10px] mb-1.5 px-1.5 py-0">{p.category}</Badge>
                          )}
                          {p.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{p.description}</p>
                          )}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{p.sellerRating}★</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">~{p.estimatedDeliveryDays}d delivery</span>
                          </div>
                          <div className="mt-auto space-y-1.5">
                            <a
                              href={p.searchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1.5 w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium py-2 px-3 rounded-md transition-colors"
                              data-testid={`link-buy-product-${idx}`}
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              View Products & Buy
                            </a>
                            {p.vendorSearchUrl && (
                              <a
                                href={p.vendorSearchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1 w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                data-testid={`link-browse-vendor-${idx}`}
                              >
                                Browse on {p.domain || p.platform}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!showAllResults && (searchResults.platforms?.length || 0) > 24 && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllResults(true)}
                        data-testid="button-show-all-vendors"
                      >
                        Show all {searchResults.platforms.length} vendors
                      </Button>
                    </div>
                  )}
                  {showAllResults && (searchResults.platforms?.length || 0) > 24 && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllResults(false)}
                        data-testid="button-show-fewer-vendors"
                      >
                        Show fewer
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Best-Selling Products — Price Comparison</CardTitle>
                  <CardDescription>{filteredCompProducts.length} products compared across {comparisonPlatforms.length} platforms</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={comparisonPlatformFilter} onValueChange={setComparisonPlatformFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-comp-platform">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      {comparisonPlatforms.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={comparisonCategoryFilter} onValueChange={setComparisonCategoryFilter}>
                    <SelectTrigger className="w-[160px]" data-testid="select-comp-category">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {comparisonCategories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={comparisonSort} onValueChange={(v: any) => setComparisonSort(v)}>
                    <SelectTrigger className="w-[150px]" data-testid="select-comp-sort">
                      <ArrowUpDown className="w-4 h-4 mr-1" />
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tep">Lowest Price</SelectItem>
                      <SelectItem value="savings">Biggest Savings</SelectItem>
                      <SelectItem value="delivery">Fastest Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {priceCompLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCompProducts.map((product: any) => {
                    const isExpanded = expandedProduct === product.id;
                    const bestListing = product.platforms[0];
                    const priceDiff = product.maxTep > 0 ? ((product.maxTep - product.minTep) / product.maxTep * 100).toFixed(0) : "0";

                    return (
                      <div key={product.id} className="border rounded-lg overflow-hidden" data-testid={`card-comparison-${product.id}`}>
                        <button
                          className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors text-left"
                          onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                          data-testid={`button-expand-${product.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">{product.title}</p>
                              <Badge variant="outline" className="text-xs shrink-0">{product.category}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                              <span>{product.platforms.length} platform{product.platforms.length !== 1 ? 's' : ''}</span>
                              <span>·</span>
                              <span className="font-medium text-foreground">Best: {fc(product.minTep)}</span>
                              {product.savings > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-green-600 font-medium">Save up to {fc(product.savings)} ({priceDiff}%)</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {bestListing && (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Best Value
                              </Badge>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t bg-muted/30">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead>Platform</TableHead>
                                    <TableHead>Top Seller</TableHead>
                                    <TableHead>Base Price</TableHead>
                                    <TableHead>Discount</TableHead>
                                    <TableHead>Shipping</TableHead>
                                    <TableHead>Tax</TableHead>
                                    <TableHead>Total (TEP)</TableHead>
                                    <TableHead>Delivery</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead>Rating</TableHead>
                                    <TableHead></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {product.platforms.map((listing: any, idx: number) => {
                                    const isBest = idx === 0;
                                    const platformColor =
                                      listing.platform === "Amazon" ? "border-orange-500/30 text-orange-600" :
                                      listing.platform === "eBay" ? "border-blue-500/30 text-blue-600" :
                                      listing.platform === "Argos" ? "border-red-500/30 text-red-600" :
                                      listing.platform === "Currys" ? "border-sky-500/30 text-sky-600" :
                                      listing.platform === "John Lewis" ? "border-emerald-500/30 text-emerald-600" :
                                      listing.platform === "Very" ? "border-pink-500/30 text-pink-600" :
                                      listing.platform === "AO.com" ? "border-cyan-500/30 text-cyan-600" :
                                      listing.platform === "Boots" ? "border-blue-600/30 text-blue-700" :
                                      listing.platform === "Superdrug" ? "border-fuchsia-500/30 text-fuchsia-600" :
                                      listing.platform === "OnBuy" ? "border-teal-500/30 text-teal-600" :
                                      listing.platform === "Robert Dyas" ? "border-amber-600/30 text-amber-700" :
                                      listing.platform === "Richer Sounds" ? "border-indigo-500/30 text-indigo-600" :
                                      listing.platform === "CJ Dropshipping" ? "border-amber-500/30 text-amber-600" :
                                      listing.platform === "Costco" ? "border-red-400/30 text-red-500" :
                                      listing.platform === "Home Bargains" ? "border-emerald-500/30 text-emerald-600" :
                                      listing.platform === "Temu" ? "border-violet-500/30 text-violet-600" :
                                      "border-gray-500/30 text-gray-600";

                                    return (
                                      <TableRow key={idx} className={isBest ? "bg-green-50/50 dark:bg-green-950/20" : ""} data-testid={`row-listing-${product.id}-${idx}`}>
                                        <TableCell>
                                          {isBest && (
                                            <Badge className="bg-green-600 text-white text-[10px] px-1.5">
                                              #1
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className={platformColor}>
                                            {listing.platform}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <div>
                                            {(() => {
                                              const sellerUrl = listing.productUrl || vendorWebsiteMap.get((listing.seller || '').toLowerCase());
                                              return sellerUrl ? (
                                                <a
                                                  href={sellerUrl.startsWith('http') ? sellerUrl : `https://${sellerUrl}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                                                  data-testid={`link-seller-${product.id}-${idx}`}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {listing.seller}
                                                  <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                                                </a>
                                              ) : (
                                                <p className="text-sm font-medium">{listing.seller}</p>
                                              );
                                            })()}
                                          </div>
                                        </TableCell>
                                        <TableCell>{fc(listing.basePrice)}</TableCell>
                                        <TableCell>
                                          {listing.discount > 0 ? (
                                            <span className="text-green-600">-{fc(listing.discount)}</span>
                                          ) : "—"}
                                        </TableCell>
                                        <TableCell>
                                          {listing.shippingCost > 0 ? fc(listing.shippingCost) : (
                                            <span className="text-green-600 text-xs font-medium">FREE</span>
                                          )}
                                        </TableCell>
                                        <TableCell>{listing.tax > 0 ? fc(listing.tax) : "—"}</TableCell>
                                        <TableCell>
                                          <span className={`font-bold ${isBest ? "text-green-600" : ""}`}>
                                            {fc(listing.totalEffectivePrice)}
                                          </span>
                                        </TableCell>
                                        <TableCell>
                                          <span className="text-sm">{listing.deliveryDays}d</span>
                                        </TableCell>
                                        <TableCell>
                                          {listing.availability === 'in_stock' && (
                                            <Badge variant="outline" className="text-green-600 border-green-500/30 gap-1 text-xs">
                                              <CheckCircle2 className="w-3 h-3" />
                                              In Stock
                                            </Badge>
                                          )}
                                          {listing.availability === 'low_stock' && (
                                            <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1 text-xs">
                                              <AlertTriangle className="w-3 h-3" />
                                              Low
                                            </Badge>
                                          )}
                                          {listing.availability === 'out_of_stock' && (
                                            <Badge variant="outline" className="text-red-600 border-red-500/30 gap-1 text-xs">
                                              <XCircle className="w-3 h-3" />
                                              Out
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <span className="text-sm">{listing.sellerRating.toFixed(1)}★</span>
                                        </TableCell>
                                        <TableCell>
                                          <a
                                            href={listing.productUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                                            data-testid={`link-deal-${product.id}-${idx}`}
                                          >
                                            Buy Now <ExternalLink className="w-3 h-3" />
                                          </a>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!hasPriceComparison && (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="py-16 text-center">
            <Scale className="w-16 h-16 mx-auto text-muted-foreground/30 mb-6" />
            <h3 className="text-xl font-bold mb-2">Unlock Price Comparison</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Purchase the Price Comparison add-on above to compare prices across platforms,
              find the best deals, and maximise your profit margins.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

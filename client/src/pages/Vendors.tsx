import { useVendors, useCreateVendor, useDeleteVendor } from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users, Globe, ExternalLink, Search } from "lucide-react";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { SiAmazon, SiEbay, SiEtsy } from "react-icons/si";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVendorSchema, type InsertVendor } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VENDOR_DIRECTORY, COUNTRIES, ALL_CATEGORIES, getDomain } from "@/data/vendor-directory";

const COUNTRY_FLAGS: Record<string, string> = {
  "UK": "🇬🇧", "USA": "🇺🇸", "Canada": "🇨🇦", "Australia": "🇦🇺",
  "Germany": "🇩🇪", "France": "🇫🇷", "Spain": "🇪🇸", "Italy": "🇮🇹",
  "Netherlands": "🇳🇱", "Sweden": "🇸🇪", "Poland": "🇵🇱", "Turkey": "🇹🇷",
  "India": "🇮🇳", "China": "🇨🇳", "Japan": "🇯🇵", "South Korea": "🇰🇷",
  "Brazil": "🇧🇷", "Mexico": "🇲🇽", "Nigeria": "🇳🇬", "South Africa": "🇿🇦",
  "Kenya": "🇰🇪", "Ghana": "🇬🇭", "Egypt": "🇪🇬", "UAE": "🇦🇪",
  "Saudi Arabia": "🇸🇦",
};

function VendorFavicon({ website, name }: { website: string; name: string }) {
  const domain = getDomain(website);
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Globe className="w-4 h-4 text-primary" />
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={name}
      className="h-8 w-8 rounded-full object-contain bg-white border border-border/30"
      onError={() => setImgError(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

const ITEMS_PER_PAGE = 30;

export default function Vendors() {
  const { data: vendors, isLoading } = useVendors();
  const deleteVendor = useDeleteVendor();
  const [open, setOpen] = useState(false);
  const [dirCountry, setDirCountry] = useState("All");
  const [dirCategory, setDirCategory] = useState("All");
  const [dirSearch, setDirSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const filteredDirectory = useMemo(() => {
    return VENDOR_DIRECTORY.filter(v => {
      if (dirCountry !== "All" && v.country !== dirCountry) return false;
      if (dirCategory !== "All" && v.category !== dirCategory) return false;
      const search = dirSearch.trim().toLowerCase();
      if (search && !v.name.toLowerCase().includes(search) && !v.description.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [dirCountry, dirCategory, dirSearch]);

  const visibleVendors = filteredDirectory.slice(0, visibleCount);

  const handleFilterChange = () => {
    setVisibleCount(ITEMS_PER_PAGE);
  };

  if (isLoading) return <div className="p-8">Loading vendors...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight" data-testid="text-vendors-title">Vendors</h2>
          <p className="text-muted-foreground mt-2">Manage your suppliers and discover new sources</p>
        </div>
        <div className="flex items-center gap-2">
          <PageRefreshButton />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20" data-testid="button-add-vendor">
                <Plus className="w-4 h-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              <VendorForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="my-vendors" data-testid="tabs-vendors">
        <TabsList>
          <TabsTrigger value="my-vendors" data-testid="tab-my-vendors">My Vendors ({vendors?.length || 0})</TabsTrigger>
          <TabsTrigger value="directory" data-testid="tab-vendor-directory">Vendor Directory ({VENDOR_DIRECTORY.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="my-vendors" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vendors?.map((vendor) => (
              <Card key={vendor.id} className="border-border/50">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {vendor.name.toLowerCase().includes('amazon') ? <SiAmazon className="w-5 h-5 text-orange-500" /> :
                     vendor.name.toLowerCase().includes('ebay') ? <SiEbay className="w-5 h-5 text-blue-600" /> :
                     vendor.name.toLowerCase().includes('aliexpress') ? <span className="text-xs font-bold text-red-500">Ali</span> :
                     vendor.name.toLowerCase().includes('walmart') ? <span className="text-xs font-bold text-blue-500">W</span> :
                     vendor.name.toLowerCase().includes('etsy') ? <SiEtsy className="w-5 h-5 text-orange-600" /> :
                     <Users className="w-5 h-5 text-primary" />}
                  </div>
                  <div>
                    {vendor.website ? (
                      <a
                        href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-primary hover:underline"
                        data-testid={`link-vendor-name-${vendor.id}`}
                      >
                        {vendor.name}
                      </a>
                    ) : (
                      <CardTitle className="text-base">{vendor.name}</CardTitle>
                    )}
                    <CardDescription className="text-xs">
                      {vendor.website ? (
                        <a
                          href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          data-testid={`link-vendor-website-${vendor.id}`}
                        >
                          {vendor.website}
                        </a>
                      ) : "No website"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Integration: </span>
                      <span className="font-medium capitalize">{vendor.integrationType}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteVendor.mutate(vendor.id)}
                      data-testid={`button-delete-vendor-${vendor.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {vendors?.length === 0 && (
              <div className="col-span-full text-center p-12 text-muted-foreground border-2 border-dashed rounded-xl">
                No vendors added yet. Add a supplier to source products.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="directory" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={dirSearch}
                onChange={(e) => { setDirSearch(e.target.value); handleFilterChange(); }}
                className="pl-9"
                data-testid="input-directory-search"
              />
            </div>
            <Select value={dirCountry} onValueChange={(v) => { setDirCountry(v); handleFilterChange(); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-directory-country">
                <Globe className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Countries</SelectItem>
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c] || "🌍"} {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dirCategory} onValueChange={(v) => { setDirCategory(v); handleFilterChange(); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-directory-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                {ALL_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground" data-testid="text-directory-count">
            Showing {Math.min(visibleCount, filteredDirectory.length)} of {filteredDirectory.length} vendor{filteredDirectory.length !== 1 ? 's' : ''}
          </p>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleVendors.map((vendor) => (
              <Card key={`${vendor.country}-${vendor.name}`} className="border-border/50 hover:border-primary/30 transition-colors" data-testid={`card-directory-vendor-${vendor.name.replace(/\s+/g, '-').toLowerCase()}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <VendorFavicon website={vendor.website} name={vendor.name} />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{vendor.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{COUNTRY_FLAGS[vendor.country] || "🌍"} {vendor.country}</Badge>
                        <Badge variant="outline" className="text-xs">{vendor.category}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{vendor.description}</p>
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    data-testid={`link-directory-vendor-${vendor.name.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    Visit Website <ExternalLink className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
            {filteredDirectory.length === 0 && (
              <div className="col-span-full text-center p-12 text-muted-foreground border-2 border-dashed rounded-xl">
                No vendors match your filters. Try adjusting your search or filters.
              </div>
            )}
          </div>

          {visibleCount < filteredDirectory.length && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                data-testid="button-load-more-vendors"
              >
                Load More ({filteredDirectory.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VendorForm({ onSuccess }: { onSuccess: () => void }) {
  const createVendor = useCreateVendor();
  const form = useForm<InsertVendor>({
    resolver: zodResolver(insertVendorSchema),
    defaultValues: {
      name: "",
      website: "",
      integrationType: "custom",
      config: {}
    }
  });

  const onSubmit = (data: InsertVendor) => {
    createVendor.mutate(data, { onSuccess });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor Name</FormLabel>
              <FormControl>
                <Input placeholder="Supplier Inc." {...field} data-testid="input-vendor-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} value={field.value || ""} data-testid="input-vendor-website" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={createVendor.isPending} data-testid="button-submit-vendor">
          {createVendor.isPending ? "Adding..." : "Add Vendor"}
        </Button>
      </form>
    </Form>
  );
}

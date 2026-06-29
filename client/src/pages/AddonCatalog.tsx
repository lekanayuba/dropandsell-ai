import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Sparkles, Package, Wrench, FileText, Server, Loader2, Calendar, ShoppingCart, Clock } from "lucide-react";
import { useState } from "react";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

const categoryMeta: Record<string, { icon: React.ElementType; label: string }> = {
  tools: { icon: Wrench, label: 'Tools' },
  services: { icon: Server, label: 'Services' },
  content: { icon: FileText, label: 'Content' },
  general: { icon: Package, label: 'General' },
};

export default function AddonCatalog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [api.addonCatalog.list.path],
    queryFn: async () => {
      const res = await fetch(api.addonCatalog.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return api.addonCatalog.list.responses[200].parse(await res.json());
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(api.addonCatalog.refresh.path, {
        method: api.addonCatalog.refresh.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Refresh failed");
      const result = await res.json();
      toast({
        title: "Catalog Refreshed",
        description: `${result.itemsAdded} new items, ${result.itemsUpdated} updated`,
      });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading catalog...</div>;

  const items = data?.items ?? [];
  const newItems = items.filter(i => i.isNew);
  const regularItems = items.filter(i => !i.isNew);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Add-on Catalog</h2>
          <p className="text-muted-foreground mt-2">
            Browse tools, services, and content to supercharge your store
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Catalog
        </Button>
      </div>

      {data?.lastRefreshed ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg w-fit">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            Updated: {new Date(data.lastRefreshed).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {new Date(data.lastRefreshed).toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          {data.newThisMonth > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              {data.newThisMonth} new this month
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg w-fit">
          <Calendar className="w-4 h-4" />
          Not yet updated
        </div>
      )}

      {newItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-xl font-semibold font-display">New This Month</h3>
            <Badge variant="secondary" className="ml-1">{newItems.length} items</Badge>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newItems.map((item) => (
              <AddonCard key={item.id} item={item} isNew />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-xl font-semibold font-display">All Add-ons</h3>
        </div>
        {regularItems.length === 0 && newItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No add-ons yet</h3>
              <p className="text-muted-foreground text-sm">Refresh the catalog to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {regularItems.map((item) => (
              <AddonCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddonCard({ item, isNew }: { item: any; isNew?: boolean }) {
  const CatMeta = categoryMeta[item.category] ?? categoryMeta.general;
  const Icon = CatMeta.icon;

  return (
    <Card className={`group relative overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg ${
      isNew ? 'ring-1 ring-amber-400/30 bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-950/10' : ''
    }`}>
      {isNew && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
            <Sparkles className="w-3 h-3" /> NEW
          </Badge>
        </div>
      )}
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${isNew ? 'bg-amber-500/10' : 'bg-primary/5'}`}>
            <Icon className={`w-5 h-5 ${isNew ? 'text-amber-600' : 'text-primary'}`} />
          </div>
          <Badge variant="outline" className="text-xs capitalize">{CatMeta.label}</Badge>
        </div>
        <CardTitle className="text-lg">{item.name}</CardTitle>
        <CardDescription className="text-sm line-clamp-2">{item.description}</CardDescription>
      </CardHeader>
      <CardFooter className="flex items-center justify-between">
        <span className="text-2xl font-bold font-display">£{Number(item.price).toFixed(2)}</span>
        <Button size="sm" variant="outline" className="gap-1">
          <ShoppingCart className="w-3 h-3" /> Add
        </Button>
      </CardFooter>
    </Card>
  );
}

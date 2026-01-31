import { useStores, useCreateStore, useDeleteStore } from "@/hooks/use-stores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Store, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStoreSchema, type InsertStore } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

export default function Stores() {
  const { data: stores, isLoading } = useStores();
  const deleteStore = useDeleteStore();
  const [open, setOpen] = useState(false);

  if (isLoading) return <div className="p-8">Loading stores...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Stores</h2>
          <p className="text-muted-foreground mt-2">Manage your connected marketplaces</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Connect Store
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect a New Store</DialogTitle>
            </DialogHeader>
            <StoreForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stores?.map((store) => (
          <Card key={store.id} className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="p-2 bg-primary/5 rounded-lg">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <Badge variant={store.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {store.status}
                </Badge>
              </div>
              <CardTitle className="mt-4">{store.name}</CardTitle>
              <CardDescription className="capitalize">{store.platform}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground mb-6">
                <RefreshCw className="w-3 h-3 mr-2" />
                Last sync: {store.lastSync ? new Date(store.lastSync).toLocaleDateString() : 'Never'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">Sync</Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteStore.mutate(store.id)}
                  disabled={deleteStore.isPending}
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
              Connect your Shopify, Amazon, or eBay store to start syncing products.
            </p>
            <Button onClick={() => setOpen(true)}>Connect First Store</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StoreForm({ onSuccess }: { onSuccess: () => void }) {
  const createStore = useCreateStore();
  const form = useForm<InsertStore>({
    resolver: zodResolver(insertStoreSchema),
    defaultValues: {
      name: "",
      platform: "shopify",
      credentials: {},
      status: "active"
    }
  });

  const onSubmit = (data: InsertStore) => {
    createStore.mutate(data, { onSuccess });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store Name</FormLabel>
              <FormControl>
                <Input placeholder="My Awesome Store" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="platform"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Platform</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="ebay">eBay</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Simplified credential input for demo */}
        <div className="space-y-2">
          <Label>API Key (Mock)</Label>
          <Input type="password" placeholder="Enter API Key" />
        </div>
        
        <Button type="submit" className="w-full" disabled={createStore.isPending}>
          {createStore.isPending ? "Connecting..." : "Connect Store"}
        </Button>
      </form>
    </Form>
  );
}

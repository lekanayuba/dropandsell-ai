import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Plus, Truck, Pencil, Trash2 } from "lucide-react";

const CARRIERS = [
  { value: "royal_mail", label: "Royal Mail" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl", label: "DHL" },
  { value: "ups", label: "UPS" },
  { value: "usps", label: "USPS" },
  { value: "other", label: "Other" },
];

const SERVICE_LEVELS = [
  { value: "economy", label: "Economy" },
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
  { value: "overnight", label: "Overnight" },
];

function ProfileForm({ profile, onClose }: { profile?: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: profile?.name || "",
    carrier: profile?.carrier || "other",
    serviceLevel: profile?.serviceLevel || "standard",
    baseRate: profile?.baseRate || "",
    ratePerKg: profile?.ratePerKg || "",
    freeShippingThreshold: profile?.freeShippingThreshold || "",
    estimatedDaysMin: profile?.estimatedDaysMin || 3,
    estimatedDaysMax: profile?.estimatedDaysMax || 7,
    regions: profile?.regions || "",
    isActive: profile?.isActive !== false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const url = profile ? `/api/shipping-profiles/${profile.id}` : "/api/shipping-profiles";
      const method = profile ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: profile ? "Profile updated" : "Profile created" });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-profiles"] });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Profile Name</Label>
        <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard UK Shipping" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Carrier</Label>
          <Select value={form.carrier} onValueChange={(v) => setForm(p => ({ ...p, carrier: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Service Level</Label>
          <Select value={form.serviceLevel} onValueChange={(v) => setForm(p => ({ ...p, serviceLevel: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SERVICE_LEVELS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Base Rate ($)</Label>
          <Input type="number" step="0.01" value={form.baseRate} onChange={(e) => setForm(p => ({ ...p, baseRate: e.target.value }))} />
        </div>
        <div>
          <Label>Rate per Kg ($)</Label>
          <Input type="number" step="0.01" value={form.ratePerKg} onChange={(e) => setForm(p => ({ ...p, ratePerKg: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Free Shipping Threshold ($)</Label>
          <Input type="number" step="0.01" value={form.freeShippingThreshold} onChange={(e) => setForm(p => ({ ...p, freeShippingThreshold: e.target.value }))} />
        </div>
        <div>
          <Label>Est. Min Days</Label>
          <Input type="number" value={form.estimatedDaysMin} onChange={(e) => setForm(p => ({ ...p, estimatedDaysMin: parseInt(e.target.value) || 0 }))} />
        </div>
        <div>
          <Label>Est. Max Days</Label>
          <Input type="number" value={form.estimatedDaysMax} onChange={(e) => setForm(p => ({ ...p, estimatedDaysMax: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>
      <div>
        <Label>Regions (comma-separated)</Label>
        <Input value={form.regions} onChange={(e) => setForm(p => ({ ...p, regions: e.target.value }))} placeholder="e.g. US,UK,EU,CA" />
      </div>
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
        {mutation.isPending ? "Saving..." : profile ? "Update Profile" : "Create Profile"}
      </Button>
    </div>
  );
}

export default function ShippingProfiles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<any>(null);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["/api/shipping-profiles"],
    queryFn: async () => { const r = await fetch("/api/shipping-profiles", { credentials: "include" }); return r.json(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/shipping-profiles/${id}`, { method: "DELETE", credentials: "include" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/shipping-profiles"] }); toast({ title: "Profile deleted" }); },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const carrierLabel = (v: string) => CARRIERS.find(c => c.value === v)?.label || v;
  const serviceLabel = (v: string) => SERVICE_LEVELS.find(s => s.value === v)?.label || v;

  if (isLoading) return <div className="space-y-6"><h2 className="text-2xl md:text-3xl font-bold font-display">Shipping Profiles</h2>{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Shipping Profiles</h2>
        <Dialog open={dialogOpen && !editProfile} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditProfile(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditProfile(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />New Profile</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Shipping Profile</DialogTitle></DialogHeader>
            <ProfileForm onClose={() => { setDialogOpen(false); setEditProfile(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      {(!profiles || profiles.length === 0) ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No shipping profiles yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a shipping profile to set rates and delivery estimates.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {profiles.map((p: any) => (
            <Card key={p.id} className="border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">{carrierLabel(p.carrier)} — {serviceLabel(p.serviceLevel)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditProfile(p); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Base Rate</p>
                    <p className="text-sm font-medium">${Number(p.baseRate).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Per Kg</p>
                    <p className="text-sm font-medium">${Number(p.ratePerKg || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Delivery</p>
                    <p className="text-sm font-medium">{p.estimatedDaysMin}–{p.estimatedDaysMax} days</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Regions</p>
                    <p className="text-sm font-medium">{p.regions || 'Global'}</p>
                  </div>
                </div>
                {p.freeShippingThreshold && Number(p.freeShippingThreshold) > 0 && (
                  <p className="text-xs text-green-600 mt-2">Free shipping over ${Number(p.freeShippingThreshold).toFixed(2)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editProfile && (
        <Dialog open={true} onOpenChange={(o) => { if (!o) setEditProfile(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
            <ProfileForm profile={editProfile} onClose={() => setEditProfile(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
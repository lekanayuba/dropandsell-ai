import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings2, Boxes, Percent, ShieldAlert } from "lucide-react";

type StoreRules = {
  autoRestockEnabled: boolean;
  autoRestockBuffer: number;
  defaultProfitEnabled: boolean;
  defaultProfitPercentage: number;
  autoPauseOnFailedStock: boolean;
};

const QUICK_RESTOCK = [5, 10, 15, 25, 50];
const QUICK_PROFIT = [10, 20, 30, 40, 50];

export function StoreRulesCard() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<StoreRules>({ queryKey: ["/api/user/store-rules"] });

  const [autoRestockEnabled, setAutoRestockEnabled] = useState(false);
  const [autoRestockBuffer, setAutoRestockBuffer] = useState<string>("10");
  const [defaultProfitEnabled, setDefaultProfitEnabled] = useState(false);
  const [defaultProfitPercentage, setDefaultProfitPercentage] = useState<string>("30");
  const [autoPauseOnFailedStock, setAutoPauseOnFailedStock] = useState(true);

  useEffect(() => {
    if (!data) return;
    setAutoRestockEnabled(!!data.autoRestockEnabled);
    setAutoRestockBuffer(String(data.autoRestockBuffer ?? 10));
    setDefaultProfitEnabled(!!data.defaultProfitEnabled);
    setDefaultProfitPercentage(String(data.defaultProfitPercentage ?? 30));
    setAutoPauseOnFailedStock(data.autoPauseOnFailedStock !== false);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<StoreRules>) => {
      const res = await apiRequest("PATCH", "/api/user/store-rules", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/store-rules"] });
      toast({
        title: "Store rules saved",
        description: "Your settings will sync to your eBay store on the next stock or pricing update.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not save",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveRestock = () => {
    const payload: Partial<StoreRules> = { autoRestockEnabled };
    if (autoRestockEnabled) {
      const n = Number(autoRestockBuffer);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) {
        toast({
          title: "Invalid number",
          description: "Auto-restock must be a whole number between 1 and 1000.",
          variant: "destructive",
        });
        return;
      }
      payload.autoRestockBuffer = n;
    }
    saveMutation.mutate(payload);
  };

  const saveProfit = () => {
    const payload: Partial<StoreRules> = { defaultProfitEnabled };
    if (defaultProfitEnabled) {
      const n = Number(defaultProfitPercentage);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) {
        toast({
          title: "Invalid percentage",
          description: "Profit percentage must be a whole number between 1 and 1000.",
          variant: "destructive",
        });
        return;
      }
      payload.defaultProfitPercentage = n;
    }
    saveMutation.mutate(payload);
  };

  const saveSafety = () => {
    saveMutation.mutate({ autoPauseOnFailedStock });
  };

  return (
    <Card className="border-border/50 shadow-sm" data-testid="card-store-rules">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="w-4 h-4 text-primary" />
          Store Rules
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set the defaults that apply across your eBay store. Toggle a rule on, type a value, and save —
          changes sync to eBay on the next sync (within minutes).
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading rules…
          </div>
        ) : (
          <Tabs defaultValue="restock" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="restock" data-testid="tab-restock">
                <Boxes className="w-4 h-4 mr-2" />
                Auto-Restock
              </TabsTrigger>
              <TabsTrigger value="profit" data-testid="tab-profit">
                <Percent className="w-4 h-4 mr-2" />
                Profit %
              </TabsTrigger>
              <TabsTrigger value="safety" data-testid="tab-safety">
                <ShieldAlert className="w-4 h-4 mr-2" />
                Safety
              </TabsTrigger>
            </TabsList>

            {/* === AUTO-RESTOCK === */}
            <TabsContent value="restock" className="mt-4 space-y-4">
              <div className="flex items-start justify-between rounded-md border border-border/50 p-4">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="toggle-restock" className="text-sm font-medium">
                    Default auto-restock quantity
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When a listing sells out, refill it to this number on eBay so it stays visible to buyers.
                    Leave off to use our safe default of 10.
                  </p>
                </div>
                <Switch
                  id="toggle-restock"
                  checked={autoRestockEnabled}
                  onCheckedChange={setAutoRestockEnabled}
                  data-testid="switch-restock"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="input-restock-buffer" className="text-sm">
                  Restock to
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="input-restock-buffer"
                    type="number"
                    min={1}
                    max={1000}
                    value={autoRestockBuffer}
                    onChange={(e) => setAutoRestockBuffer(e.target.value)}
                    disabled={!autoRestockEnabled}
                    className="max-w-[140px]"
                    data-testid="input-restock-buffer"
                  />
                  <span className="text-sm text-muted-foreground">units</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_RESTOCK.map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={String(n) === autoRestockBuffer ? "default" : "outline"}
                      size="sm"
                      disabled={!autoRestockEnabled}
                      onClick={() => setAutoRestockBuffer(String(n))}
                      data-testid={`button-restock-quick-${n}`}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveRestock}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-restock"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save & Sync to eBay
                </Button>
              </div>
            </TabsContent>

            {/* === DEFAULT PROFIT % === */}
            <TabsContent value="profit" className="mt-4 space-y-4">
              <div className="flex items-start justify-between rounded-md border border-border/50 p-4">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="toggle-profit" className="text-sm font-medium">
                    Default profit percentage
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Applied as a markup on every new listing where you haven't set a vendor-specific
                    pricing rule. Leave off if you only want to use vendor rules.
                  </p>
                </div>
                <Switch
                  id="toggle-profit"
                  checked={defaultProfitEnabled}
                  onCheckedChange={setDefaultProfitEnabled}
                  data-testid="switch-profit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="input-profit-pct" className="text-sm">
                  Markup
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="input-profit-pct"
                    type="number"
                    min={1}
                    max={1000}
                    value={defaultProfitPercentage}
                    onChange={(e) => setDefaultProfitPercentage(e.target.value)}
                    disabled={!defaultProfitEnabled}
                    className="max-w-[140px]"
                    data-testid="input-profit-pct"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_PROFIT.map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={String(n) === defaultProfitPercentage ? "default" : "outline"}
                      size="sm"
                      disabled={!defaultProfitEnabled}
                      onClick={() => setDefaultProfitPercentage(String(n))}
                      data-testid={`button-profit-quick-${n}`}
                    >
                      {n}%
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveProfit}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-profit"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save & Apply
                </Button>
              </div>
            </TabsContent>

            {/* === SAFETY (auto-pause when vendor stock checks fail) === */}
            <TabsContent value="safety" className="mt-4 space-y-4">
              <div className="flex items-start justify-between rounded-md border border-border/50 p-4">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="autoPauseOnFailedStock" className="text-sm font-medium">
                    Auto-pause listings when stock checks fail
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If we can't confirm a product is in stock at your supplier after 3 attempts in a row,
                    we'll automatically end your eBay listings for that product so you don't get an order
                    you can't fulfil. You'll get an email and can re-list once the supplier shows it back
                    in stock. <span className="font-medium text-foreground">Recommended: ON.</span>
                  </p>
                </div>
                <Switch
                  id="autoPauseOnFailedStock"
                  checked={autoPauseOnFailedStock}
                  onCheckedChange={setAutoPauseOnFailedStock}
                  data-testid="switch-auto-pause-failed-stock"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveSafety}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-safety"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save & Apply
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

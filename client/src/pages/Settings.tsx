import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Copy, RefreshCw, Download, Chrome, Puzzle, Eye, EyeOff, Package, ShoppingCart, Tag, Link, LogOut, Globe, ExternalLink, ChevronDown, MousePointerClick } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { buildUserUniqueUrl } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export default function Settings() {
  const { toast } = useToast();
  const { logout, isLoggingOut } = useAuth();
  const { code: currentCurrency } = useCurrency();
  const [showApiKey, setShowApiKey] = useState(false);

  const updateCurrencyMutation = useMutation({
    mutationFn: async (currency: string) => {
      return apiRequest("PATCH", "/api/user/currency", { currency });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Currency updated", description: "Your display currency has been changed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update currency", variant: "destructive" });
    }
  });

  const { data: apiKeyData, isLoading } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/user/api-key"],
  });

  const { data: uniqueUrlData, isLoading: isLoadingUrl } = useQuery<{ uniqueUrl: string }>({
    queryKey: ["/api/user/unique-url"],
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user/api-key/regenerate");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user/api-key"], data);
      toast({
        title: "API Key Regenerated",
        description: "Your new API key has been generated. Update it in your browser extension.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate API key",
        variant: "destructive",
      });
    },
  });

  const getFullUniqueUrl = () => {
    return buildUserUniqueUrl(uniqueUrlData?.uniqueUrl || "");
  };

  const copyUniqueUrl = () => {
    const fullUrl = getFullUniqueUrl();
    if (fullUrl) {
      navigator.clipboard.writeText(fullUrl);
      toast({
        title: "Copied!",
        description: "Unique URL copied to clipboard",
      });
    }
  };

  const copyUniqueUrlCode = () => {
    if (uniqueUrlData?.uniqueUrl) {
      navigator.clipboard.writeText(uniqueUrlData.uniqueUrl);
      toast({
        title: "Copied!",
        description: "Unique URL code copied to clipboard",
      });
    }
  };

  const copyApiKey = () => {
    if (apiKeyData?.apiKey) {
      navigator.clipboard.writeText(apiKeyData.apiKey);
      toast({
        title: "Copied!",
        description: "API key copied to clipboard",
      });
    }
  };

  const downloadExtension = () => {
    window.open("/api/extension/download", "_blank");
  };

  const openChromeWebStore = () => {
    window.open("https://chromewebstore.google.com/detail/cmhenhnoglkmfimnoidoaofnhkjnhdnk", "_blank");
  };

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6" data-testid="page-settings">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">Manage your account settings and browser extension</p>
        </div>
        <PageRefreshButton />
      </div>

      <Card data-testid="card-extension">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            <CardTitle data-testid="text-extension-title">Browser Extension — Connect in One Click</CardTitle>
          </div>
          <CardDescription data-testid="text-extension-description">
            Install once from the Chrome Web Store, click "Sign in with DropandSell", and you're done. No URL, no code, no API key needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-2" data-testid="section-step-install">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                Install from the Chrome Web Store
              </h3>
              <p className="text-sm text-muted-foreground">
                Click the button below to open the official DropandSell extension page, then click <strong>"Add to Chrome"</strong>. Chrome installs and updates the extension for you automatically.
              </p>
              <Button onClick={openChromeWebStore} className="w-full mt-2" data-testid="button-open-chrome-web-store">
                <Chrome className="mr-2 h-4 w-4" />
                Open Chrome Web Store
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-2" data-testid="section-step-signin">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                Click "Sign in with DropandSell"
              </h3>
              <p className="text-sm text-muted-foreground">
                Pin the DropandSell icon in your browser toolbar, click it, and tap the big <strong>"Sign in with DropandSell"</strong> button. A new tab opens, the extension links to your account, and you're ready to import products.
              </p>
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                <MousePointerClick className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">That's it. No copy-paste, no codes, no keys.</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <Chrome className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Works in <strong>Google Chrome</strong> and Chromium-based browsers (Edge, Brave, Opera). Make sure you're <strong>signed in to your DropandSell dashboard in the same browser</strong> before clicking sign in.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-unique-url">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            <CardTitle data-testid="text-unique-url-title">Your Personal Dashboard URL</CardTitle>
          </div>
          <CardDescription data-testid="text-unique-url-description">
            Your unique link for signing in to your DropandSell dashboard. Bookmark it so you can return easily.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Unique URL</Label>
            <div className="flex gap-2">
              <Input
                value={isLoadingUrl ? "Loading..." : getFullUniqueUrl()}
                readOnly
                className="font-mono text-sm"
                data-testid="input-unique-url"
              />
              <Button variant="outline" onClick={copyUniqueUrl} data-testid="button-copy-unique-url">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-advanced">
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <button className="w-full" data-testid="button-toggle-advanced">
              <CardHeader className="cursor-pointer hover-elevate">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <CardTitle data-testid="text-advanced-title" className="text-base">Advanced — Manual Setup</CardTitle>
                    <CardDescription data-testid="text-advanced-description">
                      Most users don't need this. Only open if you want to connect the extension manually with your URL code and API key, or download the dev-mode ZIP.
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform shrink-0 ml-3 ${showAdvanced ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 border-t pt-6">
              <div className="space-y-2">
                <Label>Your Unique URL Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={isLoadingUrl ? "Loading..." : (uniqueUrlData?.uniqueUrl || "")}
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-unique-url-code"
                  />
                  <Button variant="outline" onClick={copyUniqueUrlCode} data-testid="button-copy-unique-url-code">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Paste this into the extension's manual setup form.</p>
              </div>

              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={isLoading ? "Loading..." : apiKeyData?.apiKey || ""}
                      readOnly
                      className="pr-10 font-mono"
                      data-testid="input-api-key"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowApiKey(!showApiKey)}
                      data-testid="button-toggle-api-key"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="outline" onClick={copyApiKey} data-testid="button-copy-api-key">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    data-testid="button-regenerate-api-key"
                  >
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate Key
                  </Button>
                  <p className="text-xs text-muted-foreground" data-testid="text-regenerate-warning">
                    Warning: This will disconnect all current extension sessions
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download the Extension as a ZIP (Developer Mode)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Only use this if you can't install from the Chrome Web Store. After downloading, unzip it, open <code className="bg-muted px-1 rounded">chrome://extensions</code>, enable Developer mode, click "Load unpacked", and select the unzipped folder.
                </p>
                <Button onClick={downloadExtension} variant="outline" size="sm" data-testid="button-download-extension">
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download Extension ZIP
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card data-testid="card-supported-websites">
        <CardHeader>
          <CardTitle data-testid="text-websites-title">Supported Websites</CardTitle>
          <CardDescription data-testid="text-websites-description">
            The extension can import products from these marketplaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border" data-testid="vendor-amazon">
              <Package className="h-6 w-6 text-orange-500" />
              <div>
                <div className="font-medium" data-testid="text-amazon-name">Amazon</div>
                <div className="text-xs text-muted-foreground" data-testid="text-amazon-domains">.com, .co.uk, .de, .fr</div>
              </div>
              <Badge variant="outline" className="ml-auto bg-green-500/10 text-green-600 border-green-200" data-testid="badge-amazon-status">Active</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border" data-testid="vendor-aliexpress">
              <ShoppingCart className="h-6 w-6 text-red-500" />
              <div>
                <div className="font-medium" data-testid="text-aliexpress-name">AliExpress</div>
                <div className="text-xs text-muted-foreground" data-testid="text-aliexpress-domains">aliexpress.com</div>
              </div>
              <Badge variant="outline" className="ml-auto bg-green-500/10 text-green-600 border-green-200" data-testid="badge-aliexpress-status">Active</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border" data-testid="vendor-ebay">
              <Tag className="h-6 w-6 text-blue-500" />
              <div>
                <div className="font-medium" data-testid="text-ebay-name">eBay</div>
                <div className="text-xs text-muted-foreground" data-testid="text-ebay-domains">.com, .co.uk</div>
              </div>
              <Badge variant="outline" className="ml-auto bg-green-500/10 text-green-600 border-green-200" data-testid="badge-ebay-status">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-currency">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle data-testid="text-currency-title">Display Currency</CardTitle>
          </div>
          <CardDescription data-testid="text-currency-description">
            Choose the currency used to display prices, balances, and earnings across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select
              value={currentCurrency}
              onValueChange={(value) => updateCurrencyMutation.mutate(value)}
              disabled={updateCurrencyMutation.isPending}
            >
              <SelectTrigger data-testid="select-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} data-testid={`currency-setting-${c.code}`}>
                    {c.flag} {c.code} — {c.symbol} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-sign-out" className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-destructive" />
            <CardTitle data-testid="text-sign-out-title">Sign Out</CardTitle>
          </div>
          <CardDescription data-testid="text-sign-out-description">
            Sign out of your DropandSell Automation App account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-sign-out"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? "Signing out..." : "Sign Out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

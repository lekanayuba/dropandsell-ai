import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Store, 
  Package, 
  Upload, 
  DollarSign, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  Zap,
  Settings,
  BarChart3,
  Chrome,
  ShieldCheck,
  Globe
} from "lucide-react";
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from "@/lib/currency";

function CurrencySelector({ selected, onSelect }: { selected: string; onSelect: (code: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">Choose Your Currency</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Select the currency you want to use across the platform. All prices, wallet balances, and analytics will display in your chosen currency.
        </p>
      </div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-h-[400px] overflow-y-auto p-1">
        {SUPPORTED_CURRENCIES.map((c) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            data-testid={`currency-option-${c.code}`}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
              selected === c.code
                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <span className="text-xl">{c.flag}</span>
            <div className="min-w-0">
              <div className="font-medium text-sm">{c.code}</div>
              <div className="text-xs text-muted-foreground truncate">{c.symbol} {c.name}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState("GBP");
  const [, setLocation] = useLocation();
  
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/complete-onboarding", { currency: selectedCurrency });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    }
  });

  const sym = getCurrencySymbol(selectedCurrency);

  const steps = [
    {
      id: 1,
      title: "Welcome to DropandSell Automation App",
      description: "Your all-in-one dropshipping automation platform",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Let's get you started!</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              DropandSell Automation App helps you automate your dropshipping business across multiple marketplaces. 
              This quick guide will show you how to make the most of the platform.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-8">
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <Store className="h-10 w-10 text-primary mb-4" />
                <h4 className="font-semibold mb-2">Multi-Marketplace</h4>
                <p className="text-sm text-muted-foreground">Connect Shopify, eBay, Amazon and more</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <Zap className="h-10 w-10 text-primary mb-4" />
                <h4 className="font-semibold mb-2">Automated Pricing</h4>
                <p className="text-sm text-muted-foreground">Set rules to automatically price your products</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <BarChart3 className="h-10 w-10 text-primary mb-4" />
                <h4 className="font-semibold mb-2">Analytics</h4>
                <p className="text-sm text-muted-foreground">Track performance across all channels</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "Select Your Currency",
      description: "Choose your preferred display currency",
      content: (
        <CurrencySelector selected={selectedCurrency} onSelect={setSelectedCurrency} />
      )
    },
    {
      id: 3,
      title: "Step 1: Connect Your Stores",
      description: "Link your marketplace accounts",
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Connect Your Marketplace Stores</h3>
              <p className="text-muted-foreground mb-4">
                Start by connecting your existing marketplace accounts. DropandSell Automation App supports:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">Shopify</Badge>
                <Badge variant="secondary">eBay</Badge>
                <Badge variant="secondary">Amazon</Badge>
              </div>
            </div>
          </div>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">How to connect a store:</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">1</span>
                  <span>Go to the <strong>Stores</strong> page from the sidebar</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">2</span>
                  <span>Click <strong>Connect Store</strong> and select your marketplace</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                  <span>For <strong>eBay</strong>: Enter your eBay username, the email address linked to your eBay account, a store name, and select your eBay site. Then click "Connect to eBay" — you'll be redirected to eBay to authorise securely. No API keys needed!</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">4</span>
                  <span>For <strong>Shopify/Amazon</strong>: Enter your platform API credentials from your seller settings</span>
                </li>
              </ol>
            </CardContent>
          </Card>
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Multi-Store Support:</strong> Connect multiple marketplace stores depending on your plan (up to 15 on Enterprise). For example, connect different eBay accounts (e.g. "My eBay UK" and "My eBay US") to sell across multiple marketplaces from one dashboard!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Step 2: Add Your Vendors",
      description: "Set up your suppliers",
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Add Your Vendors (Suppliers)</h3>
              <p className="text-muted-foreground mb-4">
                Vendors are your product suppliers. Add them to track where your products come from 
                and apply vendor-specific pricing rules.
              </p>
            </div>
          </div>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">Adding a vendor:</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">1</span>
                  <span>Navigate to the <strong>Vendors</strong> page</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">2</span>
                  <span>Click <strong>Add Vendor</strong> and enter their details</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                  <span>Choose integration type: API, CSV feed, or manual</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )
    },
    {
      id: 5,
      title: "Step 3: Import Products",
      description: "Bring in your product catalog",
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Import Your Products</h3>
              <p className="text-muted-foreground mb-4">
                There are three ways to import products into your inventory:
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <Chrome className="h-8 w-8 text-primary mb-3" />
                <h4 className="font-semibold mb-2">Browser Extension</h4>
                <p className="text-sm text-muted-foreground">Import products directly from Amazon, AliExpress, eBay, Walmart, and Etsy with one click while browsing</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <Upload className="h-8 w-8 text-primary mb-3" />
                <h4 className="font-semibold mb-2">CSV Upload</h4>
                <p className="text-sm text-muted-foreground">Upload vendor product catalogs via CSV with automatic field mapping</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <Package className="h-8 w-8 text-primary mb-3" />
                <h4 className="font-semibold mb-2">Manual Entry</h4>
                <p className="text-sm text-muted-foreground">Add products manually with AI-powered description generation</p>
              </CardContent>
            </Card>
          </div>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">Installing the Browser Extension (one-click):</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">1</span>
                  <span>Open the official DropandSell listing on the <strong>Chrome Web Store</strong> and click <strong>"Add to Chrome"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">2</span>
                  <span>Click the DropandSell icon in your browser toolbar and tap <strong>"Sign in with DropandSell"</strong> — no API key, no URL code</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                  <span>Browse any supported vendor site and click the extension icon to import a product in one click</span>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground mt-4">
                Can't use the Chrome Web Store? You can also install manually from <strong>Settings → Advanced — Manual Setup</strong>.
              </p>
            </CardContent>
          </Card>
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> The Browser Extension auto-detects vendors and generates AI descriptions, making it the fastest way to build your inventory!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 6,
      title: "Step 4: Set Pricing Rules",
      description: "Automate your pricing strategy",
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Configure Pricing Rules</h3>
              <p className="text-muted-foreground mb-4">
                Set up automatic pricing rules to calculate selling prices from cost prices.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Markup %</h4>
                <p className="text-sm text-muted-foreground">Add a percentage on top of cost price</p>
                <p className="text-xs text-muted-foreground mt-2">e.g., 30% markup: {sym}10 → {sym}13</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Margin %</h4>
                <p className="text-sm text-muted-foreground">Set your profit margin percentage</p>
                <p className="text-xs text-muted-foreground mt-2">e.g., 25% margin: {sym}10 → {sym}13.33</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Fixed Amount</h4>
                <p className="text-sm text-muted-foreground">Add a fixed amount to cost</p>
                <p className="text-xs text-muted-foreground mt-2">e.g., +{sym}5: {sym}10 → {sym}15</p>
              </CardContent>
            </Card>
          </div>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">Setting up rules:</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">1</span>
                  <span>Go to <strong>Manual</strong> → <strong>Pricing</strong> tab</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">2</span>
                  <span>Create rules with priorities (higher priority = applies first)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                  <span>Optionally set min/max price constraints</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )
    },
    {
      id: 7,
      title: "Step 5: Publish to Stores",
      description: "List products on marketplaces",
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Publish Products to Your Stores</h3>
              <p className="text-muted-foreground mb-4">
                Use the publish queue to stage and batch-publish products to your connected marketplaces.
              </p>
            </div>
          </div>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">Publishing workflow:</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">1</span>
                  <span>Go to <strong>Inventory</strong> and select products to publish</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">2</span>
                  <span>Click <strong>Publish to Store</strong> and choose a specific store or select <strong>"All Stores"</strong> to publish to every connected store at once</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                  <span>Products go to the publish queue with pricing rules applied</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">4</span>
                  <span>Review in <strong>Manual</strong> → <strong>Publish</strong> and confirm</span>
                </li>
              </ol>
            </CardContent>
          </Card>
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> With multiple stores connected, use "All Stores" to list the same products across all your accounts simultaneously — maximising your reach!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 8,
      title: "Step 6: Safety & Compliance",
      description: "Protect your listings from violations",
      content: (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">VERO & Content Filters</h3>
              <p className="text-muted-foreground mb-4">
                DropandSell Automation App automatically checks your products before publishing to prevent marketplace policy violations.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">VERO List</h4>
                <p className="text-sm text-muted-foreground">Add restricted brands, keywords, and SKU patterns to prevent listing trademarked or prohibited products. Manage in Manual → VERO tab.</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Content Filters</h4>
                <p className="text-sm text-muted-foreground">Automatically detect and block personal information (emails, phone numbers, URLs) in product listings. Configure in Manual → Filters tab.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 9,
      title: "You're Ready!",
      description: "Start automating your dropshipping business",
      content: (
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-4">You're All Set!</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              You now know the basics of DropandSell Automation App. Start by connecting your first store 
              and importing your product catalog.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 max-w-lg mx-auto">
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="pt-6 text-left">
                <Store className="h-8 w-8 text-primary mb-3" />
                <h4 className="font-semibold">Connect a Store</h4>
                <p className="text-sm text-muted-foreground">Link your marketplace</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="pt-6 text-left">
                <Upload className="h-8 w-8 text-primary mb-3" />
                <h4 className="font-semibold">Import Products</h4>
                <p className="text-sm text-muted-foreground">Upload your catalog</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold font-display">Getting Started</h1>
            <Badge variant="outline">{currentStep + 1} of {steps.length}</Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{step.title}</CardTitle>
            <CardDescription>{step.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step.content}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
            data-testid="button-onboarding-prev"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {isLastStep ? (
            <Button
              onClick={() => completeOnboarding.mutate()}
              disabled={completeOnboarding.isPending}
              data-testid="button-onboarding-complete"
            >
              {completeOnboarding.isPending ? "Completing..." : "Go to Dashboard"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              data-testid="button-onboarding-next"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {!isLastStep && (
          <div className="text-center mt-6">
            <Button
              variant="ghost"
              onClick={() => completeOnboarding.mutate()}
              disabled={completeOnboarding.isPending}
              data-testid="button-skip-onboarding"
            >
              Skip for now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

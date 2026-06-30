import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { USER_QUERY_KEY } from "@/hooks/use-auth";
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
  BarChart3
} from "lucide-react";

const steps = [
  {
    id: 1,
    title: "Welcome to DropandSell AI",
    description: "Your all-in-one dropshipping automation platform",
    content: (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-4">Let's get you started!</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            DropandSell AI helps you automate your dropshipping business across multiple marketplaces. 
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
              Start by connecting your existing marketplace accounts. DropandSell AI supports:
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary">Shopify</Badge>
              <Badge variant="secondary">eBay</Badge>
              <Badge variant="secondary">Amazon</Badge>
              <Badge variant="secondary">WooCommerce</Badge>
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
                <span>Click <strong>Connect Store</strong>, select your marketplace, and name your store</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                <span>Authorize via the platform's official login page (OAuth) — no API keys needed</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">4</span>
                <span>DropandSell AI will verify and sync your store data automatically</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: 3,
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
    id: 4,
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
              Use our CSV import tool to quickly bring in product catalogs from your vendors.
            </p>
          </div>
        </div>
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-3">CSV Import process:</h4>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">1</span>
                <span>Go to <strong>Automation</strong> → <strong>Import</strong> tab</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">2</span>
                <span>Select your vendor and upload the CSV file</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                <span>Map CSV columns to product fields (title, SKU, price, etc.)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">4</span>
                <span>Preview and confirm the import</span>
              </li>
            </ol>
          </CardContent>
        </Card>
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Tip:</strong> You can also manually add products from the Inventory page.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 5,
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
              <p className="text-xs text-muted-foreground mt-2">e.g., 30% markup: £10 → £13</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">Margin %</h4>
              <p className="text-sm text-muted-foreground">Set your profit margin percentage</p>
              <p className="text-xs text-muted-foreground mt-2">e.g., 25% margin: £10 → £13.33</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">Fixed Amount</h4>
              <p className="text-sm text-muted-foreground">Add a fixed amount to cost</p>
              <p className="text-xs text-muted-foreground mt-2">e.g., +£5: £10 → £15</p>
            </CardContent>
          </Card>
        </div>
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-3">Setting up rules:</h4>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">1</span>
                <span>Go to <strong>Automation</strong> → <strong>Pricing</strong> tab</span>
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
    id: 6,
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
                <span>Click <strong>Publish to Store</strong> and choose your target store</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">3</span>
                <span>Products go to the publish queue with pricing rules applied</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">4</span>
                <span>Review in <strong>Automation</strong> → <strong>Publish</strong> and confirm</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: 7,
    title: "You're Ready!",
    description: "Start automating your dropshipping business"
  }
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [, setLocation] = useLocation();
  
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/complete-onboarding");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
      setLocation("/");
    }
  });

  const handleComplete = () => {
    completeOnboarding.mutate();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleCardClick = (path: string) => {
    completeOnboarding.mutate(undefined, {
      onSuccess: () => setLocation(path),
    });
  };

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
            <CardDescription>{isLastStep ? "" : step.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLastStep ? <FinalStepContent onCardClick={handleCardClick} /> : step.content}
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
              onClick={handleComplete}
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
              onClick={handleComplete}
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

const FinalStepContent = ({ onCardClick }: { onCardClick: (path: string) => void }) => (
  <div className="space-y-6 text-center">
    <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto">
      <CheckCircle2 className="h-10 w-10 text-green-600" />
    </div>
    <div>
      <h3 className="text-2xl font-bold mb-4">You're All Set!</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        You now know the basics of DropandSell AI. Start by connecting your first store 
        and importing your product catalog.
      </p>
    </div>
    <div className="grid gap-4 md:grid-cols-2 max-w-lg mx-auto">
      <Card className="hover-elevate cursor-pointer" onClick={() => onCardClick('/stores')}>
        <CardContent className="pt-6 text-left">
          <Store className="h-8 w-8 text-primary mb-3" />
          <h4 className="font-semibold">Connect a Store</h4>
          <p className="text-sm text-muted-foreground">Link your marketplace</p>
        </CardContent>
      </Card>
      <Card className="hover-elevate cursor-pointer" onClick={() => onCardClick('/automation?tab=import')}>
        <CardContent className="pt-6 text-left">
          <Upload className="h-8 w-8 text-primary mb-3" />
          <h4 className="font-semibold">Import Products</h4>
          <p className="text-sm text-muted-foreground">Upload your catalog</p>
        </CardContent>
      </Card>
    </div>
  </div>
);

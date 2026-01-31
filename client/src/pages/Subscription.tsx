import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, Rocket, Building2, Building, Castle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Plan = {
  id: string;
  name: string;
  description: string;
  priceId: string | null;
  amount: number;
  currency: string;
  listingsLimit: number;
  interval: string;
};

type CurrentSubscription = {
  id: number;
  planName: string;
  status: string;
  currentPeriodEnd: string;
} | null;

const planIcons = [Zap, Rocket, Crown, Building2, Building, Castle];
const planColors = [
  "from-blue-500 to-blue-600",
  "from-green-500 to-green-600", 
  "from-purple-500 to-purple-600",
  "from-orange-500 to-orange-600",
  "from-pink-500 to-pink-600",
  "from-indigo-500 to-indigo-600",
];

export default function Subscription() {
  const { toast } = useToast();

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/subscription/plans"],
  });

  const { data: currentSubscription, isLoading: subLoading } = useQuery<CurrentSubscription>({
    queryKey: ["/api/subscription/current"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { priceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscription/portal", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  const isLoading = plansLoading || subLoading;

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold font-display tracking-tight">Choose Your Plan</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Scale your dropshipping business with the right plan. All plans include multi-marketplace integration, 
          VERO compliance detection, and automated order fulfillment.
        </p>
      </div>

      {currentSubscription && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Badge variant="default" className="bg-primary">Active</Badge>
              <div>
                <p className="font-medium">Current Plan: {currentSubscription.planName}</p>
                <p className="text-sm text-muted-foreground">
                  Renews on {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              data-testid="button-manage-subscription"
            >
              {portalMutation.isPending ? "Loading..." : "Manage Subscription"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan, index) => {
          const Icon = planIcons[index] || Zap;
          const gradientColor = planColors[index] || planColors[0];
          const isCurrentPlan = currentSubscription?.planName === plan.name;
          const isPopular = index === 2;

          return (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                isPopular ? "border-primary shadow-lg shadow-primary/20" : "border-border/50"
              } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
              data-testid={`card-plan-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary shadow-lg">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className={`w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-6">
                <div className="text-center">
                  <span className="text-4xl font-bold">£{plan.amount}</span>
                  <span className="text-muted-foreground">/{plan.interval}</span>
                </div>

                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">
                      <strong>{plan.listingsLimit.toLocaleString()}</strong> product listings
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Multi-marketplace sync</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">VERO compliance detection</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Automated order fulfillment</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Wallet & auto-payment</span>
                  </li>
                  {index >= 3 && (
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">Priority support</span>
                    </li>
                  )}
                  {index >= 4 && (
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">Advanced analytics</span>
                    </li>
                  )}
                  {index === 5 && (
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">Dedicated account manager</span>
                    </li>
                  )}
                </ul>
              </CardContent>

              <CardFooter>
                <Button 
                  className={`w-full ${isPopular ? "shadow-lg shadow-primary/30" : ""}`}
                  variant={isCurrentPlan ? "outline" : isPopular ? "default" : "secondary"}
                  disabled={isCurrentPlan || !plan.priceId || checkoutMutation.isPending}
                  onClick={() => plan.priceId && checkoutMutation.mutate(plan.priceId)}
                  data-testid={`button-subscribe-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {isCurrentPlan 
                    ? "Current Plan" 
                    : checkoutMutation.isPending 
                      ? "Loading..." 
                      : "Get Started"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-sm text-muted-foreground space-y-2 pt-8">
        <p>All prices are in GBP and billed monthly. Cancel anytime.</p>
        <p>Need a custom plan? <a href="mailto:support@dropflow.io" className="text-primary hover:underline">Contact us</a></p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { USER_QUERY_KEY } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { Loader2, Check, CreditCard, Shield, Clock, ArrowRight, Zap } from "lucide-react";

type Plan = {
  priceId: string;
  name: string;
  listingsLimit: number;
  amount: number;
  features: string[];
};

export default function PaymentSetup() {
  const [, navigate] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [directDebitAgreed, setDirectDebitAgreed] = useState(false);

  const { data: subscriptionPlans, isLoading: loadingProducts } = useQuery<Plan[]>({
    queryKey: ['/api/stripe/products'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('POST', '/api/stripe/create-checkout-session', { 
        planId,
        successUrl: window.location.origin + '/payment-success',
        cancelUrl: window.location.origin + '/payment-setup',
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const skipPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/user/skip-payment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
      navigate('/');
    },
  });

  const handleProceed = () => {
    if (selectedPlan && directDebitAgreed) {
      checkoutMutation.mutate(selectedPlan);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4">Step 4 of 5</Badge>
          <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Select a subscription plan to unlock all features. You can change or cancel anytime.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {loadingProducts && [...Array(6)].map((_, i) => <Card key={i} className="h-80 animate-pulse bg-muted" />)}
          {subscriptionPlans?.map((plan) => (
            <Card 
              key={plan.priceId}
              className={`relative cursor-pointer transition-all ${
                selectedPlan === plan.priceId 
                  ? 'ring-2 ring-primary border-primary' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedPlan(plan.priceId)}
              data-testid={`plan-${plan.name.toLowerCase().replace(' ', '-')}`}
            >
              {plan.name === 'Growth Plan' && ( // Example of marking a plan as popular
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Most Popular</Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {selectedPlan === plan.priceId && <Check className="h-5 w-5 text-primary" />}
                </CardTitle>
                <CardDescription>
                  Up to {plan.listingsLimit.toLocaleString()} listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="text-3xl font-bold">£{plan.amount}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Direct Debit Authorization
            </CardTitle>
            <CardDescription>
              Set up automatic payments for uninterrupted service
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Secure Payment Processing</p>
                  <p className="text-sm text-muted-foreground">
                    Your payment information is encrypted and securely processed by Stripe.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Monthly Billing</p>
                  <p className="text-sm text-muted-foreground">
                    You'll be charged monthly on the same date you subscribe. Cancel anytime.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Direct Debit Guarantee</p>
                  <p className="text-sm text-muted-foreground">
                    You're protected by the Direct Debit Guarantee. You can cancel at any time 
                    and are entitled to a full refund if there's an error in your payment.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox 
                id="direct-debit-agree" 
                checked={directDebitAgreed}
                onCheckedChange={(checked) => setDirectDebitAgreed(checked as boolean)}
                data-testid="checkbox-direct-debit"
              />
              <Label htmlFor="direct-debit-agree" className="text-sm leading-relaxed cursor-pointer">
                I authorize DropandSell AI to set up a recurring payment using my payment method. 
                I understand that I will be charged monthly and can cancel at any time. 
                I have read and agree to the{" "}
                <a href="/policies" target="_blank" className="text-primary underline">Direct Debit terms</a>.
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleProceed}
              disabled={!selectedPlan || !directDebitAgreed || checkoutMutation.isPending || loadingProducts}
              className="w-full sm:w-auto"
              data-testid="button-proceed-payment"
            >
              {checkoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Continue to Payment
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => skipPaymentMutation.mutate()}
              disabled={skipPaymentMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-skip-payment"
            >
              {skipPaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Start Free Trial
            </Button>
          </CardFooter>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Need help? <a href="/faq" className="text-primary underline">View our FAQ</a> or contact support.</p>
        </div>
      </div>
    </div>
  );
}

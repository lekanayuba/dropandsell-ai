import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Check, CreditCard, Shield, Clock, ArrowRight, Zap } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const YEARLY_DISCOUNT = 0.10;
function getYearlyPrice(monthlyPrice: number): number {
  return Math.round(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100;
}

const SUBSCRIPTION_PLANS = [
  { id: 'starter', name: 'Starter Plan', listings: 500, priceGbp: 12, storeLimit: 2, features: ['500 active listings', 'Up to 2 stores', 'Basic analytics', 'Email support'] },
  { id: 'basic', name: 'Basic Plan', listings: 750, priceGbp: 20, storeLimit: 4, features: ['750 active listings', 'Up to 4 stores', 'Advanced analytics', 'Priority support'], popular: true },
  { id: 'growth', name: 'Growth Plan', listings: 1200, priceGbp: 35, storeLimit: 6, features: ['1,200 active listings', 'Up to 6 stores', 'Full analytics', 'Phone support'] },
  { id: 'professional', name: 'Professional Plan', listings: 2000, priceGbp: 50, storeLimit: 8, features: ['2,000 active listings', 'Up to 8 stores', 'API access', 'Dedicated support'] },
  { id: 'business', name: 'Business Plan', listings: 4000, priceGbp: 75, storeLimit: 12, features: ['4,000 active listings', 'Up to 12 stores', 'Team accounts', 'Custom integrations'] },
  { id: 'enterprise', name: 'Enterprise Plan', listings: 8000, priceGbp: 100, storeLimit: 15, features: ['8,000 active listings', 'Up to 15 stores', 'Unlimited teams', 'SLA guarantee'] },
];

export default function PaymentSetup() {
  const { symbol: currSym, format: fc } = useCurrency();
  const [, navigate] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [directDebitAgreed, setDirectDebitAgreed] = useState(false);
  const isYearly = billingInterval === 'year';

  const { data: stripeProducts, isLoading: loadingProducts } = useQuery<any[]>({
    queryKey: ['/api/stripe/products'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('POST', '/api/stripe/create-checkout-session', { 
        planId,
        billingInterval,
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
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
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
            Choose a plan to get started. Cancel anytime.
          </p>
          <div className="flex items-center justify-center gap-3 pt-4" data-testid="billing-toggle-setup">
            <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <button
              type="button"
              role="switch"
              aria-checked={isYearly}
              onClick={() => setBillingInterval(isYearly ? 'month' : 'year')}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isYearly ? 'bg-primary' : 'bg-muted'}`}
              data-testid="toggle-billing-interval-setup"
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${isYearly ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              Yearly
            </span>
            {isYearly && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Save 10%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative cursor-pointer transition-all ${
                selectedPlan === plan.id 
                  ? 'ring-2 ring-primary border-primary' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
              data-testid={`plan-${plan.id}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Most Popular</Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {selectedPlan === plan.id && <Check className="h-5 w-5 text-primary" />}
                </CardTitle>
                <CardDescription>
                  Up to {plan.listings.toLocaleString()} listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-2">
                  {isYearly ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-lg line-through text-muted-foreground">{fc(plan.priceGbp)}</span>
                        <span className="text-3xl font-bold">{fc(Math.round(getYearlyPrice(plan.priceGbp) / 12 * 100) / 100)}</span>
                        <span className="text-muted-foreground">/mo</span>
                      </div>
                      <p className="text-sm font-medium text-primary">{fc(getYearlyPrice(plan.priceGbp))}/year — Save 10%</p>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">{fc(plan.priceGbp)}</span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>
                <p className="text-sm font-medium text-primary mb-4">{isYearly ? 'Billed annually' : 'Billed monthly'}</p>
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
                  <p className="font-medium">{isYearly ? 'Annual Billing' : 'Monthly Billing'}</p>
                  <p className="text-sm text-muted-foreground">
                    {isYearly
                      ? "You'll be charged once per year starting from your subscription date. Your next charge will be exactly 1 year later. Cancel anytime."
                      : "You'll be charged monthly starting from your subscription date. Cancel anytime."}
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
                I authorize DropandSell Automation App to set up a recurring {isYearly ? 'annual' : 'monthly'} payment using my payment method. 
                I understand that I can cancel at any time. 
                I have read and agree to the{" "}
                <a href="/policies" target="_blank" className="text-primary underline">Direct Debit terms</a>.
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleProceed}
              disabled={!selectedPlan || !directDebitAgreed || checkoutMutation.isPending}
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
              Skip for Now
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

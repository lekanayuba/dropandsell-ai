import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

export default function PaymentSuccess() {
  const [, navigate] = useLocation();

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/user/confirm-payment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  useEffect(() => {
    confirmPaymentMutation.mutate();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Thank you for subscribing to DropandSell AI. Your account has been activated 
            and you now have full access to all features.
          </p>
          
          <div className="bg-muted/50 p-4 rounded-lg text-left">
            <h4 className="font-medium mb-2">What's next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Connect your first marketplace store</li>
              <li>• Add vendors and import products</li>
              <li>• Set up pricing rules for automation</li>
            </ul>
          </div>

          <Button 
            onClick={() => navigate('/install-app')} 
            className="w-full"
            disabled={confirmPaymentMutation.isPending}
            data-testid="button-continue-to-app"
          >
            {confirmPaymentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Continue to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

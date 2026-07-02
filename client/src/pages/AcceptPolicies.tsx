import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, Database, CreditCard, CheckCircle2, AlertTriangle } from "lucide-react";

export default function AcceptPolicies() {
  const [, setLocation] = useLocation();
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedData, setAcceptedData] = useState(false);
  const [acceptedDebit, setAcceptedDebit] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);

  const allAccepted = acceptedPrivacy && acceptedTerms && acceptedData && acceptedDebit && acceptedDisclaimer;

  const acceptPolicies = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/accept-policies");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/onboarding");
    }
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display mb-2">Review Our Policies</h1>
          <p className="text-muted-foreground">
            Please read and accept our policies to continue using DropandSell Automation App
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Policy Agreements</CardTitle>
            <CardDescription>
              You must accept all policies to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 border rounded-lg hover-elevate">
              <Checkbox
                id="privacy"
                checked={acceptedPrivacy}
                onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                data-testid="checkbox-privacy"
              />
              <div className="flex-1">
                <label htmlFor="privacy" className="font-medium cursor-pointer flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Privacy Policy
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  I have read and agree to the Privacy Policy, which explains how DropandSell Automation App collects, uses, and protects my personal data.
                </p>
                <a
                  href="/policies?tab=privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-read-privacy"
                >
                  Read full policy
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 border rounded-lg hover-elevate">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                data-testid="checkbox-terms"
              />
              <div className="flex-1">
                <label htmlFor="terms" className="font-medium cursor-pointer flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  User Agreement (Terms of Service)
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  I agree to the Terms of Service and understand my responsibilities when using DropandSell Automation App.
                </p>
                <a
                  href="/policies?tab=terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-read-terms"
                >
                  Read full terms
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 border rounded-lg hover-elevate">
              <Checkbox
                id="data"
                checked={acceptedData}
                onCheckedChange={(checked) => setAcceptedData(checked === true)}
                data-testid="checkbox-data"
              />
              <div className="flex-1">
                <label htmlFor="data" className="font-medium cursor-pointer flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  Data Protection Policy
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  I acknowledge the Data Protection Policy and understand my rights under UK GDPR.
                </p>
                <a
                  href="/policies?tab=data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-read-data"
                >
                  Read full policy
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 border rounded-lg hover-elevate">
              <Checkbox
                id="debit"
                checked={acceptedDebit}
                onCheckedChange={(checked) => setAcceptedDebit(checked === true)}
                data-testid="checkbox-debit"
              />
              <div className="flex-1">
                <label htmlFor="debit" className="font-medium cursor-pointer flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Direct Debit Policy
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  I understand and accept the Direct Debit Policy for subscription payments and wallet top-ups.
                </p>
                <a
                  href="/policies?tab=debit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-read-debit"
                >
                  Read full policy
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 border rounded-lg hover-elevate border-amber-200 bg-amber-50/30">
              <Checkbox
                id="disclaimer"
                checked={acceptedDisclaimer}
                onCheckedChange={(checked) => setAcceptedDisclaimer(checked === true)}
                data-testid="checkbox-disclaimer"
              />
              <div className="flex-1">
                <label htmlFor="disclaimer" className="font-medium cursor-pointer flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Store Responsibility Disclaimer
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  I acknowledge and understand that I am solely responsible for the management and compliance of my store(s). The role of DropandSell is to facilitate and streamline the dropshipping process through automation. It is my responsibility to verify that the vendors from whom I source products are not offering counterfeit goods. Whilst DropandSell employs automated measures to detect and remove content that may trigger policy violations on platforms such as eBay, I understand that some items or descriptions may not be identified and could still result in policy infractions for which I bear full responsibility.
                </p>
                <a
                  href="/policies?tab=disclaimer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-read-disclaimer"
                >
                  Read full disclaimer
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {allAccepted ? (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                All policies accepted
              </span>
            ) : (
              "Please accept all policies to continue"
            )}
          </p>
          <Button
            onClick={() => acceptPolicies.mutate()}
            disabled={!allAccepted || acceptPolicies.isPending}
            data-testid="button-accept-policies"
          >
            {acceptPolicies.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

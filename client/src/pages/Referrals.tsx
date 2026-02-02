import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Users, Wallet, Share2, Check, Loader2, Gift } from "lucide-react";

export default function Referrals() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: referralData, isLoading: loadingCode } = useQuery<{
    referralCode: string;
    referralLink: string;
  }>({
    queryKey: ['/api/referral/code'],
  });

  const { data: referralsData, isLoading: loadingReferrals } = useQuery<{
    referrals: any[];
    totalEarnings: number;
    totalReferrals: number;
  }>({
    queryKey: ['/api/referrals'],
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-muted-foreground">
          Earn 10% commission for every user you refer who subscribes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-referrals">
              {loadingReferrals ? "..." : referralsData?.totalReferrals || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-earnings">
              £{loadingReferrals ? "..." : (referralsData?.totalEarnings || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">10%</div>
            <p className="text-xs text-muted-foreground">Per subscription</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link with friends and earn 10% of their subscription fee - paid immediately!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCode ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={referralData?.referralLink || ''}
                  readOnly
                  className="font-mono text-sm"
                  data-testid="input-referral-link"
                />
                <Button 
                  onClick={() => copyToClipboard(referralData?.referralLink || '')}
                  variant="outline"
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono" data-testid="badge-referral-code">
                  {referralData?.referralCode}
                </Badge>
                <span className="text-sm text-muted-foreground">Your referral code</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">1. Share Your Link</h4>
              <p className="text-sm text-muted-foreground">
                Send your unique referral link to friends and colleagues
              </p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">2. They Subscribe</h4>
              <p className="text-sm text-muted-foreground">
                When they sign up and choose a subscription plan
              </p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">3. Get Paid Instantly</h4>
              <p className="text-sm text-muted-foreground">
                10% commission is added to your wallet immediately
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
          <CardDescription>Track users who signed up using your referral link</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingReferrals ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : referralsData?.referrals?.length ? (
            <div className="space-y-2">
              {referralsData.referrals.map((referral: any) => (
                <div 
                  key={referral.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  data-testid={`referral-item-${referral.id}`}
                >
                  <div>
                    <Badge variant={referral.status === 'active' ? 'default' : 'secondary'}>
                      {referral.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      £{Number(referral.totalEarnings || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">earned</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No referrals yet. Share your link to start earning!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

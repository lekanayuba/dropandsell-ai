import { useWallet, useDeposit } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, CreditCard, Users, Coins, Loader2, Building2, Plus, CheckCircle2, ExternalLink, ShieldCheck, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { useLocation } from "wouter";

type PaymentMethodsResponse = {
  subscriptionCard: {
    id: string;
    brand: string;
    last4: string;
    expMonth?: number;
    expYear?: number;
  } | null;
  bankDetails: {
    accountName: string | null;
    accountNumberMasked: string | null;
    sortCode: string | null;
    bankName: string | null;
    hasBankDetails: boolean;
  };
  hasSubscription: boolean;
};

export default function Wallet() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { symbol: currSym, format: fc } = useCurrency();
  const { data: wallet, isLoading, refetch } = useWallet();
  const deposit = useDeposit();
  const [amount, setAmount] = useState("50");
  const [open, setOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<string>("");
  const [convertPoints, setConvertPoints] = useState("");

  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [showBankForm, setShowBankForm] = useState(false);

  const { data: fullWallet } = useQuery<{ balance: number; referralBalance: number; points: number; currency: string }>({
    queryKey: ["/api/wallet/full"],
    refetchInterval: 30000,
  });

  const { data: paymentData, isLoading: paymentLoading } = useQuery<PaymentMethodsResponse>({
    queryKey: ["/api/wallet/payment-methods"],
  });

  type StripeConnectStatus = {
    connected: boolean;
    status: 'not_started' | 'incomplete' | 'under_review' | 'restricted' | 'verified' | 'pending' | 'error';
    message?: string;
    payoutsEnabled?: boolean;
    chargesEnabled?: boolean;
    detailsSubmitted?: boolean;
    transfersActive?: boolean;
    transfersStatus?: string | null;
    requirementsDueCount?: number;
    disabledReason?: string | null;
    accountId?: string;
  };

  const { data: connectStatus, isLoading: connectLoading, refetch: refetchConnect } = useQuery<StripeConnectStatus>({
    queryKey: ["/api/stripe-connect/status"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectParam = params.get('connect');
    if (connectParam === 'complete') {
      toast({ title: "Welcome back!", description: "Refreshing your Stripe payout status…" });
      refetchConnect();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (connectParam === 'updated') {
      toast({ title: "Bank details updated", description: "Your new payout details have been saved with Stripe." });
      refetchConnect();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (connectParam === 'refresh') {
      toast({ title: "Onboarding paused", description: "You can resume Stripe payout setup any time from the Payout Account card.", variant: "destructive" });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refetchConnect, toast]);

  const onboardConnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/stripe-connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json() as Promise<{ success: boolean; url: string }>;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: "Could not start Stripe onboarding", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Stripe setup failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  // Used by the "Update Payout Details" button shown to verified users.
  // Hits the dedicated update endpoint (Stripe `account_update` link),
  // which lets users genuinely edit their bank details — unlike the
  // onboarding link, which only resumes incomplete steps.
  const updateConnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/stripe-connect/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json() as Promise<{ success: boolean; url: string }>;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: "Could not open Stripe update form", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Update form failed to open", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const subscriptionCard = paymentData?.subscriptionCard || null;
  const bankDetails = paymentData?.bankDetails || { accountName: null, accountNumberMasked: null, sortCode: null, bankName: null, hasBankDetails: false };
  const hasSubscription = paymentData?.hasSubscription || false;

  const saveBankMutation = useMutation({
    mutationFn: async (details: { accountName: string; accountNumber: string; sortCode: string; bankName: string }) => {
      const response = await fetch("/api/wallet/bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(details),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Bank details saved", description: "Your bank account details have been saved successfully" });
      setShowBankForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/payment-methods"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ amt, method, pmId, bank }: { amt: number; method: string; pmId?: string; bank?: { name: string; number: string; sort: string; bankName: string } }) => {
      const response = await fetch("/api/wallet/withdraw-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: amt,
          withdrawMethod: method,
          paymentMethodId: pmId,
          ...(bank ? {
            bankAccountName: bank.name,
            bankAccountNumber: bank.number,
            bankSortCode: bank.sort,
            bankName: bank.bankName,
          } : {}),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.withdrawMethod === 'bank') {
        toast({ title: "Withdrawal submitted", description: "Your funds will be deposited manually into your bank within 5–10 working days after admin approval. A confirmation email is on its way." });
      } else {
        toast({ title: "Withdrawal submitted", description: "Your Stripe payout request has been submitted for admin approval. Stripe will send it to your connected bank account once approved." });
      }
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawMethod("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/full"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/withdrawal-requests/mine"] });
    },
    onError: (err: any) => {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    },
  });

  // ===== Update bank details on an existing pending withdrawal request =====
  // Opened either from the "Update bank details" link in the confirmation
  // email (?update_request=<id>) or from the user's own pending list below.
  const [updateRequestId, setUpdateRequestId] = useState<number | null>(null);
  const [updRName, setUpdRName] = useState("");
  const [updRNumber, setUpdRNumber] = useState("");
  const [updRSort, setUpdRSort] = useState("");
  const [updRBank, setUpdRBank] = useState("");

  type MyWithdrawal = {
    id: number;
    amount: string;
    description: string | null;
    status: string;
    withdrawMethod: string | null;
    adminNote: string | null;
    processedAt: string | null;
    createdAt: string;
  };
  const { data: myRequests } = useQuery<MyWithdrawal[]>({
    queryKey: ["/api/wallet/withdrawal-requests/mine"],
    refetchInterval: 60000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upd = params.get('update_request');
    if (upd && /^\d+$/.test(upd)) {
      setUpdateRequestId(parseInt(upd));
      if (bankDetails.hasBankDetails) {
        setUpdRName(bankDetails.accountName || "");
        setUpdRSort(bankDetails.sortCode || "");
        setUpdRBank(bankDetails.bankName || "");
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [bankDetails.hasBankDetails, bankDetails.accountName, bankDetails.sortCode, bankDetails.bankName]);

  const updateRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/wallet/withdrawal-requests/${id}/bank`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bankAccountName: updRName,
          bankAccountNumber: updRNumber,
          bankSortCode: updRSort,
          bankName: updRBank,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Bank details updated", description: "Your withdrawal will now be paid to the new account." });
      setUpdateRequestId(null);
      setUpdRNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/withdrawal-requests/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/payment-methods"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (pts: number) => {
      const response = await fetch("/api/wallet/convert-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ points: pts }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Points converted!", description: "Funds added to your wallet balance" });
      setConvertOpen(false);
      setConvertPoints("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/full"] });
    },
    onError: (err: any) => {
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" });
    },
  });


  if (isLoading) return <div className="p-8">Loading wallet...</div>;

  const handleDeposit = () => {
    deposit.mutate(Number(amount), {
      onSuccess: () => setOpen(false)
    });
  };

  const handleSaveBankDetails = () => {
    saveBankMutation.mutate({
      accountName: bankAccountName,
      accountNumber: bankAccountNumber,
      sortCode: bankSortCode,
      bankName: bankName,
    });
  };

  const handleWithdrawDialogOpen = (isOpen: boolean) => {
    setWithdrawOpen(isOpen);
    if (isOpen) {
      setWithdrawMethod("");
      setWithdrawAmount("");
      setShowBankForm(false);
      if (bankDetails.hasBankDetails) {
        setBankAccountName(bankDetails.accountName || "");
        setBankAccountNumber("");
        setBankSortCode(bankDetails.sortCode || "");
        setBankName(bankDetails.bankName || "");
      } else {
        setBankAccountName("");
        setBankAccountNumber("");
        setBankSortCode("");
        setBankName("");
      }
    }
  };

  const canWithdraw = () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return false;
    if (!withdrawMethod) return false;
    if (withdrawMethod === 'card' && connectStatus?.status !== 'verified') return false;
    if (withdrawMethod === 'bank') {
      const haveSaved = bankDetails.hasBankDetails && !showBankForm;
      const haveInline = bankAccountName.trim().length >= 2 && /^\d{6,8}$/.test(bankAccountNumber.replace(/\s/g, '')) && /^\d{6}$/.test(bankSortCode.replace(/[-\s]/g, ''));
      if (!haveSaved && !haveInline) return false;
    }
    return true;
  };

  const submitWithdraw = () => {
    const bankPayload = withdrawMethod === 'bank' && (showBankForm || !bankDetails.hasBankDetails)
      ? {
          name: bankAccountName.trim(),
          number: bankAccountNumber.replace(/\s/g, ''),
          sort: bankSortCode.replace(/[-\s]/g, ''),
          bankName: bankName.trim(),
        }
      : undefined;
    withdrawMutation.mutate({
      amt: Number(withdrawAmount),
      method: withdrawMethod,
      pmId: undefined,
      bank: bankPayload,
    });
  };

  const referralBalance = fullWallet?.referralBalance || 0;
  const points = fullWallet?.points || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">Wallet</h2>
          <p className="text-muted-foreground mt-2">Manage your funds and transaction history</p>
        </div>
        <PageRefreshButton />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none shadow-xl shadow-primary/20">
          <CardHeader>
            <CardTitle className="text-primary-foreground/80 font-medium text-sm flex items-center gap-2">
              <WalletIcon className="w-4 h-4" />
              Main Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display" data-testid="text-main-balance">
              {fc(wallet?.balance || 0)}
            </div>
            <p className="text-primary-foreground/60 text-sm mt-2 mb-6">
              Available for purchases
            </p>
            <div className="flex gap-3">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="shadow-sm">
                    <ArrowDownLeft className="w-4 h-4 mr-2" />
                    Deposit Funds
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Funds to Wallet</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount ({currSym})</label>
                      <Input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleDeposit}
                      disabled={deposit.isPending}
                    >
                      {deposit.isPending ? "Processing..." : `Deposit ${fc(amount || 0)}`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-600 to-green-500 text-white border-none shadow-xl shadow-green-500/20">
          <CardHeader>
            <CardTitle className="text-white/80 font-medium text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Referral Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display" data-testid="text-referral-balance">
              {fc(referralBalance)}
            </div>
            <p className="text-white/60 text-sm mt-2 mb-6">
              10% commission from referrals
            </p>
            <Dialog open={withdrawOpen} onOpenChange={handleWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="shadow-sm" data-testid="button-withdraw-referral">
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Withdraw Earnings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Withdraw Referral Earnings</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <p className="text-sm text-muted-foreground">
                    Available: <span className="font-semibold text-foreground">{fc(referralBalance)}</span>
                  </p>
                  <div className="space-y-2">
                    <Label>Amount ({currSym})</Label>
                    <Input 
                      type="number" 
                      value={withdrawAmount} 
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      max={referralBalance}
                      data-testid="input-withdraw-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Withdraw To</Label>
                    <Select value={withdrawMethod} onValueChange={(val) => {
                      setWithdrawMethod(val);
                      if (val === 'bank' && !bankDetails.hasBankDetails) {
                        setShowBankForm(true);
                      } else {
                        setShowBankForm(false);
                      }
                    }}>
                      <SelectTrigger data-testid="select-withdraw-method">
                        <SelectValue placeholder="Select withdrawal method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Stripe Payout
                          </span>
                        </SelectItem>
                        <SelectItem value="bank">
                          <span className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" /> Bank Account
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {withdrawMethod === 'card' && (
                    <div className="space-y-3">
                      {connectLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking Stripe payout setup...
                        </div>
                      ) : connectStatus?.status === 'verified' ? (
                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                          <div className="p-2 bg-background rounded-md shadow-sm">
                            <ShieldCheck className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm" data-testid="text-stripe-payout-ready">Stripe payout account ready</p>
                            <p className="text-xs text-muted-foreground">Admin approval will send this withdrawal through Stripe Connect.</p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                      ) : connectStatus?.status === 'under_review' || connectStatus?.status === 'restricted' ? (
                        <div className="p-4 border border-amber-500/30 rounded-lg text-center space-y-3 bg-amber-500/10">
                          <div className="flex justify-center">
                            <div className="p-3 bg-background rounded-full">
                              <Clock className="w-6 h-6 text-amber-600" />
                            </div>
                          </div>
                          <p className="text-sm font-medium">Stripe payout not ready yet</p>
                          <p className="text-xs text-muted-foreground">{connectStatus?.message || "Stripe is still reviewing your payout account."}</p>
                          <Button variant="outline" size="sm" onClick={() => refetchConnect()} data-testid="button-refresh-withdraw-stripe-connect">
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Refresh Status
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 border border-dashed rounded-lg text-center space-y-3">
                          <div className="flex justify-center">
                            <div className="p-3 bg-muted rounded-full">
                              <ShieldCheck className="w-6 h-6 text-muted-foreground" />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Stripe payout setup required</p>
                            <p className="text-xs text-muted-foreground mt-1">Complete Stripe Connect setup before requesting an automatic payout.</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => onboardConnectMutation.mutate()} disabled={onboardConnectMutation.isPending} data-testid="button-setup-withdraw-stripe-connect">
                            {onboardConnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1" />}
                            Set Up Stripe Payouts
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {withdrawMethod === 'bank' && (
                    <div className="space-y-3">
                      {bankDetails.hasBankDetails && !showBankForm ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                            <div className="p-2 bg-background rounded-md shadow-sm">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm" data-testid="text-bank-account-name">
                                {bankDetails.accountName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {bankDetails.bankName ? `${bankDetails.bankName} - ` : ''}
                                {bankDetails.accountNumberMasked} | Sort: {bankDetails.sortCode}
                              </p>
                            </div>
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          </div>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowBankForm(true)} data-testid="button-edit-bank-details">
                            Use different bank details
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                          <p className="text-sm font-medium">Bank account for deposit</p>
                          <p className="text-xs text-muted-foreground -mt-2">We'll deposit the funds manually into this account.</p>
                          <div className="space-y-2">
                            <Label className="text-xs">Account Name</Label>
                            <Input
                              value={bankAccountName}
                              onChange={(e) => setBankAccountName(e.target.value)}
                              placeholder="John Smith"
                              data-testid="input-bank-account-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Bank Name (optional)</Label>
                            <Input
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                              placeholder="e.g. Barclays, HSBC"
                              data-testid="input-bank-name"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Sort Code</Label>
                              <Input
                                value={bankSortCode}
                                onChange={(e) => setBankSortCode(e.target.value)}
                                placeholder="00-00-00"
                                maxLength={8}
                                data-testid="input-bank-sort-code"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Account Number</Label>
                              <Input
                                value={bankAccountNumber}
                                onChange={(e) => setBankAccountNumber(e.target.value)}
                                placeholder="12345678"
                                maxLength={8}
                                data-testid="input-bank-account-number"
                              />
                            </div>
                          </div>
                          {bankDetails.hasBankDetails && (
                            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowBankForm(false)}>
                              Use saved details instead
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Manual bank deposit</p>
                          <p className="text-[11px] text-muted-foreground">
                            Approved withdrawals are deposited directly into your bank by our team. Please allow <strong>5–10 working days</strong> for funds to reflect in your account.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { handleWithdrawDialogOpen(false); }} data-testid="button-cancel-withdraw">
                    Cancel
                  </Button>
                  <Button
                    onClick={submitWithdraw}
                    disabled={withdrawMutation.isPending || !canWithdraw()}
                    data-testid="button-confirm-withdraw"
                  >
                    {withdrawMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request {fc(withdrawAmount || 0)}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Payout Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="section-stripe-connect">
              {connectLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-connect-loading">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking payout setup…
                </div>
              ) : connectStatus?.status === 'verified' ? (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/30" data-testid="status-connect-verified">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">Payouts active</p>
                      <p className="text-[11px] text-muted-foreground">
                        Your Stripe payout account is fully verified. Approved referral withdrawals will be sent automatically to your bank.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => updateConnectMutation.mutate()}
                    disabled={updateConnectMutation.isPending}
                    data-testid="button-update-stripe-connect"
                  >
                    {updateConnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Change Bank Details
                  </Button>
                  <p className="text-[11px] text-muted-foreground/70">
                    Opens a secure Stripe page where you can update your bank account, sort code, name or address. Changes take effect immediately for your next payout.
                  </p>
                </>
              ) : connectStatus?.status === 'under_review' ? (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30" data-testid="status-connect-review">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Stripe is reviewing your details</p>
                      <p className="text-[11px] text-muted-foreground">
                        You've submitted everything Stripe needs. They're verifying your account — this usually takes a few minutes to a few hours. We'll enable payouts as soon as Stripe confirms.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => refetchConnect()}
                    data-testid="button-refresh-stripe-connect"
                  >
                    Refresh Status
                  </Button>
                </>
              ) : connectStatus?.status === 'incomplete' ? (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30" data-testid="status-connect-incomplete">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Onboarding not finished</p>
                      <p className="text-[11px] text-muted-foreground">
                        You started setting up your Stripe payout account but didn't complete it. Click below to continue where you left off.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onboardConnectMutation.mutate()}
                    disabled={onboardConnectMutation.isPending}
                    data-testid="button-continue-stripe-connect"
                  >
                    {onboardConnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Continue Stripe Setup
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Set up your payout account so approved referral withdrawals are sent automatically to your bank. Setup takes about 3 minutes — Stripe will ask for your name, address, date of birth and bank details.
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onboardConnectMutation.mutate()}
                    disabled={onboardConnectMutation.isPending}
                    data-testid="button-start-stripe-connect"
                  >
                    {onboardConnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Set Up Stripe Payouts
                  </Button>
                  <p className="text-[11px] text-muted-foreground/70">
                    Powered by Stripe Connect. You'll be redirected to Stripe to enter your details securely, then brought back here automatically.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600 to-purple-500 text-white border-none shadow-xl shadow-purple-500/20">
          <CardHeader>
            <CardTitle className="text-white/80 font-medium text-sm flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Usage Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display" data-testid="text-points">
              {points.toFixed(3)}
            </div>
            <p className="text-white/60 text-sm mt-2 mb-6">
              0.001 points per {fc(1)} spent
            </p>
            <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="shadow-sm" data-testid="button-convert-points">
                  <Coins className="w-4 h-4 mr-2" />
                  Convert to Funds
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convert Points to Funds</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Available: {points.toFixed(3)} points (1 point = {fc(1)})
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Points to Convert</label>
                    <Input 
                      type="number" 
                      value={convertPoints} 
                      onChange={(e) => setConvertPoints(e.target.value)}
                      placeholder="0"
                      step="0.001"
                      max={points}
                      data-testid="input-convert-points"
                    />
                    {convertPoints && Number(convertPoints) > 0 && (
                      <p className="text-sm text-green-600">
                        = {fc(convertPoints)} added to wallet
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConvertOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => convertMutation.mutate(Number(convertPoints))}
                    disabled={convertMutation.isPending || !convertPoints || Number(convertPoints) <= 0}
                    data-testid="button-confirm-convert"
                  >
                    {convertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Convert Points
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment & Payout Methods</CardTitle>
            <CardDescription>Cards are used for subscriptions. Stripe payout and bank details are used for withdrawals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading payment methods...
              </div>
            ) : (
              <>
                {subscriptionCard ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium" data-testid="text-card-display">
                          {subscriptionCard.brand.charAt(0).toUpperCase() + subscriptionCard.brand.slice(1)} ending in {subscriptionCard.last4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {subscriptionCard.expMonth && subscriptionCard.expYear 
                            ? `Expires ${subscriptionCard.expMonth}/${subscriptionCard.expYear}` 
                            : 'Subscription card'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Subscription</Badge>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 border border-dashed rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">No card on file</p>
                        <p className="text-xs text-muted-foreground">Subscribe to add a payment card</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLocation('/subscription')} data-testid="button-go-to-subscription">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}

                {bankDetails.hasBankDetails ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium" data-testid="text-bank-display">{bankDetails.accountName}</p>
                        <p className="text-xs text-muted-foreground">
                          {bankDetails.bankName ? `${bankDetails.bankName} - ` : ''}{bankDetails.accountNumberMasked} | Sort: {bankDetails.sortCode}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Bank</Badge>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 border border-dashed rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">No bank account</p>
                        <p className="text-xs text-muted-foreground">Add via withdrawal dialog</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {myRequests && myRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Your Withdrawal Requests
            </CardTitle>
            <CardDescription>
              Stripe payout requests are sent through Stripe after admin approval. Bank transfer requests are deposited manually within 5–10 working days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payout details</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.map((r) => {
                  const isPending = r.status === 'pending_approval';
                  return (
                    <TableRow key={r.id} data-testid={`row-withdrawal-${r.id}`}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{fc(Math.abs(Number(r.amount)))}</TableCell>
                      <TableCell>
                        <Badge variant={isPending || r.status === 'processing' ? 'secondary' : r.status === 'approved' ? 'default' : 'destructive'} className="capitalize">
                          {r.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={r.description || ''}>
                        {r.description || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-update-bank-${r.id}`}
                            onClick={() => {
                              setUpdateRequestId(r.id);
                              setUpdRName(bankDetails.accountName || '');
                              setUpdRNumber('');
                              setUpdRSort(bankDetails.sortCode || '');
                              setUpdRBank(bankDetails.bankName || '');
                            }}
                          >
                            Update bank details
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={updateRequestId !== null} onOpenChange={(o) => { if (!o) setUpdateRequestId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update bank details for this withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              These details will be used for the manual deposit. We'll also save them as your default bank for next time.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Account Name</Label>
              <Input value={updRName} onChange={(e) => setUpdRName(e.target.value)} placeholder="John Smith" data-testid="input-upd-bank-name" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Bank Name (optional)</Label>
              <Input value={updRBank} onChange={(e) => setUpdRBank(e.target.value)} placeholder="e.g. Barclays, HSBC" data-testid="input-upd-bank" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Sort Code</Label>
                <Input value={updRSort} onChange={(e) => setUpdRSort(e.target.value)} placeholder="00-00-00" maxLength={8} data-testid="input-upd-sort" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Account Number</Label>
                <Input value={updRNumber} onChange={(e) => setUpdRNumber(e.target.value)} placeholder="12345678" maxLength={8} data-testid="input-upd-number" />
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                Updates only apply while the request is still pending approval.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateRequestId(null)}>Cancel</Button>
            <Button
              data-testid="button-save-upd-bank"
              disabled={updateRequestMutation.isPending || updRName.trim().length < 2 || !/^\d{6,8}$/.test(updRNumber.replace(/\s/g, '')) || !/^\d{6}$/.test(updRSort.replace(/[-\s]/g, ''))}
              onClick={() => updateRequestId && updateRequestMutation.mutate(updateRequestId)}
            >
              {updateRequestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallet?.transactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                wallet?.transactions?.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{tx.type.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>{tx.description || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      ['deposit', 'referral_bonus'].includes(tx.type) ? 'text-green-600' : 'text-foreground'
                    }`}>
                      {['deposit', 'referral_bonus'].includes(tx.type) ? '+' : '-'}{fc(Number(tx.amount))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

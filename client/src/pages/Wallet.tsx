import { useWallet, useDeposit } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, CreditCard, Users, Coins, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Wallet() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: wallet, isLoading, refetch } = useWallet();
  const deposit = useDeposit();
  const [amount, setAmount] = useState("50");
  const [open, setOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [convertPoints, setConvertPoints] = useState("");

  const { data: fullWallet } = useQuery<{ balance: number; referralBalance: number; points: number; currency: string }>({
    queryKey: ["/api/wallet/full"],
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amt: number) => {
      const response = await fetch("/api/wallet/withdraw-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: amt }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Withdrawal requested", description: "Your request is pending approval" });
      setWithdrawOpen(false);
      setWithdrawAmount("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/full"] });
    },
    onError: (err: any) => {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
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

  const referralBalance = fullWallet?.referralBalance || 0;
  const points = fullWallet?.points || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Wallet</h2>
        <p className="text-muted-foreground mt-2">Manage your funds and transaction history</p>
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
              £{Number(wallet?.balance || 0).toFixed(2)}
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
                      <label className="text-sm font-medium">Amount ($)</label>
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
                      {deposit.isPending ? "Processing..." : `Deposit $${amount}`}
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
              £{referralBalance.toFixed(2)}
            </div>
            <p className="text-white/60 text-sm mt-2 mb-6">
              10% commission from referrals
            </p>
            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="shadow-sm" data-testid="button-withdraw-referral">
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Withdraw to Bank
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw Referral Earnings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Available: £{referralBalance.toFixed(2)}
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (£)</label>
                    <Input 
                      type="number" 
                      value={withdrawAmount} 
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      max={referralBalance}
                      data-testid="input-withdraw-amount"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => withdrawMutation.mutate(Number(withdrawAmount))}
                    disabled={withdrawMutation.isPending || !withdrawAmount || Number(withdrawAmount) <= 0}
                    data-testid="button-confirm-withdraw"
                  >
                    {withdrawMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Withdraw £{withdrawAmount || "0"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
              0.001 points per £1 spent
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
                    Available: {points.toFixed(3)} points (1 point = £1)
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
                        = £{Number(convertPoints).toFixed(2)} added to wallet
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
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Manage your connected cards and banks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium">Visa ending in 4242</p>
                  <p className="text-xs text-muted-foreground">Expires 12/25</p>
                </div>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>
            <Button variant="outline" className="w-full">
              Add Payment Method
            </Button>
          </CardContent>
        </Card>
      </div>

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
                      {['deposit', 'referral_bonus'].includes(tx.type) ? '+' : '-'}${Number(tx.amount).toFixed(2)}
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

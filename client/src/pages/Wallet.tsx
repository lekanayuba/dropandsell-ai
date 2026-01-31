import { useWallet, useDeposit } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, CreditCard } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function Wallet() {
  const { data: wallet, isLoading } = useWallet();
  const deposit = useDeposit();
  const [amount, setAmount] = useState("50");
  const [open, setOpen] = useState(false);

  if (isLoading) return <div className="p-8">Loading wallet...</div>;

  const handleDeposit = () => {
    deposit.mutate(Number(amount), {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Wallet</h2>
        <p className="text-muted-foreground mt-2">Manage your funds and transaction history</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none shadow-xl shadow-primary/20">
          <CardHeader>
            <CardTitle className="text-primary-foreground/80 font-medium text-sm flex items-center gap-2">
              <WalletIcon className="w-4 h-4" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display">
              ${Number(wallet?.balance || 0).toFixed(2)}
            </div>
            <p className="text-primary-foreground/60 text-sm mt-2 mb-6">
              Available for immediate payout
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

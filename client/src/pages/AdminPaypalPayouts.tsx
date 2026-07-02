import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, CheckCircle2, Wallet } from "lucide-react";

interface PayoutGroup {
  recipientHandle: string;
  monthYear: string;
  status: "pending" | "settled";
  count: number;
  amountPence: number;
  settledAt: string | null;
}

interface PayoutResponse {
  recipientHandle: string;
  pendingTotalPence: number;
  groups: PayoutGroup[];
}

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatMonth(monthYear: string): string {
  const [y, m] = monthYear.split("-").map(Number);
  if (!y || !m) return monthYear;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function AdminPaypalPayouts() {
  const { toast } = useToast();
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PayoutResponse>({
    queryKey: ["/api/admin/paypal-payouts"],
  });

  const settleMutation = useMutation({
    mutationFn: async (vars: { recipientHandle: string; monthYear: string }) => {
      const res = await apiRequest("POST", "/api/admin/paypal-payouts/settle", vars);
      return (await res.json()) as { success: boolean; settledCount: number; settledPence: number };
    },
    onSuccess: (result, vars) => {
      toast({
        title: "Marked as paid",
        description: `${result.settledCount} accrual${result.settledCount === 1 ? "" : "s"} (${formatGbp(result.settledPence)}) for ${formatMonth(vars.monthYear)} settled.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/paypal-payouts"] });
    },
    onError: (err: any) => {
      toast({
        title: "Could not mark as paid",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => setSettlingKey(null),
  });

  const pending = (data?.groups || []).filter((g) => g.status === "pending");
  const settled = (data?.groups || []).filter((g) => g.status === "settled");
  const recipient = data?.recipientHandle || "OLADIRANOJO";

  function openPaypal(amountPence: number) {
    const amount = (amountPence / 100).toFixed(2);
    window.open(`https://paypal.me/${recipient}/${amount}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Wallet className="w-6 h-6 text-[#285261]" />
          PayPal Payouts
        </h1>
        <p className="text-muted-foreground mt-1">
          £0.10 accrues per active subscription per calendar month. Send the total
          to <span className="font-semibold">PayPal.Me/{recipient}</span> and mark the
          batch paid below.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Total currently owed</CardTitle>
          <CardDescription>Sum of every unsettled month across every recipient.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-[#285261]" data-testid="text-pending-total">
            {isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : formatGbp(data?.pendingTotalPence ?? 0)}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pending batches</CardTitle>
          <CardDescription>
            One row per (recipient × month). Click "Open PayPal.Me" to send the batched amount,
            then "Mark paid".
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading…
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-pending">
              Nothing pending. All caught up.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Subscriptions</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((g) => {
                  const key = `${g.recipientHandle}|${g.monthYear}`;
                  const isSettling = settleMutation.isPending && settlingKey === key;
                  return (
                    <TableRow key={key} data-testid={`row-pending-${key}`}>
                      <TableCell className="font-medium">{formatMonth(g.monthYear)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">PayPal.Me/{g.recipientHandle}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{g.count}</TableCell>
                      <TableCell className="text-right font-semibold">{formatGbp(g.amountPence)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPaypal(g.amountPence)}
                            data-testid={`button-open-paypal-${key}`}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Open PayPal.Me
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSettlingKey(key);
                              settleMutation.mutate({
                                recipientHandle: g.recipientHandle,
                                monthYear: g.monthYear,
                              });
                            }}
                            disabled={isSettling}
                            data-testid={`button-mark-paid-${key}`}
                          >
                            {isSettling ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                            )}
                            Mark paid
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Previously settled batches.</CardDescription>
        </CardHeader>
        <CardContent>
          {settled.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">No settled batches yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Subscriptions</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Settled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settled.map((g) => {
                  const key = `settled-${g.recipientHandle}|${g.monthYear}`;
                  return (
                    <TableRow key={key} data-testid={`row-settled-${key}`}>
                      <TableCell className="font-medium">{formatMonth(g.monthYear)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">PayPal.Me/{g.recipientHandle}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{g.count}</TableCell>
                      <TableCell className="text-right font-semibold">{formatGbp(g.amountPence)}</TableCell>
                      <TableCell>
                        {g.settledAt
                          ? new Date(g.settledAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

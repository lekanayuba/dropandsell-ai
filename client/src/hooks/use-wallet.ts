import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useWallet() {
  return useQuery({
    queryKey: [api.wallet.get.path],
    queryFn: async () => {
      const res = await fetch(api.wallet.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallet info");
      return api.wallet.get.responses[200].parse(await res.json());
    },
  });
}

export function useDeposit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (amount: number) => {
      // Mock payment method ID for now
      const payload = { amount, paymentMethodId: "mock_pm_123" };
      const res = await fetch(api.wallet.deposit.path, {
        method: api.wallet.deposit.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to deposit funds");
      return api.wallet.deposit.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.wallet.get.path] });
      toast({ title: "Success", description: "Funds deposited successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Deposit failed", variant: "destructive" });
    },
  });
}

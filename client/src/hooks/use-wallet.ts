import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useWallet() {
  return useQuery({
    queryKey: [api.wallet.get.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.wallet.get.path);
      return api.wallet.get.responses[200].parse(await res.json());
    },
  });
}

export function useFullWallet() {
  return useQuery<{ balance: number; referralBalance: number; points: number; currency: string }>({
    queryKey: ["/api/wallet/full"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wallet/full");
      return res.json();
    },
  });
}

export function useDeposit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("POST", "/api/wallet/deposit", { amount });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.wallet.get.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/full"] });
      toast({ title: "Success", description: `Deposit of £${data.amount} initiated` });
    },
    onError: (err: Error) => {
      toast({ title: "Deposit Failed", description: err.message, variant: "destructive" });
    },
  });
}

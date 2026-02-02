import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "./use-auth";

const REFERRAL_CODE_KEY = "dropflow_referral_code";

export function useReferralHandler() {
  const { user, isAuthenticated } = useAuth();

  const applyReferralMutation = useMutation({
    mutationFn: async (referralCode: string) => {
      const response = await apiRequest("POST", "/api/referral/apply", { referralCode });
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem(REFERRAL_CODE_KEY);
    },
    onError: () => {
      localStorage.removeItem(REFERRAL_CODE_KEY);
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref");
    
    if (refCode) {
      localStorage.setItem(REFERRAL_CODE_KEY, refCode);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("ref");
      window.history.replaceState({}, "", newUrl.pathname + newUrl.search);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user && !user.referredBy) {
      const storedCode = localStorage.getItem(REFERRAL_CODE_KEY);
      if (storedCode && !applyReferralMutation.isPending) {
        applyReferralMutation.mutate(storedCode);
      }
    }
  }, [isAuthenticated, user]);

  return {
    isApplying: applyReferralMutation.isPending,
  };
}

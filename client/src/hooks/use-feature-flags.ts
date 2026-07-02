import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface FeatureFlag {
  id: number;
  featureKey: string;
  name: string;
  description: string;
  isEnabled: boolean;
  adminOnly: boolean;
  accessible: boolean;
}

export function useFeatureFlags() {
  const { isAuthenticated } = useAuth();
  return useQuery<FeatureFlag[]>({
    queryKey: ['/api/feature-flags'],
    enabled: isAuthenticated,
  });
}

export function useFeatureAccess(featureKey: string): { hasAccess: boolean; isLoading: boolean } {
  const { user, isAuthenticated } = useAuth();
  const { data: flags, isLoading } = useFeatureFlags();

  const isAdmin = user?.isAdmin === 'true' || user?.email === 'dropandsellauth@gmail.com';

  if (!isAuthenticated) {
    return { hasAccess: false, isLoading: true };
  }

  if (isLoading || !flags) {
    return { hasAccess: isAdmin, isLoading };
  }

  const flag = flags.find(f => f.featureKey === featureKey);

  if (!flag) {
    return { hasAccess: isAdmin, isLoading: false };
  }

  return {
    hasAccess: flag.accessible || isAdmin,
    isLoading: false,
  };
}

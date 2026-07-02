import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useDashboardStats(storeIds?: number[]) {
  const params = storeIds && storeIds.length > 0 ? `?storeIds=${storeIds.join(",")}` : "";
  const path = `${api.dashboard.stats.path}${params}`;

  return useQuery({
    queryKey: [api.dashboard.stats.path, storeIds],
    queryFn: async () => {
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      return api.dashboard.stats.responses[200].parse(await res.json());
    },
    refetchInterval: 30000,
  });
}

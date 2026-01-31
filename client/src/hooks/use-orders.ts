import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

interface OrderFilters {
  status?: string;
  page?: number;
}

export function useOrders(filters?: OrderFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.page) params.append("page", String(filters.page));

  return useQuery({
    queryKey: [api.orders.list.path, filters],
    queryFn: async () => {
      const url = `${api.orders.list.path}?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return api.orders.list.responses[200].parse(await res.json());
    },
  });
}

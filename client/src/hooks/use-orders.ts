import { useQuery } from "@tanstack/react-query";

export function useOrders() {
  return useQuery<any[]>({
    queryKey: ['/api/orders'],
  });
}

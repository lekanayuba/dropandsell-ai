import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertStore } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useStores() {
  return useQuery({
    queryKey: [api.stores.list.path],
    queryFn: async () => {
      const res = await fetch(api.stores.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stores");
      return api.stores.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertStore) => {
      const res = await fetch(api.stores.create.path, {
        method: api.stores.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create store");
      }
      return api.stores.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
      toast({ title: "Success", description: "Store connected successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.stores.delete.path, { id });
      const res = await fetch(url, { 
        method: api.stores.delete.method, 
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete store");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
      toast({ title: "Success", description: "Store disconnected" });
    },
  });
}

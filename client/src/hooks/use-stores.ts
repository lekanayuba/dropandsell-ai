import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertStore } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to disconnect store");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
      toast({ title: "Success", description: "Store disconnected successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertStore> }) => {
      const url = buildUrl(api.stores.update.path, { id });
      const res = await apiRequest(api.stores.update.method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
      toast({ title: "Success", description: "Store updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (storeId: number) => {
      const res = await apiRequest("POST", `/api/stores/${storeId}/test-connection`);
      return res.json();
    },
    onSuccess: (data: { success: boolean; status?: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
      if (data.success) {
        toast({ title: "Connection Successful", description: data.message });
      } else {
        toast({ title: "Connection Failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useMarketplaceListings() {
  return useQuery<any[]>({
    queryKey: ["/api/marketplace-listings"],
  });
}

export function useStoreListings(storeId: number | null) {
  return useQuery({
    queryKey: ["/api/stores", storeId, "listings"],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await fetch(`/api/stores/${storeId}/listings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json();
    },
    enabled: !!storeId,
  });
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PricingRule, ImportJob, PublishQueueItem, Product, Store } from "@shared/schema";

export function usePricingRules() {
  return useQuery<PricingRule[]>({
    queryKey: ["/api/pricing-rules"],
  });
}

export function useCreatePricingRule() {
  return useMutation({
    mutationFn: async (data: Partial<PricingRule>) => {
      const res = await apiRequest("POST", "/api/pricing-rules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
    },
  });
}

export function useUpdatePricingRule() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<PricingRule>) => {
      const res = await apiRequest("PUT", `/api/pricing-rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
    },
  });
}

export function useDeletePricingRule() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pricing-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
    },
  });
}

export function useImportJobs() {
  return useQuery<ImportJob[]>({
    queryKey: ["/api/import-jobs"],
  });
}

export function usePublishQueue() {
  return useQuery<PublishQueueItem[]>({
    queryKey: ["/api/publish-queue"],
  });
}

export function useAddToPublishQueue() {
  return useMutation({
    mutationFn: async (data: { productId: number; storeId: number; calculatedPrice: number; pricingRuleId?: number }) => {
      const res = await apiRequest("POST", "/api/publish-queue", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue"] });
    },
  });
}

export function useBulkAddToPublishQueue() {
  return useMutation({
    mutationFn: async (items: { productId: number; storeId: number; calculatedPrice: number; pricingRuleId?: number }[]) => {
      const res = await apiRequest("POST", "/api/publish-queue/bulk", { items });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue"] });
    },
  });
}

export function useDeleteFromPublishQueue() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/publish-queue/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue"] });
    },
  });
}

export function usePublishItems() {
  return useMutation({
    mutationFn: async (queueItemIds: number[]) => {
      const res = await apiRequest("POST", "/api/automation/publish", { queueItemIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });
}

export function useCalculatePrice() {
  return useMutation({
    mutationFn: async (data: { costPrice: number; vendorId?: number }) => {
      const res = await apiRequest("POST", "/api/automation/calculate-price", data);
      return res.json();
    },
  });
}

export function useImportCSV() {
  return useMutation({
    mutationFn: async (data: { file: File; vendorId?: number; fieldMapping?: Record<string, string> }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      if (data.vendorId) {
        formData.append("vendorId", data.vendorId.toString());
      }
      if (data.fieldMapping) {
        formData.append("fieldMapping", JSON.stringify(data.fieldMapping));
      }
      
      const res = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Import failed");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/import-jobs"] });
    },
  });
}

export function usePreviewCSV() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Preview failed");
      }
      
      return res.json() as Promise<{ headers: string[]; previewRows: string[][]; totalRows: number }>;
    },
  });
}

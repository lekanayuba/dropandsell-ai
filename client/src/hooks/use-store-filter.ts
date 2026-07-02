import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "dropandsell_store_filter";

function loadFromStorage(): number[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveToStorage(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

export function useStoreFilter(allStoreIds: number[]) {
  const [selectedStoreIds, setSelectedStoreIdsRaw] = useState<number[]>(loadFromStorage);

  useEffect(() => {
    if (allStoreIds.length > 0 && selectedStoreIds.length === 0) {
      setSelectedStoreIds(allStoreIds);
    }
    if (selectedStoreIds.length > 0) {
      const valid = selectedStoreIds.filter((id) => allStoreIds.includes(id));
      if (valid.length !== selectedStoreIds.length) {
        setSelectedStoreIds(valid.length > 0 ? valid : allStoreIds);
      }
    }
  }, [allStoreIds.join(",")]);

  const setSelectedStoreIds = useCallback((ids: number[]) => {
    saveToStorage(ids);
    setSelectedStoreIdsRaw(ids);
  }, []);

  const toggleStore = useCallback(
    (id: number) => {
      const next = selectedStoreIds.includes(id)
        ? selectedStoreIds.filter((s) => s !== id)
        : [...selectedStoreIds, id];
      if (next.length === 0) return;
      setSelectedStoreIds(next);
    },
    [selectedStoreIds, setSelectedStoreIds]
  );

  const selectAll = useCallback(() => {
    setSelectedStoreIds(allStoreIds);
  }, [allStoreIds, setSelectedStoreIds]);

  const isAllSelected = allStoreIds.length > 0 && selectedStoreIds.length === allStoreIds.length;

  return {
    selectedStoreIds,
    setSelectedStoreIds,
    toggleStore,
    selectAll,
    isAllSelected,
    hasMultipleStores: allStoreIds.length > 1,
  };
}

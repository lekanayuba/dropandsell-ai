import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Store, ChevronDown, RotateCcw } from "lucide-react";
import { SiShopify, SiAmazon, SiEbay, SiTiktok } from "react-icons/si";
import { useState } from "react";

interface StoreInfo {
  id: number;
  name: string;
  platform: string;
  status: string;
}

interface StoreFilterDropdownProps {
  stores: StoreInfo[];
  selectedStoreIds: number[];
  onToggleStore: (id: number) => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
}

function PlatformIcon({ platform }: { platform: string }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  switch (platform?.toLowerCase()) {
    case "shopify":
      return <SiShopify className={`${cls} text-green-600`} />;
    case "amazon":
      return <SiAmazon className={`${cls} text-orange-500`} />;
    case "ebay":
      return <SiEbay className={`${cls} text-blue-600`} />;
    case "tiktok":
      return <SiTiktok className={`${cls} text-black dark:text-white`} />;
    default:
      return <Store className={`${cls} text-muted-foreground`} />;
  }
}

export function StoreFilterDropdown({
  stores,
  selectedStoreIds,
  onToggleStore,
  onSelectAll,
  isAllSelected,
}: StoreFilterDropdownProps) {
  const [open, setOpen] = useState(false);

  if (stores.length <= 1) return null;

  const activeStores = stores.filter((s) => s.status === "active" || s.status === "connected");
  const displayStores = activeStores.length > 0 ? activeStores : stores;

  const label = isAllSelected
    ? "All Stores"
    : selectedStoreIds.length === 1
      ? displayStores.find((s) => s.id === selectedStoreIds[0])?.name || "1 Store"
      : `${selectedStoreIds.length} Stores`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-store-filter">
          <Store className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
          <Badge variant="secondary" className="ml-1 text-xs px-1.5 sm:hidden">
            {isAllSelected ? "All" : selectedStoreIds.length}
          </Badge>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" data-testid="popover-store-filter">
        <div className="flex items-center justify-between px-2 pb-2 border-b mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter by Store</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={onSelectAll}
            data-testid="button-store-filter-reset"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {isAllSelected ? "Reset" : "View All"}
          </Button>
        </div>
        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          {displayStores.map((store) => (
            <label
              key={store.id}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
              data-testid={`store-filter-option-${store.id}`}
            >
              <Checkbox
                checked={selectedStoreIds.includes(store.id)}
                onCheckedChange={() => onToggleStore(store.id)}
                data-testid={`checkbox-store-${store.id}`}
              />
              <PlatformIcon platform={store.platform} />
              <span className="text-sm truncate flex-1">{store.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

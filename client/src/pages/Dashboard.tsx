import { useDashboardStats } from "@/hooks/use-dashboard";
import { StatsCard } from "@/components/StatsCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  ShoppingBag,
  Store,
  Wallet,
  ArrowUpRight,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STORAGE_KEY = "dash-card-order";

const statCards = [
  { title: "Total Revenue", key: "totalRevenue", icon: DollarSign, fmt: "currency" },
  { title: "Total Orders", key: "totalOrders", icon: ShoppingBag, fmt: "number" },
  { title: "Active Listings", key: "activeListings", icon: Store, fmt: "number" },
  { title: "Wallet Balance", key: "walletBalance", icon: Wallet, fmt: "currency" },
  { title: "Out of Stock", key: "outOfStockProducts", icon: AlertTriangle, fmt: "number" },
] as const;

function statValue(stats: any, key: string, fmt: string): string {
  const val = stats?.[key] ?? 0;
  if (fmt === "currency") {
    const n = typeof val === "number" ? val : parseFloat(String(val));
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return Number(val).toString();
}

function statDesc(key: string, stats: any): string {
  if (key === "outOfStockProducts") {
    return (stats?.outOfStockProducts ?? 0) > 0 ? "Needs attention" : "All in stock";
  }
  if (key === "totalRevenue") return "+20.1% from last month";
  if (key === "totalOrders") return "+15% from last month";
  if (key === "activeListings") return "Across 3 stores";
  if (key === "walletBalance") return "Available for payout";
  return "";
}

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function SortableStatCard({
  id,
  stats,
  icon: Icon,
  title,
  value,
  description,
}: {
  id: string;
  stats: any;
  icon: any;
  title: string;
  value: string;
  description: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`drop-zone ${isDragging ? "dragging" : ""}`}
    >
      <StatsCard
        title={title}
        value={value}
        icon={Icon}
        description={description}
        dragHandle={
          <button
            className="p-2 -ml-2 touch-none cursor-grab active:cursor-grabbing hover:text-primary transition-colors"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        }
      />
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const [cardOrder, setCardOrder] = useState<string[]>(() => loadOrder());

  useEffect(() => {
    if (cardOrder.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cardOrder));
    }
  }, [cardOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const initialIds = statCards.map((c) => c.key);
  const order = cardOrder.length === statCards.length ? cardOrder : initialIds;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setCardOrder((prev) => {
          const ids = prev.length === statCards.length ? prev : initialIds;
          const oldIdx = ids.indexOf(active.id as string);
          const newIdx = ids.indexOf(over.id as string);
          return arrayMove(ids, oldIdx, newIdx);
        });
      }
    },
    [],
  );

  const mockChartData = [
    { name: "Mon", total: 1200 },
    { name: "Tue", total: 2100 },
    { name: "Wed", total: 1800 },
    { name: "Thu", total: 2400 },
    { name: "Fri", total: 3200 },
    { name: "Sat", total: 4500 },
    { name: "Sun", total: 3800 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-4 md:px-6 lg:px-0">
        <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Dashboard</h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 px-4 md:px-6 lg:px-0">
            {order.map((key) => {
              const card = statCards.find((c) => c.key === key);
              if (!card) return null;
              return (
                <SortableStatCard
                  key={card.key}
                  id={card.key}
                  stats={stats}
                  icon={card.icon}
                  title={card.title}
                  value={statValue(stats, card.key, card.fmt)}
                  description={statDesc(card.key, stats)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 px-4 md:px-6 lg:px-0">
        <Card className="lg:col-span-4 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[250px] md:h-[300px] lg:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 md:space-y-6">
              {[1, 2, 3, 4, 5].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center min-h-[44px] md:min-h-0"
                >
                  <div className="h-10 w-10 md:h-9 md:w-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <ArrowUpRight className="h-5 w-5 md:h-4 md:w-4 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4 space-y-1">
                    <p className="text-sm md:text-sm font-medium leading-none">New order received</p>
                    <p className="text-xs text-muted-foreground">
                      Order #ORD-{1000 + i} &bull; 2 min ago
                    </p>
                  </div>
                  <div className="ml-auto font-medium text-sm md:text-sm">+$29.00</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

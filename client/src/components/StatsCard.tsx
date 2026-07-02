import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, description, trend, className }: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border/60 hover:border-border hover:shadow-md transition-all duration-200", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
        <div className="p-1.5 bg-primary/8 rounded-lg">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-display tracking-tight">{value}</div>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

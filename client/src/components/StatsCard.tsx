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
  dragHandle?: React.ReactNode;
}

export function StatsCard({ title, value, icon: Icon, description, trend, className, dragHandle }: StatsCardProps) {
  return (
    <Card className={cn("transition-shadow duration-300", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1">
          {dragHandle}
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

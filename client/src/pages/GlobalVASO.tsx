import { Card, CardContent } from "@/components/ui/card";
import { Globe, TrendingUp, Package, DollarSign } from "lucide-react";

export default function GlobalVASO() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display">Global VASO</h1>
        <p className="text-muted-foreground mt-1">Value-Added Service Overview across all markets</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Services", value: "12", icon: Globe, color: "text-blue-500" },
          { label: "Total Revenue", value: "$45,230", icon: DollarSign, color: "text-green-500" },
          { label: "Orders This Month", value: "847", icon: Package, color: "text-amber-500" },
          { label: "Growth Rate", value: "+23%", icon: TrendingUp, color: "text-purple-500" },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl ${s.color.replace("text", "bg")}/10 flex items-center justify-center`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4">Regional Performance</h3>
            <div className="space-y-4">
              {[
                { region: "North America", orders: 342, revenue: "$18,230", flag: "🇺🇸" },
                { region: "Europe", orders: 285, revenue: "$15,400", flag: "🇪🇺" },
                { region: "Asia Pacific", orders: 156, revenue: "$8,900", flag: "🌏" },
                { region: "Middle East", orders: 64, revenue: "$2,700", flag: "🌍" },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{r.flag}</span>
                    <div>
                      <p className="text-sm font-medium">{r.region}</p>
                      <p className="text-xs text-muted-foreground">{r.orders} orders</p>
                    </div>
                  </div>
                  <span className="font-semibold">{r.revenue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4">Top Services</h3>
            <div className="space-y-4">
              {[
                { name: "Premium Support", usage: 89, revenue: "$12,400" },
                { name: "Express Shipping", usage: 76, revenue: "$9,800" },
                { name: "Product Photography", usage: 64, revenue: "$8,200" },
                { name: "Translation Services", usage: 45, revenue: "$5,100" },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <div className="w-32 h-1.5 rounded-full bg-muted-foreground/20 mt-1">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${s.usage}%` }} />
                    </div>
                  </div>
                  <span className="font-semibold text-sm">{s.revenue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
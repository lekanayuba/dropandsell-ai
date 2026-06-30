import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Users, ShoppingCart, DollarSign, Calendar } from "lucide-react";

export default function Customers() {
  const [search, setSearch] = useState("");

  const { data: customers, isLoading } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => { const r = await fetch("/api/customers", { credentials: "include" }); return r.json(); },
  });

  const list = (customers || []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCustomers = list.length;
  const totalRevenue = list.reduce((s: number, c: any) => s + c.totalSpent, 0);
  const avgOrderValue = totalCustomers > 0 ? (totalRevenue / list.reduce((s: number, c: any) => s + c.totalOrders, 0) || 0) : 0;

  if (isLoading) {
    return <div className="space-y-6"><h2 className="text-2xl md:text-3xl font-bold font-display">Customers</h2>{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">Customers</h2>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Customers</p><p className="text-xl font-bold">{(customers || []).length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">${totalRevenue.toFixed(2)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center"><ShoppingCart className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-sm text-muted-foreground">Avg Order Value</p><p className="text-xl font-bold">${avgOrderValue.toFixed(2)}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Orders</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Spent</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c: any, i: number) => (
                  <tr key={c.email} className="border-b border-border/20 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-medium">{c.name}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{c.email}</td>
                    <td className="py-3 px-4 text-right">{c.totalOrders}</td>
                    <td className="py-3 px-4 text-right font-medium">${c.totalSpent.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground hidden md:table-cell">
                      {c.lastOrder ? new Date(c.lastOrder).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">
                    {search ? 'No customers match your search' : 'No customers yet. Orders with customer emails will appear here.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const guides = [
  { title: "Getting Started with Dropshipping", desc: "Learn the basics of setting up your first dropshipping store", category: "Basics" },
  { title: "Connecting Marketplaces", desc: "How to connect eBay, Amazon, Shopify and more", category: "Integration" },
  { title: "Managing Inventory", desc: "Sync and manage your product inventory across all stores", category: "Inventory" },
  { title: "Order Fulfillment", desc: "Automate order processing and tracking", category: "Orders" },
  { title: "Wallet & Payments", desc: "Understanding deposits, withdrawals and fees", category: "Finance" },
  { title: "AI Price Optimization", desc: "Using AI to optimize your product pricing", category: "AI Features" },
];

export default function Manual() {
  const [search, setSearch] = useState("");
  const filtered = guides.filter(g => g.title.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display">Manual</h1>
        <p className="text-muted-foreground mt-1">Guides and documentation for using the platform</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search guides..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{g.category}</span>
              </div>
              <h3 className="font-semibold mb-1">{g.title}</h3>
              <p className="text-sm text-muted-foreground">{g.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
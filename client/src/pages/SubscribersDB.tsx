import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Search, Download, Mail, Calendar } from "lucide-react";

const mockSubscribers = [
  { email: "john@example.com", plan: "Pro", joined: "2025-01-15", status: "Active" },
  { email: "jane@example.com", plan: "Basic", joined: "2025-02-20", status: "Active" },
  { email: "bob@example.com", plan: "Enterprise", joined: "2025-03-10", status: "Active" },
  { email: "alice@example.com", plan: "Pro", joined: "2025-04-05", status: "Cancelled" },
];

export default function SubscribersDB() {
  const [search, setSearch] = useState("");
  const filtered = mockSubscribers.filter(s => s.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Subscriber's DB</h1>
          <p className="text-muted-foreground mt-1">Manage your subscriber database</p>
        </div>
        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by email..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length} subscribers</span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Mail className="h-3.5 w-3.5 inline mr-1" /> Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead><Calendar className="h-3.5 w-3.5 inline mr-1" /> Joined</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell>{s.plan}</TableCell>
                  <TableCell>{s.joined}</TableCell>
                  <TableCell><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.status === "Active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>{s.status}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
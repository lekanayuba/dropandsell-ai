import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Settings, RefreshCw, List, Globe, Clock } from "lucide-react";

export default function DrosellAutoListing() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">DROSEL Auto-Listing</h1>
          <p className="text-muted-foreground mt-1">Automatically list products across your marketplaces</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="auto-toggle">Active</Label>
          <Switch id="auto-toggle" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 space-y-3">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Marketplace Sync</h3>
            <p className="text-sm text-muted-foreground">Auto-list new products to connected stores</p>
            <Select disabled={!enabled} defaultValue="all">
              <SelectTrigger><SelectValue placeholder="Select markets" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="ebay">eBay</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Scheduling</h3>
            <p className="text-sm text-muted-foreground">Set intervals for automatic listing checks</p>
            <Select disabled={!enabled} defaultValue="hourly">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="realtime">Real-time</SelectItem>
                <SelectItem value="hourly">Every Hour</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Rules</h3>
            <p className="text-sm text-muted-foreground">Define pricing and category mapping rules</p>
            <Button variant="outline" size="sm" className="w-full" disabled={!enabled}>Configure Rules</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Auto-Listing Queue</h3>
            <Button size="sm" disabled={!enabled}><Play className="h-4 w-4 mr-2" />Run Now</Button>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <List className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No items in queue. Enable auto-listing above to start.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
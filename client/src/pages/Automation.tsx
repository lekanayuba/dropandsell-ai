import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useVendors } from "@/hooks/use-vendors";
import { useStores } from "@/hooks/use-stores";
import { useProducts } from "@/hooks/use-products";
import {
  usePricingRules,
  useCreatePricingRule,
  useUpdatePricingRule,
  useDeletePricingRule,
  useImportJobs,
  usePublishQueue,
  useDeleteFromPublishQueue,
  useUpdatePublishQueueItem,
  usePublishItems,
  useImportCSV,
  usePreviewCSV,
  useBulkAddToPublishQueue,
} from "@/hooks/use-automation";
import {
  Upload,
  Settings2,
  Send,
  Plus,
  Trash2,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

export default function Automation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("import");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Automation</h2>
          <p className="text-muted-foreground mt-2">
            Import products, set pricing rules, and publish to marketplaces
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="import" className="gap-2" data-testid="tab-import">
            <Upload className="w-4 h-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2" data-testid="tab-pricing">
            <Settings2 className="w-4 h-4" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="publish" className="gap-2" data-testid="tab-publish">
            <Send className="w-4 h-4" />
            Publish
          </TabsTrigger>
          <TabsTrigger value="vero" className="gap-2" data-testid="tab-vero">
            <ShieldAlert className="w-4 h-4" />
            VERO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <ImportSection />
        </TabsContent>

        <TabsContent value="pricing">
          <PricingRulesSection />
        </TabsContent>

        <TabsContent value="publish">
          <PublishSection />
        </TabsContent>

        <TabsContent value="vero">
          <VEROSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ImportSection() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [vendorId, setVendorId] = useState<string>("");
  const [preview, setPreview] = useState<{ headers: string[]; previewRows: string[][]; totalRows: number } | null>(null);

  const { data: vendors } = useVendors();
  const { data: importJobs, isLoading: jobsLoading } = useImportJobs();
  const importCSV = useImportCSV();
  const previewCSV = usePreviewCSV();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      try {
        const previewData = await previewCSV.mutateAsync(selectedFile);
        setPreview(previewData);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      const result = await importCSV.mutateAsync({
        file,
        vendorId: vendorId && vendorId !== "none" ? Number(vendorId) : undefined,
      });

      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.successCount} products${result.errorCount > 0 ? `, ${result.errorCount} errors` : ""}`,
      });

      setFile(null);
      setPreview(null);
      setVendorId("");
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            CSV Import
          </CardTitle>
          <CardDescription>
            Upload a CSV file with product data from your vendor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Vendor (Optional)</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger data-testid="select-vendor">
                <SelectValue placeholder="Choose a vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vendor</SelectItem>
                {vendors?.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>CSV File</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
                data-testid="input-csv-file"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium">
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">CSV files only (max 10MB)</p>
              </label>
            </div>
          </div>

          {preview && (
            <div className="space-y-2">
              <Label>Preview ({preview.totalRows} rows)</Label>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h, i) => (
                        <TableHead key={i} className="text-xs whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.previewRows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="text-xs truncate max-w-[150px]">
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!file || importCSV.isPending}
            className="w-full"
            data-testid="button-import-csv"
          >
            {importCSV.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Products
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>Recent import jobs and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : importJobs?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No imports yet</p>
          ) : (
            <div className="space-y-3">
              {importJobs?.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{job.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.successCount} imported, {job.errorCount} errors
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}
                  >
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PricingRulesSection() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  const { data: rules, isLoading } = usePricingRules();
  const { data: vendors } = useVendors();
  const createRule = useCreatePricingRule();
  const updateRule = useUpdatePricingRule();
  const deleteRule = useDeletePricingRule();

  const [formData, setFormData] = useState({
    name: "",
    ruleType: "markup",
    value: "",
    minPrice: "",
    maxPrice: "",
    applyToVendor: "all",
    priority: "0",
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      ruleType: "markup",
      value: "",
      minPrice: "",
      maxPrice: "",
      applyToVendor: "all",
      priority: "0",
      isActive: true,
    });
    setEditingRule(null);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        name: formData.name,
        ruleType: formData.ruleType,
        value: parseFloat(formData.value),
        minPrice: formData.minPrice ? parseFloat(formData.minPrice) : null,
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : null,
        applyToVendor: formData.applyToVendor && formData.applyToVendor !== "all" ? Number(formData.applyToVendor) : null,
        priority: parseInt(formData.priority),
        isActive: formData.isActive,
      };

      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, ...data });
        toast({ title: "Rule Updated", description: "Pricing rule has been updated" });
      } else {
        await createRule.mutateAsync(data);
        toast({ title: "Rule Created", description: "New pricing rule has been created" });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      ruleType: rule.ruleType,
      value: rule.value?.toString() || "",
      minPrice: rule.minPrice?.toString() || "",
      maxPrice: rule.maxPrice?.toString() || "",
      applyToVendor: rule.applyToVendor?.toString() || "all",
      priority: rule.priority?.toString() || "0",
      isActive: rule.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: "Rule Deleted", description: "Pricing rule has been deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pricing Rules</CardTitle>
          <CardDescription>
            Define markup, margin, or fixed price adjustments for your products
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-pricing-rule">
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Pricing Rule" : "Create Pricing Rule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Default 30% Markup"
                  data-testid="input-rule-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Type</Label>
                  <Select
                    value={formData.ruleType}
                    onValueChange={(v) => setFormData({ ...formData, ruleType: v })}
                  >
                    <SelectTrigger data-testid="select-rule-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markup">Markup %</SelectItem>
                      <SelectItem value="margin">Margin %</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder={formData.ruleType === "fixed" ? "e.g., 10.00" : "e.g., 30"}
                    data-testid="input-rule-value"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Price (Optional)</Label>
                  <Input
                    type="number"
                    value={formData.minPrice}
                    onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                    placeholder="e.g., 5.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Price (Optional)</Label>
                  <Input
                    type="number"
                    value={formData.maxPrice}
                    onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                    placeholder="e.g., 100.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Apply to Vendor (Optional)</Label>
                  <Select
                    value={formData.applyToVendor}
                    onValueChange={(v) => setFormData({ ...formData, applyToVendor: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All vendors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All vendors</SelectItem>
                      {vendors?.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    placeholder="Higher = applied first"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.value || createRule.isPending || updateRule.isPending}
                data-testid="button-save-pricing-rule"
              >
                {createRule.isPending || updateRule.isPending ? "Saving..." : "Save Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : rules?.length === 0 ? (
          <div className="text-center py-12">
            <Settings2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No pricing rules yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a rule to automatically calculate selling prices
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Constraints</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules?.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {rule.ruleType === "markup" ? "Markup" : rule.ruleType === "margin" ? "Margin" : "Fixed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rule.ruleType === "fixed" ? `£${rule.value}` : `${rule.value}%`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.minPrice && `Min: £${rule.minPrice}`}
                    {rule.minPrice && rule.maxPrice && " | "}
                    {rule.maxPrice && `Max: £${rule.maxPrice}`}
                    {!rule.minPrice && !rule.maxPrice && "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(rule)}
                        data-testid={`button-edit-rule-${rule.id}`}
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(rule.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-rule-${rule.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PublishSection() {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");

  const { data: queue, isLoading: queueLoading } = usePublishQueue();
  const { data: products } = useProducts({});
  const { data: stores } = useStores();
  const { data: rules } = usePricingRules();
  const deleteFromQueue = useDeleteFromPublishQueue();
  const updateQueueItem = useUpdatePublishQueueItem();
  const publishItems = usePublishItems();
  const bulkAddToQueue = useBulkAddToPublishQueue();

  const handleQuantityChange = (itemId: number, quantity: number) => {
    if (quantity < 1) quantity = 1;
    updateQueueItem.mutate({ id: itemId, quantity });
  };

  const handlePublish = async () => {
    if (selectedItems.length === 0) {
      toast({ title: "No items selected", description: "Please select items to publish", variant: "destructive" });
      return;
    }

    try {
      const result = await publishItems.mutateAsync(selectedItems);
      const successCount = result.results.filter((r: any) => r.status === "published").length;
      const failCount = result.results.filter((r: any) => r.status === "failed").length;

      toast({
        title: "Publishing Complete",
        description: `${successCount} published, ${failCount} failed`,
      });

      setSelectedItems([]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddToQueue = async () => {
    if (selectedProducts.length === 0 || !selectedStore) {
      toast({ title: "Missing selection", description: "Please select products and a store", variant: "destructive" });
      return;
    }

    try {
      const activeRule = rules?.find((r) => r.isActive);
      const items = selectedProducts.map((productId) => {
        const product = products?.items.find((p) => p.id === productId);
        const costPrice = Number(product?.costPrice || 0);
        let calculatedPrice = Number(product?.sellingPrice || costPrice);

        if (activeRule) {
          const ruleValue = Number(activeRule.value);
          switch (activeRule.ruleType) {
            case "markup":
              calculatedPrice = costPrice * (1 + ruleValue / 100);
              break;
            case "margin":
              calculatedPrice = costPrice / (1 - ruleValue / 100);
              break;
            case "fixed":
              calculatedPrice = costPrice + ruleValue;
              break;
          }
        }

        return {
          productId,
          storeId: Number(selectedStore),
          calculatedPrice: Math.round(calculatedPrice * 100) / 100,
          pricingRuleId: activeRule?.id,
          quantity: product?.quantity || 1,
          postageType: product?.deliveryType || 'buyer_pays',
          postageCost: product?.deliveryCost || undefined,
        };
      });

      await bulkAddToQueue.mutateAsync(items);
      toast({ title: "Added to Queue", description: `${items.length} products added to publish queue` });

      setIsAddDialogOpen(false);
      setSelectedProducts([]);
      setSelectedStore("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleItemSelection = (id: number) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const pendingItems = queue?.filter((q) => q.status === "pending") || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Publish Queue</CardTitle>
            <CardDescription>
              Products staged for publishing to your connected stores
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-to-queue">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Products
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Products to Publish Queue</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Store</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger data-testid="select-publish-store">
                        <SelectValue placeholder="Choose a store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores?.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.name} ({s.platform})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Products ({selectedProducts.length} selected)</Label>
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                      {products?.items.length === 0 ? (
                        <p className="p-4 text-center text-muted-foreground">No products available</p>
                      ) : (
                        products?.items.map((product) => (
                          <div
                            key={product.id}
                            className={`flex items-center justify-between p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                              selectedProducts.includes(product.id) ? "bg-primary/10" : ""
                            }`}
                            onClick={() => toggleProductSelection(product.id)}
                          >
                            <div>
                              <p className="font-medium text-sm">{product.title}</p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {product.sku} | Cost: £{Number(product.costPrice).toFixed(2)}
                              </p>
                            </div>
                            {selectedProducts.includes(product.id) && (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddToQueue}
                    disabled={selectedProducts.length === 0 || !selectedStore || bulkAddToQueue.isPending}
                    data-testid="button-confirm-add-to-queue"
                  >
                    {bulkAddToQueue.isPending ? "Adding..." : `Add ${selectedProducts.length} Products`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              onClick={handlePublish}
              disabled={selectedItems.length === 0 || publishItems.isPending}
              data-testid="button-publish-selected"
            >
              {publishItems.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Publish Selected ({selectedItems.length})
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queueLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : queue?.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Publish queue is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add products from your inventory to start publishing
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Postage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue?.map((item) => {
                  const product = products?.items.find((p) => p.id === item.productId);
                  const store = stores?.find((s) => s.id === item.storeId);

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.status === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-4 h-4 rounded border-input"
                            data-testid={`checkbox-queue-item-${item.id}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product?.title || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{product?.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{store?.name || "Unknown"}</Badge>
                      </TableCell>
                      <TableCell>£{Number(item.calculatedPrice).toFixed(2)}</TableCell>
                      <TableCell>
                        {item.status === "pending" ? (
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                            className="w-16 h-8 text-center"
                            data-testid={`input-quantity-${item.id}`}
                          />
                        ) : (
                          <Badge variant="outline">{item.quantity || 1}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className={
                            item.postageType === 'free' ? 'bg-green-500/10 text-green-600 border-green-200' :
                            item.postageType === 'seller_pays' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                            item.postageType === 'buyer_pays' ? 'bg-amber-500/10 text-amber-600 border-amber-200' :
                            'bg-muted text-muted-foreground'
                          }>
                            {item.postageType === 'free' ? 'Free' : 
                             item.postageType === 'seller_pays' ? 'Seller Pays' : 
                             item.postageType === 'buyer_pays' ? 'Buyer Pays' : 'Default'}
                          </Badge>
                          {item.postageType !== 'free' && (
                            <span className="text-xs text-muted-foreground">£{Number(item.postageCost || 0).toFixed(2)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "published"
                              ? "default"
                              : item.status === "failed"
                              ? "destructive"
                              : item.status === "publishing"
                              ? "secondary"
                              : "outline"
                          }
                          className="gap-1"
                        >
                          {item.status === "pending" && <Clock className="w-3 h-3" />}
                          {item.status === "publishing" && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {item.status === "published" && <CheckCircle2 className="w-3 h-3" />}
                          {item.status === "failed" && <XCircle className="w-3 h-3" />}
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteFromQueue.mutate(item.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-queue-item-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VEROSection() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    type: "brand",
    value: "",
    platform: "",
    reason: "",
  });

  const { data: veroList, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/vero-list"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof newItem) => {
      const res = await fetch("/api/vero-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add VERO item");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setIsAddDialogOpen(false);
      setNewItem({ type: "brand", value: "", platform: "", reason: "" });
      toast({ title: "Item added to VERO list" });
    },
    onError: () => {
      toast({ title: "Failed to add item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/vero-list/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Item removed from VERO list" });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/vero-list/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  const handleAddItem = () => {
    if (!newItem.value.trim()) {
      toast({ title: "Please enter a value", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      ...newItem,
      platform: newItem.platform || undefined,
    } as any);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-vero-list">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-vero-title">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              VERO List
            </CardTitle>
            <CardDescription data-testid="text-vero-description">
              Manage restricted brands and keywords to prevent listing violations
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-vero-item">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add VERO Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newItem.type}
                    onValueChange={(v) => setNewItem({ ...newItem, type: v })}
                  >
                    <SelectTrigger data-testid="select-vero-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brand">Brand</SelectItem>
                      <SelectItem value="keyword">Keyword</SelectItem>
                      <SelectItem value="sku">SKU Pattern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    value={newItem.value}
                    onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                    placeholder={
                      newItem.type === "brand" ? "e.g. Nike, Apple" :
                      newItem.type === "keyword" ? "e.g. replica, fake" :
                      "e.g. NIKE-*, APPLE*"
                    }
                    data-testid="input-vero-value"
                  />
                  {newItem.type === "sku" && (
                    <p className="text-xs text-muted-foreground">Use * as wildcard</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Platform (Optional)</Label>
                  <Select
                    value={newItem.platform}
                    onValueChange={(v) => setNewItem({ ...newItem, platform: v })}
                  >
                    <SelectTrigger data-testid="select-vero-platform">
                      <SelectValue placeholder="All platforms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All platforms</SelectItem>
                      <SelectItem value="ebay">eBay</SelectItem>
                      <SelectItem value="amazon">Amazon</SelectItem>
                      <SelectItem value="shopify">Shopify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Input
                    value={newItem.reason}
                    onChange={(e) => setNewItem({ ...newItem, reason: e.target.value })}
                    placeholder="e.g. Trademark protected"
                    data-testid="input-vero-reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-vero">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddItem}
                  disabled={addMutation.isPending}
                  data-testid="button-confirm-add-vero"
                >
                  {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Item
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-amber-500/10 border-amber-200 p-4 mb-6" data-testid="alert-vero-info">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">What is VERO?</p>
                <p className="text-sm text-amber-700 mt-1">
                  VERO (Verified Rights Owner Program) protects intellectual property on marketplaces like eBay.
                  Products matching items in this list will be blocked from publishing to prevent account suspensions.
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !veroList || veroList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-vero-empty">
              <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No VERO items added yet</p>
              <p className="text-sm mt-1">Add restricted brands or keywords to protect your account</p>
            </div>
          ) : (
            <Table data-testid="table-vero-list">
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veroList.map((item: any) => (
                  <TableRow key={item.id} data-testid={`row-vero-item-${item.id}`}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize" data-testid={`badge-vero-type-${item.id}`}>
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-vero-value-${item.id}`}>
                      {item.value}
                    </TableCell>
                    <TableCell data-testid={`text-vero-platform-${item.id}`}>
                      {item.platform ? (
                        <Badge variant="secondary" className="capitalize">
                          {item.platform}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">All</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-vero-reason-${item.id}`}>
                      {item.reason || "-"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={item.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: item.id, isActive: checked })
                        }
                        data-testid={`switch-vero-active-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-vero-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

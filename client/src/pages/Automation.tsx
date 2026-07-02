import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { useVendors } from "@/hooks/use-vendors";
import { useStores, useMarketplaceListings } from "@/hooks/use-stores";
import { useProducts } from "@/hooks/use-products";
import { useCurrency } from "@/hooks/use-currency";
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
  Filter,
  Mail,
  Phone,
  Globe,
  AtSign,
  Code,
  Ban,
  Scissors,
  Flame,
  Pill,
  Sparkles,
  Image as ImageIcon,
  Package,
  ExternalLink,
  Store,
  Search,
  Shield,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

export default function Automation() {
  const { toast } = useToast();
  const { symbol: currSym, format: fc } = useCurrency();
  const [activeTab, setActiveTab] = useState("import");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">Manual</h2>
          <p className="text-muted-foreground mt-2">
            Import products, set pricing rules, and publish to marketplaces
          </p>
        </div>
        <PageRefreshButton />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-[750px]">
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
          <TabsTrigger value="filters" className="gap-2" data-testid="tab-filters">
            <Filter className="w-4 h-4" />
            Filters
          </TabsTrigger>
          <TabsTrigger value="restricted" className="gap-2" data-testid="tab-restricted">
            <Ban className="w-4 h-4" />
            Restricted
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <div className="space-y-6">
            <VendorSiteImportSection />
            <ImportSection />
          </div>
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

        <TabsContent value="filters">
          <ContentFiltersSection />
        </TabsContent>

        <TabsContent value="restricted">
          <RestrictedProductsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VendorSiteImportSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { symbol: currSym, format: fc } = useCurrency();
  const { data: vendors } = useVendors();

  const [productData, setProductData] = useState({
    title: "",
    sku: "",
    costPrice: "",
    sellingPrice: "",
    vendorId: "",
    imageUrls: ["", "", "", ""],
    description: "",
  });
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageUrlChange = (index: number, value: string) => {
    const newUrls = [...productData.imageUrls];
    newUrls[index] = value;
    setProductData({ ...productData, imageUrls: newUrls });
  };

  const generateAIDescription = async () => {
    if (!productData.title) {
      toast({ title: "Error", description: "Product title is required to generate description", variant: "destructive" });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const vendorName = vendors?.find(v => v.id.toString() === productData.vendorId)?.name;
      const response = await apiRequest("POST", "/api/ai/generate-description", {
        productTitle: productData.title,
        productSku: productData.sku,
        vendorName,
        costPrice: productData.costPrice ? parseFloat(productData.costPrice) : undefined,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response. Please try again.');
      }
      const data = await response.json();
      setProductData({ ...productData, description: data.description });
      toast({ title: "Success", description: "AI description generated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate description", variant: "destructive" });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!productData.title) {
      toast({ title: "Error", description: "Product title is required", variant: "destructive" });
      return;
    }

    if (!productData.costPrice || !productData.sellingPrice) {
      toast({ title: "Error", description: "Cost price and selling price are required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const validImages = productData.imageUrls.filter(url => url.trim() !== "");
      const sku = productData.sku || `SKU-${Date.now()}`;
      
      await apiRequest("POST", "/api/products", {
        title: productData.title,
        sku: sku,
        description: productData.description || null,
        costPrice: productData.costPrice,
        sellingPrice: productData.sellingPrice,
        vendorId: productData.vendorId ? parseInt(productData.vendorId) : null,
        images: validImages.length > 0 ? validImages : null,
        quantity: 0,
      });

      toast({ title: "Success", description: "Product saved successfully" });
      setProductData({
        title: "",
        sku: "",
        costPrice: "",
        sellingPrice: "",
        vendorId: "",
        imageUrls: ["", "", "", ""],
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save product", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Vendor Site Import
        </CardTitle>
        <CardDescription>
          Manually import a product with AI-powered description generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Product Title *</Label>
            <Input
              value={productData.title}
              onChange={(e) => setProductData({ ...productData, title: e.target.value })}
              placeholder="Enter product title"
              data-testid="input-vendor-product-title"
            />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input
              value={productData.sku}
              onChange={(e) => setProductData({ ...productData, sku: e.target.value })}
              placeholder="Product SKU"
              data-testid="input-vendor-product-sku"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Cost Price ({currSym}) *</Label>
            <Input
              type="number"
              step="0.01"
              value={productData.costPrice}
              onChange={(e) => setProductData({ ...productData, costPrice: e.target.value })}
              placeholder="0.00"
              data-testid="input-vendor-cost-price"
            />
          </div>
          <div className="space-y-2">
            <Label>Selling Price ({currSym}) *</Label>
            <Input
              type="number"
              step="0.01"
              value={productData.sellingPrice}
              onChange={(e) => setProductData({ ...productData, sellingPrice: e.target.value })}
              placeholder="0.00"
              data-testid="input-vendor-selling-price"
            />
          </div>
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select value={productData.vendorId} onValueChange={(v) => setProductData({ ...productData, vendorId: v })}>
              <SelectTrigger data-testid="select-vendor-import">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors?.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Product Images (up to 4)
          </Label>
          <div className="grid gap-3 md:grid-cols-2">
            {productData.imageUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={url}
                  onChange={(e) => handleImageUrlChange(index, e.target.value)}
                  placeholder={`Image URL ${index + 1}`}
                  data-testid={`input-image-url-${index + 1}`}
                />
                {url && (
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-10 h-10 object-cover rounded border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Product Description</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={generateAIDescription}
              disabled={isGeneratingDescription || !productData.title}
              data-testid="button-generate-ai-description"
            >
              {isGeneratingDescription ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate with AI
                </>
              )}
            </Button>
          </div>
          <Textarea
            value={productData.description}
            onChange={(e) => setProductData({ ...productData, description: e.target.value })}
            placeholder="Enter product description or generate with AI"
            rows={5}
            data-testid="textarea-product-description"
          />
        </div>

        <Button
          onClick={handleSaveProduct}
          disabled={isSaving || !productData.title}
          className="w-full"
          data-testid="button-save-vendor-product"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Package className="w-4 h-4 mr-2" />
              Save Product
            </>
          )}
        </Button>
      </CardContent>
    </Card>
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
  const { symbol: currSym, format: fc } = useCurrency();
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
                    {rule.ruleType === "fixed" ? fc(rule.value) : `${rule.value}%`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.minPrice && `Min: ${fc(rule.minPrice)}`}
                    {rule.minPrice && rule.maxPrice && " | "}
                    {rule.maxPrice && `Max: ${fc(rule.maxPrice)}`}
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
  const { symbol: currSym, format: fc } = useCurrency();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");

  const { data: queue, isLoading: queueLoading } = usePublishQueue();
  const { data: products } = useProducts({});
  const { data: stores } = useStores();
  const { data: marketplaceListings } = useMarketplaceListings();
  const { data: rules } = usePricingRules();
  const deleteFromQueue = useDeleteFromPublishQueue();
  const updateQueueItem = useUpdatePublishQueueItem();
  const publishItems = usePublishItems();
  const bulkAddToQueue = useBulkAddToPublishQueue();

  const handleQuantityChange = (itemId: number, quantity: number) => {
    if (quantity < 1) quantity = 1;
    updateQueueItem.mutate({ id: itemId, quantity });
  };

  const [publishResults, setPublishResults] = useState<any[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  const handlePublish = async () => {
    if (user) {
      const subStatus = (user as any)?.subscriptionStatus;
      if (subStatus !== 'active' && subStatus !== 'trialing') {
        toast({ title: "Subscription required", description: "Please subscribe to a plan before publishing products", variant: "destructive" });
        navigate("/subscription");
        return;
      }
    }

    if (selectedItems.length === 0) {
      toast({ title: "No items selected", description: "Please select items to publish", variant: "destructive" });
      return;
    }

    try {
      const result = await publishItems.mutateAsync(selectedItems);
      const successCount = result.results.filter((r: any) => r.status === "published").length;
      const skippedCount = result.results.filter((r: any) => r.status === "skipped").length;
      const failCount = result.results.filter((r: any) => r.status === "failed").length;
      const totalOk = successCount + skippedCount;

      setPublishResults(result.results);
      setShowResultsDialog(true);

      if (failCount === 0) {
        toast({
          title: "All Published Successfully",
          description: `${successCount} item${successCount > 1 ? 's' : ''} published${skippedCount > 0 ? `, ${skippedCount} already listed` : ''}`,
        });
      } else {
        toast({
          title: "Publishing Complete",
          description: `${totalOk} published, ${failCount} failed — see details`,
          variant: failCount > 0 && totalOk === 0 ? "destructive" : "default",
        });
      }

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
      const targetStoreIds = selectedStore === "all"
        ? (stores || []).filter(s => s.status === 'active').map(s => s.id)
        : [Number(selectedStore)];

      if (targetStoreIds.length === 0) {
        toast({ title: "No active stores", description: "You have no active stores to publish to", variant: "destructive" });
        return;
      }

      let totalAdded = 0;
      let failedStores: string[] = [];

      for (const storeId of targetStoreIds) {
        const storeName = stores?.find(s => s.id === storeId)?.name || `Store ${storeId}`;
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
            storeId,
            calculatedPrice: Math.round(calculatedPrice * 100) / 100,
            pricingRuleId: activeRule?.id,
            quantity: product?.quantity || 1,
            postageType: product?.deliveryType || 'buyer_pays',
            postageCost: product?.deliveryCost || undefined,
          };
        });

        try {
          await bulkAddToQueue.mutateAsync(items);
          totalAdded += items.length;
        } catch (storeErr: any) {
          failedStores.push(`${storeName}: ${storeErr.message || 'Failed to add'}`);
        }
      }

      if (totalAdded > 0 && failedStores.length === 0) {
        const storeLabel = targetStoreIds.length > 1 ? `${targetStoreIds.length} stores` : 'publish queue';
        toast({ title: "Added to Queue", description: `${totalAdded} products added to ${storeLabel}` });
      } else if (totalAdded > 0 && failedStores.length > 0) {
        toast({ title: "Partially Added", description: `${totalAdded} added, some failed: ${failedStores.join('; ')}` });
      } else {
        toast({ title: "Failed to Add", description: failedStores.join('; ') || "Failed to add products to queue", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsAddDialogOpen(false);
      setSelectedProducts([]);
      setSelectedStore("");
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
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (open) { setSelectedStore(""); setSelectedProducts([]); } }}>
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
                        {(stores || []).filter(s => s.status === 'active').length > 1 && (
                          <SelectItem value="all">All Stores</SelectItem>
                        )}
                        {(stores || []).filter(s => s.status === 'active').map((s) => {
                          const ebayUser = (s.credentials as any)?.ebayUsername;
                          return (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.name} ({s.platform}){ebayUser ? ` — @${ebayUser}` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedStore && selectedStore !== "all" && (() => {
                    const store = stores?.find(s => s.id === Number(selectedStore));
                    const ebayUser = (store?.credentials as any)?.ebayUsername;
                    return (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-sm text-primary font-semibold">
                          Publishing to: {store?.name || selectedStore}
                        </p>
                        {ebayUser && (
                          <p className="text-xs text-primary/80 mt-1">
                            eBay account: @{ebayUser} (Store ID: {selectedStore})
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
                                SKU: {product.sku} | Cost: {fc(product.costPrice)}
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
                    {bulkAddToQueue.isPending ? "Adding..." : 
                      selectedStore && selectedStore !== "all"
                        ? `Add ${selectedProducts.length} to @${(stores?.find(s => s.id === Number(selectedStore))?.credentials as any)?.ebayUsername || stores?.find(s => s.id === Number(selectedStore))?.name || 'Store'}`
                        : `Add ${selectedProducts.length} Products`}
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
                  <TableHead>Links</TableHead>
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
                          <div className="flex flex-col gap-0.5">
                          <Badge variant="outline">{store?.name || "Unknown"}</Badge>
                          {store?.platform === 'ebay' && (store?.credentials as any)?.ebayUsername && (
                            <span className="text-xs text-muted-foreground">@{(store.credentials as any).ebayUsername}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{fc(item.calculatedPrice)}</TableCell>
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
                            <span className="text-xs text-muted-foreground">{fc(item.postageCost || 0)}</span>
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
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const sourceUrl = (product?.attributes as any)?.sourceUrl;
                            const vendorUrl = sourceUrl || (product as any)?.vendorWebsite || null;
                            if (vendorUrl) {
                              return (
                                <a
                                  href={vendorUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:underline"
                                  data-testid={`link-vendor-${item.id}`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Vendor
                                </a>
                              );
                            }
                            return null;
                          })()}
                          {item.status === "published" && (() => {
                            const listing = marketplaceListings
                              ?.filter((l: any) => l.productId === item.productId && l.storeId === item.storeId && l.status === "active" && l.listingUrl)
                              .sort((a: any, b: any) => (b.id || 0) - (a.id || 0))[0];
                            if (listing?.listingUrl) {
                              return (
                                <a
                                  href={listing.listingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  data-testid={`link-store-listing-${item.id}`}
                                >
                                  <Store className="w-3 h-3" />
                                  Store
                                </a>
                              );
                            }
                            return null;
                          })()}
                        </div>
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

      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publishing Results</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {publishResults.map((result: any, idx: number) => {
              const queueItem = queue?.find(q => q.id === result.id);
              const product = queueItem ? products?.items.find(p => p.id === queueItem.productId) : null;
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    result.status === "published" ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" 
                    : result.status === "skipped" ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
                    : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                  }`}
                  data-testid={`publish-result-${idx}`}
                >
                  {result.status === "published" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  ) : result.status === "skipped" ? (
                    <CheckCircle2 className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{product?.title || `Item #${result.id}`}</p>
                    {result.status === "published" && result.listingUrl && (
                      <a
                        href={result.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline break-all"
                        data-testid={`link-listing-${idx}`}
                      >
                        View on marketplace
                      </a>
                    )}
                    {result.status === "published" && result.ebayAccount && (
                      <p className="text-xs text-muted-foreground mt-0.5">Published to: @{result.ebayAccount}{result.storeName ? ` (${result.storeName})` : ''}</p>
                    )}
                    {result.status === "published" && result.externalId && (
                      <p className="text-xs text-muted-foreground mt-0.5">Listing ID: {result.externalId}</p>
                    )}
                    {result.status === "published" && (() => {
                      const sourceUrl = (product?.attributes as any)?.sourceUrl;
                      const vendorUrl = sourceUrl || (product as any)?.vendorWebsite || null;
                      if (vendorUrl) {
                        return (
                          <a
                            href={vendorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:underline mt-0.5"
                            data-testid={`link-vendor-result-${idx}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on vendor site
                          </a>
                        );
                      }
                      return null;
                    })()}
                    {result.status === "skipped" && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">{result.message}</p>
                    )}
                    {result.status === "failed" && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{result.message}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultsDialog(false)} data-testid="button-close-results">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

      <GlobalVeroDisplay />

      <ScanProductsCard />
    </div>
  );
}

function GlobalVeroDisplay() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: stats } = useQuery<{ total: number; active: number; brands: number; keywords: number }>({
    queryKey: ["/api/global-vero-list/stats"],
  });

  const { data: globalItems = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/global-vero-list"],
    enabled: expanded,
  });

  const filtered = globalItems.filter((item: any) =>
    !search || item.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card data-testid="card-global-vero">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base" data-testid="text-global-vero-title">
              <Shield className="h-5 w-5 text-primary" />
              Global VeRO Protection
            </CardTitle>
            <CardDescription>
              System-wide blocked brands and keywords — {stats?.active ?? 0} active entries ({stats?.brands ?? 0} brands, {stats?.keywords ?? 0} keywords)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-global-vero">
            {expanded ? "Hide" : "View List"}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search global VeRO list..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-global-vero"
              />
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="max-h-[300px] overflow-auto">
              <div className="flex flex-wrap gap-2">
                {filtered.map((item: any) => (
                  <Badge
                    key={item.id}
                    variant={item.type === "brand" ? "default" : "secondary"}
                    className="text-xs"
                    data-testid={`badge-global-vero-${item.id}`}
                  >
                    {item.value}
                  </Badge>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">No matching entries</p>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            These entries are managed by system administrators and cannot be edited. Your personal VeRO list above is checked in addition to this global list.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function ScanProductsCard() {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<any>(null);

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/vero-scan-products", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Scan failed");
      return res.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      if (data.blocked > 0) {
        toast({ title: `${data.blocked} products flagged`, description: `${data.scanned} products scanned`, variant: "destructive" });
      } else {
        toast({ title: "All products are clean", description: `${data.scanned} products scanned` });
      }
    },
    onError: () => {
      toast({ title: "Scan failed", variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-scan-products">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-5 w-5 text-primary" />
          Scan Products
        </CardTitle>
        <CardDescription>
          Check all your existing products against both personal and global VeRO lists
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          data-testid="button-scan-products"
        >
          {scanMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Scan All Products
            </>
          )}
        </Button>

        {scanResult && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold" data-testid="text-scanned-count">{scanResult.scanned}</p>
                <p className="text-xs text-muted-foreground">Scanned</p>
              </div>
              <div className="rounded-lg border p-3 text-center bg-green-50 dark:bg-green-950">
                <p className="text-2xl font-bold text-green-600" data-testid="text-clean-count">{scanResult.scanned - scanResult.blocked}</p>
                <p className="text-xs text-muted-foreground">Clean</p>
              </div>
              <div className="rounded-lg border p-3 text-center bg-red-50 dark:bg-red-950">
                <p className="text-2xl font-bold text-red-600" data-testid="text-blocked-count">{scanResult.blocked}</p>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </div>
            </div>
            {scanResult.blockedProducts?.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-3">
                <p className="font-medium text-red-800 dark:text-red-300 text-sm mb-2">Flagged Products:</p>
                <div className="space-y-1">
                  {scanResult.blockedProducts.map((p: any) => (
                    <div key={p.id} className="text-sm flex items-center gap-2" data-testid={`text-flagged-product-${p.id}`}>
                      <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                      <span className="truncate">{p.title}</span>
                      <span className="text-xs text-red-600 dark:text-red-400">({p.violations.join(", ")})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentFiltersSection() {
  const { toast } = useToast();
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [customPattern, setCustomPattern] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const { data: filters, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/content-filters"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { type: string; description?: string; pattern?: string }) => {
      const res = await fetch("/api/content-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add filter");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Content filter enabled" });
    },
    onError: () => {
      toast({ title: "Failed to enable filter", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/content-filters/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Content filter removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove filter", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/content-filters/${id}`, {
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
      toast({ title: "Failed to update filter", variant: "destructive" });
    },
  });

  const filterTypes = [
    { type: "email", label: "Email Addresses", icon: Mail, description: "Detects email addresses like name@domain.com" },
    { type: "phone", label: "Phone Numbers", icon: Phone, description: "Detects phone numbers in various formats" },
    { type: "url", label: "Website URLs", icon: Globe, description: "Detects website links and URLs" },
    { type: "social", label: "Social Media Handles", icon: AtSign, description: "Detects @username mentions" },
  ];

  const getActiveFilter = (type: string) => filters?.find(f => f.type === type && f.isActive);
  const getFilter = (type: string) => filters?.find(f => f.type === type);

  const handleToggleFilter = (type: string) => {
    const existingFilter = getFilter(type);
    if (existingFilter) {
      toggleMutation.mutate({ id: existingFilter.id, isActive: !existingFilter.isActive });
    } else {
      addMutation.mutate({ type, description: filterTypes.find(f => f.type === type)?.label });
    }
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-content-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-filters-title">
            <Filter className="h-5 w-5 text-primary" />
            Content Filters
          </CardTitle>
          <CardDescription data-testid="text-filters-description">
            Prevent personal information from being shared in product listings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-blue-500/10 border-blue-200 p-4 mb-6" data-testid="alert-filters-info">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-medium text-blue-800">Why filter personal information?</p>
                <p className="text-sm text-blue-700 mt-1">
                  Marketplaces like eBay and Amazon prohibit sharing seller or vendor contact information
                  in product listings to prevent off-platform transactions. Products with personal info
                  will be blocked from publishing.
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="grid gap-4">
              {filterTypes.map(({ type, label, icon: Icon, description }) => {
                const filter = getFilter(type);
                const isActive = filter?.isActive ?? false;
                
                return (
                  <div
                    key={type}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isActive ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                    }`}
                    data-testid={`card-filter-${type}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <h4 className="font-medium" data-testid={`text-filter-label-${type}`}>{label}</h4>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isActive && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">
                          Active
                        </Badge>
                      )}
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleFilter(type)}
                        disabled={toggleMutation.isPending || addMutation.isPending}
                        data-testid={`switch-filter-${type}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-custom-filters">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-custom-filters-title">
              <Code className="h-5 w-5" />
              Custom Filters
            </CardTitle>
            <CardDescription>
              Add custom patterns to detect specific text you want to block
            </CardDescription>
          </div>
          <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-custom-filter">
                <Plus className="mr-2 h-4 w-4" />
                Add Custom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Filter</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Pattern (Regex)</Label>
                  <Input
                    value={customPattern}
                    onChange={(e) => setCustomPattern(e.target.value)}
                    placeholder="e.g. \b(company|business)\s*name\b"
                    className="font-mono"
                    data-testid="input-custom-pattern"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a regular expression pattern to match text you want to block
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="e.g. Block company name mentions"
                    data-testid="input-custom-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)} data-testid="button-cancel-custom">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!customPattern.trim()) {
                      toast({ title: "Please enter a pattern", variant: "destructive" });
                      return;
                    }
                    addMutation.mutate({
                      type: "custom",
                      pattern: customPattern,
                      description: customDescription || undefined,
                    });
                    setCustomPattern("");
                    setCustomDescription("");
                    setIsCustomDialogOpen(false);
                  }}
                  disabled={addMutation.isPending}
                  data-testid="button-confirm-add-custom"
                >
                  {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Filter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {filters?.filter(f => f.type === 'custom').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-custom-empty">
              <Code className="h-10 w-10 mx-auto mb-4 opacity-20" />
              <p>No custom filters added yet</p>
              <p className="text-sm mt-1">Click "Add Custom" to create a regex pattern filter</p>
            </div>
          ) : (
            <Table data-testid="table-custom-filters">
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filters?.filter(f => f.type === 'custom').map((filter: any) => (
                  <TableRow key={filter.id} data-testid={`row-custom-filter-${filter.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-custom-pattern-${filter.id}`}>
                      {filter.pattern}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-custom-desc-${filter.id}`}>
                      {filter.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={filter.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: filter.id, isActive: checked })
                        }
                        data-testid={`switch-custom-active-${filter.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(filter.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-custom-${filter.id}`}
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

function RestrictedProductsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [category, setCategory] = useState<string>("sharp_objects");
  const [keyword, setKeyword] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [reason, setReason] = useState("");

  const { data: items, isLoading } = useQuery<any[]>({
    queryKey: ["/api/restricted-products"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { category: string; keyword: string; jurisdiction?: string; reason?: string }) => {
      const response = await fetch("/api/restricted-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add restricted product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restricted-products"] });
      toast({ title: "Restricted product added successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await fetch(`/api/restricted-products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restricted-products"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/restricted-products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restricted-products"] });
      toast({ title: "Item deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const categoryIcons: Record<string, any> = {
    sharp_objects: Scissors,
    chemicals: Flame,
    drugs: Pill,
    weapons: Ban,
    custom: AlertTriangle,
  };

  const categoryLabels: Record<string, string> = {
    sharp_objects: "Sharp Objects",
    chemicals: "Chemicals",
    drugs: "Drugs/Medications",
    weapons: "Weapons",
    custom: "Custom",
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-restricted-products">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-restricted-title">
              <Ban className="h-5 w-5" />
              Restricted Products
            </CardTitle>
            <CardDescription>
              Block dangerous or regulated items from being listed for regulatory compliance
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-restricted">
                <Plus className="mr-2 h-4 w-4" />
                Add Restriction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Restricted Product</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-restricted-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sharp_objects">Sharp Objects (knives, blades)</SelectItem>
                      <SelectItem value="chemicals">Chemicals (hazardous materials)</SelectItem>
                      <SelectItem value="drugs">Drugs/Medications</SelectItem>
                      <SelectItem value="weapons">Weapons</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Keyword to Block</Label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. knife, sword, machete"
                    data-testid="input-restricted-keyword"
                  />
                  <p className="text-xs text-muted-foreground">
                    Products containing this keyword in title or description will be blocked
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Jurisdiction (Optional)</Label>
                  <Input
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    placeholder="e.g. UK, EU, USA"
                    data-testid="input-restricted-jurisdiction"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Prohibited under UK law"
                    data-testid="input-restricted-reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-restricted">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!keyword.trim()) {
                      toast({ title: "Please enter a keyword", variant: "destructive" });
                      return;
                    }
                    addMutation.mutate({
                      category,
                      keyword: keyword.trim(),
                      jurisdiction: jurisdiction.trim() || undefined,
                      reason: reason.trim() || undefined,
                    });
                    setKeyword("");
                    setJurisdiction("");
                    setReason("");
                    setIsDialogOpen(false);
                  }}
                  disabled={addMutation.isPending}
                  data-testid="button-confirm-add-restricted"
                >
                  {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Restriction
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-restricted-empty">
              <Ban className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No restrictions configured</p>
              <p className="text-sm mt-1">Add keywords for products that cannot be listed</p>
            </div>
          ) : (
            <Table data-testid="table-restricted-products">
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => {
                  const Icon = categoryIcons[item.category] || AlertTriangle;
                  return (
                    <TableRow key={item.id} data-testid={`row-restricted-${item.id}`}>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Icon className="h-3 w-3" />
                          {categoryLabels[item.category] || item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-restricted-keyword-${item.id}`}>
                        {item.keyword}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.jurisdiction || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.reason || "-"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: item.id, isActive: checked })
                          }
                          data-testid={`switch-restricted-active-${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-restricted-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-restricted-info">
        <CardHeader>
          <CardTitle className="text-lg">About Restricted Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Products matching restricted keywords will be blocked from publishing to protect you from:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Scissors className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-sm">Sharp Objects</p>
                <p className="text-xs text-muted-foreground">Knives, blades, swords that may violate shipping policies</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Chemicals</p>
                <p className="text-xs text-muted-foreground">Hazardous materials, flammables, corrosives</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Pill className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Drugs/Medications</p>
                <p className="text-xs text-muted-foreground">Prescription items, controlled substances</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Ban className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Custom Rules</p>
                <p className="text-xs text-muted-foreground">Add your own restrictions for any category</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

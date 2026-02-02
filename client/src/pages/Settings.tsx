import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Copy, RefreshCw, Download, Chrome, Puzzle, Eye, EyeOff, Package, ShoppingCart, Tag } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: apiKeyData, isLoading } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/user/api-key"],
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user/api-key/regenerate");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user/api-key"], data);
      toast({
        title: "API Key Regenerated",
        description: "Your new API key has been generated. Update it in your browser extension.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate API key",
        variant: "destructive",
      });
    },
  });

  const copyApiKey = () => {
    if (apiKeyData?.apiKey) {
      navigator.clipboard.writeText(apiKeyData.apiKey);
      toast({
        title: "Copied!",
        description: "API key copied to clipboard",
      });
    }
  };

  const downloadExtension = () => {
    window.open("/extension.zip", "_blank");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Settings</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">Manage your account settings and browser extension</p>
      </div>

      <Card data-testid="card-extension">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            <CardTitle data-testid="text-extension-title">Browser Extension</CardTitle>
          </div>
          <CardDescription data-testid="text-extension-description">
            Import products directly from Amazon, AliExpress, and eBay with one click
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4" data-testid="section-install-guide">
            <h3 className="font-semibold mb-3 flex items-center gap-2" data-testid="text-install-title">
              <Chrome className="h-4 w-4" />
              How to Install
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground" data-testid="list-install-steps">
              <li>Download the extension files from the link below</li>
              <li>Unzip the downloaded file to a folder on your computer</li>
              <li>Open Chrome and go to <code className="bg-muted px-1 rounded">chrome://extensions</code></li>
              <li>Enable Developer mode (toggle in top right)</li>
              <li>Click Load unpacked and select the extension folder</li>
              <li>The DropandSell AI icon will appear in your browser toolbar</li>
            </ol>
          </div>

          <Button onClick={downloadExtension} className="w-full sm:w-auto" data-testid="button-download-extension">
            <Download className="mr-2 h-4 w-4" />
            Download Extension
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-api-key">
        <CardHeader>
          <CardTitle data-testid="text-api-key-title">API Key</CardTitle>
          <CardDescription data-testid="text-api-key-description">
            Use this key to connect the browser extension to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={isLoading ? "Loading..." : apiKeyData?.apiKey || ""}
                  readOnly
                  className="pr-10 font-mono"
                  data-testid="input-api-key"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                  data-testid="button-toggle-api-key"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" onClick={copyApiKey} data-testid="button-copy-api-key">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              data-testid="button-regenerate-api-key"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
              Regenerate Key
            </Button>
            <p className="text-xs text-muted-foreground" data-testid="text-regenerate-warning">
              Warning: This will disconnect all current extension sessions
            </p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-supported-websites">
        <CardHeader>
          <CardTitle data-testid="text-websites-title">Supported Websites</CardTitle>
          <CardDescription data-testid="text-websites-description">
            The extension can import products from these marketplaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border" data-testid="vendor-amazon">
              <Package className="h-6 w-6 text-orange-500" />
              <div>
                <div className="font-medium" data-testid="text-amazon-name">Amazon</div>
                <div className="text-xs text-muted-foreground" data-testid="text-amazon-domains">.com, .co.uk, .de, .fr</div>
              </div>
              <Badge variant="outline" className="ml-auto bg-green-500/10 text-green-600 border-green-200" data-testid="badge-amazon-status">Active</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border" data-testid="vendor-aliexpress">
              <ShoppingCart className="h-6 w-6 text-red-500" />
              <div>
                <div className="font-medium" data-testid="text-aliexpress-name">AliExpress</div>
                <div className="text-xs text-muted-foreground" data-testid="text-aliexpress-domains">aliexpress.com</div>
              </div>
              <Badge variant="outline" className="ml-auto bg-green-500/10 text-green-600 border-green-200" data-testid="badge-aliexpress-status">Active</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border" data-testid="vendor-ebay">
              <Tag className="h-6 w-6 text-blue-500" />
              <div>
                <div className="font-medium" data-testid="text-ebay-name">eBay</div>
                <div className="text-xs text-muted-foreground" data-testid="text-ebay-domains">.com, .co.uk</div>
              </div>
              <Badge variant="outline" className="ml-auto bg-green-500/10 text-green-600 border-green-200" data-testid="badge-ebay-status">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

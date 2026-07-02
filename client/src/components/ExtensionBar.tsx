import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Copy, Eye, EyeOff, Key, Link2, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildUserUniqueUrl } from "@/lib/utils";

export function ExtensionBar() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("das_ext_bar_collapsed") === "true";
    } catch { return false; }
  });

  const { data: apiKeyData } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/user/api-key"],
    enabled: !!isAuthenticated,
  });

  const { data: uniqueUrlData } = useQuery<{ uniqueUrl: string }>({
    queryKey: ["/api/user/unique-url"],
    enabled: !!isAuthenticated,
  });

  if (!isAuthenticated || !user?.onboardingCompleted || !user?.emailVerified || !user?.policiesAccepted) {
    return null;
  }

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("das_ext_bar_collapsed", String(next)); } catch {}
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  const urlCode = uniqueUrlData?.uniqueUrl || "";
  const apiKey = apiKeyData?.apiKey || "";
  const fullUniqueUrl = buildUserUniqueUrl(urlCode);

  return (
    <div className="sticky top-0 z-40 bg-primary/5 border-b border-primary/20 backdrop-blur-sm" data-testid="extension-bar">
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          onClick={toggleCollapse}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          data-testid="button-toggle-extension-bar"
        >
          <Key className="h-3.5 w-3.5" />
          <span>Extension Connect</span>
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
        {collapsed && (
          <span className="text-[10px] text-muted-foreground hidden sm:inline">Click to expand</span>
        )}
      </div>

      {!collapsed && (
        <div className="flex flex-wrap items-center gap-3 px-4 pb-2 text-xs">
          <div className="flex items-center gap-1.5" data-testid="ext-bar-unique-url">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Your URL:</span>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[11px] font-mono max-w-[200px] truncate">
              {fullUniqueUrl || "..."}
            </code>
            {fullUniqueUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => copyToClipboard(fullUniqueUrl, "Unique URL")}
                data-testid="ext-bar-copy-unique-url"
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5" data-testid="ext-bar-url-code">
            <Link2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">URL Code:</span>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[11px] font-mono max-w-[120px] truncate">
              {urlCode || "..."}
            </code>
            {urlCode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => copyToClipboard(urlCode, "URL Code")}
                data-testid="ext-bar-copy-url"
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5" data-testid="ext-bar-api-key">
            <Key className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">API Key:</span>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[11px] font-mono max-w-[140px] truncate">
              {apiKey ? (showApiKey ? apiKey : "••••••••••••") : "..."}
            </code>
            {apiKey && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowApiKey(!showApiKey)}
                  data-testid="ext-bar-toggle-key"
                >
                  {showApiKey ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => copyToClipboard(apiKey, "API Key")}
                  data-testid="ext-bar-copy-key"
                >
                  <Copy className="h-2.5 w-2.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

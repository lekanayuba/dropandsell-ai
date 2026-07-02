import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ShopifyCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const shop = params.get("shop");
    const state = params.get("state");

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code from Shopify");
      return;
    }

    const exchangeToken = async () => {
      try {
        const response = await fetch("/api/shopify/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, shop, state }),
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setStatus("success");
          setTimeout(() => {
            setLocation("/stores?shopify_success=true");
          }, 1500);
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Failed to connect Shopify store");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err?.message || "Failed to connect Shopify store");
      }
    };

    exchangeToken();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-shopify-callback">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Connecting your Shopify store...</h2>
              <p className="text-muted-foreground text-sm">Please wait while we finalize the connection.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">Shopify Connected!</h2>
              <p className="text-muted-foreground text-sm">Redirecting to your stores...</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Connection Failed</h2>
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
              <Button onClick={() => setLocation("/stores")} className="mt-2" data-testid="button-back-to-stores">
                Back to Stores
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

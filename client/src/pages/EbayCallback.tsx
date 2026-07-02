import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EbayCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusText, setStatusText] = useState("Connecting your eBay account...");

  useEffect(() => {
    function hideReplitBanner() {
      document.querySelectorAll('body > *').forEach(el => {
        if (el.id === 'root') return;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
        const htmlEl = el as HTMLElement;
        const html = el.outerHTML?.toLowerCase() || '';
        if (html.includes('replit') || html.includes('repl.co') || html.includes('repl.it') || html.includes('callback')) {
          if (htmlEl.tagName !== 'DIV' || !htmlEl.querySelector('[data-testid="page-ebay-callback"]')) {
            htmlEl.style.display = 'none';
            el.remove();
          }
        }
      });
      document.querySelectorAll('iframe').forEach(iframe => {
        const src = (iframe.src || '').toLowerCase();
        if (src.includes('replit') || src.includes('repl.co') || src.includes('pid.')) {
          iframe.style.display = 'none';
          iframe.remove();
        }
      });
      const banner = document.querySelector('[data-replit-metadata]');
      if (banner) { (banner as HTMLElement).style.display = 'none'; banner.remove(); }
    }
    hideReplitBanner();
    const interval = setInterval(hideReplitBanner, 200);
    const observer = new MutationObserver(hideReplitBanner);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { clearInterval(interval); observer.disconnect(); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setErrorMessage("eBay authorization was denied or failed");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code from eBay");
      return;
    }

    const exchangeToken = async () => {
      try {
        const response = await fetch("/api/ebay/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, state }),
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setStatus("success");
          setTimeout(() => {
            setLocation("/stores?ebay_success=true");
          }, 1500);
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Failed to connect eBay store");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err?.message || "Failed to connect eBay store");
      }
    };

    exchangeToken();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-ebay-callback">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">{statusText}</h2>
              <p className="text-muted-foreground text-sm">Please wait while we finalize the connection.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">eBay Connected!</h2>
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

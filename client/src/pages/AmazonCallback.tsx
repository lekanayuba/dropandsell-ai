import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { SiAmazon } from "react-icons/si";

export default function AmazonCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const code = params.get("code");
    const sellingPartnerId = params.get("selling_partner_id");
    const state = params.get("state");

    if (error) {
      setStatus("error");
      setMessage(error);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Missing authorization code from Amazon. Please try again.");
      return;
    }

    const exchangeToken = async () => {
      try {
        const response = await fetch("/api/amazon/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, sellingPartnerId, state }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(data.message || "Failed to connect Amazon store");
          return;
        }

        setStatus("success");
        setMessage(`Amazon store connected successfully! Seller ID: ${data.sellingPartnerId || "Connected"}`);

        setTimeout(() => setLocation("/stores"), 2500);
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "An unexpected error occurred");
      }
    };

    exchangeToken();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="card-amazon-callback">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${
              status === "loading" ? "bg-orange-100" :
              status === "success" ? "bg-green-100" : "bg-red-100"
            }`}>
              {status === "loading" ? (
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              ) : status === "success" ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
          </div>
          <CardTitle className="flex items-center justify-center gap-2" data-testid="text-callback-title">
            <SiAmazon className="w-5 h-5 text-orange-500" />
            {status === "loading" ? "Connecting Amazon..." :
             status === "success" ? "Amazon Connected!" : "Connection Failed"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="text-callback-message">
            {status === "loading"
              ? "Exchanging authorization tokens with Amazon Seller Central. Please wait..."
              : message}
          </p>
          {status === "success" && (
            <p className="text-xs text-muted-foreground">Redirecting to stores page...</p>
          )}
          {status === "error" && (
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setLocation("/stores")} data-testid="button-back-to-stores">
                Back to Stores
              </Button>
              <Button onClick={() => window.location.href = "/api/amazon/auth"} data-testid="button-retry-amazon">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

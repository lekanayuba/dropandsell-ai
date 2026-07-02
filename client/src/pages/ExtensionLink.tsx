import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Puzzle,
  ShieldCheck,
} from "lucide-react";
import dropandSellLogo from "@assets/Drop_1.jpg_1775119096004.jpeg";

type Status =
  | "loading"
  | "confirm"
  | "sending"
  | "success"
  | "no-extid"
  | "blocked"
  | "error";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: any,
          responseCallback?: (response: any) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

const EXT_ID_PATTERN = /^[a-p]{32}$/;

export default function ExtensionLink() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string>("");
  const [extId, setExtId] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("ext") || "";

    if (!id) {
      setStatus("no-extid");
      return;
    }

    // Sanity-check the extension id format. Real Chrome extension IDs are
    // 32 lowercase letters a-p. Reject anything else without making a
    // network call so we never hand credentials to garbage IDs.
    if (!EXT_ID_PATTERN.test(id)) {
      setStatus("blocked");
      setError("That extension ID does not look valid.");
      return;
    }

    setExtId(id);
    setStatus("confirm");
  }, []);

  const handleConnect = async () => {
    setStatus("sending");
    try {
      const res = await fetch(
        `/api/user/extension-credentials?ext=${encodeURIComponent(extId)}`,
        { credentials: "include" },
      );
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        setStatus("blocked");
        setError(
          body?.message ||
            "This extension is not authorized to connect to DropandSell.",
        );
        return;
      }
      if (!res.ok) {
        throw new Error("We could not load your account credentials.");
      }
      const creds = await res.json();

      if (!window.chrome?.runtime?.sendMessage) {
        setStatus("error");
        setError(
          "Your browser does not appear to support Chrome extensions, or the DropandSell extension is not installed.",
        );
        return;
      }

      window.chrome.runtime.sendMessage(
        extId,
        {
          type: "DROPANDSELL_CONNECT",
          payload: {
            apiUrl: creds.apiUrl,
            uniqueUrl: creds.uniqueUrl,
            apiKey: creds.apiKey,
          },
        },
        (response: any) => {
          const lastErr = window.chrome?.runtime?.lastError;
          if (lastErr) {
            setStatus("error");
            setError(
              "We could not reach the DropandSell extension. Please make sure it is installed and enabled in your browser, then try again.",
            );
            return;
          }
          if (response?.ok) {
            setStatus("success");
            setTimeout(() => {
              try {
                window.close();
              } catch (_) {
                // ignore — window.close only works for windows opened by script
              }
            }, 2500);
          } else {
            setStatus("error");
            setError(
              response?.message ||
                "The extension did not accept the connection. Please update to the latest version and try again.",
            );
          }
        },
      );
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/50 shadow-md">
        <CardContent className="p-8 text-center space-y-5">
          <div className="flex justify-center">
            <img
              src={dropandSellLogo}
              alt="DropandSell"
              className="h-14 w-14 rounded-lg object-contain"
              data-testid="img-extension-logo"
            />
          </div>

          {status === "loading" && (
            <>
              <h1
                className="text-xl font-semibold"
                data-testid="text-status-loading"
              >
                Loading…
              </h1>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </>
          )}

          {status === "confirm" && (
            <>
              <ShieldCheck className="w-12 h-12 mx-auto text-primary" />
              <h1
                className="text-xl font-semibold"
                data-testid="text-status-confirm"
              >
                Connect the DropandSell extension?
              </h1>
              <p className="text-sm text-muted-foreground">
                The browser extension below is asking to connect to your
                DropandSell account. Only continue if you started this from the
                extension you trust.
              </p>
              <div
                className="mx-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono break-all"
                data-testid="text-ext-id"
              >
                {extId}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => window.close()}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button onClick={handleConnect} data-testid="button-confirm">
                  Connect
                </Button>
              </div>
            </>
          )}

          {status === "sending" && (
            <>
              <h1
                className="text-xl font-semibold"
                data-testid="text-status-sending"
              >
                Linking the extension…
              </h1>
              <p className="text-sm text-muted-foreground">
                Sending your credentials to the DropandSell extension.
              </p>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
              <h1
                className="text-xl font-semibold"
                data-testid="text-status-success"
              >
                Extension connected!
              </h1>
              <p className="text-sm text-muted-foreground">
                You&apos;re all set. This tab will close automatically. You can
                now open the DropandSell extension on any vendor page to import
                products.
              </p>
              <Button
                onClick={() => window.close()}
                className="w-full"
                data-testid="button-close"
              >
                Close
              </Button>
            </>
          )}

          {status === "no-extid" && (
            <>
              <Puzzle className="w-12 h-12 mx-auto text-primary" />
              <h1
                className="text-xl font-semibold"
                data-testid="text-status-noextid"
              >
                Open this from the extension
              </h1>
              <p className="text-sm text-muted-foreground">
                To connect your account, click the DropandSell extension icon in
                your browser toolbar and press{" "}
                <strong>Sign in with DropandSell</strong>. If you don&apos;t
                have it yet, install it from the Chrome Web Store first.
              </p>
            </>
          )}

          {status === "blocked" && (
            <>
              <AlertTriangle className="w-12 h-12 mx-auto text-rose-500" />
              <h1
                className="text-xl font-semibold"
                data-testid="text-status-blocked"
              >
                Extension not allowed
              </h1>
              <p
                className="text-sm text-muted-foreground"
                data-testid="text-blocked-message"
              >
                {error ||
                  "This extension is not authorized to connect to DropandSell."}
              </p>
              <Button
                onClick={() => window.close()}
                className="w-full"
                data-testid="button-close-blocked"
              >
                Close
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
              <h1
                className="text-xl font-semibold"
                data-testid="text-status-error"
              >
                Couldn&apos;t connect
              </h1>
              <p
                className="text-sm text-muted-foreground"
                data-testid="text-error-message"
              >
                {error}
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
                data-testid="button-retry"
              >
                Try again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

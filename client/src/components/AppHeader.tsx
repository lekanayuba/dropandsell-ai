import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, Copy, Check, Eye, EyeOff, Plug, Link2, Hash, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@shared/routes";

function ConnectField({
  icon: Icon,
  label,
  value,
  displayValue,
  loading,
  testId,
  onReveal,
  revealed,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  displayValue?: string;
  loading?: boolean;
  testId: string;
  onReveal?: () => void;
  revealed?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: "Copied", description: `${label} copied to clipboard` });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually", variant: "destructive" });
    }
  };

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 py-1 pl-3 pr-1.5"
      data-testid={`field-${testId}`}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
        {label}
      </span>
      <span
        className="max-w-[120px] truncate font-mono text-[12px] text-foreground sm:max-w-[180px]"
        data-testid={`text-${testId}`}
        title={loading ? undefined : value}
      >
        {loading ? "…" : displayValue ?? value}
      </span>
      {onReveal && (
        <button
          type="button"
          onClick={onReveal}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
          data-testid={`button-reveal-${testId}`}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        disabled={loading || !value}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-40"
        aria-label={`Copy ${label}`}
        data-testid={`button-copy-${testId}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function AppHeader() {
  const { user } = useAuth();
  const [showKey, setShowKey] = useState(false);

  const { data: apiKeyData, isLoading: keyLoading } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/user/api-key"],
  });

  const { data: unread } = useQuery({
    queryKey: [api.notification.unreadCount.path],
    queryFn: async () => {
      const res = await fetch(api.notification.unreadCount.path, { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return (await res.json()) as { count: number };
    },
    refetchInterval: 60000,
  });

  const apiKey = apiKeyData?.apiKey ?? "";
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const urlCode = apiKey ? apiKey.replace(/^dfk_/, "").slice(0, 11) : "";
  const maskedKey = apiKey ? "•".repeat(Math.min(apiKey.length, 24)) : "";

  const unreadCount = unread?.count ?? 0;
  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.trim() ||
    (user?.email?.[0]?.toUpperCase() ?? "U");

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md sm:px-6 md:px-8"
      data-testid="app-header"
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto pl-12 sm:gap-3 sm:pl-0">
        <div className="flex flex-shrink-0 items-center gap-2 pr-1" data-testid="label-extension-connect">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plug className="h-4 w-4" />
          </span>
          <span className="hidden whitespace-nowrap font-display text-sm font-bold text-foreground md:inline">
            Extension Connect
          </span>
        </div>

        <ConnectField icon={Link2} label="Your URL" value={appUrl} testId="app-url" />
        <ConnectField icon={Hash} label="URL Code" value={urlCode} loading={keyLoading} testId="url-code" />
        <ConnectField
          icon={KeyRound}
          label="API Key"
          value={apiKey}
          displayValue={showKey ? apiKey : maskedKey}
          loading={keyLoading}
          testId="api-key"
          onReveal={() => setShowKey((s) => !s)}
          revealed={showKey}
        />
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <Link
          href="/notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
          data-testid="button-header-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-muted sm:pr-3"
          data-testid="link-header-profile"
        >
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={user?.profileImageUrl ?? undefined} alt="Your avatar" />
            <AvatarFallback className="bg-muted text-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 leading-tight lg:block">
            <p className="truncate text-[13px] font-medium text-foreground" data-testid="text-header-user-name">
              {`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Account"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground" data-testid="text-header-user-email">
              {user?.email}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}

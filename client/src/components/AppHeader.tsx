import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@shared/routes";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Your store performance at a glance" },
  "/getting-started": { title: "Getting Started", subtitle: "Set up your account step by step" },
  "/getstarted": { title: "Analytics", subtitle: "Track your growth and trends" },
  "/orders": { title: "Orders", subtitle: "Manage and fulfil customer orders" },
  "/shipping": { title: "Fulfilment", subtitle: "Shipping profiles and delivery" },
  "/stores": { title: "Stores", subtitle: "Connect and manage marketplaces" },
  "/vendors": { title: "Vendors", subtitle: "Your suppliers and product sources" },
  "/customers": { title: "Customers", subtitle: "People who buy from your stores" },
  "/inventory": { title: "Inventory", subtitle: "Products, stock and pricing" },
  "/bulk-edit": { title: "Bulk Edit", subtitle: "Update many products at once" },
  "/automation": { title: "Automation", subtitle: "Rules, filters and restrictions" },
  "/wallet": { title: "Wallet", subtitle: "Your balance and transactions" },
  "/referrals": { title: "Referrals", subtitle: "Earn by inviting other sellers" },
  "/subscription": { title: "Subscription", subtitle: "Your plan and billing" },
  "/addon-catalog": { title: "Add-ons", subtitle: "Extra features for your account" },
  "/drosell-auto-listing": { title: "DROSEL Auto-Listing", subtitle: "Automated product listing" },
  "/suggestions": { title: "Suggestions", subtitle: "Share ideas to improve the platform" },
  "/profile": { title: "Profile", subtitle: "Your personal details" },
  "/manual": { title: "Manual", subtitle: "Guides and how-tos" },
  "/faq": { title: "Help & FAQ", subtitle: "Answers to common questions" },
  "/policies": { title: "Policies", subtitle: "Legal and compliance documents" },
  "/settings": { title: "Settings", subtitle: "Manage your account preferences" },
  "/notifications": { title: "Notifications", subtitle: "Your latest alerts and updates" },
  "/temu": { title: "Temu Integration", subtitle: "Import products from Temu" },
  "/global-vaso": { title: "Global VeRO", subtitle: "Restricted brands and keywords" },
  "/subscribers-db": { title: "Subscribers DB", subtitle: "All platform subscribers" },
  "/admin": { title: "Admin Dashboard", subtitle: "Platform administration" },
  "/admin/support": { title: "Support Inbox", subtitle: "Respond to customer messages" },
};

export function AppHeader() {
  const [location] = useLocation();
  const { user } = useAuth();

  const meta = TITLES[location] ?? { title: "DropandSell", subtitle: "Automation Platform" };

  const { data: unread } = useQuery({
    queryKey: [api.notification.unreadCount.path],
    queryFn: async () => {
      const res = await fetch(api.notification.unreadCount.path, { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return (await res.json()) as { count: number };
    },
    refetchInterval: 60000,
  });

  const unreadCount = unread?.count ?? 0;
  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.trim() ||
    (user?.email?.[0]?.toUpperCase() ?? "U");

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md sm:px-6 md:px-8"
      data-testid="app-header"
    >
      <div className="min-w-0 pl-12 sm:pl-0">
        <h1
          className="truncate font-display text-lg font-bold leading-tight text-foreground sm:text-xl"
          data-testid="text-page-title"
        >
          {meta.title}
        </h1>
        <p className="hidden truncate text-[13px] text-muted-foreground sm:block" data-testid="text-page-subtitle">
          {meta.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
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
          <div className="hidden min-w-0 leading-tight sm:block">
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

import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Package, 
  PackageOpen,
  ShoppingCart, 
  Wallet, 
  CreditCard,
  Zap,
  LogOut,
  Settings,
  Menu,
  HelpCircle,
  Shield,
  Gift,
  Bell,
  Globe,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count ?? 0;

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/stores", label: "Stores", icon: Store },
    { href: "/vendors", label: "Vendors", icon: Users },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/orders", label: "Orders", icon: ShoppingCart },
    { href: "/automation", label: "Automation", icon: Zap },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { href: "/addon-catalog", label: "Catalog", icon: PackageOpen },
    { href: "/temu", label: "Temu", icon: Globe },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/referrals", label: "Referrals", icon: Gift },
    { href: "/subscription", label: "Subscription", icon: CreditCard },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
    { href: "/policies", label: "Policies", icon: Shield },
    { href: "/admin/support", label: "Support Inbox", icon: MessageSquare },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold font-display bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            DropandSell AI
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Automation Platform</p>
      </div>

      <div className="flex-1 py-6 px-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          return (
            <Link key={link.href} href={link.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group min-h-[44px]",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="truncate">{link.label}</span>
                {(link as any).badge > 0 && (
                  <Badge className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs" variant="default">
                    {(link as any).badge}
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-4 py-3.5 mb-2 min-h-[44px]">
          <Avatar className="h-10 w-10 md:h-9 md:w-9 border border-border shrink-0">
            <AvatarImage src={user?.profileImageUrl ?? undefined} />
            <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-72 fixed inset-y-0 left-0 z-30">
        <NavContent />
      </div>
    </>
  );
}

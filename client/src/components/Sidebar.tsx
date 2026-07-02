import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureAccess } from "@/hooks/use-feature-flags";

import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Package, 
  BarChart3, 
  Wallet, 
  CreditCard,
  Zap,
  LogOut,
  Settings,
  Menu,
  HelpCircle,
  Shield,
  Gift,
  UserCircle,
  Puzzle,
  Lightbulb,
  ShoppingCart,
  Truck,
  Rocket,
  ShoppingBag,
  ChevronRight
} from "lucide-react";
import dropandSellLogo from "@assets/Drop_1.jpg_1775119096004.jpeg";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { hasAccess: hasFulfillmentAccess } = useFeatureAccess('auto_fulfillment');
  const { hasAccess: hasDropAndSellAccess } = useFeatureAccess('drop_and_sell');

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/getting-started", label: "Getting Started", icon: Rocket },
    ...(hasFulfillmentAccess
      ? [
          { href: "/orders", label: "Orders", icon: ShoppingCart },
          { href: "/fulfillment", label: "Fulfillment", icon: Truck },
        ]
      : []),
    { href: "/stores", label: "Stores", icon: Store },
    { href: "/vendors", label: "Vendors", icon: Users },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/automation", label: "Manual", icon: Zap },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/referrals", label: "Referrals", icon: Gift },
    { href: "/subscription", label: "Subscription", icon: CreditCard },
    { href: "/addons", label: "Add-ons", icon: Puzzle },
    ...(hasDropAndSellAccess ? [{ href: "/drop-and-sell", label: "DROSEL Auto-Listing", icon: ShoppingBag }] : []),
    { href: "/suggestions", label: "Suggestions", icon: Lightbulb },
    { href: "/profile", label: "Profile", icon: UserCircle },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
    { href: "/policies", label: "Policies", icon: Shield },
    { href: "/settings", label: "Settings", icon: Settings },
    ...(user?.isAdmin === "true" || user?.email === "dropandsellauth@gmail.com"
      ? [
          { href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
        ]
      : []),
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full" style={{ background: 'hsl(var(--sidebar-bg))' }}>
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className="flex items-center gap-2.5">
          <img src={dropandSellLogo} alt="DropandSell Automation App" className="h-10 w-10 rounded-lg object-contain" style={{ filter: 'brightness(1.1)' }} data-testid="img-app-logo" />
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-white font-display">DropandSell</span>
            <p className="text-[11px] leading-tight" style={{ color: 'hsl(var(--sidebar-muted))' }}>Automation Platform</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          return (
            <Link key={link.href} href={link.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-150 cursor-pointer group relative",
                  isActive
                    ? "text-white"
                    : "hover:text-white"
                )}
                style={{
                  background: isActive ? 'hsl(var(--sidebar-active) / 0.18)' : undefined,
                  color: isActive ? 'hsl(var(--sidebar-active))' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'hsl(var(--sidebar-hover))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '';
                  }
                }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: 'hsl(var(--sidebar-active))' }} />
                )}
                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: isActive ? 'hsl(var(--sidebar-active))' : 'hsl(var(--sidebar-muted))' }} />
                <span style={{ color: isActive ? 'white' : 'hsl(var(--sidebar-fg))' }}>{link.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="px-3 py-3 border-t" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
          <Avatar className="h-8 w-8 border-2" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
            <AvatarImage src={user?.profileImageUrl} />
            <AvatarFallback className="text-xs font-medium bg-primary/20 text-primary">{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate text-white">{user?.firstName} {user?.lastName}</p>
            <p className="text-[11px] truncate" style={{ color: 'hsl(var(--sidebar-muted))' }}>{user?.email}</p>
          </div>
        </div>
        <button 
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer"
          style={{ color: 'hsl(var(--sidebar-muted))' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'hsl(0 63% 40% / 0.15)';
            e.currentTarget.style.color = 'hsl(0 80% 65%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '';
            e.currentTarget.style.color = 'hsl(var(--sidebar-muted))';
          }}
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
        <div className="mt-2 px-1">
          <LanguageSwitcher variant="sidebar" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shadow-lg">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px]">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden lg:block w-[260px] fixed inset-y-0 left-0 z-30 shadow-2xl">
        <NavContent />
      </div>
    </>
  );
}

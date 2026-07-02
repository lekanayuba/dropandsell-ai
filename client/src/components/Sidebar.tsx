import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { User as AuthUser } from "@shared/models/auth";
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Package, 
  PackageOpen,
  ShoppingCart, 
  Wallet, 
  CreditCard,
  LogOut,
  Settings,
  Menu,
  HelpCircle,
  Shield,
  Gift,
  Truck,
  BarChart3,
  BookOpen,
  Lightbulb,
  User,
  List,
  Rocket,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import dropandSellLogo from "@assets/Drop_1.jpg_1775119096004.jpeg";

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

const baseLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/getstarted", label: "Getting Started", icon: Rocket },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/shipping", label: "Fulfillment", icon: Truck },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/vendors", label: "Vendors", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/manual", label: "Manual", icon: BookOpen },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/referrals", label: "Referrals", icon: Gift },
  { href: "/subscription", label: "Subscription", icon: CreditCard },
  { href: "/addon-catalog", label: "Add-ons", icon: PackageOpen },
  { href: "/drosell-auto-listing", label: "DROSEL Auto-Listing", icon: List },
  { href: "/suggestions", label: "Suggestions", icon: Lightbulb },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/policies", label: "Policies", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminLinks: NavLink[] = [
  { href: "/global-vaso", label: "Global VeRO", icon: Shield },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const links = isAdmin ? [...baseLinks, ...adminLinks] : baseLinks;

  const renderLink = (link: NavLink, isMobile: boolean = false) => {
    const Icon = link.icon;
    const isActive = location === link.href;
    const testId = `link-nav-${link.href === "/" ? "dashboard" : link.href.replace(/\//g, "-").replace(/^-/, "")}`;
    const LinkContent = (
      <a
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors",
          isActive
            ? "bg-white/10 text-white"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        )}
        data-testid={testId}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-primary" : "text-slate-400")} />
        <span>{link.label}</span>
      </a>
    );

    if (isMobile) {
      return (
        <SheetClose asChild key={link.href}>
          <Link href={link.href}>{LinkContent}</Link>
        </SheetClose>
      );
    }

    return (
      <Link href={link.href} key={link.href}>
        {LinkContent}
      </Link>
    );
  };

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
        <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo-home">
          <img
            src={dropandSellLogo}
            alt="DropandSell"
            className="h-9 w-9 rounded-lg object-contain"
            data-testid="img-app-logo"
          />
          <div className="leading-tight">
            <span className="block text-[15px] font-display font-bold text-white">DropandSell</span>
            <span className="block text-[11px] text-slate-400">Automation Platform</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <nav className="grid gap-0.5 px-3">
          {links.map(link => renderLink(link, isMobile))}
        </nav>
      </div>

      <UserMenu user={user ?? null} onLogout={logout} isAdmin={isAdmin} />
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0" data-testid="button-open-menu">
              <Menu className="w-5 h-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0 w-[280px] border-slate-800">
            <NavContent isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-10 lg:block w-[280px] border-r border-slate-800">
        <NavContent />
      </div>
    </>
  );
}

function UserMenu({ user, onLogout, isAdmin }: { user: AuthUser | null, onLogout: () => void, isAdmin: boolean }) {
  return (
    <div className="mt-auto border-t border-slate-800 p-3">
      <div className="mb-2 flex items-center gap-2.5 px-2 py-1.5">
        <Avatar className="h-9 w-9 border border-slate-700">
          <AvatarImage src={user?.profileImageUrl ?? undefined} alt="User avatar" />
          <AvatarFallback className="bg-slate-800 text-slate-200">{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white" data-testid="text-user-name">
            {isAdmin ? "Admin Zone" : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Account"}
          </p>
          <p className="truncate text-[11px] text-slate-400" data-testid="text-user-email">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
        data-testid="button-logout"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign Out</span>
      </button>
      <div className="mt-1 flex items-center gap-2 px-3 py-1.5 text-[12px] text-slate-500">
        <Globe className="h-3.5 w-3.5" />
        <span>English</span>
      </div>
    </div>
  );
}

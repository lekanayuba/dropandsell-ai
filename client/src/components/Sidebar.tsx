import { Link, useLocation } from "wouter";
import { useAuth, User as AuthUser } from "@/hooks/use-auth";
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
  Truck,
  BarChart3,
  BookOpen,
  Lightbulb,
  User,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  featured?: boolean;
}

interface NavGroup {
  title: string;
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    title: "Store",
    links: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/shipping", label: "Fulfillment", icon: Truck },
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Tools",
    links: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/stores", label: "Stores", icon: Store },
      { href: "/vendors", label: "Vendors", icon: Users },
      { href: "/addon-catalog", label: "Add-ons", icon: PackageOpen },
      { href: "/drosell-auto-listing", label: "DROSEL Auto-Listing", icon: List },
      { href: "/suggestions", label: "Suggestions", icon: Lightbulb },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/wallet", label: "Wallet", icon: Wallet },
      { href: "/subscription", label: "Subscription", icon: CreditCard },
      { href: "/referrals", label: "Referrals", icon: Gift },
      { href: "/profile", label: "Profile", icon: User },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/manual", label: "Manual", icon: BookOpen },
      { href: "/faq", label: "FAQ", icon: HelpCircle },
      { href: "/policies", label: "Policies", icon: Shield },
    ],
  },
];


export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const renderLink = (link: NavLink, isMobile: boolean = false) => {
    const Icon = link.icon;
    const isActive = location === link.href;
    const LinkContent = (
      <a
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          link.featured && "text-primary font-semibold"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{link.label}</span>
        {link.featured && !isActive && (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-primary/80">
            Start
          </span>
        )}
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
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <PackageOpen className="h-6 w-6 text-primary" />
          <span className="text-lg font-display font-bold">
            DropandSell AI
          </span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start gap-4 p-4 text-sm font-medium">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                {group.title}
              </h3>
              {group.links.map(link => renderLink(link, isMobile))}
            </div>
          ))}

        </nav>
      </div>
      <UserMenu user={user} onLogout={logout} />
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <Menu className="w-5 h-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
            <NavContent isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-10 lg:block w-[280px] border-r bg-card">
        <NavContent />
      </div>
    </>
  );
}

function UserMenu({ user, onLogout }: { user: AuthUser | null, onLogout: () => void }) {
  return (
    <div className="mt-auto border-t p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-9 w-9 border">
          <AvatarImage src={user?.profileImageUrl ?? undefined} alt="User avatar" />
          <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>
      <Button variant="outline" className="w-full justify-start gap-2" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        <span>Sign Out</span>
      </Button>
    </div>
  );
}
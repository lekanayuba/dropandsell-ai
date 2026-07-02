import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { DatabaseZap, Shield, Wallet, Lightbulb, UserX, ChevronRight, LayoutDashboard, MessageSquare } from "lucide-react";

const ADMIN_TOOLS = [
  {
    href: "/admin/subscribers",
    label: "Subscribers DB",
    description: "Manage users, revenue, feature flags and referrals.",
    icon: DatabaseZap,
    testid: "link-admin-subscribers",
  },
  {
    href: "/admin/global-vero",
    label: "Global VeRO",
    description: "Block high-risk brands across every seller account.",
    icon: Shield,
    testid: "link-admin-global-vero",
  },
  {
    href: "/admin/paypal-payouts",
    label: "PayPal Payouts",
    description: "Track and settle partner payout accruals.",
    icon: Wallet,
    testid: "link-admin-paypal-payouts",
  },
  {
    href: "/admin/support",
    label: "Live Support",
    description: "Reply to customer chat messages in real time.",
    icon: MessageSquare,
    testid: "link-admin-support",
  },
  {
    href: "/suggestions",
    label: "Suggestions & Feedback",
    description: "Review and respond to feature requests and reports.",
    icon: Lightbulb,
    testid: "link-admin-suggestions",
  },
];

export default function AdminHub() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === "true" || user?.email === "dropandsellauth@gmail.com";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="admin-access-denied">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <UserX className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500" data-testid="page-admin-hub">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <LayoutDashboard className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage your platform from one place.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} href={tool.href} data-testid={tool.testid}>
              <Card className="group cursor-pointer transition-colors hover:border-primary/50 h-full">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{tool.label}</h3>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

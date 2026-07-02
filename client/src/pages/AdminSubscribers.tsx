import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CreditCard, UserCheck, UserX, Search, Download, Loader2, DollarSign, TrendingUp, Globe, BarChart3, PieChart as PieChartIcon, Calendar, RefreshCw, Mail, Send, CheckCircle2, Shield, ToggleLeft, ChevronDown, ChevronRight, Link2, Copy, Trash2, Wallet, Check, X, Clock, Banknote, Briefcase } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useState, useMemo, Fragment } from "react";
import { useToast } from "@/hooks/use-toast";
import { downloadExcel } from "@/lib/export-excel";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from "recharts";

interface ReferredUser {
  id: number;
  referredEmail: string;
  referredName: string;
  status: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  totalEarnings: string;
  commission: number;
  createdAt: string | null;
}

interface Subscriber {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  billingInterval: string;
  currency: string | null;
  createdAt: string | null;
  onboardingCompleted: string | null;
  paymentSkipped: string | null;
  freeAccess?: boolean;
  activeAddons?: { addonId: string; purchasedAt: string | null }[];
  freeAddons?: boolean;
  referralCode: string;
  referralLink: string;
  referredUsers: ReferredUser[];
  referredByEmail: string;
  isFreelanceLister?: boolean;
}

const PLAN_PRICES: Record<string, number> = {
  "Starter Plan": 12,
  "Basic Plan": 20,
  "Growth Plan": 35,
  "Professional Plan": 50,
  "Business Plan": 75,
  "Enterprise Plan": 100,
};

const YEARLY_DISCOUNT = 0.10;

function getSubscriberPlanRevenue(s: Subscriber): number {
  if (!s.subscriptionPlan || !s.subscriptionStatus || s.subscriptionStatus !== 'active' || s.freeAccess) return 0;
  const monthlyPrice = PLAN_PRICES[s.subscriptionPlan] || 0;
  if (s.billingInterval === 'year') {
    return Math.round(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100;
  }
  return monthlyPrice;
}

const ADDON_PRICE = 3.99;

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

export default function AdminSubscribers() {
  const { user } = useAuth();
  const { format: fc } = useCurrency();
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedRefs, setExpandedRefs] = useState<Set<number>>(new Set());
  const [detailSubscriber, setDetailSubscriber] = useState<Subscriber | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<"daily" | "weekly" | "monthly">("daily");

  const isAdmin = user?.isAdmin === "true" || user?.email === "dropandsellauth@gmail.com";
  const { toast } = useToast();
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; totalUsers: number } | null>(null);

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-update-broadcast");
      return res.json();
    },
    onSuccess: (data: any) => {
      setBroadcastResult({ sent: data.sent, failed: data.failed, totalUsers: data.totalUsers });
      toast({
        title: "Broadcast sent",
        description: `Update email sent to ${data.sent} of ${data.totalUsers} users.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Broadcast failed",
        description: err.message || "Could not send update emails.",
        variant: "destructive",
      });
    },
  });

  const [apologyResult, setApologyResult] = useState<{ sent: number; failed: number; totalUsers: number } | null>(null);

  const apologyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-banner-apology");
      return res.json();
    },
    onSuccess: (data: any) => {
      setApologyResult({ sent: data.sent, failed: data.failed, totalUsers: data.totalUsers });
      toast({
        title: "Apology emails sent",
        description: `Service disruption apology sent to ${data.sent} of ${data.totalUsers} users.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Apology broadcast failed",
        description: err.message || "Could not send apology emails.",
        variant: "destructive",
      });
    },
  });

  const [veroApologyResult, setVeroApologyResult] = useState<{ sent: number; failed: number; totalUsers: number } | null>(null);

  const veroApologyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-vero-update-apology");
      return res.json();
    },
    onSuccess: (data: any) => {
      setVeroApologyResult({ sent: data.sent, failed: data.failed, totalUsers: data.totalUsers });
      toast({
        title: "VeRO apology emails sent",
        description: `VeRO update apology sent to ${data.sent} of ${data.totalUsers} users.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "VeRO apology broadcast failed",
        description: err.message || "Could not send VeRO apology emails.",
        variant: "destructive",
      });
    },
  });

  const [addonApologyResult, setAddonApologyResult] = useState<{ sent: number; failed: number; totalUsers: number } | null>(null);

  const addonApologyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-addon-issue-apology");
      return res.json();
    },
    onSuccess: (data: any) => {
      setAddonApologyResult({ sent: data.sent, failed: data.failed, totalUsers: data.totalUsers });
      toast({
        title: "Add-on apology emails sent",
        description: `Apology sent to ${data.sent} of ${data.totalUsers} add-on subscribers.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Add-on apology broadcast failed",
        description: err.message || "Could not send add-on apology emails.",
        variant: "destructive",
      });
    },
  });

  const [withdrawalBroadcastResult, setWithdrawalBroadcastResult] = useState<{ sent: number; failed: number; totalUsers: number } | null>(null);

  const withdrawalBroadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-withdrawal-process-broadcast");
      return res.json();
    },
    onSuccess: (data: any) => {
      setWithdrawalBroadcastResult({ sent: data.sent, failed: data.failed, totalUsers: data.totalUsers });
      toast({
        title: "Withdrawal process emails sent",
        description: `Sent to ${data.sent} of ${data.totalUsers} users.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Broadcast failed",
        description: err.message || "Could not send emails.",
        variant: "destructive",
      });
    },
  });

  const [noPlanReminderResult, setNoPlanReminderResult] = useState<{ sent: number; failed: number; totalUsers: number } | null>(null);

  const noPlanReminderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-no-plan-reminder-broadcast");
      return res.json();
    },
    onSuccess: (data: any) => {
      setNoPlanReminderResult({ sent: data.sent, failed: data.failed, totalUsers: data.totalUsers });
      toast({
        title: "Subscription reminder sent",
        description: `Sent to ${data.sent} of ${data.totalUsers} non-active users.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Broadcast failed",
        description: err.message || "Could not send subscription reminder emails.",
        variant: "destructive",
      });
    },
  });

  const [droselAnnouncementResult, setDroselAnnouncementResult] = useState<{ sent: number; failed: number; totalUsers: number } | null>(null);

  const droselAnnouncementMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-drosel-announcement");
      return res.json();
    },
    onSuccess: (data: any) => {
      setDroselAnnouncementResult({ sent: data.sent, failed: data.failed, totalUsers: data.totalUsers });
      toast({
        title: "DROSEL announcement sent",
        description: `Sent to ${data.sent} of ${data.totalUsers} users.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Broadcast failed",
        description: err.message || "Could not send DROSEL announcement emails.",
        variant: "destructive",
      });
    },
  });

  const [recalcResult, setRecalcResult] = useState<any>(null);

  const recalcReferralsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/recalc-referral-wallets", {
        manualLinks: [
          { referrerEmail: "triple.u.fam@gmail.com", referredEmails: ["tina_ogbomo@yahoo.com", "ronkeomotola@gmail.com"] },
          { referrerEmail: "Cyrinaudochukwu28@gmail.com", referredEmails: ["triple.u.fam@gmail.com"], reassign: true },
          { referrerEmail: "ogunyoyeyemijoseph@gmail.com", referredEmails: ["deski5050@gmail.com"], reassign: true }
        ]
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setRecalcResult(data);
      toast({
        title: "Referral wallets updated",
        description: data.message || "All referral bonuses have been recalculated and credited.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
    },
    onError: (err: any) => {
      toast({
        title: "Recalculation failed",
        description: err.message || "Could not recalculate referral wallets.",
        variant: "destructive",
      });
    },
  });

  const { data: featureFlags, isLoading: flagsLoading } = useQuery<any[]>({
    queryKey: ['/api/feature-flags'],
    enabled: isAdmin,
  });

  const toggleFeatureFlag = useMutation({
    mutationFn: async ({ key, isEnabled }: { key: string; isEnabled: boolean }) => {
      const res = await apiRequest('PUT', `/api/feature-flags/${key}`, { isEnabled });
      const text = await res.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags'] });
      toast({ title: "Feature Flag Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const publishFeature = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest('POST', `/api/feature-flags/${key}/publish`);
      const text = await res.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags'] });
      toast({ title: "Feature Published", description: "Feature is now available to all users" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: withdrawalRequests, isLoading: withdrawalsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/withdrawal-requests'],
    enabled: isAdmin,
  });

  const approveWithdrawal = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote?: string }) => {
      const res = await apiRequest('POST', `/api/admin/withdrawal-requests/${id}/approve`, { adminNote });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscribers'] });
      toast({ title: "Withdrawal Approved", description: data.message });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectWithdrawal = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote?: string }) => {
      const res = await apiRequest('POST', `/api/admin/withdrawal-requests/${id}/reject`, { adminNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawal-requests'] });
      toast({ title: "Withdrawal Rejected", description: "The withdrawal request has been rejected." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pendingWithdrawals = useMemo(() => {
    return (withdrawalRequests || []).filter((w: any) => w.status === 'pending_approval');
  }, [withdrawalRequests]);

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('DELETE', `/api/admin/subscribers/${userId}`);
      const text = await res.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscribers'] });
      toast({ title: "User Removed", description: "User and all associated data have been deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data, isLoading, refetch, isFetching } = useQuery<{ subscribers: Subscriber[] }>({
    queryKey: ["/api/admin/subscribers"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const subscribers = data?.subscribers || [];

  const filtered = subscribers
    .filter((s) => {
      const matchesSearch =
        !search ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        s.lastName?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || s.subscriptionStatus === statusFilter;
      const matchesPlan =
        planFilter === "all" || s.subscriptionPlan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    })
    // Newest signups first so the user doesn't have to scroll to find them.
    // Anyone without a createdAt sinks to the bottom.
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });

  const totalSubscribers = subscribers.length;
  const activeCount = subscribers.filter(
    (s) => s.subscriptionStatus === "active" || s.subscriptionStatus === "trialing"
  ).length;
  const trialCount = subscribers.filter(
    (s) => s.subscriptionStatus === "trialing" || s.paymentSkipped
  ).length;
  const cancelledCount = subscribers.filter(
    (s) => s.subscriptionStatus === "canceled" || s.subscriptionStatus === "cancelled"
  ).length;

  const addonUsersCount = useMemo(() => {
    return subscribers.filter(s => (s.activeAddons?.length ?? 0) > 0 && !s.freeAddons).length;
  }, [subscribers]);

  const totalPaidAddons = useMemo(() => {
    return subscribers.reduce((sum, s) => {
      if (!s.freeAddons && (s.activeAddons?.length ?? 0) > 0) {
        return sum + s.activeAddons!.length;
      }
      return sum;
    }, 0);
  }, [subscribers]);

  const addonRevenue = useMemo(() => totalPaidAddons * ADDON_PRICE, [totalPaidAddons]);

  const planRevenue = useMemo(() => {
    return subscribers.reduce((sum, s) => sum + getSubscriberPlanRevenue(s), 0);
  }, [subscribers]);

  const totalRevenue = useMemo(() => planRevenue + addonRevenue, [planRevenue, addonRevenue]);

  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    subscribers.forEach((s) => {
      const plan = s.subscriptionPlan || "No Plan";
      counts[plan] = (counts[plan] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [subscribers]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    subscribers.forEach((s) => {
      const status = s.subscriptionStatus || "No Status";
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [subscribers]);

  const currencyDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    subscribers.forEach((s) => {
      const curr = s.currency || "GBP";
      counts[curr] = (counts[curr] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [subscribers]);

  const signupTrend = useMemo(() => {
    if (subscribers.length === 0) return [];
    const now = new Date();
    const grouped: Record<string, number> = {};

    if (timeRange === "daily") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        grouped[key] = 0;
      }
      subscribers.forEach((s) => {
        if (s.createdAt) {
          const key = new Date(s.createdAt).toISOString().split("T")[0];
          if (grouped[key] !== undefined) grouped[key]++;
        }
      });
      return Object.entries(grouped).map(([date, count]) => ({
        label: new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        signups: count,
      }));
    }

    if (timeRange === "weekly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split("T")[0];
        grouped[key] = 0;
      }
      subscribers.forEach((s) => {
        if (s.createdAt) {
          const d = new Date(s.createdAt);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toISOString().split("T")[0];
          if (grouped[key] !== undefined) grouped[key]++;
        }
      });
      return Object.entries(grouped).map(([date, count]) => ({
        label: `Wk ${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        signups: count,
      }));
    }

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      grouped[key] = 0;
    }
    subscribers.forEach((s) => {
      if (s.createdAt) {
        const d = new Date(s.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (grouped[key] !== undefined) grouped[key]++;
      }
    });
    return Object.entries(grouped).map(([date, count]) => ({
      label: new Date(date + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      signups: count,
    }));
  }, [subscribers, timeRange]);

  const revenueTrend = useMemo(() => {
    if (subscribers.length === 0) return [];
    const now = new Date();
    const grouped: Record<string, number> = {};

    if (timeRange === "daily") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        grouped[key] = 0;
      }
      subscribers.forEach((s) => {
        if (s.createdAt && s.subscriptionStatus === "active" && s.subscriptionPlan && !s.freeAccess) {
          const key = new Date(s.createdAt).toISOString().split("T")[0];
          if (grouped[key] !== undefined) grouped[key] += getSubscriberPlanRevenue(s);
        }
      });
    } else if (timeRange === "weekly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split("T")[0];
        grouped[key] = 0;
      }
      subscribers.forEach((s) => {
        if (s.createdAt && s.subscriptionStatus === "active" && s.subscriptionPlan && !s.freeAccess) {
          const d = new Date(s.createdAt);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toISOString().split("T")[0];
          if (grouped[key] !== undefined) grouped[key] += getSubscriberPlanRevenue(s);
        }
      });
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        grouped[key] = 0;
      }
      subscribers.forEach((s) => {
        if (s.createdAt && s.subscriptionStatus === "active" && s.subscriptionPlan && !s.freeAccess) {
          const d = new Date(s.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (grouped[key] !== undefined) grouped[key] += getSubscriberPlanRevenue(s);
        }
      });
    }

    return Object.entries(grouped).map(([date, amount]) => {
      let label = date;
      if (timeRange === "daily") {
        label = new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      } else if (timeRange === "weekly") {
        label = `Wk ${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      } else {
        label = new Date(date + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      }
      return { label, revenue: amount };
    });
  }, [subscribers, timeRange]);

  const revenueByPlan = useMemo(() => {
    const totals: Record<string, number> = {};
    subscribers.forEach((s) => {
      if (s.subscriptionStatus === "active" && s.subscriptionPlan && !s.freeAccess) {
        const rev = getSubscriberPlanRevenue(s);
        const label = s.billingInterval === 'year' ? `${s.subscriptionPlan} (Yearly)` : s.subscriptionPlan;
        totals[label] = (totals[label] || 0) + rev;
      }
    });
    if (addonRevenue > 0) {
      totals["Addons (Trending Products)"] = addonRevenue;
    }
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [subscribers, addonRevenue]);

  const uniquePlans = [...new Set(subscribers.map((s) => s.subscriptionPlan).filter(Boolean))] as string[];
  const uniqueStatuses = [...new Set(subscribers.map((s) => s.subscriptionStatus).filter(Boolean))] as string[];

  function getStatusBadge(status: string | null) {
    if (!status) return <Badge variant="outline">No Plan</Badge>;
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Trial</Badge>;
      case "canceled":
      case "cancelled":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelled</Badge>;
      case "past_due":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Past Due</Badge>;
      case "pending":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight" data-testid="text-admin-title">
            Subscribers Database
          </h2>
          <p className="text-muted-foreground mt-2">
            View all registered users, subscription analytics, and revenue insights
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-subscribers"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            downloadExcel(
              filtered.map((s) => ({
                Email: s.email || "",
                Name: [s.firstName, s.lastName].filter(Boolean).join(" ") || "",
                Plan: s.subscriptionPlan || "None",
                "Billing": s.billingInterval === 'year' ? 'Yearly' : 'Monthly',
                "Access Type": s.freeAccess ? "Free Access" : "Paid",
                "Plan Revenue (GBP)": s.freeAccess ? 0 : getSubscriberPlanRevenue(s),
                "Active Addons": (s.activeAddons?.length ?? 0) > 0 ? s.activeAddons!.map(a => a.addonId).join(", ") : "None",
                "Addon Revenue (GBP)": s.freeAddons ? 0 : (s.activeAddons?.length ?? 0) * ADDON_PRICE,
                "Total Revenue (GBP)": (s.freeAccess ? 0 : getSubscriberPlanRevenue(s)) + (s.freeAddons ? 0 : (s.activeAddons?.length ?? 0) * ADDON_PRICE),
                Status: s.subscriptionStatus || "None",
                Currency: s.currency || "GBP",
                "Joined Date": s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
                "Onboarding Done": s.onboardingCompleted ? "Yes" : "No",
                "Payment Skipped": s.paymentSkipped ? "Yes" : "No",
              })),
              "subscribers-report"
            );
          }}
          data-testid="button-export-all"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Full Report
        </Button>
        <Button
          variant={recalcResult ? "outline" : "default"}
          size="sm"
          onClick={() => {
            if (!recalcReferralsMutation.isPending && !recalcResult) {
              if (window.confirm(`Recalculate all referral wallets? This will mark paid referrals as active and credit 10% commission to each referrer's wallet. This cannot be undone.`)) {
                recalcReferralsMutation.mutate();
              }
            }
          }}
          disabled={recalcReferralsMutation.isPending || !!recalcResult}
          data-testid="button-recalc-referrals"
          className={recalcResult ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-50" : ""}
        >
          {recalcReferralsMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Recalculating...
            </>
          ) : recalcResult ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Wallets Updated
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4 mr-2" />
              Recalculate Referral Wallets
            </>
          )}
        </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card data-testid="card-total-subscribers">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubscribers}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-subscribers">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-green-500" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-trial-subscribers">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500" />
              Trial / Free
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{trialCount}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-cancelled-subscribers">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-500" />
              Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{cancelledCount}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-revenue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fc(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Plans: {fc(planRevenue)} + Addons: {fc(addonRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
          <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-2" data-testid="tab-subscribers">
            <Users className="w-4 h-4" />
            Subscribers
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2 relative" data-testid="tab-withdrawals">
            <Banknote className="w-4 h-4" />
            Withdrawals
            {pendingWithdrawals.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingWithdrawals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-2" data-testid="tab-revenue">
            <TrendingUp className="w-4 h-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="feature-flags" className="gap-2" data-testid="tab-feature-flags">
            <Shield className="w-4 h-4" />
            Feature Flags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
              <SelectTrigger className="w-[150px]" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const chartData = signupTrend.map((d) => ({
                  Period: d.label,
                  "New Signups": d.signups,
                }));
                downloadExcel(chartData, `signup-trend-${timeRange}`);
              }}
              data-testid="button-export-trend"
            >
              <Download className="w-4 h-4 mr-1" />
              Export Trend
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card data-testid="card-signup-trend">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Signup Trend ({timeRange === "daily" ? "Last 30 Days" : timeRange === "weekly" ? "Last 12 Weeks" : "Last 12 Months"})
                </CardTitle>
                <CardDescription>New user registrations over time</CardDescription>
              </CardHeader>
              <CardContent>
                {signupTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={signupTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" className="text-xs" angle={-45} textAnchor="end" height={60} />
                      <YAxis className="text-xs" allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="signups" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} name="Signups" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-plan-distribution">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5" />
                  Plan Distribution
                </CardTitle>
                <CardDescription>Subscribers by plan type</CardDescription>
              </CardHeader>
              <CardContent>
                {planDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={planDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {planDistribution.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-status-distribution">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5" />
                  Subscription Status
                </CardTitle>
                <CardDescription>Breakdown by subscription status</CardDescription>
              </CardHeader>
              <CardContent>
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {statusDistribution.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-currency-distribution">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  User Locations (by Currency)
                </CardTitle>
                <CardDescription>Geographic distribution of subscribers</CardDescription>
              </CardHeader>
              <CardContent>
                {currencyDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={currencyDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={50} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} name="Users" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscribers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>All Subscribers</CardTitle>
                  <CardDescription>{filtered.length} of {totalSubscribers} users</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 w-64"
                      data-testid="input-search-subscribers"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {uniqueStatuses.map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-plan-filter">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      {uniquePlans.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      downloadExcel(
                        filtered.map((s) => ({
                          Email: s.email || "",
                          Name: [s.firstName, s.lastName].filter(Boolean).join(" ") || "",
                          Plan: s.subscriptionPlan || "None",
                          "Billing": s.billingInterval === 'year' ? 'Yearly' : 'Monthly',
                          "Access Type": s.freeAccess ? "Free Access" : "Paid",
                          "Plan Revenue (GBP)": s.freeAccess ? 0 : getSubscriberPlanRevenue(s),
                          "Active Addons": (s.activeAddons?.length ?? 0) > 0 ? s.activeAddons!.map(a => a.addonId).join(", ") : "None",
                          "Addon Revenue (GBP)": s.freeAddons ? 0 : (s.activeAddons?.length ?? 0) * ADDON_PRICE,
                          Status: s.subscriptionStatus || "None",
                          Currency: s.currency || "GBP",
                          "Joined Date": s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
                          "Onboarding Done": s.onboardingCompleted ? "Yes" : "No",
                        })),
                        "subscribers"
                      );
                    }}
                    data-testid="button-export-subscribers"
                    title="Export to Excel"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No subscribers found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Plan Revenue</TableHead>
                        <TableHead>Addons</TableHead>
                        <TableHead>Referrals</TableHead>
                        <TableHead>Referral Link</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Onboarded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((subscriber) => {
                        const isExpanded = expandedRows.has(subscriber.id);
                        const refUsers = subscriber.referredUsers || [];
                        const activeRefCount = refUsers.filter((r) => r.status === 'active').length;
                        const toggleExpand = () => {
                          const next = new Set(expandedRows);
                          if (isExpanded) next.delete(subscriber.id);
                          else next.add(subscriber.id);
                          setExpandedRows(next);
                        };
                        return (
                          <Fragment key={subscriber.id}>
                            <TableRow data-testid={`row-subscriber-${subscriber.id}`} className={isExpanded ? "border-b-0" : ""}>
                              <TableCell className="w-8 pr-0">
                                {refUsers.length > 0 ? (
                                  <button onClick={toggleExpand} className="p-1 hover:bg-muted rounded" data-testid={`button-expand-${subscriber.id}`}>
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                ) : (
                                  <span className="w-4 h-4 inline-block" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setDetailSubscriber(subscriber)}
                                      className="font-medium text-left hover:underline hover:text-primary cursor-pointer"
                                      data-testid={`button-name-${subscriber.id}`}
                                    >
                                      {[subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || "\u2014"}
                                    </button>
                                    {subscriber.isFreelanceLister && (
                                      <span title="Freelance Lister" data-testid={`badge-lister-${subscriber.id}`}>
                                        <Briefcase className="w-4 h-4 text-[#285261]" />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-email-${subscriber.id}`}>
                                    {subscriber.email}
                                  </p>
                                  {subscriber.referredByEmail && (
                                    <p className="text-xs text-blue-500 mt-0.5">Referred by: {subscriber.referredByEmail}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell data-testid={`text-plan-${subscriber.id}`}>
                                <div className="flex items-center gap-2">
                                  {subscriber.subscriptionPlan || <span className="text-muted-foreground">None</span>}
                                  {subscriber.freeAccess && (
                                    <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px] px-1.5 py-0" data-testid={`badge-free-access-${subscriber.id}`}>Free Access</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {subscriber.freeAccess
                                  ? <span className="text-purple-600 font-medium">Free</span>
                                  : subscriber.subscriptionPlan && PLAN_PRICES[subscriber.subscriptionPlan]
                                    ? <div>
                                        <span>{fc(getSubscriberPlanRevenue(subscriber))}</span>
                                        {subscriber.billingInterval === 'year' && (
                                          <span className="text-[10px] text-green-600 ml-1">/yr</span>
                                        )}
                                        {subscriber.billingInterval !== 'year' && (
                                          <span className="text-[10px] text-muted-foreground ml-1">/mo</span>
                                        )}
                                      </div>
                                    : <span className="text-muted-foreground">{fc(0)}</span>}
                              </TableCell>
                              <TableCell data-testid={`text-addons-${subscriber.id}`}>
                                {(subscriber.activeAddons?.length ?? 0) > 0 ? (
                                  <div className="flex items-center gap-1.5">
                                    <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px] px-1.5 py-0">
                                      {subscriber.activeAddons!.length} addon{subscriber.activeAddons!.length > 1 ? "s" : ""}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {subscriber.freeAddons ? "(Free)" : `+${fc(subscriber.activeAddons!.length * ADDON_PRICE)}`}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell data-testid={`text-referrals-${subscriber.id}`}>
                                {refUsers.length > 0 ? (
                                  <button onClick={toggleExpand} className="flex items-center gap-1.5 hover:underline">
                                    <Badge className={activeRefCount > 0 ? "bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0" : "bg-orange-500/10 text-orange-600 border-orange-500/20 text-[10px] px-1.5 py-0"}>
                                      {activeRefCount}/{refUsers.length} active
                                    </Badge>
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell data-testid={`text-referral-link-${subscriber.id}`}>
                                {subscriber.referralLink ? (
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[160px]" title={subscriber.referralLink}>
                                      ?ref={subscriber.referralCode}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(subscriber.referralLink);
                                        toast({ title: "Copied", description: "Referral link copied to clipboard" });
                                      }}
                                      className="p-1 hover:bg-muted rounded shrink-0"
                                      data-testid={`button-copy-ref-link-${subscriber.id}`}
                                    >
                                      <Copy className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell data-testid={`text-status-${subscriber.id}`}>
                                {getStatusBadge(subscriber.subscriptionStatus)}
                              </TableCell>
                              <TableCell>{subscriber.currency || "GBP"}</TableCell>
                              <TableCell>
                                {subscriber.createdAt ? new Date(subscriber.createdAt).toLocaleDateString() : "\u2014"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {subscriber.onboardingCompleted ? (
                                    <Badge variant="outline" className="text-green-600 border-green-500/20">Yes</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">No</Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    data-testid={`button-delete-user-${subscriber.id}`}
                                    disabled={deleteUserMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Remove ${subscriber.email}? This will cancel their subscription and delete all their data permanently.`)) {
                                        deleteUserMutation.mutate(subscriber.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && refUsers.map((ref) => (
                              <Fragment key={`ref-${ref.id}`}>
                                <TableRow
                                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                                  onClick={() => {
                                    const next = new Set(expandedRefs);
                                    if (expandedRefs.has(ref.id)) next.delete(ref.id);
                                    else next.add(ref.id);
                                    setExpandedRefs(next);
                                  }}
                                  data-testid={`row-referral-${ref.id}`}
                                >
                                  <TableCell className="w-8 pr-0 pl-8">
                                    {expandedRefs.has(ref.id) ? (
                                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{ref.referredName || "—"}</p>
                                      <p className="text-xs text-muted-foreground">{ref.referredEmail}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{ref.subscriptionPlan || "—"}</TableCell>
                                  <TableCell>{ref.commission > 0 ? fc(ref.commission) : "—"}</TableCell>
                                  <TableCell>—</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={ref.status === 'active'
                                      ? "bg-green-500/10 text-green-600 border-green-200"
                                      : ref.status === 'pending'
                                      ? "bg-yellow-500/10 text-yellow-600 border-yellow-200"
                                      : "bg-gray-100 text-gray-600"}>
                                      {ref.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{getStatusBadge(ref.subscriptionStatus)}</TableCell>
                                  <TableCell>GBP</TableCell>
                                  <TableCell className="text-sm">
                                    {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : "—"}
                                  </TableCell>
                                  <TableCell>—</TableCell>
                                </TableRow>
                                {expandedRefs.has(ref.id) && (
                                  <TableRow key={`ref-${ref.id}-details`}>
                                    <TableCell colSpan={11} className="bg-muted/20 p-4">
                                      <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                            <Users className="w-4 h-4" /> Referred User
                                          </h4>
                                          <div className="text-sm space-y-1">
                                            <p className="font-medium">{ref.referredName || "—"}</p>
                                            <p>{ref.referredEmail}</p>
                                            <p>Plan: {ref.subscriptionPlan || "None"}</p>
                                            <p>Subscription: {ref.subscriptionStatus || "None"}</p>
                                          </div>
                                        </div>
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                            <DollarSign className="w-4 h-4" /> Referral Details
                                          </h4>
                                          <div className="text-sm space-y-1">
                                            <p>Referral Status: <span className="font-medium">{ref.status}</span></p>
                                            <p>Commission: <span className="font-medium">{ref.status === 'active' && ref.commission > 0 ? fc(ref.commission) : "—"}</span></p>
                                            <p>Total Earnings: <span className="font-medium">{fc(Number(ref.totalEarnings))}</span></p>
                                            <p>Referred: {ref.createdAt ? new Date(ref.createdAt).toLocaleString() : "—"}</p>
                                          </div>
                                        </div>
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                            <Link2 className="w-4 h-4" /> Referrer Info
                                          </h4>
                                          <div className="text-sm space-y-1">
                                            <p>Referrer: <span className="font-medium">{[subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || "—"}</span></p>
                                            <p>Referral Code: <span className="font-mono">{subscriber.referralCode || "—"}</span></p>
                                            {subscriber.referralLink && (
                                              <div className="flex items-center gap-1 mt-1">
                                                <p className="font-mono text-xs text-muted-foreground break-all">{subscriber.referralLink}</p>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(subscriber.referralLink);
                                                    toast({ title: "Copied", description: "Referral link copied" });
                                                  }}
                                                  className="p-1 hover:bg-muted rounded shrink-0"
                                                  data-testid={`button-copy-referral-${subscriber.id}-${ref.id}`}
                                                >
                                                  <Copy className="w-3 h-3 text-muted-foreground" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            ))}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={!!detailSubscriber} onOpenChange={(open) => !open && setDetailSubscriber(null)}>
            <DialogContent data-testid="dialog-subscriber-details">
              <DialogHeader>
                <DialogTitle>
                  {detailSubscriber
                    ? [detailSubscriber.firstName, detailSubscriber.lastName].filter(Boolean).join(" ") || "User details"
                    : "User details"}
                </DialogTitle>
                <DialogDescription>Contact and account details for this user.</DialogDescription>
              </DialogHeader>
              {detailSubscriber && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email address</p>
                      <p className="font-medium break-all" data-testid="text-detail-email">{detailSubscriber.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone number</p>
                      <p className="font-medium" data-testid="text-detail-phone">{detailSubscriber.phone || "Not set"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="font-medium" data-testid="text-detail-joined">
                        {detailSubscriber.createdAt ? new Date(detailSubscriber.createdAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                Referral Withdrawal Requests
                {pendingWithdrawals.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingWithdrawals.length} Pending</Badge>
                )}
              </CardTitle>
              <CardDescription>Review and approve referral withdrawal requests. Approved funds will be deducted from the user's referral balance and sent via Stripe.</CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !withdrawalRequests || withdrawalRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No withdrawal requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Payout Account</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalRequests.map((w: any) => (
                        <TableRow key={w.id} className={w.status === 'pending_approval' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''} data-testid={`withdrawal-row-${w.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{w.userName || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{w.userEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-red-600">{fc(Math.abs(Number(w.amount)))}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {w.withdrawMethod === 'bank' ? 'Bank Transfer' : 'Card'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {w.hasConnectAccount ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Stripe Connected
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                                <X className="w-3 h-3 mr-1" />
                                Not Set Up
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{fc(Number(w.referralBalance))}</span>
                          </TableCell>
                          <TableCell>
                            {w.status === 'pending_approval' ? (
                              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            ) : w.status === 'approved' ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                <Check className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            ) : w.status === 'rejected' ? (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                                <X className="w-3 h-3 mr-1" />
                                Rejected
                              </Badge>
                            ) : w.status === 'payout_failed' ? (
                              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                                <X className="w-3 h-3 mr-1" />
                                Payout Failed
                              </Badge>
                            ) : (
                              <Badge variant="outline">{w.status}</Badge>
                            )}
                            {w.adminNote && (
                              <p className="text-xs text-muted-foreground mt-1">{w.adminNote}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p>{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '-'}</p>
                              <p className="text-muted-foreground">{w.createdAt ? new Date(w.createdAt).toLocaleTimeString() : ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {w.status === 'pending_approval' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  disabled={approveWithdrawal.isPending}
                                  onClick={() => {
                                    if (window.confirm(`Approve withdrawal of ${fc(Math.abs(Number(w.amount)))} for ${w.userEmail}? This will deduct from their referral balance and initiate the Stripe payout.`)) {
                                      approveWithdrawal.mutate({ id: w.id });
                                    }
                                  }}
                                  data-testid={`approve-withdrawal-${w.id}`}
                                >
                                  {approveWithdrawal.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={rejectWithdrawal.isPending}
                                  onClick={() => {
                                    const reason = window.prompt(`Reject withdrawal for ${w.userEmail}? Enter reason (optional):`);
                                    if (reason !== null) {
                                      rejectWithdrawal.mutate({ id: w.id, adminNote: reason || undefined });
                                    }
                                  }}
                                  data-testid={`reject-withdrawal-${w.id}`}
                                >
                                  {rejectWithdrawal.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                                  Reject
                                </Button>
                              </div>
                            )}
                            {w.status === 'approved' && w.processedAt && (
                              <p className="text-xs text-green-600">
                                Processed {new Date(w.processedAt).toLocaleDateString()}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
              <SelectTrigger className="w-[150px]" data-testid="select-revenue-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const revenueData = revenueTrend.map((d) => ({
                  Period: d.label,
                  "Revenue (GBP)": d.revenue,
                }));
                const planData = revenueByPlan.map((d) => ({
                  Plan: d.name,
                  "Total Revenue (GBP)": d.value,
                }));
                downloadExcel([...revenueData, {}, { Period: "--- Revenue by Plan ---", "Revenue (GBP)": "" as any }, ...planData.map(p => ({ Period: p.Plan, "Revenue (GBP)": p["Total Revenue (GBP)"] }))], `revenue-report-${timeRange}`);
              }}
              data-testid="button-export-revenue"
            >
              <Download className="w-4 h-4 mr-1" />
              Export Revenue
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card data-testid="card-revenue-trend">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Revenue Trend
                </CardTitle>
                <CardDescription>Subscription revenue from new signups over time</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" className="text-xs" angle={-45} textAnchor="end" height={60} />
                      <YAxis className="text-xs" tickFormatter={(v) => fc(v)} />
                      <Tooltip formatter={(value: any) => [fc(value), "Revenue"]} />
                      <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-revenue-by-plan">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5" />
                  Revenue by Plan
                </CardTitle>
                <CardDescription>Revenue breakdown by subscription plan (monthly + yearly)</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueByPlan.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={revenueByPlan} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${fc(value)}`}>
                        {revenueByPlan.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => fc(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No revenue data yet</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(PLAN_PRICES).map(([plan, price]) => {
                  const planSubs = subscribers.filter(s => s.subscriptionPlan === plan && s.subscriptionStatus === "active" && !s.freeAccess);
                  const monthlySubs = planSubs.filter(s => s.billingInterval !== 'year');
                  const yearlySubs = planSubs.filter(s => s.billingInterval === 'year');
                  const yearlyTotal = Math.round(price * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100;
                  const totalPlanRev = (monthlySubs.length * price) + (yearlySubs.length * yearlyTotal);
                  return (
                    <div key={plan} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`revenue-plan-${plan}`}>
                      <div>
                        <p className="font-medium text-sm">{plan}</p>
                        <p className="text-xs text-muted-foreground">
                          {planSubs.length} active subscriber{planSubs.length !== 1 ? "s" : ""}
                          {yearlySubs.length > 0 && ` (${yearlySubs.length} yearly)`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{fc(totalPlanRev)}</p>
                        <p className="text-xs text-muted-foreground">
                          {monthlySubs.length > 0 && `${monthlySubs.length}×${fc(price)}/mo`}
                          {monthlySubs.length > 0 && yearlySubs.length > 0 && " + "}
                          {yearlySubs.length > 0 && `${yearlySubs.length}×${fc(yearlyTotal)}/yr`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between p-4 border rounded-lg border-indigo-500/30 bg-indigo-500/5" data-testid="revenue-addons">
                  <div>
                    <p className="font-medium text-sm">Addons (Trending Products)</p>
                    <p className="text-xs text-muted-foreground">{totalPaidAddons} addon{totalPaidAddons !== 1 ? "s" : ""} ({addonUsersCount} user{addonUsersCount !== 1 ? "s" : ""}) × {fc(ADDON_PRICE)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-indigo-600">{fc(addonRevenue)}</p>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feature-flags" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Feature Flags
              </CardTitle>
              <CardDescription>Control feature rollout. Enable features for admin testing, then publish to make them available for all users.</CardDescription>
            </CardHeader>
            <CardContent>
              {flagsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : featureFlags && featureFlags.length > 0 ? (
                <div className="space-y-4">
                  {featureFlags.map((flag: any) => (
                    <div key={flag.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`flag-${flag.featureKey}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{flag.name}</h4>
                          {flag.adminOnly && <Badge variant="outline" className="text-xs">Admin Only</Badge>}
                          {flag.isEnabled && !flag.adminOnly && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Published</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{flag.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Enabled</span>
                          <Switch
                            checked={flag.isEnabled}
                            onCheckedChange={(checked) => toggleFeatureFlag.mutate({ key: flag.featureKey, isEnabled: checked })}
                            className="cursor-pointer hover:brightness-125 hover:scale-110 transition-all duration-150"
                            data-testid={`switch-flag-${flag.featureKey}`}
                          />
                        </div>
                        {flag.isEnabled && flag.adminOnly && (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`Publish "${flag.name}" to all users? This will make the feature visible and accessible to everyone.`)) {
                                publishFeature.mutate(flag.featureKey);
                              }
                            }}
                            disabled={publishFeature.isPending}
                            data-testid={`button-publish-${flag.featureKey}`}
                          >
                            {publishFeature.isPending ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Globe className="w-4 h-4 mr-1" />
                            )}
                            Publish to All Users
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-8 text-muted-foreground cursor-pointer group transition-all duration-200 hover:text-foreground"
                  onClick={() => toggleFeatureFlag.mutate({ key: 'auto_fulfillment', isEnabled: true })}
                  data-testid="button-enable-empty-flag"
                >
                  <ToggleLeft className="w-10 h-10 mx-auto mb-3 opacity-50 group-hover:opacity-100 group-hover:text-primary group-hover:scale-110 transition-all duration-200" />
                  <p className="group-hover:text-foreground transition-colors duration-200">No feature flags configured</p>
                  <p className="text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">Click to enable</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

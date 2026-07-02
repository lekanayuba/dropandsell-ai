import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar } from "@/components/Sidebar";
import { SupportChat } from "@/components/SupportChat";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useAuth } from "@/hooks/use-auth";
import { useReferralHandler } from "@/hooks/use-referral";
import { useFeatureAccess } from "@/hooks/use-feature-flags";
import { Loader2 } from "lucide-react";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ExtensionBar } from "@/components/ExtensionBar";
import { ListingResolvedBanner } from "@/components/ListingResolvedBanner";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { DomTranslator } from "@/i18n/DomTranslator";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Stores from "@/pages/Stores";
import Vendors from "@/pages/Vendors";
import Inventory from "@/pages/Inventory";
import Analytics from "@/pages/Analytics";
import Wallet from "@/pages/Wallet";
import Subscription from "@/pages/Subscription";
import Automation from "@/pages/Automation";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import ExtensionLink from "@/pages/ExtensionLink";
import FAQ from "@/pages/FAQ";
import Policies from "@/pages/Policies";
import AcceptPolicies from "@/pages/AcceptPolicies";
import VerifyEmail from "@/pages/VerifyEmail";
import PaymentSetup from "@/pages/PaymentSetup";
import InstallApp from "@/pages/InstallApp";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Referrals from "@/pages/Referrals";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import EbayCallback from "@/pages/EbayCallback";
import TikTokCallback from "@/pages/TikTokCallback";
import ShopifyCallback from "@/pages/ShopifyCallback";
import ResetPassword from "@/pages/ResetPassword";
import AdminHub from "@/pages/AdminHub";
import AdminSubscribers from "@/pages/AdminSubscribers";
import AdminGlobalVero from "@/pages/AdminGlobalVero";
import AdminPaypalPayouts from "@/pages/AdminPaypalPayouts";
import Addons from "@/pages/Addons";
import Suggestions from "@/pages/Suggestions";
import Orders from "@/pages/Orders";
import Fulfillment from "@/pages/Fulfillment";
import GettingStarted from "@/pages/GettingStarted";
import AmazonCallback from "@/pages/AmazonCallback";
import DropAndSell from "@/pages/DropAndSell";
import CollectPhone from "@/pages/CollectPhone";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  useReferralHandler();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Check if email is verified
  if (!user?.emailVerified) {
    return <VerifyEmail />;
  }

  // Check if policies are accepted
  if (!user?.policiesAccepted) {
    return <AcceptPolicies />;
  }

  // Check if onboarding is completed
  if (!user?.onboardingCompleted) {
    return <Onboarding />;
  }

  // Require a phone number before using the app (admins exempt)
  if (!user?.phone && user?.isAdmin !== "true") {
    return <CollectPhone />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body selection:bg-primary/20">
      <Sidebar />
      <main className="flex-1 lg:ml-[260px] transition-all duration-300 overflow-y-auto">
        <ExtensionBar />
        <ListingResolvedBanner />
        <div className="p-5 lg:p-8">
          <Component />
        </div>
      </main>
      <ScrollToTop />
    </div>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  useReferralHandler();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (!user?.emailVerified) {
    return <VerifyEmail />;
  }

  const isAdmin = user?.isAdmin === "true" || user?.email === "dropandsellauth@gmail.com";
  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body selection:bg-primary/20">
      <Sidebar />
      <main className="flex-1 lg:ml-[260px] transition-all duration-300 overflow-y-auto">
        <ExtensionBar />
        <ListingResolvedBanner />
        <div className="p-5 lg:p-8">
          <Component />
        </div>
      </main>
      <ScrollToTop />
    </div>
  );
}

function FeatureGatedRoute({ component: Component, featureKey }: { component: React.ComponentType; featureKey: string }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { hasAccess, isLoading: flagLoading } = useFeatureAccess(featureKey);
  useReferralHandler();

  if (isLoading || flagLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (!user?.emailVerified) {
    return <VerifyEmail />;
  }

  if (!user?.policiesAccepted) {
    return <AcceptPolicies />;
  }

  if (!user?.onboardingCompleted) {
    return <Onboarding />;
  }

  // Require a phone number before using the app (admins exempt)
  if (!user?.phone && user?.isAdmin !== "true") {
    return <CollectPhone />;
  }

  if (!hasAccess) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body selection:bg-primary/20">
      <Sidebar />
      <main className="flex-1 lg:ml-[260px] transition-all duration-300 overflow-y-auto">
        <ExtensionBar />
        <ListingResolvedBanner />
        <div className="p-5 lg:p-8">
          <Component />
        </div>
      </main>
      <ScrollToTop />
    </div>
  );
}

function PublicPolicyRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-5 lg:p-8">
        <Component />
      </div>
    );
  }

  if (user?.emailVerified && user?.policiesAccepted && user?.onboardingCompleted) {
    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground font-body selection:bg-primary/20">
        <Sidebar />
        <main className="flex-1 lg:ml-[260px] transition-all duration-300 overflow-y-auto">
          <ExtensionBar />
          <div className="p-5 lg:p-8">
            <Component />
          </div>
        </main>
        <ScrollToTop />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-5 lg:p-8">
      <Component />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/api/login" component={() => {
        window.location.href = "/api/login";
        return null;
      }} />
      <Route path="/reset-password" component={() => <ResetPassword />} />
      <Route path="/verify-email" component={() => {
        return <VerifyEmail />;
      }} />
      <Route path="/policies" component={() => <PublicPolicyRoute component={Policies} />} />
      <Route path="/faq" component={() => <ProtectedRoute component={FAQ} />} />
      <Route path="/onboarding" component={() => {
        return <Onboarding />;
      }} />
      <Route path="/payment-setup" component={() => <PaymentSetup />} />
      <Route path="/payment-success" component={() => <PaymentSuccess />} />
      <Route path="/install-app" component={() => <InstallApp />} />
      <Route path="/extension-link" component={() => <ProtectedRoute component={ExtensionLink} />} />
      <Route path="/signup" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/ebay-callback" component={() => <ProtectedRoute component={EbayCallback} />} />
      <Route path="/tiktok-callback" component={() => <ProtectedRoute component={TikTokCallback} />} />
      <Route path="/shopify-callback" component={() => <ProtectedRoute component={ShopifyCallback} />} />
      <Route path="/amazon-callback" component={() => <ProtectedRoute component={AmazonCallback} />} />
      <Route path="/stores" component={() => <ProtectedRoute component={Stores} />} />
      <Route path="/vendors" component={() => <ProtectedRoute component={Vendors} />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={Inventory} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
      <Route path="/wallet" component={() => <ProtectedRoute component={Wallet} />} />
      <Route path="/subscription" component={() => <ProtectedRoute component={Subscription} />} />
      <Route path="/automation" component={() => <ProtectedRoute component={Automation} />} />
      <Route path="/referrals" component={() => <ProtectedRoute component={Referrals} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/addons" component={() => <ProtectedRoute component={Addons} />} />
      <Route path="/orders" component={() => <FeatureGatedRoute component={Orders} featureKey="auto_fulfillment" />} />
      <Route path="/fulfillment" component={() => <FeatureGatedRoute component={Fulfillment} featureKey="auto_fulfillment" />} />
      <Route path="/drop-and-sell" component={() => <FeatureGatedRoute component={DropAndSell} featureKey="drop_and_sell" />} />
      <Route path="/suggestions" component={() => <ProtectedRoute component={Suggestions} />} />
      <Route path="/getting-started" component={() => <ProtectedRoute component={GettingStarted} />} />
      <Route path="/admin" component={() => <AdminRoute component={AdminHub} />} />
      <Route path="/admin/subscribers" component={() => <AdminRoute component={AdminSubscribers} />} />
      <Route path="/admin/global-vero" component={() => <AdminRoute component={AdminGlobalVero} />} />
      <Route path="/admin/paypal-payouts" component={() => <AdminRoute component={AdminPaypalPayouts} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DomTranslator />
        <Toaster />
        <Router />
        <SupportChat />
        <WhatsAppButton />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;

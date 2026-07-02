import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/AppHeader";
import { SupportChat } from "@/components/SupportChat";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/use-auth";
import { useReferralHandler } from "@/hooks/use-referral";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Stores from "@/pages/Stores";
import Vendors from "@/pages/Vendors";
import Inventory from "@/pages/Inventory";
import Orders from "@/pages/Orders";
import Wallet from "@/pages/Wallet";
import Subscription from "@/pages/Subscription";
import Automation from "@/pages/Automation";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import FAQ from "@/pages/FAQ";
import Policies from "@/pages/Policies";
import AcceptPolicies from "@/pages/AcceptPolicies";
import VerifyEmail from "@/pages/VerifyEmail";
import PaymentSetup from "@/pages/PaymentSetup";
import InstallApp from "@/pages/InstallApp";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Referrals from "@/pages/Referrals";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import AddonCatalog from "@/pages/AddonCatalog";
import TemuIntegration from "@/pages/TemuIntegration";
import AdminSupport from "@/pages/AdminSupport";
import AdminDashboard from "@/pages/AdminDashboard";
import Getstarted from "@/pages/Getstarted";
import GettingStarted from "@/pages/GettingStarted";
import BulkEdit from "@/pages/BulkEdit";
import ShippingProfiles from "@/pages/ShippingProfiles";
import Customers from "@/pages/Customers";
import Manual from "@/pages/Manual";
import DrosellAutoListing from "@/pages/DrosellAutoListing";
import Suggestions from "@/pages/Suggestions";
import ProfilePage from "@/pages/Profile";
import SubscribersDB from "@/pages/SubscribersDB";
import GlobalVASO from "@/pages/GlobalVASO";
import TrackOrder from "@/pages/TrackOrder";

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

  return (
    <div className="min-h-screen w-full bg-muted/40 font-body text-foreground selection:bg-primary/20">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-72">
        <AppHeader />
        <ErrorBoundary>
          <main className="flex-1 p-4 sm:px-6 sm:py-6 md:p-8"><Component /></main>
        </ErrorBoundary>
      </div>
    </div>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();

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

  const isAdmin =
    (user as any)?.role === "admin" ||
    (user as any)?.email === "dropandsellauth@gmail.com";

  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen w-full bg-muted/40 font-body text-foreground selection:bg-primary/20">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-72">
        <AppHeader />
        <ErrorBoundary>
          <main className="flex-1 p-4 sm:px-6 sm:py-6 md:p-8"><Component /></main>
        </ErrorBoundary>
      </div>
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
      <div className="min-h-screen bg-background p-6 lg:p-10">
        <Component />
      </div>
    );
  }

  if (user?.emailVerified && user?.policiesAccepted && user?.onboardingCompleted) {
    return (
      <div className="min-h-screen w-full bg-muted/40 font-body text-foreground selection:bg-primary/20">
        <Sidebar />
        <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8 lg:ml-72">
          <Component />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
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
      <Route path="/track" component={() => <TrackOrder />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/analytics" component={() => <Redirect to="/getstarted" />} />
      <Route path="/getstarted" component={() => <ProtectedRoute component={Getstarted} />} />
      <Route path="/getting-started" component={() => <ProtectedRoute component={GettingStarted} />} />
      <Route path="/stores" component={() => <ProtectedRoute component={Stores} />} />
      <Route path="/vendors" component={() => <ProtectedRoute component={Vendors} />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={Inventory} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} />} />
      <Route path="/bulk-edit" component={() => <ProtectedRoute component={BulkEdit} />} />
      <Route path="/shipping" component={() => <ProtectedRoute component={ShippingProfiles} />} />
      <Route path="/wallet" component={() => <ProtectedRoute component={Wallet} />} />
      <Route path="/subscription" component={() => <ProtectedRoute component={Subscription} />} />
      <Route path="/automation" component={() => <ProtectedRoute component={Automation} />} />
      <Route path="/referrals" component={() => <ProtectedRoute component={Referrals} />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} />} />
      <Route path="/addon-catalog" component={() => <ProtectedRoute component={AddonCatalog} />} />
      <Route path="/temu" component={() => <ProtectedRoute component={TemuIntegration} />} />      
      <Route path="/admin/support" component={() => <AdminRoute component={AdminSupport} />} />
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/manual" component={() => <ProtectedRoute component={Manual} />} />
      <Route path="/drosell-auto-listing" component={() => <ProtectedRoute component={DrosellAutoListing} />} />
      <Route path="/suggestions" component={() => <ProtectedRoute component={Suggestions} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route path="/subscribers-db" component={() => <AdminRoute component={SubscribersDB} />} />
      <Route path="/global-vaso" component={() => <AdminRoute component={GlobalVASO} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
      <SupportChat />
    </QueryClientProvider>
  );
}

export default App;

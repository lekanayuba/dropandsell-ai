import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

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

  return (
    <div className="flex min-h-screen bg-background text-foreground font-body selection:bg-primary/20">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-6 lg:p-10 transition-all duration-300">
        <Component />
      </main>
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
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/stores" component={() => <ProtectedRoute component={Stores} />} />
      <Route path="/vendors" component={() => <ProtectedRoute component={Vendors} />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={Inventory} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} />} />
      <Route path="/wallet" component={() => <ProtectedRoute component={Wallet} />} />
      <Route path="/subscription" component={() => <ProtectedRoute component={Subscription} />} />
      <Route path="/automation" component={() => <ProtectedRoute component={Automation} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;

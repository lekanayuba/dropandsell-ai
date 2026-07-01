import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, USER_QUERY_KEY } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const authMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.role !== "admin") {
        toast({ title: "Access Denied", description: "Only administrators can access this area.", variant: "destructive" });
        return;
      }
      toast({ title: "Welcome Admin", description: "Redirecting to dashboard..." });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Invalid credentials", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authMutation.mutate();
  };

  return (
    <div className="min-h-screen w-full flex">
      <div className="hidden lg:flex flex-col w-1/2 bg-slate-950 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[100px]" />
        <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
          <div className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            Admin Panel
          </div>
          <div className="space-y-8 max-w-lg">
            <h1 className="font-display text-5xl font-bold leading-tight">
              Administrator access only.
            </h1>
            <p className="text-lg text-slate-300">
              Manage platform settings, users, integrations, and monitor system health.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            &copy; 2024 DropandSell AI Inc. All rights reserved.
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-amber-500" />
              </div>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Admin Login</h2>
            <p className="text-muted-foreground">Sign in with your admin credentials</p>
          </div>

          <Card className="border-border/50 shadow-xl shadow-amber-500/5">
            <CardContent className="pt-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
                  disabled={authMutation.isPending}
                >
                  {authMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In as Admin
                </Button>
              </form>

              <div className="mt-6 text-center">
                <a href="/" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
                  Back to client login
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
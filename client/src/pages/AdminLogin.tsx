import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, Shield, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { USER_QUERY_KEY } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setMounted(true); }, []);

  const authMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Invalid credentials");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.user?.role !== "admin") {
        toast({ title: "Access Denied", description: "Only administrators can access this area.", variant: "destructive" });
        return;
      }
      toast({ title: "Welcome Admin", description: "Redirecting to dashboard..." });
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
      window.location.href = "/admin";
    },
    onError: (error: any) => {
      toast({ title: "Authentication Failed", description: error.message || "Invalid credentials", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authMutation.mutate();
  };

  return (
    <div className="min-h-screen w-full flex bg-black relative overflow-hidden selection:bg-amber-500/30">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-600/5" />
      
      {/* Glow orbs */}
      <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-20%] right-[10%] w-[500px] h-[500px] rounded-full bg-amber-600/8 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[40%] right-[30%] w-[300px] h-[300px] rounded-full bg-amber-400/5 blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-[2px] w-[2px] rounded-full bg-amber-400/30"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}

      <div className="relative z-10 w-full flex items-center justify-center p-4 sm:p-8">
        <div className={`w-full max-w-[420px] transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center gap-3 mb-6">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 animate-in zoom-in-50 duration-500">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Panel</h1>
            <p className="text-sm text-zinc-400 mt-1.5">Sign in to manage your platform</p>
          </div>

          {/* Login Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-amber-600/20 rounded-2xl blur-xl" />
            <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-8 shadow-2xl">
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-zinc-300 text-sm font-medium">Email</Label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-amber-600/10 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 bg-zinc-800/50 border-zinc-700/60 text-white placeholder:text-zinc-500 focus:border-amber-500/50 focus:ring-amber-500/20 focus-visible:ring-amber-500/20 rounded-lg transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="admin-password" className="text-zinc-300 text-sm font-medium">Password</Label>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-amber-600/10 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
                      <Input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-12 bg-zinc-800/50 border-zinc-700/60 text-white placeholder:text-zinc-500 focus:border-amber-500/50 focus:ring-amber-500/20 focus-visible:ring-amber-500/20 rounded-lg transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-300 rounded-xl"
                  disabled={authMutation.isPending}
                >
                  {authMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-zinc-800/60 text-center">
                <a href="/" className="text-sm text-zinc-500 hover:text-amber-400 transition-colors">
                  Back to client portal
                </a>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-600 mt-8">
            &copy; {new Date().getFullYear()} DropandSell AI. All rights reserved.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-10px); opacity: 0.4; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

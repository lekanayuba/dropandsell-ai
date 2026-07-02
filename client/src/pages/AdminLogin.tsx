import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, User, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Admin login failed");
      }

      toast({
        title: "Welcome, Admin",
        description: "You have been signed in to the admin area.",
      });

      await refetch();
      window.location.href = "/admin";
    } catch (error: any) {
      toast({
        title: "Access denied",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "hsl(200 50% 10%)" }}
    >
      <div className="absolute top-[-15%] left-[-5%] w-[450px] h-[450px] rounded-full bg-teal-400/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-8%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[110px]" />

      <div className="w-full max-w-md relative z-10 space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-teal-400/15 border border-teal-400/30 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-teal-300" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white" data-testid="text-admin-title">
              Admin Portal
            </h1>
            <p className="text-sm text-white/50">
              Restricted access — authorized staff only
            </p>
          </div>
        </div>

        <Card className="border-white/10 bg-white/[0.03] backdrop-blur shadow-2xl">
          <CardContent className="pt-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-username" className="text-white/80">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="admin-username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    required
                    data-testid="input-admin-username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-white/80">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    required
                    data-testid="input-admin-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    data-testid="button-toggle-admin-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white"
                disabled={isLoading}
                data-testid="button-admin-login"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in to Admin
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="text-xs text-white/40 hover:text-white/70 inline-flex items-center gap-1"
                data-testid="link-back-to-client-login"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to customer login
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/25">
          © {new Date().getFullYear()} DropandSell Automation App
        </p>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function Login() {
  const features = [
    "Multi-channel inventory sync",
    "Automated order fulfillment",
    "Supplier management",
    "Real-time analytics",
    "Secure wallet & transactions"
  ];

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex flex-col w-1/2 bg-slate-950 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-purple-500/20 blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
          <div className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <div className="w-3 h-3 bg-primary rounded-full" />
            </div>
            DropandSell AI
          </div>

          <div className="space-y-8 max-w-lg">
            <h1 className="font-display text-5xl font-bold leading-tight">
              Scale your dropshipping empire with automation.
            </h1>
            <p className="text-lg text-slate-300">
              Manage all your stores, vendors, and orders from one unified dashboard. Stop manual work and start scaling.
            </p>
            
            <div className="space-y-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-slate-200">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-sm text-slate-500">
            © 2024 DropandSell AI Inc. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Panel - Login */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-display text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your account to continue</p>
          </div>

          <Card className="border-border/50 shadow-xl shadow-primary/5">
            <CardContent className="pt-6 pb-6">
              <Button 
                className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                onClick={() => window.location.href = "/api/login"}
              >
                Sign in with Replit
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              
              <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  By clicking continue, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

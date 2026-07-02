import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Mail, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import dropandSellLogo from "@assets/Drop_1.jpg_1775119096004.jpeg";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const { toast } = useToast();
  const { refetch } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin 
        ? { email, password }
        : { email, password, firstName, lastName };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      toast({
        title: isLogin ? "Welcome back!" : "Account created!",
        description: isLogin 
          ? "You have been logged in successfully." 
          : "Please check your email to verify your account.",
      });

      await refetch();
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setForgotEmailSent(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      <div className="hidden lg:flex flex-col w-1/2 relative overflow-hidden" style={{ background: 'hsl(200 50% 14%)' }}>
        <div className="absolute top-[-15%] left-[-5%] w-[450px] h-[450px] rounded-full bg-teal-400/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-8%] w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={dropandSellLogo} alt="DropandSell Automation App" className="h-11 w-11 rounded-lg object-contain" style={{ filter: 'brightness(1.1)' }} data-testid="img-login-logo" />
              <span className="font-display text-xl font-bold tracking-tight">DropandSell</span>
            </div>
            <LanguageSwitcher variant="login" />
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="font-display text-4xl font-extrabold leading-[1.15] tracking-tight">
              {t('hero_title')}
            </h1>
            <p className="text-[15px] text-white/60 leading-relaxed">
              {t('hero_desc')}
            </p>
            
            <div className="space-y-3 pt-2">
              {[t('feature_1'), t('feature_2'), t('feature_3'), t('feature_4'), t('feature_5')].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-teal-400/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <span className="text-sm text-white/75">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/30">
            {t('copyright')}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="lg:hidden absolute top-4 right-4">
          <LanguageSwitcher variant="compact" />
        </div>
        <div className="w-full max-w-md space-y-8">
          {showForgotPassword ? (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  {t('reset_password')}
                </h2>
                <p className="text-muted-foreground">
                  {forgotEmailSent
                    ? t('check_email')
                    : t('reset_desc')}
                </p>
              </div>

              <Card className="border-border/50 shadow-xl shadow-primary/5">
                <CardContent className="pt-6 pb-6">
                  {forgotEmailSent ? (
                    <div className="text-center space-y-4">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                      <p className="text-sm text-muted-foreground">
                        {t('reset_sent_desc')} <strong>{forgotEmail}</strong>, {t('reset_sent_desc2')}
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotEmailSent(false);
                          setForgotEmail("");
                        }}
                        className="text-sm"
                        data-testid="button-back-to-login"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('back_to_signin')}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgotEmail">{t('email')}</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="forgotEmail"
                            type="email"
                            placeholder="you@example.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="pl-10"
                            required
                            data-testid="input-forgot-email"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                        disabled={isLoading}
                        data-testid="button-send-reset-link"
                      >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('send_reset')}
                      </Button>
                    </form>
                  )}

                  {!forgotEmailSent && (
                    <div className="mt-6 text-center">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotEmail("");
                        }}
                        className="text-sm"
                        data-testid="button-back-to-login"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('back_to_signin')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  {isLogin ? t('welcome_back') : t('create_account')}
                </h2>
                <p className="text-muted-foreground">
                  {isLogin ? t('sign_in_desc') : t('sign_up_desc')}
                </p>
              </div>

              <Card className="border-border/50 shadow-xl shadow-primary/5">
                <CardContent className="pt-6 pb-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">{t('first_name')}</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="firstName"
                              type="text"
                              placeholder={t('first_name')}
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="pl-10"
                              data-testid="input-first-name"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">{t('last_name')}</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="lastName"
                              type="text"
                              placeholder={t('last_name')}
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="pl-10"
                              data-testid="input-last-name"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">{t('email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type={isLogin ? "text" : "email"}
                          autoComplete="username"
                          placeholder={isLogin ? "you@example.com or username" : "you@example.com"}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">{t('password')}</Label>
                        {isLogin && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowForgotPassword(true);
                              setForgotEmail(email);
                            }}
                            className="text-xs text-primary hover:text-primary/80 font-medium"
                            data-testid="link-forgot-password"
                          >
                            {t('forgot_password')}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder={isLogin ? "Enter your password" : "At least 8 characters"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                          minLength={8}
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-password-visibility"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button 
                      type="submit"
                      className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/15 hover:shadow-primary/25 transition-all"
                      disabled={isLoading}
                      data-testid="button-submit"
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isLogin ? t('sign_in') : t('sign_up')}
                    </Button>
                  </form>
                  
                  <div className="mt-6 text-center space-y-4">
                    <Button
                      variant="ghost"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-sm"
                      data-testid="button-toggle-auth"
                    >
                      {isLogin 
                        ? t('no_account')
                        : t('have_account')}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground">
                      {t('terms')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

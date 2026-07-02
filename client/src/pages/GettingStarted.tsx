import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  UserPlus,
  Mail,
  ShieldCheck,
  BookOpen,
  Download,
  Plug,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Chrome,
  Store,
  Package,
  ArrowRight,
  Settings,
  Globe,
  Puzzle,
  Key,
  Link as LinkIcon,
  MonitorSmartphone,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface StepData {
  id: number;
  title: string;
  icon: React.ReactNode;
  summary: string;
  details: React.ReactNode;
  actionLabel?: string;
  actionLink?: string;
}

export default function GettingStarted() {
  const { user } = useAuth();
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const completedSteps = new Set<number>();
  if (user) completedSteps.add(1);
  if (user?.emailVerified) completedSteps.add(2);
  if (user?.policiesAccepted) completedSteps.add(3);
  if (user?.onboardingCompleted) completedSteps.add(4);

  const totalTrackableSteps = 4;
  const progress = (completedSteps.size / totalTrackableSteps) * 100;

  const steps: StepData[] = [
    {
      id: 1,
      title: "Create Your Account",
      icon: <UserPlus className="w-5 h-5" />,
      summary: "Sign up with your name, email address, and a secure password to get started.",
      details: (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                Visit the Signup Page
              </h4>
              <p className="text-sm text-muted-foreground">
                Navigate to the DropandSell website and click on the <strong>"Sign Up"</strong> tab on the login page.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                Fill in Your Details
              </h4>
              <p className="text-sm text-muted-foreground">
                Enter your <strong>First Name</strong>, <strong>Last Name</strong>, <strong>Email</strong>, and choose a <strong>Password</strong> (minimum 8 characters).
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                Referral Code (Optional)
              </h4>
              <p className="text-sm text-muted-foreground">
                If you were referred by another user, enter their <strong>referral code</strong> to link your account. This helps both you and the referrer earn rewards.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                Submit & Continue
              </h4>
              <p className="text-sm text-muted-foreground">
                Click <strong>"Create Account"</strong>. Your account will be created instantly and you'll be logged in automatically.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: "Verify Your Email",
      icon: <Mail className="w-5 h-5" />,
      summary: "Check your inbox for a verification email and click the link to confirm your address.",
      details: (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                Check Your Inbox
              </h4>
              <p className="text-sm text-muted-foreground">
                After signing up, a verification email is sent to the address you used. Check your <strong>inbox</strong> and <strong>spam/junk folder</strong>.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                Click the Verification Link
              </h4>
              <p className="text-sm text-muted-foreground">
                Open the email from DropandSell and click the <strong>"Verify Email"</strong> button or link. This confirms your email address is valid.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                Didn't Receive It?
              </h4>
              <p className="text-sm text-muted-foreground">
                If you don't see the email after a few minutes, click <strong>"Resend Verification Email"</strong> on the verification page to get a new one.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                Email Verified
              </h4>
              <p className="text-sm text-muted-foreground">
                Once verified, you'll be redirected to the next step automatically. Your account is now secured with a confirmed email.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: "Accept Policies",
      icon: <ShieldCheck className="w-5 h-5" />,
      summary: "Review and accept the platform policies including Privacy, Terms of Service, and Data Protection.",
      details: (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Before using the platform, you'll need to review and agree to the following policies:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Privacy Policy</p>
                  <p className="text-xs text-muted-foreground">How we collect, use, and protect your data</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Terms of Service</p>
                  <p className="text-xs text-muted-foreground">Rules and conditions for using the platform</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Data Protection</p>
                  <p className="text-xs text-muted-foreground">GDPR compliance and data handling practices</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Direct Debit Policy</p>
                  <p className="text-xs text-muted-foreground">Payment processing terms and conditions</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Check each policy box and click <strong>"Continue"</strong> to proceed. You can review these policies anytime from the Policies page.
            </p>
          </div>
        </div>
      ),
      actionLabel: "View Policies",
      actionLink: "/policies",
    },
    {
      id: 4,
      title: "Complete Onboarding Walkthrough",
      icon: <BookOpen className="w-5 h-5" />,
      summary: "Go through the 9-step guided tour to learn the platform features and set your preferred currency.",
      details: (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-3">
              The onboarding walkthrough introduces you to all the key features of DropandSell:
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Store className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">Connecting marketplace stores</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Globe className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">Adding product vendors</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Package className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">Importing products</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <MonitorSmartphone className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">Browser extension setup</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Puzzle className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">Setting pricing rules</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Settings className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">Choosing your currency</span>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <p className="text-sm">
                <strong>Important:</strong> During this step, you'll select your <strong>preferred currency</strong> (GBP, USD, EUR, etc.). All prices, wallet balances, and analytics will display in your chosen currency throughout the platform.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      title: "Install the Browser Extension from the Chrome Web Store",
      icon: <Chrome className="w-5 h-5" />,
      summary: "One-click install from the Chrome Web Store. No downloads, no zip files, no developer mode.",
      actionLabel: "Open Chrome Web Store",
      actionLink: "https://chromewebstore.google.com/detail/cmhenhnoglkmfimnoidoaofnhkjnhdnk",
      details: (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                Open the Chrome Web Store listing
              </h4>
              <p className="text-sm text-muted-foreground">
                Click the <strong>"Open Chrome Web Store"</strong> button below to visit the official DropandSell extension page in Google Chrome.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                Click "Add to Chrome"
              </h4>
              <p className="text-sm text-muted-foreground">
                On the extension page, click the blue <strong>"Add to Chrome"</strong> button, then confirm <strong>"Add extension"</strong> in the popup. Chrome will install it in seconds.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                Pin the icon
              </h4>
              <p className="text-sm text-muted-foreground">
                Click the puzzle-piece icon in your browser toolbar, find <strong>DropandSell</strong>, and click the pin icon next to it. The DropandSell icon will now stay visible in your toolbar.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                Updates happen automatically
              </h4>
              <p className="text-sm text-muted-foreground">
                Chrome will silently keep your extension up to date in the background — you'll never need to reinstall or update manually.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <Chrome className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Works in <strong>Google Chrome</strong> and Chromium-based browsers (Edge, Brave, Opera). On Edge or Brave, the Chrome Web Store install flow works the same way.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 6,
      title: "Sign in to the Extension",
      icon: <Plug className="w-5 h-5" />,
      summary: "One click. No URL, no code, no API key — the extension links to your account automatically.",
      actionLabel: "Open Extension Guide",
      actionLink: "/settings",
      details: (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                Open the extension
              </h4>
              <p className="text-sm text-muted-foreground">
                Click the <strong>DropandSell icon</strong> in your browser toolbar. The extension popup will open.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                Click "Sign in with DropandSell"
              </h4>
              <p className="text-sm text-muted-foreground">
                A new tab will open. If you're already signed in to your DropandSell dashboard, the extension will link to your account automatically — no need to type anything.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                Done — start importing
              </h4>
              <p className="text-sm text-muted-foreground">
                The extension popup will refresh and show your account is connected. Visit any supported vendor page (Amazon, AliExpress, eBay, Walmart, Etsy, Shein, Temu, B&amp;Q, Dunelm and more) and click the DropandSell icon to import a product in one click.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">?</span>
                What about the URL code and API key?
              </h4>
              <p className="text-sm text-muted-foreground">
                You no longer need them. They still exist on the Settings page under <strong>Advanced</strong> in case you want to set things up manually, but new subscribers should always use the one-click sign-in above.
              </p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
            <p className="text-sm">
              <strong>That's it!</strong> Once connected, the extension stays signed in. Click the DropandSell icon on any product page to add it to your inventory in seconds.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6" data-testid="page-getting-started">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Getting Started</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Follow these steps to set up your DropandSell account and start selling
        </p>
      </div>

      <Card data-testid="card-progress">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Setup Progress</span>
            <span className="text-sm text-muted-foreground">{completedSteps.size} of {totalTrackableSteps} account steps completed</span>
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-setup" />
          <div className="flex items-center gap-2 mt-3">
            {completedSteps.size >= totalTrackableSteps ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-200" data-testid="badge-complete">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Account Setup Complete — Install the extension and click "Sign in with DropandSell"
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground" data-testid="badge-in-progress">
                Step {Math.min(completedSteps.size + 1, totalTrackableSteps)} — {steps[Math.min(completedSteps.size, totalTrackableSteps - 1)].title}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3" data-testid="section-steps">
        {steps.map((step) => {
          const isComplete = completedSteps.has(step.id);
          const isOpen = expandedStep === step.id;
          const isManualStep = step.id > totalTrackableSteps;
          const isCurrent = !isManualStep && !isComplete && (step.id === 1 || completedSteps.has(step.id - 1));

          return (
            <Card
              key={step.id}
              className={`transition-all ${isCurrent ? "ring-2 ring-primary/30 border-primary/50" : ""} ${isComplete ? "opacity-80" : ""}`}
              data-testid={`card-step-${step.id}`}
            >
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedStep(isOpen ? null : step.id)}
                data-testid={`button-toggle-step-${step.id}`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                  isComplete
                    ? "bg-green-500/10 text-green-600"
                    : isCurrent
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isComplete ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm sm:text-base">{step.title}</h3>
                    {isComplete && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">
                        Complete
                      </Badge>
                    )}
                    {isCurrent && !isComplete && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]">
                        Current Step
                      </Badge>
                    )}
                    {isManualStep && completedSteps.size >= totalTrackableSteps && (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200 text-[10px]">
                        Action Needed
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{step.summary}</p>
                </div>
                <div className="shrink-0">
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isOpen && (
                <CardContent className="pt-0 pb-4 px-4" data-testid={`content-step-${step.id}`}>
                  <div className="ml-14 space-y-4">
                    {step.details}
                    {step.actionLink && (
                      step.actionLink.startsWith("http") ? (
                        <a
                          href={step.actionLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`link-action-step-${step.id}`}
                        >
                          <Button variant="outline" size="sm" className="gap-2" data-testid={`button-action-step-${step.id}`}>
                            {step.actionLabel}
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </a>
                      ) : (
                        <Link href={step.actionLink}>
                          <Button variant="outline" size="sm" className="gap-2" data-testid={`button-action-step-${step.id}`}>
                            {step.actionLabel}
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      )
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card data-testid="card-whats-next">
        <CardHeader>
          <CardTitle className="text-lg">What's Next?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Link href="/stores">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" data-testid="link-stores">
                <Store className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Connect Stores</p>
                  <p className="text-xs text-muted-foreground">Link your eBay, Shopify, Amazon, or TikTok Shop</p>
                </div>
              </div>
            </Link>
            <Link href="/vendors">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" data-testid="link-vendors">
                <Globe className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Add Vendors</p>
                  <p className="text-xs text-muted-foreground">Set up your product suppliers</p>
                </div>
              </div>
            </Link>
            <Link href="/inventory">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" data-testid="link-inventory">
                <Package className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Import Products</p>
                  <p className="text-xs text-muted-foreground">Start building your product catalog</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
